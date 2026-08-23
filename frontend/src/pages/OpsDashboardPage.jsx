import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import GlassCard from '../components/GlassCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { ErrorState } from '../components/AsyncState';
import { useToast } from '../context/ToastContext';
import {
  createCrawlerSchedule,
  deleteCrawlerSchedule,
  enqueueScrapeJob,
  getAuditEvents,
  listCrawlerSchedules,
  listScrapeJobs
} from '../services/endpoints';
import { getDisplayError } from '../services/apiErrors';

export default function OpsDashboardPage() {
  const [jobs, setJobs] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [auditEvents, setAuditEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [seedUrl, setSeedUrl] = useState('https://example.com');
  const [keywords, setKeywords] = useState('security,privacy');
  const [intervalMinutes, setIntervalMinutes] = useState(60);
  const { success, error: toastError } = useToast();

  const load = async () => {
    setError('');
    setLoading(true);
    try {
      const [jobRows, scheduleRows, auditRows] = await Promise.all([listScrapeJobs(), listCrawlerSchedules(), getAuditEvents()]);
      setJobs(jobRows);
      setSchedules(scheduleRows);
      setAuditEvents(auditRows.slice(0, 25));
    } catch (err) {
      const message = getDisplayError(err, 'Failed to load ops dashboard.');
      setError(message);
      toastError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 7000);
    return () => clearInterval(timer);
  }, []);

  const parsePayload = () => {
    const seed_urls = seedUrl
      .split('\n')
      .map((v) => v.trim())
      .filter(Boolean);
    const keywordList = keywords
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    return { seed_urls, keywords: keywordList, max_pages: 6, same_domain_only: true };
  };

  const onEnqueueJob = async () => {
    try {
      const payload = parsePayload();
      await enqueueScrapeJob(payload);
      success('Scrape job queued');
      load();
    } catch (err) {
      toastError(getDisplayError(err, 'Failed to queue scrape job.'));
    }
  };

  const onCreateSchedule = async () => {
    try {
      const payload = { ...parsePayload(), interval_minutes: Number(intervalMinutes) || 60 };
      await createCrawlerSchedule(payload);
      success('Crawler schedule created');
      load();
    } catch (err) {
      toastError(getDisplayError(err, 'Failed to create schedule.'));
    }
  };

  const onDeleteSchedule = async (scheduleId) => {
    try {
      await deleteCrawlerSchedule(scheduleId);
      success('Schedule deleted');
      load();
    } catch (err) {
      toastError(getDisplayError(err, 'Failed to delete schedule.'));
    }
  };

  return (
    <div>
      <PageHeader title="Ops Dashboard" subtitle="Monitor crawler jobs, schedules, and audit events for platform operations." />

      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {loading ? (
        <div className="rounded-xl border border-white/10 bg-surface/70 p-4 text-sm text-muted">
          <LoadingSpinner /> Loading ops data...
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <GlassCard className="p-5">
          <h3 className="text-lg font-semibold">Queue & Scheduler</h3>
          <textarea value={seedUrl} onChange={(e) => setSeedUrl(e.target.value)} rows={3} className="sg-textarea mt-3" />
          <input value={keywords} onChange={(e) => setKeywords(e.target.value)} className="sg-input mt-2" />
          <div className="mt-2 flex items-center gap-2">
            <input type="number" min={5} value={intervalMinutes} onChange={(e) => setIntervalMinutes(e.target.value)} className="sg-input w-32" />
            <span className="text-xs text-muted">minutes</span>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={onEnqueueJob} className="sg-button-primary px-3 py-2 text-sm font-medium">
              Queue Job
            </button>
            <button onClick={onCreateSchedule} className="sg-button-secondary px-3 py-2 text-sm">
              Create Schedule
            </button>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <h3 className="text-lg font-semibold">Active Schedules</h3>
          <div className="mt-3 max-h-56 space-y-2 overflow-auto">
            {schedules.map((schedule) => (
              <div key={schedule.schedule_id} className="rounded-xl border border-white/10 bg-surface/70 p-3 text-xs">
                <p className="text-text">{schedule.schedule_id}</p>
                <p className="text-muted">Interval: {schedule.interval_minutes} min</p>
                <button onClick={() => onDeleteSchedule(schedule.schedule_id)} className="mt-2 rounded-lg bg-red-500/20 px-2 py-1 text-red-200">
                  Delete
                </button>
              </div>
            ))}
            {!schedules.length ? <p className="text-xs text-muted">No schedules configured.</p> : null}
          </div>
        </GlassCard>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <GlassCard className="p-5">
          <h3 className="text-lg font-semibold">Recent Jobs</h3>
          <div className="mt-2 max-h-64 space-y-2 overflow-auto">
            {jobs.map((job) => (
              <div key={job.job_id} className="rounded-xl border border-white/10 bg-surface/70 p-3 text-xs">
                <p className="text-text">{job.job_id}</p>
                <p className="text-muted">Status: {job.status}</p>
              </div>
            ))}
            {!jobs.length ? <p className="text-xs text-muted">No jobs yet.</p> : null}
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <h3 className="text-lg font-semibold">Audit Feed</h3>
          <div className="mt-2 max-h-64 space-y-2 overflow-auto">
            {auditEvents.map((event) => (
              <div key={event.id} className="rounded-xl border border-white/10 bg-surface/70 p-3 text-xs">
                <p className="text-text">{event.event_type}</p>
                <p className="text-muted">{event.created_at}</p>
              </div>
            ))}
            {!auditEvents.length ? <p className="text-xs text-muted">No audit events yet.</p> : null}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
