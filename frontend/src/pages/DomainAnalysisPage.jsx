import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CytoscapeComponent from 'react-cytoscapejs';
import PageHeader from '../components/PageHeader';
import GlassCard from '../components/GlassCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { EmptyState, ErrorState } from '../components/AsyncState';
import {
  analyzeDomainOrIp,
  downloadCyberJsonReport,
  downloadCyberPdfReport
} from '../services/endpoints';
import { getDisplayError } from '../services/apiErrors';
import { useToast } from '../context/ToastContext';

const LOCAL_STORAGE_KEY = 'shadowgraph_cyber_history';

export default function DomainAnalysisPage({ embedded = false }) {
  const [target, setTarget] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('overview'); // overview, dns, subdomains, certs, findings, graph
  const [selectedNode, setSelectedNode] = useState(null);
  const [graphSearch, setGraphSearch] = useState('');
  const [cyInstance, setCyInstance] = useState(null);

  const { success, error: showError, info } = useToast();

  // Load history from browser local storage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch {
      // noop
    }
  }, []);

  const saveToLocalHistory = (scan) => {
    try {
      const summary = {
        id: scan.id,
        target: scan.target,
        target_type: scan.target_type,
        risk_level: scan.risk_level,
        findings_count: scan.findings?.length || 0,
        subdomains_count: scan.subdomains?.length || 0,
        timestamp: scan.scanned_at || new Date().toISOString()
      };
      setHistory((prev) => {
        const filtered = prev.filter((item) => item.target !== scan.target);
        const updated = [summary, ...filtered].slice(0, 20);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
    } catch {
      // noop
    }
  };

  const runAnalysis = async (inputTarget = null) => {
    const query = (inputTarget || target).trim();
    if (!query) {
      info('Please enter a domain name or IP address.');
      return;
    }

    setLoading(true);
    setError('');
    setSelectedNode(null);

    try {
      const data = await analyzeDomainOrIp(query);
      setResult(data);
      saveToLocalHistory(data);
      success(`Analysis complete for ${data.target} (${data.risk_level} Risk)`);
    } catch (err) {
      const msg = getDisplayError(err, 'Failed to complete analysis.');
      setError(msg);
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleExportJson = () => {
    if (!result) return;
    downloadCyberJsonReport(result.id, result.target);
    success('JSON intelligence report downloaded.');
  };

  const handleExportPdf = () => {
    if (!result) return;
    downloadCyberPdfReport(result.id, result.target);
    success('PDF report generation triggered.');
  };

  // Node filter for Graph search
  const filteredGraphElements = () => {
    if (!result?.graph) return [];
    const { nodes, edges } = result.graph;
    if (!graphSearch.trim()) {
      return [...nodes, ...edges];
    }
    const q = graphSearch.toLowerCase();
    const matchedNodeIds = new Set();
    nodes.forEach((n) => {
      const label = n.data?.label?.toLowerCase() || '';
      const type = n.data?.type?.toLowerCase() || '';
      if (label.includes(q) || type.includes(q)) {
        matchedNodeIds.add(n.data.id);
      }
    });

    const activeNodes = nodes.filter((n) => matchedNodeIds.has(n.data.id));
    const activeEdges = edges.filter(
      (e) => matchedNodeIds.has(e.data.source) || matchedNodeIds.has(e.data.target)
    );
    return [...activeNodes, ...activeEdges];
  };

  return (
    <div className="space-y-6">
      {!embedded && (
        <PageHeader
          title="Domain & IP Attack Surface Analysis"
          subtitle="Real-time passive OSINT intelligence gathered via DNS-over-HTTPS, RDAP, Certificate Transparency, and Threat Feeds."
        />
      )}

      {/* Target Input Console */}
      <GlassCard className="p-5 md:p-6">
        <p className="sg-kicker">Digital Footprint Reconnaissance</p>
        <div className="mt-4 flex flex-col gap-3 md:flex-row">
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runAnalysis()}
            className="sg-input flex-1"
            placeholder="Enter root domain or IP (e.g., github.com, cloudflare.com, 1.1.1.1)"
          />
          <button
            onClick={() => runAnalysis()}
            disabled={loading}
            className="sg-button-primary flex items-center justify-center gap-2 px-6"
          >
            {loading ? <LoadingSpinner /> : null}
            {loading ? 'Gathering Intel...' : 'Scan Attack Surface'}
          </button>
        </div>

        {/* Quick Targets & Local History Chips */}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted">Quick Targets:</span>
          {['github.com', 'cloudflare.com', '1.1.1.1', 'python.org'].map((t) => (
            <button
              key={t}
              onClick={() => {
                setTarget(t);
                runAnalysis(t);
              }}
              className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-muted transition hover:border-cyan/40 hover:text-cyan"
            >
              {t}
            </button>
          ))}

          {history.length > 0 && (
            <>
              <span className="ml-3 text-muted">Recent Local Scans:</span>
              {history.slice(0, 4).map((h) => (
                <button
                  key={h.target}
                  onClick={() => {
                    setTarget(h.target);
                    runAnalysis(h.target);
                  }}
                  className="rounded-lg border border-white/10 bg-surface px-2.5 py-1 text-text transition hover:border-accent hover:text-cyan"
                >
                  {h.target}
                  <span
                    className={`ml-1.5 text-[10px] uppercase ${
                      h.risk_level === 'Critical' || h.risk_level === 'High'
                        ? 'text-red-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    • {h.risk_level}
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      </GlassCard>

      {error && <ErrorState message={error} onRetry={() => runAnalysis()} />}

      {/* Analysis Results View */}
      {result && (
        <div className="space-y-6">
          {/* Header Summary Card */}
          <GlassCard className="p-5 md:p-6">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold tracking-tight text-white">{result.target}</h2>
                  <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-semibold uppercase text-muted">
                    {result.target_type}
                  </span>
                  <span
                    className={`rounded-md px-2.5 py-0.5 text-xs font-bold uppercase ${
                      result.risk_level === 'Critical'
                        ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                        : result.risk_level === 'High'
                        ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                        : result.risk_level === 'Medium'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    }`}
                  >
                    {result.risk_level} Risk
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  Scanned: {new Date(result.scanned_at).toLocaleString()} • Verified Evidence Sources: Cloudflare DoH, RDAP, crt.sh, URLhaus
                </p>
              </div>

              {/* Action Buttons: JSON & PDF Export */}
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={handleExportJson} className="sg-button-secondary text-xs">
                  Download JSON
                </button>
                <button onClick={handleExportPdf} className="sg-button-primary text-xs">
                  Download PDF Report
                </button>
              </div>
            </div>

            {/* Metrics Overview Bar */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              <div className="rounded-xl border border-white/10 bg-surface/85 p-3 text-center">
                <p className="text-[11px] text-muted uppercase tracking-wider">Resolved IPs</p>
                <p className="mt-1 text-xl font-bold text-cyan">{result.dns?.resolved_ips?.length || 0}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-surface/85 p-3 text-center">
                <p className="text-[11px] text-muted uppercase tracking-wider">Subdomains</p>
                <p className="mt-1 text-xl font-bold text-accent">{result.subdomains?.length || 0}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-surface/85 p-3 text-center">
                <p className="text-[11px] text-muted uppercase tracking-wider">Certificates</p>
                <p className="mt-1 text-xl font-bold text-purple-400">{result.certificates?.length || 0}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-surface/85 p-3 text-center">
                <p className="text-[11px] text-muted uppercase tracking-wider">Security Findings</p>
                <p className="mt-1 text-xl font-bold text-amber-400">{result.findings?.length || 0}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-surface/85 p-3 text-center">
                <p className="text-[11px] text-muted uppercase tracking-wider">DNSSEC</p>
                <p className="mt-1 text-base font-semibold text-text">
                  {result.dns?.dnssec_enabled ? 'Signed' : 'Disabled'}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-surface/85 p-3 text-center">
                <p className="text-[11px] text-muted uppercase tracking-wider">Registrar</p>
                <p className="mt-1 truncate text-xs font-semibold text-text" title={result.rdap?.registrar}>
                  {result.rdap?.registrar || 'N/A'}
                </p>
              </div>
            </div>
          </GlassCard>

          {/* Navigation Tabs */}
          <div className="flex border-b border-white/10 pb-1 text-sm font-medium">
            {[
              ['overview', 'Security Findings & RDAP'],
              ['graph', 'Interactive ShadowGraph'],
              ['dns', 'DNS Records (DoH)'],
              ['subdomains', `Subdomains (${result.subdomains?.length || 0})`],
              ['certs', `Certificates (${result.certificates?.length || 0})`],
              ['ip_routing', 'IP & ASN Routing']
            ].map(([tabKey, tabLabel]) => (
              <button
                key={tabKey}
                onClick={() => setActiveTab(tabKey)}
                className={`mr-6 border-b-2 pb-2.5 transition ${
                  activeTab === tabKey
                    ? 'border-cyan text-cyan font-semibold'
                    : 'border-transparent text-muted hover:text-text'
                }`}
              >
                {tabLabel}
              </button>
            ))}
          </div>

          {/* TAB 1: Security Findings & RDAP */}
          {activeTab === 'overview' && (
            <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
              {/* Evidence-Based Findings */}
              <GlassCard className="p-5">
                <h3 className="text-lg font-semibold text-white">Evidence-Based Security Findings</h3>
                <p className="mt-1 text-xs text-muted">
                  Findings verified from authoritative DNS, certificate validity, RDAP lifecycles, and threat indicators.
                </p>

                <div className="mt-4 space-y-3">
                  {result.findings?.length === 0 ? (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-400">
                      ✓ No common misconfigurations or threat feed flags identified for this target.
                    </div>
                  ) : (
                    result.findings.map((f, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-xl border border-white/10 bg-surface/90 p-4"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-sm font-semibold text-white">{f.title}</h4>
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                              f.severity === 'Critical'
                                ? 'bg-red-500/20 text-red-400'
                                : f.severity === 'High'
                                ? 'bg-orange-500/20 text-orange-400'
                                : f.severity === 'Medium'
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-emerald-500/20 text-emerald-400'
                            }`}
                          >
                            {f.severity}
                          </span>
                        </div>
                        <div className="mt-2 text-xs">
                          <p className="text-muted">
                            <span className="font-semibold text-text">Evidence: </span>
                            {f.evidence}
                          </p>
                          {f.remediation && (
                            <p className="mt-1.5 text-cyan/90">
                              <span className="font-semibold text-text">Remediation: </span>
                              {f.remediation}
                            </p>
                          )}
                          <p className="mt-1.5 text-[11px] text-muted/80">Source: {f.source}</p>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </GlassCard>

              {/* RDAP & Registration Details */}
              <GlassCard className="p-5">
                <h3 className="text-lg font-semibold text-white">Domain Registration (RDAP)</h3>
                <div className="mt-4 space-y-2.5 text-xs">
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-muted">Registrar</span>
                    <span className="font-medium text-text">{result.rdap?.registrar || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-muted">Handle</span>
                    <span className="font-medium text-text">{result.rdap?.handle || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-muted">Registered On</span>
                    <span className="font-medium text-text">
                      {result.rdap?.registration_date
                        ? new Date(result.rdap.registration_date).toLocaleDateString()
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-muted">Expires On</span>
                    <span className="font-medium text-text">
                      {result.rdap?.expiration_date
                        ? new Date(result.rdap.expiration_date).toLocaleDateString()
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-muted">Last Changed</span>
                    <span className="font-medium text-text">
                      {result.rdap?.last_changed
                        ? new Date(result.rdap.last_changed).toLocaleDateString()
                        : 'N/A'}
                    </span>
                  </div>

                  <div className="mt-4">
                    <p className="text-[11px] uppercase tracking-wider text-muted">Authoritative Nameservers</p>
                    <ul className="mt-2 space-y-1">
                      {result.rdap?.nameservers?.length ? (
                        result.rdap.nameservers.map((ns, idx) => (
                          <li key={idx} className="rounded bg-white/5 px-2 py-1 font-mono text-[11px] text-cyan">
                            {ns}
                          </li>
                        ))
                      ) : (
                        <li className="text-muted">No nameserver details provided in RDAP record.</li>
                      )}
                    </ul>
                  </div>
                </div>
              </GlassCard>
            </div>
          )}

          {/* TAB 2: Interactive ShadowGraph */}
          {activeTab === 'graph' && (
            <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
              <GlassCard className="relative h-[650px] p-2">
                {/* Graph Search & Controls Overlay */}
                <div className="absolute top-4 left-4 z-10 flex items-center gap-2 rounded-xl border border-white/15 bg-black/70 p-2 backdrop-blur-md">
                  <input
                    value={graphSearch}
                    onChange={(e) => setGraphSearch(e.target.value)}
                    placeholder="Search node or type..."
                    className="w-48 bg-transparent text-xs text-text placeholder-muted focus:outline-none"
                  />
                  {graphSearch && (
                    <button
                      onClick={() => setGraphSearch('')}
                      className="text-xs text-muted hover:text-white"
                    >
                      ✕
                    </button>
                  )}
                  <button
                    onClick={() => cyInstance && cyInstance.fit()}
                    className="rounded bg-white/10 px-2 py-1 text-[11px] hover:bg-white/20"
                    title="Fit view"
                  >
                    Fit
                  </button>
                  <button
                    onClick={() => cyInstance && cyInstance.reset()}
                    className="rounded bg-white/10 px-2 py-1 text-[11px] hover:bg-white/20"
                    title="Reset view"
                  >
                    Reset
                  </button>
                </div>

                <CytoscapeComponent
                  elements={filteredGraphElements()}
                  style={{ width: '100%', height: '100%' }}
                  layout={{ name: 'cose', animate: true, padding: 30 }}
                  cy={(cy) => {
                    setCyInstance(cy);
                    cy.off('tap', 'node');
                    cy.on('tap', 'node', (evt) => {
                      const data = evt.target.data();
                      setSelectedNode(data);
                    });
                  }}
                  stylesheet={[
                    {
                      selector: 'node',
                      style: {
                        label: 'data(label)',
                        'background-color': '#0284C7',
                        color: '#F8FAFC',
                        'font-size': 11,
                        'text-valign': 'center',
                        'text-halign': 'center',
                        'border-width': 1.5,
                        'border-color': '#38BDF8',
                        width: 38,
                        height: 38
                      }
                    },
                    {
                      selector: 'node[type="Domain"]',
                      style: {
                        'background-color': '#2563EB',
                        'border-color': '#60A5FA',
                        width: 48,
                        height: 48,
                        'font-size': 12,
                        'font-weight': 'bold'
                      }
                    },
                    {
                      selector: 'node[type="IP"]',
                      style: {
                        'background-color': '#0D9488',
                        'border-color': '#2DD4BF',
                        width: 36,
                        height: 36
                      }
                    },
                    {
                      selector: 'node[type="Subdomain"]',
                      style: {
                        'background-color': '#7C3AED',
                        'border-color': '#A78BFA',
                        width: 32,
                        height: 32
                      }
                    },
                    {
                      selector: 'node[type="Certificate"]',
                      style: {
                        'background-color': '#C026D3',
                        'border-color': '#F472B6',
                        width: 30,
                        height: 30
                      }
                    },
                    {
                      selector: 'node[type="SecurityFinding"]',
                      style: {
                        'background-color': '#DC2626',
                        'border-color': '#F87171',
                        width: 34,
                        height: 34
                      }
                    },
                    {
                      selector: 'node:selected',
                      style: {
                        'border-width': 3,
                        'border-color': '#FDE047'
                      }
                    },
                    {
                      selector: 'edge',
                      style: {
                        label: 'data(label)',
                        'font-size': 8,
                        color: '#94A3B8',
                        'text-rotation': 'autorotate',
                        width: 1.5,
                        'line-color': '#334155',
                        'target-arrow-color': '#38BDF8',
                        'target-arrow-shape': 'triangle',
                        'curve-style': 'bezier'
                      }
                    }
                  ]}
                />
              </GlassCard>

              {/* Node Evidence Details Panel */}
              <GlassCard className="p-5">
                <h3 className="text-base font-semibold text-white">Entity Evidence Details</h3>
                <p className="mt-1 text-xs text-muted">Click any graph node to inspect verified relations and sources.</p>

                {selectedNode ? (
                  <div className="mt-4 space-y-3 rounded-xl border border-white/10 bg-surface/90 p-4 text-xs">
                    <div>
                      <span className="text-muted">Entity Label:</span>
                      <p className="text-sm font-bold text-cyan">{selectedNode.label}</p>
                    </div>
                    <div>
                      <span className="text-muted">Entity Type:</span>
                      <p className="font-semibold text-white">{selectedNode.type}</p>
                    </div>
                    {selectedNode.category && (
                      <div>
                        <span className="text-muted">Category:</span>
                        <p className="text-text">{selectedNode.category}</p>
                      </div>
                    )}
                    {selectedNode.detail && (
                      <div>
                        <span className="text-muted">Evidence & Attributes:</span>
                        <p className="mt-1 rounded bg-black/40 p-2 font-mono text-[11px] text-muted">
                          {selectedNode.detail}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-6 text-center text-xs text-muted">
                    <p>No entity selected.</p>
                    <p className="mt-1">Tap a node in the graph to display its authoritative attributes.</p>
                  </div>
                )}

                {/* Graph Legend */}
                <div className="mt-8 border-t border-white/10 pt-4 text-xs">
                  <p className="font-semibold text-white">Graph Topology Legend</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-[#2563EB]" />
                      <span className="text-muted">Root Domain</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-[#0D9488]" />
                      <span className="text-muted">Resolved IP</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-[#7C3AED]" />
                      <span className="text-muted">Subdomain</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-[#C026D3]" />
                      <span className="text-muted">Certificate</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-[#DC2626]" />
                      <span className="text-muted">Vulnerability</span>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </div>
          )}

          {/* TAB 3: DNS Records (DoH) */}
          {activeTab === 'dns' && (
            <GlassCard className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">DNS-over-HTTPS (DoH) Records</h3>
                  <p className="text-xs text-muted">Direct authoritative responses resolved via Cloudflare / Google DoH.</p>
                </div>
                <div className="rounded-md border border-cyan/30 bg-cyan/10 px-3 py-1 text-xs text-cyan">
                  DNSSEC: {result.dns?.dnssec_enabled ? 'Authenticated (AD Flag)' : 'Unsigned'}
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-muted">
                      <th className="py-2.5">Type</th>
                      <th className="py-2.5">Name</th>
                      <th className="py-2.5">TTL</th>
                      <th className="py-2.5">Data / Target</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                    {result.dns?.all_records?.length ? (
                      result.dns.all_records.map((r, idx) => (
                        <tr key={idx} className="hover:bg-white/5">
                          <td className="py-2 font-bold text-cyan">{r.type}</td>
                          <td className="py-2 text-text">{r.name}</td>
                          <td className="py-2 text-muted">{r.ttl}s</td>
                          <td className="py-2 break-all text-text">{r.data}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-muted">
                          No DNS records returned for target.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          )}

          {/* TAB 4: Discovered Subdomains */}
          {activeTab === 'subdomains' && (
            <GlassCard className="p-5">
              <h3 className="text-lg font-semibold text-white">Passive Subdomain Discovery</h3>
              <p className="text-xs text-muted">
                Enumerated from Certificate Transparency logs and passive DNS endpoints.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {result.subdomains?.length ? (
                  result.subdomains.map((s, idx) => (
                    <div key={idx} className="rounded-xl border border-white/10 bg-surface/85 p-3 text-xs">
                      <p className="font-semibold text-white break-all">{s.subdomain}</p>
                      <div className="mt-2 flex items-center justify-between text-[11px]">
                        <span className="text-muted">Status: {s.status}</span>
                        <span className="font-mono text-cyan">
                          {s.ips?.length ? s.ips.join(', ') : 'Unresolved'}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="col-span-3 text-center text-xs text-muted">
                    No subdomains discovered in public CT logs.
                  </p>
                )}
              </div>
            </GlassCard>
          )}

          {/* TAB 5: Public Certificate Transparency */}
          {activeTab === 'certs' && (
            <GlassCard className="p-5">
              <h3 className="text-lg font-semibold text-white">Public Certificate Transparency Records</h3>
              <p className="text-xs text-muted">Active and historic certificates registered in CT logs.</p>

              <div className="mt-4 space-y-3">
                {result.certificates?.length ? (
                  result.certificates.map((c, idx) => (
                    <div key={idx} className="rounded-xl border border-white/10 bg-surface/85 p-3 text-xs">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-white">{c.common_name}</p>
                        <span className="text-[11px] text-muted">Issuer: {c.issuer}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-muted sm:grid-cols-3">
                        <p>Valid From: {c.not_before ? new Date(c.not_before).toLocaleDateString() : 'N/A'}</p>
                        <p>Valid To: {c.not_after ? new Date(c.not_after).toLocaleDateString() : 'N/A'}</p>
                        <p className="truncate font-mono">Serial: {c.serial_number}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-xs text-muted">No public certificate records indexed.</p>
                )}
              </div>
            </GlassCard>
          )}

          {/* TAB 6: IP & ASN Routing */}
          {activeTab === 'ip_routing' && (
            <GlassCard className="p-5">
              <h3 className="text-lg font-semibold text-white">IP & ASN Intelligence</h3>
              <p className="text-xs text-muted">Routing, autonomous systems, and geolocation of resolved hosts.</p>

              <div className="mt-4 space-y-3">
                {Object.entries(result.ip_intel || {}).map(([ip, intel]) => (
                  <div key={ip} className="rounded-xl border border-white/10 bg-surface/85 p-4 text-xs">
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-base font-bold text-cyan">{ip}</p>
                      <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-text">
                        {intel.country} ({intel.country_code})
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-[11px] sm:grid-cols-4">
                      <div>
                        <span className="text-muted">ASN:</span>
                        <p className="font-medium text-text">{intel.asn}</p>
                      </div>
                      <div>
                        <span className="text-muted">Organization / ISP:</span>
                        <p className="font-medium text-text">{intel.as_org || intel.isp}</p>
                      </div>
                      <div>
                        <span className="text-muted">City / Region:</span>
                        <p className="font-medium text-text">
                          {intel.city}, {intel.region}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted">Coordinates:</span>
                        <p className="font-mono text-text">
                          {intel.latitude && intel.longitude ? `${intel.latitude}, ${intel.longitude}` : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </div>
      )}
    </div>
  );
}

