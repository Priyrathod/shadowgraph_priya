import { useEffect, useState } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import PageHeader from '../components/PageHeader';
import GlassCard from '../components/GlassCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { EmptyState, ErrorState } from '../components/AsyncState';
import { graphData, getAnalysisHistory, getSingleScan } from '../services/endpoints';
import { getDisplayError } from '../services/apiErrors';
import { useToast } from '../context/ToastContext';

const LOCAL_STORAGE_KEY = 'shadowgraph_cyber_history';

export default function GraphVisualizationPage({ embedded = false }) {
  const [elements, setElements] = useState({ nodes: [], edges: [] });
  const [summary, setSummary] = useState({ nodes: 0, edges: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeNode, setActiveNode] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [availableScans, setAvailableScans] = useState([]);
  const [selectedScanId, setSelectedScanId] = useState('');
  const [cyRef, setCyRef] = useState(null);

  const { error: showError } = useToast();

  // Load available scans from local storage and backend
  useEffect(() => {
    const fetchScans = async () => {
      let localList = [];
      try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (stored) localList = JSON.parse(stored);
      } catch {
        // noop
      }

      try {
        const serverScans = await getAnalysisHistory();
        const combined = [...localList];
        serverScans.forEach((s) => {
          if (!combined.some((c) => c.id === s.id || c.target === s.target)) {
            combined.push(s);
          }
        });
        setAvailableScans(combined);
        if (combined.length > 0) {
          setSelectedScanId(combined[0].id);
          loadCyberGraph(combined[0].id);
        } else {
          loadIdentityGraph();
        }
      } catch {
        if (localList.length > 0) {
          setAvailableScans(localList);
          setSelectedScanId(localList[0].id);
          loadCyberGraph(localList[0].id);
        } else {
          loadIdentityGraph();
        }
      }
    };

    fetchScans();
  }, []);

  const loadCyberGraph = async (scanId) => {
    if (!scanId) return;
    setLoading(true);
    setError('');
    setActiveNode(null);

    try {
      const scan = await getSingleScan(scanId);
      if (scan?.graph) {
        setElements({
          nodes: scan.graph.nodes || [],
          edges: scan.graph.edges || []
        });
        setSummary({
          nodes: scan.graph.nodes?.length || 0,
          edges: scan.graph.edges?.length || 0
        });
      }
    } catch {
      // Fallback to default identity graph if single scan fetch fails
      loadIdentityGraph();
    } finally {
      setLoading(false);
    }
  };

  const loadIdentityGraph = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await graphData();
      setElements({ nodes: data.nodes || [], edges: data.edges || [] });
      setSummary({ nodes: data.nodes?.length || 0, edges: data.edges?.length || 0 });
    } catch (err) {
      const message = getDisplayError(err, 'Failed to load graph.');
      setError(message);
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleScanChange = (e) => {
    const id = e.target.value;
    setSelectedScanId(id);
    if (id === 'identity') {
      loadIdentityGraph();
    } else {
      loadCyberGraph(id);
    }
  };

  const filteredElements = () => {
    const { nodes, edges } = elements;
    if (!nodes) return [];

    let filteredNodes = nodes;
    if (typeFilter !== 'ALL') {
      filteredNodes = filteredNodes.filter((n) => n.data?.type === typeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filteredNodes = filteredNodes.filter((n) => {
        const label = (n.data?.label || '').toLowerCase();
        const type = (n.data?.type || '').toLowerCase();
        return label.includes(q) || type.includes(q);
      });
    }

    const validNodeIds = new Set(filteredNodes.map((n) => n.data.id));
    const filteredEdges = (edges || []).filter(
      (e) => validNodeIds.has(e.data.source) && validNodeIds.has(e.data.target)
    );

    return [...filteredNodes, ...filteredEdges];
  };

  return (
    <div className="space-y-6">
      {!embedded && (
        <PageHeader
          title="Interactive ShadowGraph Visualization"
          subtitle="Topological cybersecurity and entity graph generated strictly from verified reconnaissance data."
        />
      )}

      {/* Control Header */}
      <GlassCard className="p-4 md:p-5">
        <div className="flex flex-col flex-wrap justify-between gap-4 md:flex-row md:items-center">
          {/* Scan Selector */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">Active Dataset:</span>
            <select
              value={selectedScanId}
              onChange={handleScanChange}
              className="sg-input py-1.5 text-xs font-medium md:w-64"
            >
              {availableScans.map((s) => (
                <option key={s.id || s.target} value={s.id}>
                  {s.target} ({s.target_type || 'Domain'} • {s.risk_level || 'Scan'})
                </option>
              ))}
              <option value="identity">General Identity Graph</option>
            </select>

            <span className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-cyan">
              {summary.nodes} Nodes • {summary.edges} Edges
            </span>
          </div>

          {/* Node Type Quick Filters */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {['ALL', 'Domain', 'IP', 'Subdomain', 'Certificate', 'ASN', 'SecurityFinding'].map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`rounded-lg px-2.5 py-1 transition ${
                  typeFilter === t
                    ? 'bg-cyan text-black font-semibold'
                    : 'border border-white/10 bg-surface text-muted hover:text-white'
                }`}
              >
                {t === 'SecurityFinding' ? 'Findings' : t}
              </button>
            ))}
          </div>
        </div>
      </GlassCard>

      {error && <ErrorState message={error} onRetry={loadIdentityGraph} />}

      {/* Main Cytoscape Canvas & Details Split */}
      {!error && (
        <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
          <GlassCard className="relative h-[650px] p-2">
            {/* Interactive Toolbar */}
            <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-white/15 bg-black/75 p-2 backdrop-blur-md">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search nodes..."
                className="w-40 bg-transparent text-xs text-text placeholder-muted focus:outline-none"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-xs text-muted hover:text-white">
                  ✕
                </button>
              )}
              <div className="h-4 w-px bg-white/20" />
              <button
                onClick={() => cyRef && cyRef.zoom(cyRef.zoom() * 1.25)}
                className="rounded bg-white/10 px-2 py-1 text-xs font-bold text-text hover:bg-white/20"
                title="Zoom in"
              >
                +
              </button>
              <button
                onClick={() => cyRef && cyRef.zoom(cyRef.zoom() * 0.8)}
                className="rounded bg-white/10 px-2 py-1 text-xs font-bold text-text hover:bg-white/20"
                title="Zoom out"
              >
                -
              </button>
              <button
                onClick={() => cyRef && cyRef.fit()}
                className="rounded bg-white/10 px-2 py-1 text-xs text-text hover:bg-white/20"
                title="Fit to screen"
              >
                Fit
              </button>
              <button
                onClick={() => cyRef && cyRef.reset()}
                className="rounded bg-white/10 px-2 py-1 text-xs text-text hover:bg-white/20"
                title="Reset view"
              >
                Reset
              </button>
            </div>

            {loading ? (
              <div className="flex h-full items-center justify-center">
                <LoadingSpinner />
              </div>
            ) : elements.nodes.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <EmptyState message="No nodes found. Execute a domain or IP scan to build the topology graph." />
              </div>
            ) : (
              <CytoscapeComponent
                elements={filteredElements()}
                style={{ width: '100%', height: '100%' }}
                layout={{ name: 'cose', animate: true, padding: 35 }}
                cy={(cy) => {
                  setCyRef(cy);
                  cy.off('tap', 'node');
                  cy.on('tap', 'node', (evt) => {
                    const node = evt.target.data();
                    setActiveNode(node);
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
                      width: 50,
                      height: 50,
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
                    selector: 'node[type="ASN"]',
                    style: {
                      'background-color': '#EA580C',
                      'border-color': '#FB923C',
                      width: 32,
                      height: 32
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
                      'border-width': 3.5,
                      'border-color': '#FACC15'
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
            )}
          </GlassCard>

          {/* Details & Evidence Inspector */}
          <GlassCard className="p-5">
            <p className="sg-kicker">Verified Graph Node Evidence</p>
            <h3 className="mt-1 text-base font-semibold text-white">Entity Intelligence Inspector</h3>

            {activeNode ? (
              <div className="mt-4 space-y-3.5 rounded-xl border border-white/10 bg-surface/90 p-4 text-xs">
                <div>
                  <span className="text-muted">Entity Identifier:</span>
                  <p className="font-mono text-[11px] text-cyan break-all">{activeNode.id}</p>
                </div>
                <div>
                  <span className="text-muted">Display Label:</span>
                  <p className="text-sm font-bold text-white break-all">{activeNode.label}</p>
                </div>
                <div>
                  <span className="text-muted">Node Classification:</span>
                  <p className="font-semibold text-accent">{activeNode.type}</p>
                </div>
                {activeNode.country && (
                  <div>
                    <span className="text-muted">Geolocation:</span>
                    <p className="text-text">{activeNode.country}</p>
                  </div>
                )}
                {activeNode.severity && (
                  <div>
                    <span className="text-muted">Risk Severity:</span>
                    <span className="ml-2 rounded bg-red-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-red-400">
                      {activeNode.severity}
                    </span>
                  </div>
                )}
                {activeNode.detail && (
                  <div>
                    <span className="text-muted">Evidence & Raw Attributes:</span>
                    <p className="mt-1.5 rounded-lg bg-black/50 p-2.5 font-mono text-[11px] text-muted leading-relaxed break-all">
                      {activeNode.detail}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-8 text-center text-xs text-muted">
                <p>Click on any node or edge to inspect its verified relationships and evidence source.</p>
              </div>
            )}

            {/* Entity Key */}
            <div className="mt-8 border-t border-white/10 pt-4 text-xs">
              <p className="font-semibold text-white">Legend</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-muted">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#2563EB]" />
                  <span>Domain</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#0D9488]" />
                  <span>IP Address</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#7C3AED]" />
                  <span>Subdomain</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#C026D3]" />
                  <span>Certificate</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#EA580C]" />
                  <span>ASN / Network</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#DC2626]" />
                  <span>Vulnerability</span>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
