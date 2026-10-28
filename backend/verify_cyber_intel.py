"""Quick verification of cyber intelligence engine."""
import sys
sys.path.insert(0, 'app')

from app.cyber_intel import validate_target, evaluate_security_findings, build_interactive_graph
from app.local_storage import save_scan_result, list_scan_results, generate_pdf_report

errors = []

# 1. Domain validation
try:
    res = validate_target('https://github.com/path?query=1')
    assert res['target'] == 'github.com' and res['type'] == 'domain'
    print('[PASS] Domain validation: github.com')
except Exception as e:
    errors.append(f'Domain validation: {e}')

# 2. SSRF protection - loopback
try:
    validate_target('127.0.0.1')
    errors.append('SSRF: 127.0.0.1 should have been blocked')
except ValueError:
    print('[PASS] SSRF protection: 127.0.0.1 blocked')

# 3. SSRF protection - private range
try:
    validate_target('192.168.1.100')
    errors.append('SSRF: 192.168.1.100 should have been blocked')
except ValueError:
    print('[PASS] SSRF protection: 192.168.1.100 blocked')

# 4. Invalid domain
try:
    validate_target('invalid..domain')
    errors.append('Validation: invalid..domain should have been rejected')
except ValueError:
    print('[PASS] Invalid domain rejected')

# 5. IP validation
res = validate_target('1.1.1.1')
assert res['type'] == 'ip', f'Expected ip, got {res["type"]}'
print('[PASS] IP validation: 1.1.1.1')

# 6. Graph building
dns_data = {
    'records_by_type': {}, 'all_records': [],
    'resolved_ips': ['93.184.216.34'], 'dnssec_enabled': False
}
ip_intel = {'93.184.216.34': {'asn': 'AS15133', 'as_org': 'Edgecast', 'country': 'USA', 'isp': 'Verizon', 'city': 'LA', 'region': 'CA'}}
certs = [{'common_name': 'example.com', 'issuer': 'DigiCert', 'not_before': '2024-01-01', 'not_after': '2025-06-01', 'serial_number': '12345'}]
subdomains = [{'subdomain': 'www.example.com', 'ips': ['93.184.216.34'], 'status': 'Active'}]
findings = [{'title': 'Missing DMARC Policy', 'severity': 'High', 'source': 'DNS', 'evidence': 'No DMARC record', 'remediation': 'Add DMARC record'}]

graph = build_interactive_graph('example.com', 'domain', dns_data, ip_intel, certs, subdomains, findings)
node_count = len(graph['nodes'])
edge_count = len(graph['edges'])
assert node_count >= 5, f'Expected >=5 nodes, got {node_count}'
assert edge_count >= 4, f'Expected >=4 edges, got {edge_count}'
print(f'[PASS] Graph building: {node_count} nodes, {edge_count} edges')

# 7. PDF generation
pdf_bytes = generate_pdf_report({
    'target': 'example.com',
    'target_type': 'domain',
    'risk_level': 'High',
    'scanned_at': '2026-10-29T00:00:00Z',
    'rdap': {'registrar': 'ICANN', 'registration_date': '1995-08-14', 'expiration_date': '2028-01-01', 'nameservers': ['ns1.example.com']},
    'findings': findings,
    'dns': {'resolved_ips': ['93.184.216.34']},
    'ip_intel': ip_intel,
    'subdomains': subdomains
})
assert len(pdf_bytes) > 2000, f'PDF too small: {len(pdf_bytes)} bytes'
print(f'[PASS] PDF generation: {len(pdf_bytes)} bytes')

# 8. Local storage persist and retrieve
record = save_scan_result({
    'target': 'test-verify.com', 'target_type': 'domain', 'risk_level': 'Medium',
    'findings': findings, 'dns': dns_data, 'subdomains': subdomains
})
assert record.get('id'), 'Missing scan id'
scans = list_scan_results(limit=50)
assert any(s['target'] == 'test-verify.com' for s in scans), 'Saved scan not found in list'
print(f'[PASS] Local storage: scan_id={record["id"]}')

if errors:
    print('\n[FAIL] Errors:')
    for e in errors:
        print(f'  - {e}')
    sys.exit(1)
else:
    print('\nAll tests passed!')

