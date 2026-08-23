import { useState } from 'react';
import PageHeader from '../components/PageHeader';
import GlassCard from '../components/GlassCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { EmptyState, ErrorState } from '../components/AsyncState';
import { searchResearch } from '../services/endpoints';
import { getDisplayError } from '../services/apiErrors';
import { useToast } from '../context/ToastContext';

export default function ResearchPaperPage({ embedded = false }) {
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [loading, setLoading] = useState(false);
  const [papers, setPapers] = useState([]);
  const [error, setError] = useState('');
  const { info, success, error: showError } = useToast();

  const run = async () => {
    if (!name.trim() && !institution.trim()) {
      info('Enter at least a full name or an institution.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await searchResearch(name.trim(), institution.trim());
      setPapers(data);
      success('Research lookup completed.');
    } catch (err) {
      const message = getDisplayError(err, 'Failed to search publications.');
      setError(message);
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {!embedded ? (
        <PageHeader title="Research Paper Detection" subtitle="Find papers by full name, swapped name order, only name, only institution, or both together." />
      ) : null}

      <GlassCard className="p-5 md:p-6">
        <p className="mb-3 text-sm text-muted">
          Tip: You can enter both fields, only full name, or only institution.
          If full name is provided, results are now filtered to matching author names.
        </p>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full Name (e.g., John Doe)" className="sg-input" />
          <input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="Institution (optional)" className="sg-input" />
          <button onClick={run} className="sg-button-primary flex items-center justify-center gap-2">
            {loading ? <LoadingSpinner /> : null}
            Search Research Papers
          </button>
        </div>
      </GlassCard>

      {error ? <ErrorState className="mt-4" message={error} onRetry={run} /> : null}

      {!error ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {papers.map((paper) => (
            <GlassCard key={paper.title} className="p-5">
              <h3 className="text-lg font-semibold tracking-tight">{paper.title}</h3>
              <div className="mt-3 space-y-1 text-sm text-muted">
                <p>Authors: {paper.authors}</p>
                <p>Publication Source: {paper.source}</p>
                <p>Year: {paper.year}</p>
              </div>
              <p className="mt-3 text-sm text-muted">{paper.summary || 'Summary not available.'}</p>
              {paper.url ? (
                <a href={paper.url} className="mt-2 block text-xs text-accent hover:underline">
                  Open paper source
                </a>
              ) : null}
              <p className="mt-3 text-sm text-cyan">Citation Count: {paper.citations}</p>
            </GlassCard>
          ))}

          {!papers.length && !loading ? <EmptyState className="xl:col-span-2" message="No papers found. Try full name, reversed name order, or institution-only search." /> : null}
        </div>
      ) : null}
    </div>
  );
}
