import ipaddress
import re
import time
import httpx
from datetime import datetime, timezone
from typing import Any

# Dangerous / Internal IP blocks to prevent SSRF
PRIVATE_NETWORKS = [
    ipaddress.ip_network('127.0.0.0/8'),
    ipaddress.ip_network('10.0.0.0/8'),
    ipaddress.ip_network('172.16.0.0/12'),
    ipaddress.ip_network('192.168.0.0/16'),
    ipaddress.ip_network('169.254.0.0/16'),
    ipaddress.ip_network('100.64.0.0/10'),
    ipaddress.ip_network('0.0.0.0/8'),
    ipaddress.ip_network('::1/128'),
    ipaddress.ip_network('fc00::/7'),
    ipaddress.ip_network('fe80::/10'),
]

DOMAIN_REGEX = re.compile(
    r'^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$'
)

def validate_target(target: str) -> dict[str, Any]:
    clean = target.strip().lower()
    # Strip URL schemes if user pasted http(s)://
    if '://' in clean:
        clean = clean.split('://', 1)[1]
    if '/' in clean:
        clean = clean.split('/', 1)[0]
    if ':' in clean and not clean.startswith('['):
        # Strip port
        clean = clean.split(':', 1)[0]

    if not clean:
        raise ValueError('Target cannot be empty.')

    # Check IP
    try:
        ip_obj = ipaddress.ip_address(clean)
        for net in PRIVATE_NETWORKS:
            if ip_obj in net:
                raise ValueError(f'Access to private/internal network resource ({clean}) is prohibited.')
        return {'type': 'ip', 'target': str(ip_obj), 'ip_version': ip_obj.version}
    except ValueError as e:
        if 'is prohibited' in str(e):
            raise

    # Check Domain
    if clean == 'localhost' or clean.endswith('.local') or clean.endswith('.internal'):
        raise ValueError('Access to internal/loopback hostnames is prohibited.')

    if not DOMAIN_REGEX.match(clean):
        raise ValueError(f'Invalid domain name or IP address: "{target}".')

    return {'type': 'domain', 'target': clean}


async def query_doh_record(client: httpx.AsyncClient, name: str, record_type: str) -> list[dict[str, Any]]:
    # Use Cloudflare DoH with fallback to Google DoH
    records = []
    urls = [
        ('https://cloudflare-dns.com/dns-query', {'name': name, 'type': record_type}),
        ('https://dns.google/resolve', {'name': name, 'type': record_type})
    ]
    for url, params in urls:
        try:
            resp = await client.get(url, params=params, headers={'accept': 'application/dns-json'})
            if resp.status_code == 200:
                data = resp.json()
                answers = data.get('Answer', [])
                for ans in answers:
                    records.append({
                        'name': ans.get('name', name).rstrip('.'),
                        'type': record_type,
                        'ttl': ans.get('TTL', 300),
                        'data': str(ans.get('data', '')).strip('"')
                    })
                break
        except Exception:
            continue
    return records


async def gather_dns_records(client: httpx.AsyncClient, domain: str) -> dict[str, Any]:
    types_to_query = ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME', 'SOA']
    results: dict[str, list[dict[str, Any]]] = {}
    all_records = []
    resolved_ips = []

    for t in types_to_query:
        ans = await query_doh_record(client, domain, t)
        results[t] = ans
        all_records.extend(ans)
        if t in ('A', 'AAAA'):
            for r in ans:
                ip_str = r['data'].split()[0] if ' ' in r['data'] else r['data']
                try:
                    ipaddress.ip_address(ip_str)
                    if ip_str not in resolved_ips:
                        resolved_ips.append(ip_str)
                except ValueError:
                    pass

    # Check DMARC
    dmarc_ans = await query_doh_record(client, f'_dmarc.{domain}', 'TXT')
    results['DMARC'] = dmarc_ans

    # Check DNSSEC status
    dnssec_enabled = False
    try:
        r = await client.get('https://cloudflare-dns.com/dns-query', params={'name': domain, 'type': 'A', 'do': '1'}, headers={'accept': 'application/dns-json'})
        if r.status_code == 200:
            dnssec_enabled = bool(r.json().get('AD', False))
    except Exception:
        pass

    return {
        'records_by_type': results,
        'all_records': all_records,
        'resolved_ips': resolved_ips,
        'dnssec_enabled': dnssec_enabled
    }


