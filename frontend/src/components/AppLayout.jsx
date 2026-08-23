import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();
  const isOverview = location.pathname === '/app/overview';

  return (
    <div className="relative min-h-screen px-4 py-4 text-text md:px-6">
      <div className="particle-layer" />
      {isOverview ? (
        <div className="mx-auto max-w-[1400px] pb-8">
          <div className="sticky top-0 z-30 mb-6 border-b border-white/10 bg-[#121212]/85 py-4 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <div className="w-32" />
              <p className="text-center text-sm tracking-[0.28em] text-[#00BFFF]">SHADOWGRAPH</p>
              <a href="#profile-dashboard" className="sg-button-secondary px-3 py-2 text-xs">
                Profile Dashboard
              </a>
            </div>
          </div>
          <Outlet />
        </div>
      ) : (
        <div className="mx-auto flex max-w-[1600px] gap-5">
          <Sidebar />
          <main className="min-w-0 flex-1 pb-8">
            <Topbar onOpenMenu={() => setMobileNavOpen(true)} />
            <Outlet />
          </main>
        </div>
      )}

      <AnimatePresence>
        {mobileNavOpen && !isOverview ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 p-4 lg:hidden"
            onClick={() => setMobileNavOpen(false)}
          >
            <motion.div
              initial={{ x: -24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -24, opacity: 0 }}
              transition={{ type: 'spring', damping: 22, stiffness: 240 }}
              className="max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex justify-end">
                <button onClick={() => setMobileNavOpen(false)} className="sg-button-secondary px-3 py-2">
                  Close
                </button>
              </div>
              <Sidebar mobile onNavigate={() => setMobileNavOpen(false)} />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
