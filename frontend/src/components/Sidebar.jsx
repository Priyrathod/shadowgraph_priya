import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const links = [
  ['One-Page Workspace', '/app/overview', '01'],
  ['Domain & IP Intel', '/app/domain-intel', '02'],
  ['ShadowGraph Visualizer', '/app/graph', '03'],
  ['Face Search', '/app/face-scan', '04'],
  ['Username Engine', '/app/username-scan', '05'],
  ['Footprint Summary', '/app/footprint-summary', '06'],
  ['Research Papers', '/app/research', '07'],
  ['Reputation Insight', '/app/reputation-insight', '08'],
  ['AI Story', '/app/insight-story', '09'],
  ['Skill Growth', '/app/skill-growth', '10'],
  ['Timeline & Persona', '/app/timeline-persona', '11'],
  ['Predictive & Ethics', '/app/predictive-ethics', '12'],
  ['Profile Dashboard', '/app/profile-dashboard', '13'],
  ['Reports', '/app/reports', '14'],
  ['Profile Settings', '/app/settings', '15']
];

function Brand() {
  return (
    <div className="mb-7 border-b border-white/10 pb-5">
      <p className="sg-kicker">ShadowGraph</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight">Cyber Intel Console</h2>
      <p className="mt-2 text-xs text-muted">Attack surface reconnaissance & digital footprint analysis</p>
    </div>
  );
}

function NavItems({ onClick }) {
  return (
    <nav className="space-y-1.5 overflow-y-auto max-h-[calc(100vh-16rem)] pr-1">
      {links.map(([label, href, idx]) => (
        <NavLink
          key={href}
          to={href}
          onClick={onClick}
          className={({ isActive }) =>
            `group flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition ${
              isActive
                ? 'border-accent/50 bg-accent/15 text-text shadow-[0_10px_24px_rgba(59,130,246,0.22)]'
                : 'border-transparent text-muted hover:border-white/10 hover:bg-surface/75 hover:text-text'
            }`
          }
        >
          <span>{label}</span>
          <span className="text-[10px] tracking-[0.18em] text-muted transition group-hover:text-cyan">{idx}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default function Sidebar({ mobile = false, onNavigate }) {
  const { user } = useAuth();

  return (
    <aside className={`${mobile ? 'w-full' : 'hidden h-[calc(100vh-2rem)] w-80 shrink-0 lg:block'} sg-card p-5`}>
      <Brand />
      <NavItems onClick={onNavigate} />
      <div className="mt-6 rounded-xl border border-white/10 bg-surface/70 p-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Signed In</p>
        <p className="mt-1 truncate text-sm">{user?.email || 'analyst@shadowgraph.ai'}</p>
      </div>
    </aside>
  );
}
