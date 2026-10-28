import json
import io
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib import colors

DATA_DIR = Path(__file__).resolve().parent / 'data'
DATA_DIR.mkdir(parents=True, exist_ok=True)
SCANS_FILE = DATA_DIR / 'cyber_scans.json'
_lock = threading.Lock()

def _load_all_scans() -> list[dict[str, Any]]:
    if not SCANS_FILE.exists():
        return []
    try:
        data = json.loads(SCANS_FILE.read_text(encoding='utf-8'))
        return data if isinstance(data, list) else []
    except Exception:
        return []

def _save_all_scans(scans: list[dict[str, Any]]) -> None:
    SCANS_FILE.write_text(json.dumps(scans, indent=2, default=str), encoding='utf-8')

def save_scan_result(scan_data: dict[str, Any]) -> dict[str, Any]:
    with _lock:
        scans = _load_all_scans()
        scan_id = scan_data.get('id') or f'scan_{uuid.uuid4().hex[:12]}'
        scan_data['id'] = scan_id
        scan_data['created_at'] = scan_data.get('created_at') or datetime.now(timezone.utc).isoformat()
        
        # Replace if existing or prepend
        scans = [s for s in scans if s.get('id') != scan_id]
        scans.insert(0, scan_data)
        # Limit local history to 100 scans
        _save_all_scans(scans[:100])
        return scan_data

def get_scan_result(scan_id: str) -> dict[str, Any] | None:
    with _lock:
        scans = _load_all_scans()
        for s in scans:
            if s.get('id') == scan_id:
                return s
        return None

def list_scan_results(limit: int = 50) -> list[dict[str, Any]]:
    with _lock:
        scans = _load_all_scans()
        # Return summary list without bulky raw payloads
        summaries = []
        for s in scans[:limit]:
            summaries.append({
                'id': s.get('id'),
                'target': s.get('target'),
                'target_type': s.get('target_type'),
                'created_at': s.get('created_at'),
                'findings_count': len(s.get('findings', [])),
                'ips_count': len(s.get('dns', {}).get('resolved_ips', [])),
                'subdomains_count': len(s.get('subdomains', [])),
                'risk_level': s.get('risk_level', 'Low')
            })
        return summaries

def delete_scan_result(scan_id: str) -> bool:
    with _lock:
        scans = _load_all_scans()
        new_scans = [s for s in scans if s.get('id') != scan_id]
        if len(new_scans) != len(scans):
            _save_all_scans(new_scans)
            return True
        return False

