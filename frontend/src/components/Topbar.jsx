import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

export default function Topbar({ onOpenMenu }) {
  const progress = useMemo(() => Math.floor(52 + Math.random() * 35), []);
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [openProfile, setOpenProfile] = useState(false);

  const logout = () => {
    signOut();
    navigate('/auth');
  };

  const displayName = user?.email?.split('@')?.[0] || 'analyst';

  return (
    <header className="sg-card relative mb-6 px-4 py-4 md:px-5">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-accent/10 via-transparent to-cyan/10" />
      <div className="relative flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={onOpenMenu} className="rounded-lg border border-white/15 bg-surface/85 px-3 py-2 text-sm lg:hidden">
            Menu
          </button>
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted">Active Intelligence</p>
            <h3 className="text-sm font-medium text-text md:text-base">Live scan results and risk updates</h3>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <button className="rounded-lg border border-white/15 bg-surface/85 px-3 py-2 text-sm text-muted transition hover:text-text">Notifications</button>
          <button
            onClick={() => setOpenProfile((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-surface/85 px-3 py-2 text-sm text-muted transition hover:text-text"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent/20 text-xs text-cyan">{displayName.slice(0, 2).toUpperCase()}</span>
            <span className="hidden max-w-[140px] truncate md:inline">{user?.email || 'Profile'}</span>
          </button>
        </div>
      </div>

      <div className="relative mt-4">
        <div className="mb-1 flex items-center justify-between text-[11px] text-muted">
          <span>Scan Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface">
          <div className="h-full rounded-full bg-gradient-to-r from-accent via-blue-500 to-cyan transition-all duration-700" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <AnimatePresence>
        {openProfile ? (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            className="absolute right-4 top-[74px] z-30 w-64 rounded-xl border border-white/10 bg-[#14141c]/95 p-3 shadow-[0_24px_45px_rgba(0,0,0,0.45)] backdrop-blur-xl"
          >
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Profile</p>
            <p className="mt-2 truncate text-sm">{user?.email || 'analyst@shadowgraph.ai'}</p>
            <div className="mt-3 grid gap-2">
              <Link to="/app/settings" onClick={() => setOpenProfile(false)} className="rounded-lg border border-white/10 bg-surface/80 px-3 py-2 text-sm">
                Account Settings
              </Link>
              <Link to="/app/reports" onClick={() => setOpenProfile(false)} className="rounded-lg border border-white/10 bg-surface/80 px-3 py-2 text-sm">
                Usage Reports
              </Link>
              <button onClick={logout} className="rounded-lg border border-red-500/35 bg-red-500/20 px-3 py-2 text-sm text-red-100">
                Logout
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