async def gather_rdap_info(client: httpx.AsyncClient, target: str, is_ip: bool) -> dict[str, Any]:
    url = f'https://rdap.org/ip/{target}' if is_ip else f'https://rdap.org/domain/{target}'
    try:
        resp = await client.get(url)
        if resp.status_code == 200:
            data = resp.json()
            registrar = 'Unknown'
            # Look for registrar in entities
            for ent in data.get('entities', []):
                roles = ent.get('roles', [])
                if 'registrar' in roles or 'registrant' in roles:
                    vcard = ent.get('vcardArray', [])
                    if len(vcard) > 1:
                        for row in vcard[1]:
                            if isinstance(row, list) and len(row) > 3 and row[0] == 'fn':
                                registrar = row[3]
                                break

            # Events
            events = {ev.get('eventAction'): ev.get('eventDate') for ev in data.get('events', [])}
            nameservers = [ns.get('ldhName', '') for ns in data.get('nameservers', [])]

            return {
                'handle': data.get('handle', target),
                'registrar': registrar,
                'status': data.get('status', []),
                'registration_date': events.get('registration'),
                'expiration_date': events.get('expiration'),
                'last_changed': events.get('last changed'),
                'nameservers': [ns for ns in nameservers if ns],
                'raw_status': 200
            }
        else:
            return {'status': f'RDAP returned HTTP {resp.status_code}', 'raw_status': resp.status_code}
    except Exception as e:
        return {'status': f'RDAP query failed: {str(e)}', 'raw_status': 500}


async def gather_ip_intel(client: httpx.AsyncClient, ip: str) -> dict[str, Any]:
    # Query ipwhois.app or ipapi.co
    try:
        resp = await client.get(f'https://ipwhois.app/json/{ip}')
        if resp.status_code == 200:
            data = resp.json()
            if data.get('success', True):
                return {
                    'ip': ip,
                    'asn': data.get('asn', 'Unknown'),
                    'as_org': data.get('org', data.get('isp', 'Unknown')),
                    'country': data.get('country', 'Unknown'),
                    'country_code': data.get('country_code', ''),
                    'city': data.get('city', 'Unknown'),
                    'region': data.get('region', 'Unknown'),
                    'isp': data.get('isp', 'Unknown'),
                    'latitude': data.get('latitude'),
                    'longitude': data.get('longitude')
                }
    except Exception:
        pass

    # Fallback to ipapi.co
    try:
        resp = await client.get(f'https://ipapi.co/{ip}/json/')
        if resp.status_code == 200:
            data = resp.json()
            return {
                'ip': ip,
                'asn': data.get('asn', 'Unknown'),
                'as_org': data.get('org', 'Unknown'),
                'country': data.get('country_name', 'Unknown'),
                'country_code': data.get('country_code', ''),
                'city': data.get('city', 'Unknown'),
                'region': data.get('region', 'Unknown'),
                'isp': data.get('org', 'Unknown'),
                'latitude': data.get('latitude'),
                'longitude': data.get('longitude')
            }
    except Exception:
        pass

    return {
        'ip': ip,
        'asn': 'N/A',
        'as_org': 'Unknown ASN',
        'country': 'Unknown',
        'country_code': '',
        'city': 'Unknown',
        'region': 'Unknown',
        'isp': 'Unknown'
    }


async def gather_certificates(client: httpx.AsyncClient, domain: str) -> list[dict[str, Any]]:
    # Query Certificate Transparency via crt.sh
    certs = []
    seen = set()
    try:
        resp = await client.get('https://crt.sh/', params={'q': f'%.{domain}', 'output': 'json'})
        if resp.status_code == 200:
            items = resp.json()
            # crt.sh can return thousands, limit to latest 30 unique
            for item in items[:40]:
                cn = item.get('common_name', '')
                issuer = item.get('issuer_name', 'Unknown')
                not_before = item.get('not_before', '')
                not_after = item.get('not_after', '')
                serial = str(item.get('serial_number', ''))
                key = (cn, serial)
                if key not in seen:
                    seen.add(key)
                    certs.append({
                        'common_name': cn,
                        'issuer': issuer.split('CN=')[-1].split(',')[0] if 'CN=' in issuer else issuer[:50],
                        'not_before': not_before,
                        'not_after': not_after,
                        'serial_number': serial,
                        'logged_at': item.get('entry_timestamp', '')
                    })
    except Exception:
        pass
    return certs[:20]


