import GlassCard from './GlassCard';

const labels = ['Public Profiles', 'Research Visibility', 'Breach Exposure', 'Data Leak Indicators'];

export default function RadarChart({ values = [72, 58, 40, 64] }) {
  const center = 130;
  const radius = 92;

  const point = (value, i) => {
    const angle = (Math.PI * 2 * i) / labels.length - Math.PI / 2;
    const r = (value / 100) * radius;
    return [center + r * Math.cos(angle), center + r * Math.sin(angle)];
  };

  const points = values.map((v, i) => point(v, i).join(',')).join(' ');

  return (
    <GlassCard className="p-6">
      <h3 className="mb-4 text-lg font-semibold">Risk Breakdown</h3>
      <svg viewBox="0 0 260 260" className="mx-auto h-72 w-full max-w-sm">
        {[25, 50, 75, 100].map((ring) => {
          const r = (ring / 100) * radius;
          return <circle key={ring} cx={center} cy={center} r={r} fill="none" stroke="rgba(255,255,255,0.14)" />;
        })}
        {labels.map((label, i) => {
          const [x, y] = point(100, i);
          return (
            <g key={label}>
              <line x1={center} y1={center} x2={x} y2={y} stroke="rgba(255,255,255,0.2)" />
              <text x={x} y={y < center ? y - 8 : y + 14} textAnchor="middle" fontSize="10" fill="#9CA3AF">
                {label}
              </text>
            </g>
          );
        })}
        <polygon points={points} fill="rgba(59,130,246,0.35)" stroke="#22D3EE" strokeWidth="2" />
      </svg>
    </GlassCard>
  );
}
