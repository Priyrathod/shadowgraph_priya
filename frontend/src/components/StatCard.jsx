import GlassCard from './GlassCard';

export default function StatCard({ title, value, hint }) {
  return (
    <GlassCard className="p-5 md:p-6">
      <p className="text-xs uppercase tracking-[0.2em] text-muted">{title}</p>
      <p className="mt-3 text-4xl font-semibold tracking-tight">{value}</p>
      <p className="mt-2 text-sm text-muted">{hint}</p>
      <div className="mt-4 h-1.5 rounded-full bg-white/10">
        <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-accent to-cyan" />
      </div>
    </GlassCard>
  );
}
