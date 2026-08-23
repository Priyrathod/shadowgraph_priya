import { useEffect, useState } from 'react';
import GlassCard from '../components/GlassCard';
import PageHeader from '../components/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';
import { ErrorState } from '../components/AsyncState';
import { getActivityTimeline, getAchievements, getPublicPersonaScore } from '../services/endpoints';
import { getDisplayError } from '../services/apiErrors';

export default function TimelinePersonaPage({ embedded = false }) {
  const [timeline, setTimeline] = useState([]);
  const [persona, setPersona] = useState(null);
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [timelineRows, personaData, badgeRows] = await Promise.all([
        getActivityTimeline(),
        getPublicPersonaScore(),
        getAchievements(),
      ]);
      setTimeline(timelineRows);
      setPersona(personaData);
      setBadges(badgeRows);
    } catch (err) {
      setError(getDisplayError(err, 'Could not load timeline and persona score.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      {!embedded ? <PageHeader title="Timeline, Persona & Achievements" subtitle="Track your milestones, persona score, and earned badges." /> : null}
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {loading ? (
        <div className="rounded-xl border border-white/10 bg-surface/70 p-4 text-sm text-muted">
          <LoadingSpinner /> Loading timeline and score...
        </div>
      ) : null}
      {!loading && !error ? (
        <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
          <GlassCard className="p-5">
            <h3 className="text-lg font-semibold">Interactive timeline</h3>
            <div className="mt-3 max-h-80 space-y-2 overflow-auto pr-1">
              {timeline.slice(-40).map((row) => (
                <div key={`${row.date}-${row.type}`} className="rounded-xl border border-white/10 bg-surface/70 p-3 text-sm">
                  <p className="font-medium text-text">{row.type}</p>
                  <p className="text-xs text-muted">{new Date(row.date).toLocaleString()}</p>
                  <p className="mt-1 text-muted">{row.summary}</p>
                </div>
              ))}
            </div>
          </GlassCard>
          <div className="space-y-4">
            <GlassCard className="p-5">
              <h3 className="text-lg font-semibold">Public persona score</h3>
              <p className="mt-3 text-5xl font-semibold">{persona?.persona_score ?? '--'}</p>
              <div className="mt-3 space-y-2 text-sm text-muted">
                {(persona?.suggestions || []).map((s) => (
                  <div key={s} className="rounded-lg border border-white/10 bg-surface/70 p-2">{s}</div>
                ))}
              </div>
            </GlassCard>
            <GlassCard className="p-5">
              <h3 className="text-lg font-semibold">Gamified achievements</h3>
              <div className="mt-3 grid gap-2">
                {badges.map((b) => (
                  <div key={b.id} className="rounded-xl border border-white/10 bg-surface/70 p-3 text-sm">
                    <p className="font-medium text-[#1ED760]">{b.title}</p>
                    <p className="text-muted">{b.description}</p>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        </div>
      ) : null}
    </div>
  );
}