def generate_pdf_report(scan: dict[str, Any]) -> bytes:
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    y = height - 50

    # Header / Title Bar
    pdf.setFillColor(colors.HexColor('#0F172A'))
    pdf.rect(0, height - 75, width, 75, fill=1, stroke=0)
    pdf.setFillColor(colors.HexColor('#38BDF8'))
    pdf.setFont('Helvetica-Bold', 18)
    pdf.drawString(40, height - 45, 'SHADOWGRAPH CYBER INTELLIGENCE REPORT')
    pdf.setFont('Helvetica', 9)
    pdf.setFillColor(colors.HexColor('#94A3B8'))
    pdf.drawString(40, height - 62, f'EVIDENCE-BASED DIGITAL FOOTPRINT & ATTACK SURFACE ASSESSMENT | Generated {datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")}')

    y = height - 100
    pdf.setFillColor(colors.black)

    # Target Section
    pdf.setFont('Helvetica-Bold', 13)
    pdf.drawString(40, y, '1. Target Overview')
    y -= 18

    pdf.setFont('Helvetica', 10)
    target = scan.get('target', 'Unknown')
    target_type = scan.get('target_type', 'domain').upper()
    risk = scan.get('risk_level', 'Low')

    pdf.drawString(40, y, f'Target: {target} ({target_type})')
    pdf.drawString(320, y, f'Calculated Risk Rating: {risk.upper()}')
    y -= 16

    rdap = scan.get('rdap', {})
    if rdap.get('registrar'):
        pdf.drawString(40, y, f'Registrar: {rdap.get("registrar")}')
        pdf.drawString(320, y, f'Registration Date: {rdap.get("registration_date") or "N/A"}')
        y -= 16
        pdf.drawString(40, y, f'Expiration Date: {rdap.get("expiration_date") or "N/A"}')
        y -= 22

    # Findings Section
    findings = scan.get('findings', [])
    pdf.setFont('Helvetica-Bold', 13)
    pdf.drawString(40, y, f'2. Security & Threat Findings ({len(findings)})')
    y -= 18

    if not findings:
        pdf.setFont('Helvetica-Oblique', 10)
        pdf.drawString(40, y, 'No critical security findings or threat feed flags detected.')
        y -= 20
    else:
        for idx, f in enumerate(findings[:5]):
            if y < 80:
                pdf.showPage()
                y = height - 50

            sev = f.get('severity', 'Medium').upper()
            title = f.get('title', 'Finding')
            evidence = f.get('evidence', '')
            remediation = f.get('remediation', '')

            # Badge
            pdf.setFont('Helvetica-Bold', 10)
            if sev in ('CRITICAL', 'HIGH'):
                pdf.setFillColor(colors.HexColor('#EF4444'))
            elif sev == 'MEDIUM':
                pdf.setFillColor(colors.HexColor('#F59E0B'))
            else:
                pdf.setFillColor(colors.HexColor('#10B981'))
            pdf.drawString(40, y, f'[{sev}]')

            pdf.setFillColor(colors.black)
            pdf.drawString(95, y, f'{title}')
            y -= 14

            pdf.setFont('Helvetica', 9)
            pdf.setFillColor(colors.HexColor('#334155'))
            pdf.drawString(55, y, f'Evidence: {evidence[:95]}')
            y -= 13
            if remediation:
                pdf.drawString(55, y, f'Remediation: {remediation[:95]}')
                y -= 13
            y -= 8

    # Network & Infrastructure
    if y < 140:
        pdf.showPage()
        y = height - 50

    pdf.setFont('Helvetica-Bold', 13)
    pdf.setFillColor(colors.black)
    pdf.drawString(40, y, '3. Resolved Infrastructure & Routing')
    y -= 18

    dns_ips = scan.get('dns', {}).get('resolved_ips', [])
    ip_intel = scan.get('ip_intel', {})
    for ip in dns_ips[:6]:
        intel = ip_intel.get(ip, {})
        pdf.setFont('Helvetica', 9)
        pdf.drawString(40, y, f'IP: {ip:<18} | ASN: {intel.get("asn", "N/A"):<10} | ISP: {intel.get("isp", "N/A")[:30]:<30} | {intel.get("country", "")}')
        y -= 14

    # Subdomains
    subdomains = scan.get('subdomains', [])
    if subdomains:
        if y < 120:
            pdf.showPage()
            y = height - 50

        y -= 10
        pdf.setFont('Helvetica-Bold', 13)
        pdf.drawString(40, y, f'4. Discovered Subdomains ({len(subdomains)})')
        y -= 18
        for s in subdomains[:8]:
            sub = s.get('subdomain', '')
            ips = ", ".join(s.get('ips', []))
            pdf.setFont('Helvetica', 9)
            pdf.drawString(40, y, f'• {sub} -> [{ips if ips else "Unresolved"}]')
            y -= 14

    # Footer
    pdf.setFont('Helvetica-Oblique', 8)
    pdf.setFillColor(colors.HexColor('#64748B'))
    pdf.drawString(40, 30, 'ShadowGraph Intelligence Platform | Verified Evidence Data Source: Cloudflare DoH, RDAP, crt.sh, URLhaus')

    pdf.save()
    buffer.seek(0)
    return buffer.getvalue()