async def gather_subdomains(client: httpx.AsyncClient, domain: str, certs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    discovered = set()
    # 1. From certificates Common Names and SANs
    for c in certs:
        cn = c.get('common_name', '').lower()
        if cn.endswith(f'.{domain}') and not cn.startswith('*'):
            discovered.add(cn)

    # 2. HackerTarget passive hostsearch
    try:
        r = await client.get(f'https://api.hackertarget.com/hostsearch/?q={domain}')
        if r.status_code == 200 and 'error' not in r.text.lower():
            for line in r.text.splitlines():
                parts = line.split(',')
                if parts and parts[0].strip().endswith(f'.{domain}'):
                    discovered.add(parts[0].strip().lower())
    except Exception:
        pass

    # 3. Known common subdomains probe via DoH
    common_sub_prefixes = ['www', 'mail', 'api', 'dev', 'app', 'vpn', 'admin', 'auth', 'staging', 'portal', 'cloud', 'git', 'cdn']
    for p in common_sub_prefixes:
        sub = f'{p}.{domain}'
        if sub not in discovered:
            ans = await query_doh_record(client, sub, 'A')
            if ans:
                discovered.add(sub)

    # Resolve IPs for discovered subdomains
    subdomain_results = []
    for sub in list(discovered)[:25]:
        ans = await query_doh_record(client, sub, 'A')
        ips = [a['data'] for a in ans if a.get('data')]
        subdomain_results.append({
            'subdomain': sub,
            'ips': ips,
            'status': 'Active' if ips else 'Unresolved'
        })

    return subdomain_results


async def check_threat_intelligence(client: httpx.AsyncClient, target: str) -> dict[str, Any]:
    findings = []
    listed = False
    details = {}
    try:
        # Check URLhaus
        resp = await client.post('https://urlhaus-api.abuse.ch/v1/host/', data={'host': target})
        if resp.status_code == 200:
            data = resp.json()
            if data.get('query_status') == 'ok':
                listed = True
                threat_count = data.get('url_count', 0)
                details = {
                    'urlhaus_url_count': threat_count,
                    'first_seen': data.get('firstseen'),
                    'blacklists': data.get('blacklists', {})
                }
                findings.append({
                    'title': 'Active Malware/Phishing Flag in Threat Feed',
                    'severity': 'Critical',
                    'source': 'URLhaus Threat Intelligence',
                    'evidence': f'Host is indexed on URLhaus with {threat_count} reported malicious payloads.',
                    'remediation': 'Investigate associated infrastructure immediately, isolate affected endpoints, and revoke exposed tokens.'
                })
    except Exception:
        pass

    return {
        'threat_detected': listed,
        'details': details,
        'findings': findings
    }


def evaluate_security_findings(
    target: str,
    target_type: str,
    dns_data: dict[str, Any],
    rdap_data: dict[str, Any],
    certs: list[dict[str, Any]],
    subdomains: list[dict[str, Any]],
    threat_intel: dict[str, Any]
) -> list[dict[str, Any]]:
    findings = list(threat_intel.get('findings', []))

    if target_type == 'domain':
        records = dns_data.get('records_by_type', {})

        # 1. DMARC Verification
        dmarc_records = records.get('DMARC', [])
        if not dmarc_records:
            findings.append({
                'title': 'Missing DMARC Policy Record',
                'severity': 'High',
                'source': 'DNS Analysis (_dmarc)',
                'evidence': f'No TXT record was discovered at _dmarc.{target}.',
                'remediation': f'Publish a DMARC policy (e.g., "v=DMARC1; p=reject; rua=mailto:dmarc@{target}") to prevent email spoofing.'
            })
        else:
            dmarc_txt = dmarc_records[0].get('data', '')
            if 'p=none' in dmarc_txt:
                findings.append({
                    'title': 'Permissive DMARC Policy (p=none)',
                    'severity': 'Medium',
                    'source': 'DMARC Analysis',
                    'evidence': f'DMARC policy found with p=none: "{dmarc_txt}"',
                    'remediation': 'Transition DMARC policy from p=none to p=quarantine or p=reject to actively block spoofed emails.'
                })

        # 2. SPF Record Verification
        txt_records = records.get('TXT', [])
        has_spf = any('v=spf1' in r.get('data', '') for r in txt_records)
        if not has_spf:
            findings.append({
                'title': 'Missing SPF Email Authentication',
                'severity': 'Medium',
                'source': 'DNS Analysis (TXT)',
                'evidence': 'No SPF (v=spf1) record published in apex DNS TXT records.',
                'remediation': 'Publish an SPF record defining authorized outbound mail servers to prevent unauthorized domain usage.'
            })

        # 3. DNSSEC Verification
        if not dns_data.get('dnssec_enabled'):
            findings.append({
                'title': 'DNSSEC Not Enabled',
                'severity': 'Low',
                'source': 'DNS-over-HTTPS Authenticated Data Flag',
                'evidence': 'Authoritative DNS response lacked the AD (Authenticated Data) flag for DNSSEC validation.',
                'remediation': 'Enable DNSSEC signing at your domain registrar and DNS provider to protect against DNS cache poisoning.'
            })

        # 4. Domain Expiration Check
        exp_date_str = rdap_data.get('expiration_date')
        if exp_date_str:
            try:
                # Remove timezone Z or parse ISO
                clean_exp = exp_date_str.replace('Z', '+00:00')
                exp_dt = datetime.fromisoformat(clean_exp)
                days_left = (exp_dt - datetime.now(timezone.utc)).days
                if days_left < 0:
                    findings.append({
                        'title': 'Domain Registration Has Expired',
                        'severity': 'Critical',
                        'source': 'RDAP Registration Records',
                        'evidence': f'Domain expired {abs(days_left)} days ago on {exp_date_str}.',
                        'remediation': 'Renew domain registration immediately to prevent domain takeover.'
                    })
                elif days_left <= 30:
                    findings.append({
                        'title': 'Domain Registration Expiring Soon',
                        'severity': 'High',
                        'source': 'RDAP Registration Records',
                        'evidence': f'Domain registration expires in {days_left} days on {exp_date_str}.',
                        'remediation': 'Renew domain registration to avoid unexpected service disruption.'
                    })
            except Exception:
                pass

        # 5. Exposed Subdomains
        staging_subdomains = [s['subdomain'] for s in subdomains if any(k in s['subdomain'] for k in ('dev.', 'staging.', 'test.', 'admin.', 'vpn.'))]
        if staging_subdomains:
            findings.append({
                'title': 'Potentially Sensitive Infrastructure Exposed in Subdomains',
                'severity': 'Medium',
                'source': 'Passive Subdomain Enumeration',
                'evidence': f'Discovered public endpoints that may expose internal services: {", ".join(staging_subdomains[:4])}',
                'remediation': 'Ensure staging, administrative, and development endpoints require strong authentication and IP whitelisting or are restricted to VPN.'
            })

        # 6. Certificate Expiration
        if certs:
            latest_cert = certs[0]
            not_after = latest_cert.get('not_after')
            if not_after:
                try:
                    cert_dt = datetime.fromisoformat(not_after.replace('Z', '+00:00'))
                    days_cert = (cert_dt - datetime.now(timezone.utc)).days
                    if days_cert < 0:
                        findings.append({
                            'title': 'Active TLS Certificate Expired',
                            'severity': 'High',
                            'source': 'Certificate Transparency Logs',
                            'evidence': f'Certificate for {latest_cert.get("common_name")} expired {abs(days_cert)} days ago.',
                            'remediation': 'Reissue and deploy an active SSL/TLS certificate.'
                        })
                    elif days_cert <= 15:
                        findings.append({
                            'title': 'TLS Certificate Expiring Imminently',
                            'severity': 'Medium',
                            'source': 'Certificate Transparency Logs',
                            'evidence': f'Certificate for {latest_cert.get("common_name")} expires in {days_cert} days.',
                            'remediation': 'Renew and replace SSL/TLS certificate before expiration.'
                        })
                except Exception:
                    pass

    return findings


def build_interactive_graph(
    target: str,
    target_type: str,
    dns_data: dict[str, Any],
    ip_intel_map: dict[str, dict[str, Any]],
    certs: list[dict[str, Any]],
    subdomains: list[dict[str, Any]],
    findings: list[dict[str, Any]]
) -> dict[str, Any]:
    nodes: dict[str, dict[str, Any]] = {}
    edges: dict[str, dict[str, Any]] = {}

    target_id = f'target:{target}'
    nodes[target_id] = {
        'data': {
            'id': target_id,
            'label': target,
            'type': 'Domain' if target_type == 'domain' else 'IP',
            'category': 'Target',
            'detail': f'Root Target ({target_type.upper()})'
        }
    }

    # Add Resolved IPs
    for ip in dns_data.get('resolved_ips', []):
        ip_id = f'ip:{ip}'
        intel = ip_intel_map.get(ip, {})
        country = intel.get('country', 'Unknown')
        nodes[ip_id] = {
            'data': {
                'id': ip_id,
                'label': ip,
                'type': 'IP',
                'category': 'Infrastructure',
                'detail': f'IP: {ip} | {intel.get("isp", "ISP")} | {country}',
                'asn': intel.get('asn'),
                'country': country
            }
        }
        edge_id = f'{target_id}->{ip_id}:resolves_to'
        edges[edge_id] = {
            'data': {
                'id': edge_id,
                'source': target_id,
                'target': ip_id,
                'label': 'resolves_to'
            }
        }

        # Add ASN node
        asn = intel.get('asn')
        if asn and asn != 'N/A':
            asn_id = f'asn:{asn}'
            if asn_id not in nodes:
                nodes[asn_id] = {
                    'data': {
                        'id': asn_id,
                        'label': f'ASN {asn}',
                        'type': 'ASN',
                        'category': 'Network',
                        'detail': f'{intel.get("as_org", "Autonomous System")}'
                    }
                }
            asn_edge = f'{ip_id}->{asn_id}:announced_by'
            edges[asn_edge] = {
                'data': {
                    'id': asn_edge,
                    'source': ip_id,
                    'target': asn_id,
                    'label': 'announced_by'
                }
            }

    # Add Discovered Subdomains
    for s in subdomains[:15]:
        sub = s['subdomain']
        sub_id = f'sub:{sub}'
        nodes[sub_id] = {
            'data': {
                'id': sub_id,
                'label': sub,
                'type': 'Subdomain',
                'category': 'Asset',
                'detail': f'Active Subdomain | IPs: {", ".join(s.get("ips", []))}'
            }
        }
        edge_id = f'{sub_id}->{target_id}:subdomain_of'
        edges[edge_id] = {
            'data': {
                'id': edge_id,
                'source': sub_id,
                'target': target_id,
                'label': 'subdomain_of'
            }
        }
        # Link to its IPs if resolved
        for sub_ip in s.get('ips', []):
            sub_ip_id = f'ip:{sub_ip}'
            if sub_ip_id in nodes:
                sub_ip_edge = f'{sub_id}->{sub_ip_id}:resolves_to'
                edges[sub_ip_edge] = {
                    'data': {
                        'id': sub_ip_edge,
                        'source': sub_id,
                        'target': sub_ip_id,
                        'label': 'resolves_to'
                    }
                }

    # Add Certificate Nodes
    for idx, c in enumerate(certs[:8]):
        cert_id = f'cert:{c.get("serial_number", idx)}'
        nodes[cert_id] = {
            'data': {
                'id': cert_id,
                'label': f'Cert: {c.get("issuer", "TLS Issuer")}',
                'type': 'Certificate',
                'category': 'Security',
                'detail': f'Common Name: {c.get("common_name")} | Valid to: {c.get("not_after", "N/A")}'
            }
        }
        edge_id = f'{target_id}->{cert_id}:secured_by'
        edges[edge_id] = {
            'data': {
                'id': edge_id,
                'source': target_id,
                'target': cert_id,
                'label': 'secured_by'
            }
        }

    # Add Findings Nodes
    for idx, f in enumerate(findings[:6]):
        finding_id = f'finding:{idx}'
        nodes[finding_id] = {
            'data': {
                'id': finding_id,
                'label': f['title'][:32],
                'type': 'SecurityFinding',
                'category': 'Vulnerability',
                'severity': f['severity'],
                'detail': f['evidence']
            }
        }
        edge_id = f'{target_id}->{finding_id}:has_finding'
        edges[edge_id] = {
            'data': {
                'id': edge_id,
                'source': target_id,
                'target': finding_id,
                'label': 'has_finding'
            }
        }

    return {
        'nodes': list(nodes.values()),
        'edges': list(edges.values()),
        'summary': {
            'total_nodes': len(nodes),
            'total_edges': len(edges),
            'domains': sum(1 for n in nodes.values() if n['data']['type'] == 'Domain'),
            'ips': sum(1 for n in nodes.values() if n['data']['type'] == 'IP'),
            'subdomains': sum(1 for n in nodes.values() if n['data']['type'] == 'Subdomain'),
            'certificates': sum(1 for n in nodes.values() if n['data']['type'] == 'Certificate'),
            'findings': sum(1 for n in nodes.values() if n['data']['type'] == 'SecurityFinding')
        }
    }

