import { useEffect, useState } from 'react';
import GlassCard from '../components/GlassCard';
import PageHeader from '../components/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';
import { ErrorState } from '../components/AsyncState';
import { getDisplayError } from '../services/apiErrors';
import { getReputationInsight } from '../services/endpoints';

export default function ReputationInsightPage({ embedded = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setData(await getReputationInsight());
    } catch (err) {
      setError(getDisplayError(err, 'Could not calculate reputation insight.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      {!embedded ? <PageHeader title="Reputation Insight" subtitle="Understand how visible and searchable you are online." /> : null}
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {loading ? (
        <div className="rounded-xl border border-white/10 bg-surface/70 p-4 text-sm text-muted">
          <LoadingSpinner /> Calculating your insight...
        </div>
      ) : null}

      {!error && data ? (
        <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
          <GlassCard className="p-6">
            <h3 className="text-lg font-semibold">Your reputation score</h3>
            <p className="mt-1 text-sm text-muted">Higher means you are visible in more trusted places with lower exposure risk.</p>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-surface/70 p-3 text-center">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">Reputation</p>
                <p className="mt-2 text-3xl font-semibold">{data.insight.reputation_score}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-surface/70 p-3 text-center">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">Visibility</p>
                <p className="mt-2 text-3xl font-semibold">{data.insight.visibility_score}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-surface/70 p-3 text-center">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">Exposure Risk</p>
                <p className="mt-2 text-3xl font-semibold">{data.insight.exposure_penalty}</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <h3 className="text-lg font-semibold">Highlights</h3>
            <div className="mt-3 space-y-2">
              {(data.insight.highlights || []).map((text) => (
                <div key={text} className="rounded-xl border border-white/10 bg-surface/70 p-3 text-sm text-muted">{text}</div>
              ))}
            </div>
            <h4 className="mt-5 text-sm font-semibold uppercase tracking-[0.14em] text-[#1ED760]">Recommended actions</h4>
            <div className="mt-2 space-y-2">
              {(data.insight.recommended_actions || []).map((text) => (
                <div key={text} className="rounded-xl border border-white/10 bg-surface/70 p-3 text-sm text-muted">{text}</div>
              ))}
            </div>
          </GlassCard>
        </div>
      ) : null}
    </div>
  );
}
