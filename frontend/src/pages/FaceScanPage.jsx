import { useState } from 'react';
import { motion } from 'framer-motion';
import PageHeader from '../components/PageHeader';
import GlassCard from '../components/GlassCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { EmptyState, ErrorState } from '../components/AsyncState';
import { scanFace } from '../services/endpoints';
import { getDisplayError } from '../services/apiErrors';
import { useToast } from '../context/ToastContext';

export default function FaceScanPage({ fakeMode = false, embedded = false }) {
  const [preview, setPreview] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const { success, error: showError, info } = useToast();

  const runScan = async () => {
    if (!selectedFile) {
      info('Upload an image first.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await scanFace(selectedFile, searchText);
      setResult(data);
      success(fakeMode ? 'Fake detection complete' : 'Face scan complete');
      if (!fakeMode && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('shadowgraph:data-updated', { detail: { source: 'face_scan' } }));
      }
    } catch (err) {
      const message = getDisplayError(err, 'Failed to complete scan.');
      setError(message);
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {!embedded ? (
        <PageHeader
          title={fakeMode ? 'Fake Detection' : 'Face Scan'}
          subtitle={
            fakeMode
              ? 'Assess synthetic media probability and manipulation signals.'
              : 'Capture or upload facial input to correlate profiles with confidence scoring.'
          }
        />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
        <GlassCard className="p-5 md:p-6">
          <p className="sg-kicker">Image Intelligence</p>
          <div className="mt-3">
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="sg-input"
              placeholder="Name or handle to search (optional)"
            />
          </div>
          <div className="mt-4 flex h-72 items-center justify-center rounded-xl border border-dashed border-white/20 bg-surface/45 md:h-80">
            {preview ? (
              <img src={preview} alt="Face preview" className="h-full w-full rounded-xl object-cover" />
            ) : (
              <p className="text-sm text-muted">Upload image to start scan</p>
            )}
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-2">
            <label className="sg-button-secondary cursor-pointer text-center">
              Upload Image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setSelectedFile(file);
                    setPreview(URL.createObjectURL(file));
                  }
                }}
              />
            </label>
            <button onClick={runScan} disabled={loading} className="sg-button-primary flex items-center justify-center gap-2">
              {loading ? <LoadingSpinner /> : null}
              {loading ? 'Scanning...' : fakeMode ? 'Run Fake Detection' : 'Scan Face'}
            </button>
          </div>

          <details className="mt-4 rounded-xl border border-white/10 bg-surface/60 p-4 text-sm text-muted">
            <summary className="cursor-pointer text-text">Expand scan methodology</summary>
            <p className="mt-3 leading-7">
              The scan processes uploaded media, performs face analysis, then maps confidence indicators and anti-spoof outputs to a
              structured response for rapid review.
            </p>
          </details>
        </GlassCard>

        <div>
          {error ? <ErrorState message={error} onRetry={runScan} /> : null}
          {!error ? (
            <GlassCard className="p-5 md:p-6">
              <h3 className="text-lg font-semibold">Scan Results</h3>
              {!result ? <EmptyState className="mt-3" message="No result yet. Execute a scan to view matched identities and model confidence." /> : null}

              {result ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-white/10 bg-surface/85 p-3 text-sm text-muted">Faces detected: {result.faces_detected}</div>

                  {result.matched_profiles.length ? (
                    result.matched_profiles.map((profile, idx) => (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        key={`${profile.platform}-${idx}`}
                        className="rounded-xl border border-white/10 bg-surface/85 p-3"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm">{profile.platform}</p>
                          <p className="text-sm text-cyan">{profile.confidence}%</p>
                        </div>
                        {profile.profile_url ? (
                          <a href={profile.profile_url} className="mt-1 block text-xs text-accent hover:underline">
                            {profile.profile_url}
                          </a>
                        ) : null}
                        <div className="mt-2 h-1.5 overflow-hidden rounded bg-white/10">
                          <div className="h-full rounded bg-gradient-to-r from-accent to-cyan" style={{ width: `${profile.confidence}%` }} />
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-white/10 bg-surface/85 p-3 text-sm text-muted">No gallery matches found.</div>
                  )}

                  <div className="rounded-xl border border-cyan/30 bg-cyan/10 p-3">
                    <p className="text-sm">Fake detection confidence: {result.fake_detection_confidence}%</p>
                    <p className="mt-1 text-xs text-muted">Label: {result.fake_detection_label}</p>
                  </div>

                  {result.online_presence?.length ? (
                    <div className="rounded-xl border border-white/10 bg-surface/85 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm">Online presence matches</p>
                        <p className="text-xs text-muted">
                          {result.presence_summary?.profiles_found || result.online_presence.length} found
                        </p>
                      </div>
                      <div className="max-h-56 space-y-2 overflow-auto pr-1">
                        {result.online_presence.map((row) => (
                          <div key={`${row.platform}-${row.profile_url}`} className="rounded-lg border border-white/10 bg-[#1a1a1f] p-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm">{row.platform}</p>
                              <p className="text-xs text-muted">@{row.username}</p>
                            </div>
                            {row.image_preview ? (
                              <img src={row.image_preview} alt={row.platform} className="mt-2 h-16 w-16 rounded object-cover" />
                            ) : null}
                            <a href={row.profile_url} className="mt-2 block truncate text-xs text-accent hover:underline">
                              {row.profile_url}
                            </a>
                            {row.face_match_confidence !== null && row.face_match_confidence !== undefined ? (
                              <p className="mt-1 text-xs text-cyan">Face match confidence: {row.face_match_confidence}%</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {result.anti_spoof_model ? (
                    <div className="rounded-xl border border-white/10 bg-surface/85 p-3 text-xs text-muted">
                      <p>Anti-spoof model: {result.anti_spoof_model}</p>
                    </div>
                  ) : null}

                  {result.signals && Object.keys(result.signals).length ? (
                    <div className="rounded-xl border border-white/10 bg-surface/85 p-3 text-xs text-muted">
                      <p>Blur variance: {result.signals.blur_variance}</p>
                      <p>Brightness mean: {result.signals.brightness_mean}</p>
                      <p>Edge ratio: {result.signals.edge_ratio}</p>
                      <p>Face area ratio: {result.signals.face_area_ratio}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </GlassCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}
