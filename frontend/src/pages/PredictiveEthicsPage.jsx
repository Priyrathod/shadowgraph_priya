import { useEffect, useState } from 'react';
import GlassCard from '../components/GlassCard';
import PageHeader from '../components/PageHeader';
import { ErrorState } from '../components/AsyncState';
import LoadingSpinner from '../components/LoadingSpinner';
import { getDisplayError } from '../services/apiErrors';
import { getEthicalVerification, getPredictiveAnalytics } from '../services/endpoints';

export default function PredictiveEthicsPage({ embedded = false }) {
  const [forecast, setForecast] = useState([]);
  const [actions, setActions] = useState([]);
  const [checklist, setChecklist] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [pred, ethical] = await Promise.all([getPredictiveAnalytics(), getEthicalVerification()]);
      setForecast(pred.forecast || []);
      setActions(pred.actions || []);
      setChecklist(ethical || []);
    } catch (err) {
      setError(getDisplayError(err, 'Could not load predictive analytics and verification.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      {!embedded ? <PageHeader title="Predictive Analytics & Ethical Verification" subtitle="Forecast your visibility growth and verify ethical data boundaries." /> : null}
      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {loading ? (
        <div className="rounded-xl border border-white/10 bg-surface/70 p-4 text-sm text-muted">
          <LoadingSpinner /> Loading predictive analytics...
        </div>
      ) : null}
      {!loading && !error ? (
        <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
          <GlassCard className="p-5">
            <h3 className="text-lg font-semibold">Visibility growth forecast</h3>
            <div className="mt-3 space-y-3">
              {forecast.map((row) => (
                <div key={row.month}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-muted">Month {row.month}</span>
                    <span>{row.visibility_index}</span>
                  </div>
                  <div className="h-2 rounded bg-white/10">
                    <div className="h-2 rounded bg-gradient-to-r from-[#00BFFF] to-[#1ED760]" style={{ width: `${row.visibility_index}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              {actions.map((item) => (
                <div key={item} className="rounded-xl border border-white/10 bg-surface/70 p-3 text-sm text-muted">{item}</div>
              ))}
            </div>
          </GlassCard>
          <GlassCard className="p-5">
            <h3 className="text-lg font-semibold">Ethical verification layer</h3>
            <div className="mt-3 space-y-2">
              {checklist.map((item) => (
                <div key={item.item} className="rounded-xl border border-white/10 bg-surface/70 p-3 text-sm">
                  <p className="font-medium text-text">{item.item}</p>
                  <p className={`mt-1 ${item.status ? 'text-[#1ED760]' : 'text-[#FF6B6B]'}`}>{item.status ? 'Verified' : 'Needs review'}</p>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      ) : null}
    </div>
  );
}
