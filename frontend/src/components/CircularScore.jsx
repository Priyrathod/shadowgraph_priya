import { motion } from 'framer-motion';

export default function CircularScore({ score }) {
  const gradient = `conic-gradient(#3B82F6 ${score * 3.6}deg, rgba(255,255,255,0.08) 0)`;

  return (
    <motion.div
      initial={{ scale: 0.94, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.35 }}
      className="mx-auto flex h-60 w-60 items-center justify-center rounded-full neon-ring"
      style={{ background: gradient }}
    >
      <div className="flex h-48 w-48 flex-col items-center justify-center rounded-full border border-white/10 bg-bg/95">
        <p className="text-6xl font-semibold tracking-tight">{score}</p>
        <p className="mt-1 text-xs uppercase tracking-[0.22em] text-muted">Risk Score</p>
      </div>
    </motion.div>
  );
}
