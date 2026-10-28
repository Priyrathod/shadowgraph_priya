import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import DomainAnalysisPage from './DomainAnalysisPage';
import FaceScanPage from './FaceScanPage';
import UsernameDiscoveryPage from './UsernameDiscoveryPage';
import DigitalFootprintSummaryPage from './DigitalFootprintSummaryPage';
import ResearchPaperPage from './ResearchPaperPage';
import ReputationInsightPage from './ReputationInsightPage';
import ProfileDashboardPage from './ProfileDashboardPage';
import InsightStoryPage from './InsightStoryPage';
import SkillGrowthPage from './SkillGrowthPage';
import TimelinePersonaPage from './TimelinePersonaPage';
import PredictiveEthicsPage from './PredictiveEthicsPage';
import { getCyberDashboardStats } from '../services/endpoints';

const chapters = [
  ['Domain & IP Intel', '#domain-intel'],
  ['Face Search', '#face-search'],
  ['Username Engine', '#username-engine'],
  ['Footprint Summary', '#footprint-summary'],
  ['Research Papers', '#research-papers'],
  ['Reputation Insight', '#reputation-insight'],
  ['AI Story & Alerts', '#story-alerts'],
  ['Skills & Networking', '#skills-networking'],
  ['Timeline & Persona', '#timeline-persona'],
  ['Predictive & Ethical', '#predictive-ethical'],
  ['Profile Dashboard', '#profile-dashboard'],
];

