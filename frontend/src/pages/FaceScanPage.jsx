import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PageHeader from '../components/PageHeader';
import GlassCard from '../components/GlassCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { EmptyState, ErrorState } from '../components/AsyncState';
import { scanFace } from '../services/endpoints';
import { getDisplayError } from '../services/apiErrors';
import { useToast } from '../context/ToastContext';

// ─── Webcam hook ──────────────────────────────────────────────────────────────
function useWebcam() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [active, setActive] = useState(false);
  const [err, setErr] = useState('');

  const start = useCallback(async () => {
    setErr('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
    } catch (e) {
      setErr(e.message || 'Camera access denied.');
    }
  }, []);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setActive(false);
  }, []);

  // Capture a single frame as a Blob
  const captureFrame = useCallback(
    () =>
      new Promise((resolve, reject) => {
        if (!videoRef.current || !active) {
          reject(new Error('Webcam not active'));
          return;
        }
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth || 640;
        canvas.height = videoRef.current.videoHeight || 480;
        canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
        canvas.toBlob(
          (blob) => {
            if (!blob) reject(new Error('Frame capture failed'));
            else resolve(blob);
          },
          'image/jpeg',
          0.88,
        );
      }),
    [active],
  );

  // Cleanup on unmount
  useEffect(() => () => stop(), [stop]);

  return { videoRef, active, err, start, stop, captureFrame };
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function FaceScanPage({ fakeMode = false, embedded = false }) {
  const [mode, setMode] = useState('upload'); // 'upload' | 'webcam'
  const [preview, setPreview] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [liveScanning, setLiveScanning] = useState(false);
  const liveIntervalRef = useRef(null);
  const { success, error: showError, info } = useToast();
  const webcam = useWebcam();

  // ── Upload mode: run once ────────────────────────────────────────────────
  const runScan = async (fileOverride = null) => {
    const file = fileOverride || selectedFile;
    if (!file) {
      info('Upload an image first.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await scanFace(file, searchText);
      setResult(data);
      success(fakeMode ? 'Fake detection complete' : 'Face scan complete');
      if (!fakeMode && typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('shadowgraph:data-updated', { detail: { source: 'face_scan' } }),
        );
      }
    } catch (err) {
      const message = getDisplayError(err, 'Failed to complete scan.');
      setError(message);
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  // ── Webcam mode: capture one frame and scan ──────────────────────────────
  const captureAndScan = useCallback(async () => {
    if (loading) return;
    try {
      const blob = await webcam.captureFrame();
      const file = new File([blob], 'webcam_frame.jpg', { type: 'image/jpeg' });
      // Show frame preview
      setPreview(URL.createObjectURL(blob));
      await runScan(file);
    } catch (e) {
      const msg = e.message || 'Capture failed';
      setError(msg);
      showError(msg);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webcam, loading, searchText, fakeMode]);

  // ── Live continuous scanning (every 3 seconds) ──────────────────────────
  const startLive = useCallback(() => {
    if (liveIntervalRef.current) return;
    setLiveScanning(true);
    liveIntervalRef.current = setInterval(captureAndScan, 3000);
  }, [captureAndScan]);

  const stopLive = useCallback(() => {
    if (liveIntervalRef.current) {
      clearInterval(liveIntervalRef.current);
      liveIntervalRef.current = null;
    }
    setLiveScanning(false);
  }, []);

  // Stop live on mode switch / unmount
  useEffect(() => {
    return () => stopLive();
  }, [stopLive]);

  const switchMode = (m) => {
    stopLive();
    webcam.stop();
    setMode(m);
    setResult(null);
    setError('');
    setPreview('');
    setSelectedFile(null);
  };

  // ─── Render ────────────────────────────────────────────────────────────────
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

      {/* Mode toggle */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => switchMode('upload')}
          className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
            mode === 'upload'
              ? 'bg-accent text-white'
              : 'border border-white/15 text-muted hover:border-white/30 hover:text-text'
          }`}
        >
          📁 Upload Image
        </button>
        <button
          onClick={() => switchMode('webcam')}
          className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
            mode === 'webcam'
              ? 'bg-accent text-white'
              : 'border border-white/15 text-muted hover:border-white/30 hover:text-text'
          }`}
        >
          📷 Live Webcam
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
        {/* ── Left panel ────────────────────────────────────────────────── */}
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

          {/* Preview / video area */}
          <div className="mt-4 relative flex h-72 items-center justify-center rounded-xl border border-dashed border-white/20 bg-surface/45 md:h-80 overflow-hidden">
            {mode === 'webcam' ? (
              <>
                <video
                  ref={webcam.videoRef}
                  className="h-full w-full rounded-xl object-cover"
                  muted
                  playsInline
                  style={{ display: webcam.active ? 'block' : 'none' }}
                />
                {!webcam.active && (
                  <p className="text-sm text-muted">Camera off — click Start Camera</p>
                )}
                {/* Live pulse indicator */}
                {liveScanning && (
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-red-600/90 px-2.5 py-1 text-xs text-white">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                    LIVE
                  </div>
                )}
                {/* Captured frame overlay */}
                {preview && !liveScanning && (
                  <img
                    src={preview}
                    alt="Captured frame"
                    className="absolute inset-0 h-full w-full rounded-xl object-cover opacity-60"
                  />
                )}
              </>
            ) : preview ? (
              <img src={preview} alt="Face preview" className="h-full w-full rounded-xl object-cover" />
            ) : (
              <p className="text-sm text-muted">Upload image to start scan</p>
            )}
          </div>

          {/* Action buttons */}
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {mode === 'upload' ? (
              <>
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
                <button
                  onClick={() => runScan()}
                  disabled={loading}
                  className="sg-button-primary flex items-center justify-center gap-2"
                >
                  {loading ? <LoadingSpinner /> : null}
                  {loading ? 'Scanning…' : fakeMode ? 'Run Fake Detection' : 'Scan Face'}
                </button>
              </>
            ) : (
              <>
                {!webcam.active ? (
                  <button onClick={webcam.start} className="sg-button-secondary col-span-2">
                    📷 Start Camera
                  </button>
                ) : (
                  <>
                    <button
                      onClick={captureAndScan}
                      disabled={loading}
                      className="sg-button-secondary flex items-center justify-center gap-2"
                    >
                      {loading ? <LoadingSpinner /> : null}
                      {loading ? 'Scanning…' : '📸 Scan Frame'}
                    </button>

                    {liveScanning ? (
                      <button
                        onClick={stopLive}
                        className="sg-button-primary bg-red-600 hover:bg-red-500"
                      >
                        ⏹ Stop Live
                      </button>
                    ) : (
                      <button
                        onClick={startLive}
                        className="sg-button-primary flex items-center gap-1.5"
                      >
                        <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
                        Live Scan
                      </button>
                    )}
                  </>
                )}
                {webcam.active && (
                  <button onClick={webcam.stop} className="sg-button-secondary col-span-2 text-xs text-muted">
                    Stop Camera
                  </button>
                )}
              </>
            )}
          </div>

          {webcam.err && (
            <p className="mt-3 rounded-lg border border-red-500/40 bg-red-900/20 px-3 py-2 text-xs text-red-400">
              ⚠ {webcam.err}
            </p>
          )}

          <details className="mt-4 rounded-xl border border-white/10 bg-surface/60 p-4 text-sm text-muted">
            <summary className="cursor-pointer text-text">Expand scan methodology</summary>
            <p className="mt-3 leading-7">
              {mode === 'webcam'
                ? 'Live Scan captures a JPEG frame every 3 seconds and submits it to the backend face analysis pipeline — face detection, anti-spoof scoring, gallery matching, and optional name-based presence search all run on each frame.'
                : 'The scan processes uploaded media, performs face analysis, then maps confidence indicators and anti-spoof outputs to a structured response for rapid review.'}
            </p>
          </details>
        </GlassCard>

        {/* ── Right panel: results ───────────────────────────────────────── */}
        <div>
          {error ? <ErrorState message={error} onRetry={mode === 'upload' ? runScan : captureAndScan} /> : null}
          {!error ? (
            <GlassCard className="p-5 md:p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Scan Results</h3>
                {liveScanning && (
                  <span className="flex items-center gap-1.5 text-xs text-red-400">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" /> Auto-updating
                  </span>
                )}
              </div>

              {!result ? (
                <EmptyState
                  className="mt-3"
                  message="No result yet. Execute a scan to view matched identities and model confidence."
                />
              ) : null}

              <AnimatePresence mode="wait">
                {result ? (
                  <motion.div
                    key={result.faces_detected + '-' + result.fake_detection_confidence}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-4 space-y-3"
                  >
                    <div className="rounded-xl border border-white/10 bg-surface/85 p-3 text-sm text-muted">
                      Faces detected: <span className="text-text">{result.faces_detected}</span>
                    </div>

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
                            <a
                              href={profile.profile_url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 block text-xs text-accent hover:underline"
                            >
                              {profile.profile_url}
                            </a>
                          ) : null}
                          <div className="mt-2 h-1.5 overflow-hidden rounded bg-white/10">
                            <div
                              className="h-full rounded bg-gradient-to-r from-accent to-cyan"
                              style={{ width: `${profile.confidence}%` }}
                            />
                          </div>
                        </motion.div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-white/10 bg-surface/85 p-3 text-sm text-muted">
                        No gallery matches found.
                      </div>
                    )}

                    <div className="rounded-xl border border-cyan/30 bg-cyan/10 p-3">
                      <p className="text-sm">
                        Fake detection confidence:{' '}
                        <span className="font-semibold">{result.fake_detection_confidence}%</span>
                      </p>
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
                            <div
                              key={`${row.platform}-${row.profile_url}`}
                              className="rounded-lg border border-white/10 bg-[#1a1a1f] p-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm">{row.platform}</p>
                                <p className="text-xs text-muted">@{row.username}</p>
                              </div>
                              {row.image_preview ? (
                                <img
                                  src={row.image_preview}
                                  alt={row.platform}
                                  className="mt-2 h-16 w-16 rounded object-cover"
                                />
                              ) : null}
                              <a
                                href={row.profile_url}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-2 block truncate text-xs text-accent hover:underline"
                              >
                                {row.profile_url}
                              </a>
                              {row.face_match_confidence !== null &&
                              row.face_match_confidence !== undefined ? (
                                <p className="mt-1 text-xs text-cyan">
                                  Face match confidence: {row.face_match_confidence}%
                                </p>
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
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </GlassCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}
