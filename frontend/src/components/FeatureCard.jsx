import { motion } from 'framer-motion';
import GlassCard from './GlassCard';

export default function FeatureCard({ icon, title, desc, index = 0, cta = 'Explore Module' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.38 }}
      viewport={{ once: true, amount: 0.25 }}
      className="h-full"
    >
      <GlassCard className="group h-full p-6 transition duration-300 hover:-translate-y-1">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan/30 bg-cyan/10 text-xl shadow-glow">
          {icon}
        </div>
        <h3 className="mt-5 text-xl font-semibold tracking-tight">{title}</h3>
        <p className="mt-3 text-sm leading-7 text-muted">{desc}</p>
        <div className="mt-5 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-cyan">
          <span>{cta}</span>
          <span className="transition group-hover:translate-x-1">→</span>
        </div>
      </GlassCard>
    </motion.div>
  );
}
