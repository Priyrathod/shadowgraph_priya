import { useState } from 'react';
import PageHeader from '../components/PageHeader';
import GlassCard from '../components/GlassCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { ErrorState, EmptyState } from '../components/AsyncState';
import { useToast } from '../context/ToastContext';
import { scrapeAggregate } from '../services/endpoints';
import { getDisplayError } from '../services/apiErrors';

export default function ScrapeAggregationPage({ embedded = false }) {
  const [seedUrlsInput, setSeedUrlsInput] = useState('https://example.com');
  const [keywordsInput, setKeywordsInput] = useState('security, breach, privacy');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const { error: toastError, success } = useToast();

  const run = async () => {
    const seed_urls = seedUrlsInput
      .split('\n')
      .map((v) => v.trim())
      .filter(Boolean);
    const keywords = keywordsInput
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);

    if (!seed_urls.length) {
      toastError('Provide at least one seed URL.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await scrapeAggregate({ seed_urls, keywords, max_pages: 6, same_domain_only: true });
      setResult(data);
      success('Scraping pipeline completed.');
    } catch (err) {
      const message = getDisplayError(err, 'Scraping failed.');
      setError(message);
      toastError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {!embedded ? (
        <PageHeader
          title="Web Scraping & Aggregation"
          subtitle="Crawl seed URLs, extract signals, and aggregate keywords/emails across discovered pages."
        />
      ) : null}

      <GlassCard className="p-5 md:p-6">
        <div className="grid gap-3 xl:grid-cols-2">
          <div>
            <label className="text-xs uppercase tracking-[0.16em] text-muted">Seed URLs (one per line)</label>
            <textarea value={seedUrlsInput} onChange={(e) => setSeedUrlsInput(e.target.value)} rows={7} className="sg-textarea mt-2" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.16em] text-muted">Keywords (comma-separated)</label>
            <textarea value={keywordsInput} onChange={(e) => setKeywordsInput(e.target.value)} rows={7} className="sg-textarea mt-2" />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button onClick={run} disabled={loading} className="sg-button-primary flex items-center gap-2">
            {loading ? <LoadingSpinner /> : null}
            Run Scrape Pipeline
          </button>
          <span className="sg-chip">Crawl Orchestration</span>
          <span className="sg-chip">Aggregate Signals</span>
        </div>
      </GlassCard>

      {error ? <ErrorState className="mt-4" message={error} onRetry={run} /> : null}

      {!error && result ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <GlassCard className="p-5">
            <h3 className="text-lg font-semibold">Aggregates</h3>
            <div className="mt-3 grid gap-2 text-sm text-muted">
              <p>Pages scraped: {result.aggregates.pages_scraped}</p>
              <p>Unique links: {result.aggregates.unique_links}</p>
              <p>Emails found: {result.aggregates.emails_found.length}</p>
            </div>
            <div className="mt-3 rounded-xl border border-white/10 bg-surface/70 p-3 text-xs text-muted">
              {Object.entries(result.aggregates.keyword_totals || {}).map(([k, v]) => (
                <p key={k}>
                  {k}: {v}
                </p>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <h3 className="text-lg font-semibold">Scraped Pages</h3>
            <div className="mt-2 max-h-72 space-y-2 overflow-auto pr-1">
              {result.pages.map((page) => (
                <div key={page.url} className="rounded-xl border border-white/10 bg-surface/70 p-3 text-xs">
                  <p className="font-medium text-text">{page.title}</p>
                  <p className="mt-1 text-muted">{page.url}</p>
                  <p className="mt-1 text-muted">Status: {page.status}</p>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      ) : null}

      {!error && !result && !loading ? <EmptyState className="mt-4" message="Run the scrape pipeline to see aggregated intelligence." /> : null}
    </div>
  );
}
