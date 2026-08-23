import { useEffect, useState } from 'react';
import GlassCard from '../components/GlassCard';
import PageHeader from '../components/PageHeader';
import { ErrorState } from '../components/AsyncState';
import LoadingSpinner from '../components/LoadingSpinner';
import { getSkillRadar, getNetworkingOpportunities } from '../services/endpoints';
import { getDisplayError } from '../services/apiErrors';

export default function SkillGrowthPage({ embedded = false }) {
  const [data, setData] = useState({ skills: [], gaps: [] });
  const [opps, setOpps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [skillData, opportunities] = await Promise.all([getSkillRadar(), getNetworkingOpportunities()]);
      setData(skillData);
      setOpps(opportunities);
    } catch (err) {
      setError(getDisplayError(err, 'Could not load skill and networking insights.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      {!embedded ? <PageHeader title="Skill & Networking" subtitle="See your strongest skill areas and where to grow next." /> : null}
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {loading ? (
        <div className="rounded-xl border border-white/10 bg-surface/70 p-4 text-sm text-muted">
          <LoadingSpinner /> Loading skill map...
        </div>
      ) : null}
      {!loading && !error ? (
        <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
          <GlassCard className="p-5">
            <h3 className="text-lg font-semibold">Skill / expertise radar</h3>
            <div className="mt-3 space-y-3">
              {(data.skills || []).map((row) => (
                <div key={row.name}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-muted">{row.name}</span>
                    <span>{row.score}</span>
                  </div>
                  <div className="h-2 rounded bg-white/10">
                    <div className="h-2 rounded bg-gradient-to-r from-[#00BFFF] to-[#1ED760]" style={{ width: `${row.score}%` }} />
                  </div>
                </div>
              ))}
            </div>
            {!!data.gaps?.length && (
              <div className="mt-4 rounded-xl border border-white/10 bg-surface/70 p-3 text-sm text-muted">
                Growth gaps: {data.gaps.join(', ')}
              </div>
            )}
          </GlassCard>
          <GlassCard className="p-5">
            <h3 className="text-lg font-semibold">Networking opportunities</h3>
            <div className="mt-3 space-y-2">
              {opps.map((o) => (
                <div key={o.title} className="rounded-xl border border-white/10 bg-surface/70 p-3 text-sm text-muted">
                  <p className="font-medium text-text">{o.title}</p>
                  <p className="mt-1">{o.action}</p>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      ) : null}
    </div>
  );
}
