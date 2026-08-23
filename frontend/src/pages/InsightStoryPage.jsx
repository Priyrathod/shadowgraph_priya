import { useEffect, useState } from 'react';
import GlassCard from '../components/GlassCard';
import PageHeader from '../components/PageHeader';
import { ErrorState } from '../components/AsyncState';
import LoadingSpinner from '../components/LoadingSpinner';
import { getAiNarrative, getPrivacyAlerts } from '../services/endpoints';
import { getDisplayError } from '../services/apiErrors';

export default function InsightStoryPage({ embedded = false }) {
  const [stories, setStories] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [storyRows, alertRows] = await Promise.all([getAiNarrative(), getPrivacyAlerts()]);
      setStories(storyRows);
      setAlerts(alertRows);
    } catch (err) {
      setError(getDisplayError(err, 'Could not load insight story.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      {!embedded ? <PageHeader title="AI Footprint Story" subtitle="A simple story of your online presence, alerts, and impact." /> : null}
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {loading ? (
        <div className="rounded-xl border border-white/10 bg-surface/70 p-4 text-sm text-muted">
          <LoadingSpinner /> Loading your story...
        </div>
      ) : null}
      {!loading && !error ? (
        <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
          <GlassCard className="p-5">
            <h3 className="text-lg font-semibold">Your digital story</h3>
            <div className="mt-3 space-y-3">
              {stories.map((s) => (
                <div key={s.title} className="rounded-xl border border-white/10 bg-surface/70 p-3">
                  <p className="text-sm font-medium">{s.title}</p>
                  <p className="mt-1 text-sm text-muted">{s.body}</p>
                </div>
              ))}
            </div>
          </GlassCard>
          <GlassCard className="p-5">
            <h3 className="text-lg font-semibold">Privacy & threat alerts</h3>
            <div className="mt-3 space-y-2">
              {alerts.map((a) => (
                <div key={`${a.title}-${a.severity}`} className="rounded-xl border border-white/10 bg-surface/70 p-3 text-sm">
                  <p className={`font-medium ${a.severity === 'high' ? 'text-[#FF6B6B]' : a.severity === 'medium' ? 'text-[#00BFFF]' : 'text-[#1ED760]'}`}>{a.title}</p>
                  <p className="mt-1 text-muted">{a.message}</p>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      ) : null}
    </div>
  );
}