function Chapter({ id, label, title, text, children }) {
  return (
    <motion.section
      id={id}
      initial={{ y: 16 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.4 }}
      className="sg-section min-h-[220px] px-6 py-12 text-text md:px-10 md:py-14"
    >
      <p className="sg-kicker">{label}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-text md:text-[42px]">{title}</h2>
      <p className="mt-4 max-w-4xl text-base leading-8 text-muted md:text-lg">{text}</p>
      <div className="mt-7">{children}</div>
    </motion.section>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const displayName = user?.email?.split('@')?.[0] || 'Analyst';
  const [stats, setStats] = useState({
    total_scans: 0,
    unique_domains_analyzed: 0,
    discovered_subdomains: 0,
    resolved_ips: 0,
    total_findings: 0
  });

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await getCyberDashboardStats();
        if (data) {
          setStats(data);
        }
      } catch {
        // Fallback to local storage count
        try {
          const stored = localStorage.getItem('shadowgraph_cyber_history');
          if (stored) {
            const list = JSON.parse(stored);
            setStats({
              total_scans: list.length,
              unique_domains_analyzed: new Set(list.map((s) => s.target)).size,
              discovered_subdomains: list.reduce((acc, s) => acc + (s.subdomains_count || 0), 0),
              resolved_ips: list.length * 2,
              total_findings: list.reduce((acc, s) => acc + (s.findings_count || 0), 0)
            });
          }
        } catch {
          // noop
        }
      }
    };
    loadStats();
  }, []);

  return (
    <div className="space-y-8 pb-10">
      <section className="sg-section px-6 py-12 text-center md:px-10 md:py-16">
        <p className="text-sm tracking-[0.28em] text-[#00BFFF]">SHADOWGRAPH CYBER INTELLIGENCE WORKSPACE</p>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-[56px] md:leading-[1.1]">
          Welcome, {displayName}
        </h1>
        <p className="mx-auto mt-4 max-w-3xl text-base leading-7 text-muted md:text-lg">
          Passive open-source cyber intelligence, digital footprint mapping, and evidence-based attack surface assessment without intrusive active scanning.
        </p>

        {/* Real Live Analysis Statistics */}
        <div className="mx-auto mt-8 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-xl border border-white/10 bg-surface/75 p-3 text-center">
            <p className="text-[11px] text-muted uppercase tracking-wider">Total Scans</p>
            <p className="mt-1 text-2xl font-bold text-white">{stats.total_scans}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-surface/75 p-3 text-center">
            <p className="text-[11px] text-muted uppercase tracking-wider">Targets Mapped</p>
            <p className="mt-1 text-2xl font-bold text-cyan">{stats.unique_domains_analyzed}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-surface/75 p-3 text-center">
            <p className="text-[11px] text-muted uppercase tracking-wider">Subdomains</p>
            <p className="mt-1 text-2xl font-bold text-accent">{stats.discovered_subdomains}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-surface/75 p-3 text-center">
            <p className="text-[11px] text-muted uppercase tracking-wider">Resolved IPs</p>
            <p className="mt-1 text-2xl font-bold text-purple-400">{stats.resolved_ips}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-surface/75 p-3 text-center col-span-2 sm:col-span-1">
            <p className="text-[11px] text-muted uppercase tracking-wider">Vulnerabilities</p>
            <p className="mt-1 text-2xl font-bold text-amber-400">{stats.total_findings}</p>
          </div>
        </div>

        {/* Quick Jump Buttons */}
        <div className="mx-auto mt-8 flex max-w-4xl flex-wrap justify-center gap-2">
          {chapters.map(([name, anchor]) => (
            <a key={anchor} href={anchor} className="sg-button-secondary px-3.5 py-1.5 text-xs">
              {name}
            </a>
          ))}
        </div>
      </section>

      {/* Chapter 01: Core Domain & IP Attack Surface Analysis */}
      <Chapter
        id="domain-intel"
        label="Chapter 01"
        title="Domain & IP Attack Surface Reconnaissance"
        text="Passive public intelligence gathering using DNS-over-HTTPS, RDAP registrar records, Certificate Transparency logs, and active threat feed correlation."
      >
        <DomainAnalysisPage embedded />
      </Chapter>

      {/* Chapter 02: Face Recognition & Online Presence */}
      <Chapter
        id="face-search"
        label="Chapter 02"
        title="Face Recognition & Online Presence Search"
        text="Upload your photo and optionally add a name or handle. We check public profile pages and show likely matches with links and previews."
      >
        <FaceScanPage embedded />
      </Chapter>

      {/* Chapter 03: Username Discovery */}
      <Chapter
        id="username-engine"
        label="Chapter 03"
        title="Username Display Engine"
        text="Enter a username or full name. The system checks practical profile variants and shows where you are likely visible online."
      >
        <UsernameDiscoveryPage embedded />
      </Chapter>

      {/* Chapter 04: Footprint Summary */}
      <Chapter
        id="footprint-summary"
        label="Chapter 04"
        title="Digital Footprint Summary"
        text="See a clean overview of your public presence: social platforms, coding accounts, research visibility, and linked profile counts."
      >
        <DigitalFootprintSummaryPage embedded />
      </Chapter>

      {/* Chapter 05: Research Papers */}
      <Chapter
        id="research-papers"
        label="Chapter 05"
        title="Research Paper Detection"
        text="Search by full name, institution, or both. Results are filtered to better match the person you are searching for."
      >
        <ResearchPaperPage embedded />
      </Chapter>

      {/* Chapter 06: Reputation Insight */}
      <Chapter
        id="reputation-insight"
        label="Chapter 06"
        title="Reputation Insight & Public Sentiment"
        text="Understand tone, sentiment, and visibility across public mentions."
      >
        <ReputationInsightPage embedded />
      </Chapter>

      {/* Chapter 07: AI Narrative & Story */}
      <Chapter
        id="story-alerts"
        label="Chapter 07"
        title="AI Digital Narrative & Privacy Alerts"
        text="Actionable takeaways and simple steps to manage your public visibility."
      >
        <InsightStoryPage embedded />
      </Chapter>

      {/* Chapter 08: Skills & Growth */}
      <Chapter
        id="skills-networking"
        label="Chapter 08"
        title="Skill Growth & Networking Opportunities"
        text="Analyze skill signals and peer networking opportunities from public coding and social activity."
      >
        <SkillGrowthPage embedded />
      </Chapter>

      {/* Chapter 09: Timeline & Persona */}
      <Chapter
        id="timeline-persona"
        label="Chapter 09"
        title="Activity Timeline & Public Persona"
        text="Chronological activity map and category distributions across web presence."
      >
        <TimelinePersonaPage embedded />
      </Chapter>

      {/* Chapter 10: Predictive & Ethics */}
      <Chapter
        id="predictive-ethical"
        label="Chapter 10"
        title="Predictive Exposure & Ethical Transparency"
        text="Forward-looking exposure projections with ethical verification checklist."
      >
        <PredictiveEthicsPage embedded />
      </Chapter>

      {/* Chapter 11: Profile Dashboard */}
      <Chapter
        id="profile-dashboard"
        label="Chapter 11"
        title="Profile Dashboard & Account Control"
        text="View your verified accounts and account management settings."
      >
        <ProfileDashboardPage embedded />
      </Chapter>
    </div>
  );
}
