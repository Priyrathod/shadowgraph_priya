import { useEffect, useState } from 'react';
import GlassCard from '../components/GlassCard';
import LoadingSpinner from '../components/LoadingSpinner';
import PageHeader from '../components/PageHeader';
import { ErrorState, EmptyState } from '../components/AsyncState';
import { getDigitalFootprintSummary } from '../services/endpoints';
import { getDisplayError } from '../services/apiErrors';

export default function DigitalFootprintSummaryPage({ embedded = false }) {
  const [data, setData] = useState(null);
  const [liveSearch, setLiveSearch] = useState({ query: '', rows: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getDigitalFootprintSummary();
      setData(result);
    } catch (err) {
      setError(getDisplayError(err, 'Could not load your footprint summary.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const handler = (event) => {
      const detail = event?.detail || {};
      if (detail.source === 'username_query_changed') {
        setLiveSearch({
          query: detail.query || '',
          rows: []
        });
        return;
      }
      if (detail.source === 'username_scan') {
        setLiveSearch({
          query: detail.query || '',
          rows: Array.isArray(detail.rows) ? detail.rows : []
        });
      }
      load();
    };
    window.addEventListener('shadowgraph:data-updated', handler);
    return () => window.removeEventListener('shadowgraph:data-updated', handler);
  }, []);

  const safeData = {
    total_accounts_found: Number(data?.total_accounts_found) || 0,
    active_platforms: Array.isArray(data?.active_platforms) ? data.active_platforms : [],
    categories: data?.categories && typeof data.categories === 'object' ? data.categories : {},
    research_papers_found: Number(data?.research_papers_found) || 0,
    breach_records_found: Number(data?.breach_records_found) || 0,
    profiles: Array.isArray(data?.profiles) ? data.profiles : []
  };
  const liveRows = Array.isArray(liveSearch.rows) ? liveSearch.rows : [];
  const searchedProfiles = liveRows.map((row) => ({
    platform: row.platform,
    category: 'Search Result',
    username: row.username,
    profile_url: row.link
  }));
  const searchedActivePlatforms = [...new Set(liveRows.map((row) => row.platform).filter(Boolean))];

  const effectiveProfiles = embedded ? searchedProfiles : (liveRows.length ? searchedProfiles : safeData.profiles);
  const effectiveActivePlatforms = embedded ? searchedActivePlatforms : (liveRows.length ? searchedActivePlatforms : safeData.active_platforms);
  const effectiveTotalAccounts = embedded ? effectiveProfiles.length : (liveRows.length ? searchedProfiles.length : safeData.total_accounts_found);
  const showSearchWaiting = embedded && !!liveSearch.query && !liveRows.length && !loading;
  const showSearchPrompt = embedded && !liveSearch.query && !loading;

  return (
    <div className="text-text">
      {!embedded ? <PageHeader title="Digital Footprint Summary" subtitle="A simple overview of where you appear online." /> : null}

      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {loading ? (
        <div className="rounded-xl border border-white/10 bg-surface/70 p-4 text-sm text-muted">
          <LoadingSpinner /> Building your footprint summary...
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
          <GlassCard className="p-5">
            <h3 className="text-lg font-semibold text-text">Your online visibility</h3>
            {!data ? (
              <p className="mt-2 text-sm text-text/85">
                Live summary is loading. You can run Chapter 1 or Chapter 2 scans and this section will update automatically.
              </p>
            ) : null}
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-surface/70 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">Accounts Found</p>
                <p className="mt-2 text-3xl font-semibold text-text">{effectiveTotalAccounts}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-surface/70 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">Active Platforms</p>
                <p className="mt-2 text-3xl font-semibold text-text">{effectiveActivePlatforms.length}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-surface/70 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">Research Records</p>
                <p className="mt-2 text-3xl font-semibold text-text">{embedded ? 0 : safeData.research_papers_found}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-surface/70 p-3">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">Breach Records</p>
                <p className="mt-2 text-3xl font-semibold text-text">{embedded ? 0 : safeData.breach_records_found}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {effectiveActivePlatforms.map((platform) => (
                <span key={platform} className="sg-chip">{platform}</span>
              ))}
            </div>
            {liveSearch.query ? (
              <p className="mt-3 text-xs text-muted">Showing results for: {liveSearch.query}</p>
            ) : null}
          </GlassCard>

          <GlassCard className="p-5">
            <h3 className="text-lg font-semibold text-text">Platform categories</h3>
            <div className="mt-4 space-y-3 text-sm">
              {Object.entries(safeData.categories).map(([name, count]) => {
                const safeCount = Number(count) || 0;
                const width = Math.max(6, Math.min(100, safeCount * 12));
                return (
                  <div key={name}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-muted">{name}</span>
                      <span className="text-text">{safeCount}</span>
                    </div>
                    <div className="h-2 rounded bg-white/10">
                      <div className="h-2 rounded bg-gradient-to-r from-[#00BFFF] to-[#1ED760]" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>

          <GlassCard className="p-5 xl:col-span-2">
            <h3 className="text-lg font-semibold text-text">Profiles found</h3>
            {showSearchPrompt ? (
              <EmptyState className="mt-3" message="Search a name in Chapter 2 to see Chapter 3 results for that name." />
            ) : null}
            {showSearchWaiting ? (
              <EmptyState className="mt-3" message={`No reachable public profiles found for "${liveSearch.query}". Try another variation.`} />
            ) : null}
            {!showSearchPrompt && !showSearchWaiting && !effectiveProfiles.length ? (
              <EmptyState className="mt-3" message="No profiles available yet." />
            ) : null}
            {effectiveProfiles.length ? (
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {effectiveProfiles.map((row, idx) => (
                  <div key={`${row.platform || 'platform'}-${row.profile_url || 'url'}-${idx}`} className="rounded-xl border border-white/10 bg-surface/70 p-3">
                    <p className="text-sm font-medium text-text">{row.platform}</p>
                    <p className="text-xs text-muted">{row.category}</p>
                    <p className="mt-1 text-xs text-muted">@{row.username || 'unknown'}</p>
                    <a href={row.profile_url} className="mt-2 block truncate text-xs text-accent hover:underline">
                      {row.profile_url}
                    </a>
                  </div>
                ))}
              </div>
            ) : null}
          </GlassCard>
        </div>
      ) : null}
    </div>
  );
}
