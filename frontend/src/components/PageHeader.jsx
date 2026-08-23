import { motion } from 'framer-motion';

export default function PageHeader({ title, subtitle, actions, eyebrow = 'ShadowGraph Module' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="relative mb-7 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-surface/70 to-[#101018]/75 p-6 md:mb-8 md:p-7"
    >
      <div className="pointer-events-none absolute -left-12 top-0 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-0 h-40 w-40 rounded-full bg-cyan/15 blur-3xl" />
      <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="sg-kicker">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">{title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted md:text-[15px]">{subtitle}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </motion.div>
  );
}
