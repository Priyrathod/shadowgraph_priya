import { useEffect, useState } from 'react';
import CytoscapeComponent from 'react-cytoscapejs';
import PageHeader from '../components/PageHeader';
import GlassCard from '../components/GlassCard';
import { ErrorState } from '../components/AsyncState';
import { graphData } from '../services/endpoints';
import { getDisplayError } from '../services/apiErrors';
import { useToast } from '../context/ToastContext';

const defaultNodeDescriptions = {
  User: 'Primary identity entity in the graph.',
  Platform: 'Discovered online account or platform profile.',
  'Research Paper': 'Detected publication or citation entity.',
  'Breach Event': 'Historic data breach relation.'
};

export default function GraphVisualizationPage({ embedded = false }) {
  const [elements, setElements] = useState({ nodes: [], edges: [] });
  const [summary, setSummary] = useState({ nodes: 0, edges: 0, events_ingested: 0 });
  const [error, setError] = useState('');
  const [active, setActive] = useState({ label: 'User', detail: defaultNodeDescriptions.User });
  const { error: showError } = useToast();

  const loadGraph = async () => {
    setError('');
    try {
      const data = await graphData();
      setElements({ nodes: data.nodes, edges: data.edges });
      setSummary(data.summary);
    } catch (err) {
      const message = getDisplayError(err, 'Failed to load graph.');
      setError(message);
      showError(message);
    }
  };

  useEffect(() => {
    loadGraph();
  }, []);

  return (
    <div>
      {!embedded ? <PageHeader title="Graph Visualization" subtitle="Interactive relation graph generated from your real scan history." /> : null}

      {error ? <ErrorState message={error} onRetry={loadGraph} /> : null}

      {!error ? (
        <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
          <GlassCard className="h-[620px] p-2">
            <CytoscapeComponent
              elements={[...(elements.nodes || []), ...(elements.edges || [])]}
              style={{ width: '100%', height: '100%' }}
              layout={{ name: 'cose', animate: true, padding: 20 }}
              cy={(cy) => {
                cy.off('mouseover', 'node');
                cy.on('mouseover', 'node', (evt) => {
                  const node = evt.target.data();
                  const nodeType = node.type || 'User';
                  setActive({
                    label: node.label,
                    detail: defaultNodeDescriptions[nodeType] || 'Entity in your dynamic shadow graph.'
                  });
                });
              }}
              stylesheet={[
                {
                  selector: 'node',
                  style: {
                    label: 'data(label)',
                    'background-color': '#3B82F6',
                    color: '#F5F5F7',
                    'font-size': 10,
                    'text-valign': 'center',
                    'text-halign': 'center',
                    'border-width': 1,
                    'border-color': '#22D3EE'
                  }
                },
                {
                  selector: 'node:hover',
                  style: {
                    'background-color': '#22D3EE'
                  }
                },
                {
                  selector: 'edge',
                  style: {
                    width: 2,
                    'line-color': '#22D3EE',
                    'target-arrow-color': '#22D3EE',
                    'target-arrow-shape': 'triangle',
                    'curve-style': 'bezier'
                  }
                }
              ]}
            />
          </GlassCard>

          <GlassCard className="p-5">
            <p className="sg-kicker">Live Graph Intel</p>
            <h3 className="mt-2 text-xl font-semibold">{active.label}</h3>
            <p className="mt-2 text-sm text-muted">{active.detail}</p>
            <div className="mt-5 rounded-xl border border-white/10 bg-surface/75 p-3 text-sm text-muted">
              <p>Nodes: {summary.nodes}</p>
              <p>Edges: {summary.edges}</p>
              <p>Events ingested: {summary.events_ingested}</p>
            </div>
          </GlassCard>
        </div>
      ) : null}
    </div>
  );
}
