import { useState } from 'react';
import PageHeader from '../components/PageHeader';
import GlassCard from '../components/GlassCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { EmptyState, ErrorState } from '../components/AsyncState';
import { checkBreach } from '../services/endpoints';
import { getDisplayError } from '../services/apiErrors';
import { useToast } from '../context/ToastContext';

export default function BreachMonitorPage({ embedded = false }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const { info, success, error: showError } = useToast();

  const run = async () => {
    if (!email.trim()) {
      info('Enter an email to check breaches.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await checkBreach(email.trim());
      setRows(data);
      success('Breach scan completed.');
    } catch (err) {
      const message = getDisplayError(err, 'Failed to fetch breach records.');
      setError(message);
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {!embedded ? (
        <PageHeader title="Breach Monitor" subtitle="Have I Been Pwned-compatible breach check workflow (mocked integration layer)." />
      ) : null}

      <GlassCard className="p-5 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter email" className="sg-input flex-1" />
          <button onClick={run} className="sg-button-primary flex min-w-56 items-center justify-center gap-2">
            {loading ? <LoadingSpinner /> : null}
            Check Breach Exposure
          </button>
        </div>
      </GlassCard>

      {error ? <ErrorState className="mt-4" message={error} onRetry={run} /> : null}

      {!error ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {rows.map((row) => (
            <GlassCard
              key={row.site}
              className={`p-5 ${
                row.risk === 'high' ? 'border border-red-500/35 shadow-[0_0_24px_rgba(239,68,68,0.12)]' : 'border border-emerald-500/30'
              }`}
            >
              <div className="flex items-start justify-between">
                <h3 className="text-lg font-semibold">{row.site}</h3>
                <span className={`rounded-full px-2.5 py-1 text-xs ${row.risk === 'high' ? 'bg-red-500/20 text-red-200' : 'bg-emerald-500/20 text-emerald-200'}`}>
                  {row.risk.toUpperCase()} RISK
                </span>
              </div>
              <p className="mt-3 text-sm text-muted">Data exposed: {row.data}</p>
              <p className="mt-1 text-sm text-muted">Date of breach: {row.date}</p>
            </GlassCard>
          ))}

          {!rows.length && !loading ? <EmptyState className="xl:col-span-2" message="Provide an email to check breach exposure timeline." /> : null}
        </div>
      ) : null}
    </div>
  );
}
