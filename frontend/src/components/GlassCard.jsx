export default function GlassCard({ className = '', children }) {
  return <section className={`sg-card ${className}`}>{children}</section>;
}
