import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import GlassCard from '../components/GlassCard';
import CircularScore from '../components/CircularScore';
import RadarChart from '../components/RadarChart';
import SkeletonCard from '../components/SkeletonCard';
import { ErrorState } from '../components/AsyncState';
import { calculateRisk } from '../services/endpoints';
import { getDisplayError } from '../services/apiErrors';
import { useToast } from '../context/ToastContext';

export default function ExposureScorePage({ embedded = false }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const { error: showError } = useToast();

  const loadRisk = async () => {
    setError('');
    try {
      const result = await calculateRisk();
      setData(result);
    } catch (err) {
      const message = getDisplayError(err, 'Failed to load exposure score.');
      setError(message);
      showError(message);
    }
  };

  useEffect(() => {
    loadRisk();
  }, []);

  return (
    <div>
      {!embedded ? (
        <PageHeader title="Exposure Score" subtitle="Consolidated 0-100 risk intelligence with category-level diagnostics and mitigation guidance." />
      ) : null}

      {error ? <ErrorState message={error} onRetry={loadRisk} /> : null}

      {!error && !data ? (
        <div className="grid gap-4 md:grid-cols-2">
          <SkeletonCard className="h-80" />
          <SkeletonCard className="h-80" />
        </div>
      ) : null}

      {!error && data ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <GlassCard className="p-6">
            <CircularScore score={data.score} />
            <div className="mt-6 space-y-2">
              {data.tips.map((tip) => (
                <div key={tip} className="rounded-xl border border-white/10 bg-surface/70 px-4 py-3 text-sm text-muted">
                  {tip}
                </div>
              ))}
            </div>
          </GlassCard>

          <RadarChart values={data.vector} />
        </div>
      ) : null}
    </div>
  );
}
