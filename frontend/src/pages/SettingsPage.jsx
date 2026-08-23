import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import PageHeader from '../components/PageHeader';
import GlassCard from '../components/GlassCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { ErrorState } from '../components/AsyncState';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { deleteAccount, exportPdfReport, getSettings, saveSettings } from '../services/endpoints';
import { getDisplayError } from '../services/apiErrors';

const defaultSettings = {
  profile_visible: true,
  allow_aggregation: true,
  breach_alerts: true,
  light_theme: false
};

export default function SettingsPage({ embedded = false }) {
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState('');
  const [error, setError] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const { info, success, error: toastError } = useToast();
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState({
    username: user?.email?.split('@')?.[0] || 'operator',
    role: 'Security Analyst',
    avatarColor: 'bg-accent/30'
  });

  const load = async () => {
    setError('');
    setLoading(true);
    try {
      const data = await getSettings();
      setSettings(data);
      document.body.classList.toggle('light', Boolean(data.light_theme));
    } catch (err) {
      const message = getDisplayError(err, 'Failed to load settings.');
      setError(message);
      toastError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (key) => {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    setSavingKey(key);
    try {
      const saved = await saveSettings(next);
      setSettings(saved);
      if (key === 'light_theme') {
        document.body.classList.toggle('light', Boolean(saved.light_theme));
      }
      success('Setting updated');
    } catch (err) {
      setSettings(settings);
      const message = getDisplayError(err, 'Failed to save setting.');
      toastError(message);
    } finally {
      setSavingKey('');
    }
  };

  const onExport = async () => {
    try {
      setBusyAction('export');
      const blob = await exportPdfReport();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'shadowgraph-report.pdf';
      link.click();
      URL.revokeObjectURL(url);
      success('Report download started');
    } catch (err) {
      toastError(getDisplayError(err, 'Failed to export report.'));
    } finally {
      setBusyAction('');
    }
  };

  const onDelete = async () => {
    const ok = window.confirm('Delete your account and all scan history? This cannot be undone.');
    if (!ok) return;

    try {
      setBusyAction('delete');
      await deleteAccount();
      signOut();
      info('Account deleted');
      navigate('/auth', { replace: true });
    } catch (err) {
      toastError(getDisplayError(err, 'Failed to delete account.'));
    } finally {
      setBusyAction('');
    }
  };

  return (
    <div>
      {!embedded ? (
        <PageHeader title="Settings" subtitle="Manage consent, privacy controls, profile customization, account actions, and report export." />
      ) : null}

      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {loading ? (
        <div className="rounded-xl border border-white/10 bg-surface/70 p-4 text-sm text-muted">
          <LoadingSpinner /> Loading settings...
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
          <GlassCard className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="sg-kicker">Profile</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight">{profile.username}</h3>
                <p className="mt-1 text-sm text-muted">{profile.role}</p>
                <p className="mt-1 text-xs text-muted">{user?.email || 'analyst@shadowgraph.ai'}</p>
              </div>
              <button onClick={() => setProfileOpen(true)} className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan/35 ${profile.avatarColor}`}>
                {profile.username.slice(0, 2).toUpperCase()}
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {[
                ['profile_visible', 'Public profile scanning consent'],
                ['allow_aggregation', 'Allow data aggregation'],
                ['breach_alerts', 'Breach alert notifications'],
                ['light_theme', 'Light theme mode']
              ].map(([key, label]) => (
                <label key={key} className="flex items-center justify-between rounded-xl border border-white/10 bg-surface/70 p-3 text-sm">
                  <span>{label}</span>
                  <button
                    type="button"
                    disabled={savingKey === key}
                    onClick={() => toggle(key)}
                    className={`relative h-6 w-11 rounded-full transition ${settings[key] ? 'bg-accent' : 'bg-white/20'}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${settings[key] ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </label>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="space-y-3 p-5">
            <h3 className="text-xl font-semibold">Account Actions</h3>
            <button
              onClick={onExport}
              disabled={busyAction === 'export'}
              className="sg-button-secondary flex w-full items-center justify-center gap-2"
            >
              {busyAction === 'export' ? <LoadingSpinner /> : null}
              Export Report (PDF)
            </button>
            <button
              onClick={onDelete}
              disabled={busyAction === 'delete'}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500/20 px-4 py-3 text-sm text-red-200 transition hover:bg-red-500/30"
            >
              {busyAction === 'delete' ? <LoadingSpinner /> : null}
              Delete Account
            </button>
          </GlassCard>
        </div>
      ) : null}

      <AnimatePresence>
        {profileOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4"
            onClick={() => setProfileOpen(false)}
          >
            <motion.div
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 12, opacity: 0 }}
              className="w-full max-w-md rounded-2xl border border-white/10 bg-[#12121a]/95 p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-semibold">Edit Profile</h3>
              <div className="mt-4 space-y-3">
                <input className="sg-input" value={profile.username} onChange={(e) => setProfile((p) => ({ ...p, username: e.target.value }))} />
                <input className="sg-input" value={profile.role} onChange={(e) => setProfile((p) => ({ ...p, role: e.target.value }))} />
                <div className="flex flex-wrap gap-2">
                  {['bg-accent/30', 'bg-cyan/30', 'bg-emerald-500/25'].map((color) => (
                    <button
                      key={color}
                      onClick={() => setProfile((p) => ({ ...p, avatarColor: color }))}
                      className={`h-8 w-8 rounded-full border border-white/20 ${color}`}
                    />
                  ))}
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button onClick={() => setProfileOpen(false)} className="sg-button-secondary px-4 py-2">
                  Cancel
                </button>
                <button onClick={() => setProfileOpen(false)} className="sg-button-primary px-4 py-2">
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
