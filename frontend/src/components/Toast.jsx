import { AnimatePresence, motion } from 'framer-motion';

const styles = {
  info: 'border-cyan/25 bg-surface/95 text-text',
  success: 'border-emerald-400/35 bg-emerald-500/15 text-emerald-100',
  error: 'border-red-400/35 bg-red-500/15 text-red-100'
};

export default function Toast({ message, show, type = 'info' }) {
  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 22 }}
          className={`fixed bottom-5 right-5 z-50 rounded-xl border px-4 py-3 text-sm shadow-glow ${styles[type] || styles.info}`}
        >
          {message}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
