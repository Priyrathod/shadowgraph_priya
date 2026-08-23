import { useState } from 'react';
import { motion } from 'framer-motion';
import PageHeader from '../components/PageHeader';
import GlassCard from '../components/GlassCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { EmptyState, ErrorState } from '../components/AsyncState';
import { scanUsername } from '../services/endpoints';
import { getDisplayError } from '../services/apiErrors';
import { useToast } from '../context/ToastContext';

export default function UsernameDiscoveryPage({ embedded = false }) {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const { info, success, error: showError } = useToast();

  const run = async () => {
    if (!username.trim()) {
      info('Enter a username to scan.');
      return;
    }

    setLoading(true);
    setError('');
    setRows([]);
    setProgress(0);

    const timer = setInterval(() => {
      setProgress((value) => (value >= 93 ? value : value + 7));
    }, 140);

    try {
      const result = await scanUsername(username.trim());
      setRows(result);
      success('Username scan completed.');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('shadowgraph:data-updated', {
            detail: { source: 'username_scan', query: username.trim(), rows: result }
          })
        );
      }
    } catch (err) {
      const message = getDisplayError(err, 'Failed to scan username.');
      setError(message);
      showError(message);
    } finally {
      clearInterval(timer);
      setProgress(100);
      setLoading(false);
    }
  };

  return (
    <div>
      {!embedded ? (
        <PageHeader title="Username Discovery" subtitle="Search by username or full name. We try safe public-name variations and show only links that are actually reachable." />
      ) : null}

      <GlassCard className="p-5 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            value={username}
            onChange={(e) => {
              const next = e.target.value;
              setUsername(next);
              if (typeof window !== 'undefined') {
                window.dispatchEvent(
                  new CustomEvent('shadowgraph:data-updated', {
                    detail: { source: 'username_query_changed', query: next.trim() }
                  })
                );
              }
            }}
            placeholder="Enter username or full name (e.g., John Doe)"
            className="sg-input flex-1"
          />
          <button onClick={run} className="sg-button-primary flex min-w-56 items-center justify-center gap-2">
            {loading ? <LoadingSpinner /> : null}
            Scan Across Platforms
          </button>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface">
          <div className="h-full rounded-full bg-gradient-to-r from-accent to-cyan transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {['GitHub', 'LinkedIn', 'LeetCode', 'Stack Overflow', 'X', 'Medium', 'IEEE'].map((platform) => (
            <span key={platform} className="sg-chip">
              {platform}
            </span>
          ))}
        </div>

        {error ? <ErrorState className="mt-5" message={error} onRetry={run} /> : null}

        {!error ? (
          <div className="mt-5 overflow-x-auto rounded-xl border border-white/10 bg-surface/40 p-4">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead>
                <tr className="sg-table-head">
                  <th className="pb-2">Platform</th>
                  <th className="pb-2">Username</th>
                  <th className="pb-2">Profile Link</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.03 }} key={`${row.platform}-${row.link}-${idx}`} className="sg-table-row">
                    <td className="py-3">{row.platform}</td>
                    <td className="py-3">{row.username}</td>
                    <td className="py-3"><a className="text-accent hover:underline" href={row.link} target="_blank" rel="noreferrer">{row.link}</a></td>
                  </motion.tr>
                ))}
              </tbody>
            </table>

            {!rows.length && !loading ? <EmptyState className="mt-3" message="No reachable public profiles were found for this input. Try another name variation." /> : null}
          </div>
        ) : null}
      </GlassCard>
    </div>
  );
}
