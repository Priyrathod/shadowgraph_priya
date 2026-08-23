import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import GlassCard from '../components/GlassCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { ErrorState, EmptyState } from '../components/AsyncState';
import { useToast } from '../context/ToastContext';
import { exportPdfReport, getReportHistory } from '../services/endpoints';
import { getDisplayError } from '../services/apiErrors';

export default function ReportsPage({ embedded = false }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const { success, error: toastError } = useToast();

  const load = async () => {
    setError('');
    setLoading(true);
    try {
      const rows = await getReportHistory();
      setEvents(rows);
    } catch (err) {
      const message = getDisplayError(err, 'Failed to load report history.');
      setError(message);
      toastError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onExport = async () => {
    try {
      setExporting(true);
      const blob = await exportPdfReport();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'shadowgraph-report.pdf';
      link.click();
      URL.revokeObjectURL(url);
      success('Report download started');
    } catch (err) {
      toastError(getDisplayError(err, 'Failed to export PDF report.'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      {!embedded ? (
        <PageHeader
          title="Reports"
          subtitle="Export PDF reports and review recent intelligence event history."
          actions={
            <button onClick={onExport} disabled={exporting} className="sg-button-primary px-4 py-2 text-sm">
              {exporting ? 'Exporting...' : 'Export PDF'}
            </button>
          }
        />
      ) : null}

      {embedded ? (
        <div className="mb-4 flex justify-end">
          <button onClick={onExport} disabled={exporting} className="sg-button-primary px-4 py-2 text-sm">
            {exporting ? 'Exporting...' : 'Download PDF Report'}
          </button>
        </div>
      ) : null}

      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {loading ? (
        <div className="rounded-xl border border-white/10 bg-surface/70 p-4 text-sm text-muted">
          <LoadingSpinner /> Loading report history...
        </div>
      ) : null}

      {!loading && !error && events.length ? (
        <GlassCard className="p-5">
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-surface/40 p-4">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="sg-table-head">
                  <th className="pb-2">Time</th>
                  <th className="pb-2">Type</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Keys</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} className="sg-table-row">
                    <td className="py-3 text-xs text-muted">{event.created_at}</td>
                    <td className="py-3">{event.scan_type}</td>
                    <td className="py-3">{event.summary?.status || '-'}</td>
                    <td className="py-3 text-xs text-muted">{(event.summary?.keys || []).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      ) : null}

      {!loading && !error && !events.length ? <EmptyState message="No report history yet. Run scans to generate events." /> : null}
    </div>
  );
}
