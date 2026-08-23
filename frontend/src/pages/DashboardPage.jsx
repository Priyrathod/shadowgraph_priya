import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import FaceScanPage from './FaceScanPage';
import UsernameDiscoveryPage from './UsernameDiscoveryPage';
import DigitalFootprintSummaryPage from './DigitalFootprintSummaryPage';
import ResearchPaperPage from './ResearchPaperPage';
import ReputationInsightPage from './ReputationInsightPage';
import ProfileDashboardPage from './ProfileDashboardPage';
import SettingsPage from './SettingsPage';
import InsightStoryPage from './InsightStoryPage';
import SkillGrowthPage from './SkillGrowthPage';
import TimelinePersonaPage from './TimelinePersonaPage';
import PredictiveEthicsPage from './PredictiveEthicsPage';

const chapters = [
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
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.4 }}
      className="sg-section min-h-[220px] px-6 py-12 text-text md:px-10 md:py-14"
    >
      <p className="sg-kicker">{label}</p>
      <h2 className="mt-3 text-4xl font-semibold tracking-tight text-text md:text-[48px]">{title}</h2>
      <p className="mt-4 max-w-4xl text-base leading-8 text-muted md:text-lg">{text}</p>
      <div className="mt-7">{children}</div>
    </motion.section>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const displayName = user?.email?.split('@')?.[0] || 'User';

  return (
    <div className="space-y-8 pb-10">
      <section className="sg-section px-6 py-14 text-center md:px-10 md:py-16">
        <p className="text-sm tracking-[0.28em] text-[#00BFFF]">SHADOWGRAPH WORKSPACE</p>
        <h1 className="mt-6 text-5xl font-semibold tracking-tight md:text-[64px] md:leading-[1.05]">
          Welcome, {displayName}
        </h1>
        <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-muted md:text-lg">
          Scroll down once to reveal each module step by step. Every section is connected to live backend data and built to be understandable for non-technical users.
        </p>

        <div className="mx-auto mt-9 flex max-w-4xl flex-wrap justify-center gap-2">
          {chapters.map(([name, anchor]) => (
            <a key={anchor} href={anchor} className="sg-button-secondary px-4 py-2 text-sm">
              {name}
            </a>
          ))}
        </div>

        <div className="mt-5">
          <a href="#profile-dashboard" className="sg-button-primary px-5 py-3 text-sm">
            Jump to Profile Dashboard
          </a>
        </div>
      </section>

      <Chapter
        id="face-search"
        label="Chapter 01"
        title="Face Recognition & Online Presence Search"
        text="Upload your photo and optionally add a name or handle. We check public profile pages and show likely matches with links and previews."
      >
        <FaceScanPage embedded />
      </Chapter>

      <Chapter
        id="username-engine"
        label="Chapter 02"
        title="Username Display Engine"
        text="Enter a username or full name. The system checks practical profile variants and shows where you are likely visible online."
      >
        <UsernameDiscoveryPage embedded />
      </Chapter>

      <Chapter
        id="footprint-summary"
        label="Chapter 03"
        title="Digital Footprint Summary"
        text="See a clean overview of your public presence: social platforms, coding accounts, research visibility, and linked profile counts."
      >
        <DigitalFootprintSummaryPage embedded />
      </Chapter>

      <Chapter
        id="research-papers"
        label="Chapter 04"
        title="Research Paper Detection"
        text="Search by full name, institution, or both. Results are filtered to better match the person you are searching for."
      >
        <ResearchPaperPage embedded />
      </Chapter>

      <Chapter
        id="reputation-insight"
        label="Chapter 05"
        title="Reputation Insight"
        text="Get a practical visibility score and clear recommendations so you know where you are easy to find online and what to improve."
      >
        <ReputationInsightPage embedded />
      </Chapter>

      <Chapter
        id="story-alerts"
        label="Chapter 06"
        title="AI Narrative & Privacy Alerts"
        text="Read a simple story of your digital footprint and see warnings about exposed or sensitive public data."
      >
        <InsightStoryPage embedded />
      </Chapter>

      <Chapter
        id="skills-networking"
        label="Chapter 07"
        title="Skill Radar & Networking Opportunities"
        text="View your strongest areas, growth gaps, and suggested communities or collaborators to increase your impact."
      >
        <SkillGrowthPage embedded />
      </Chapter>

      <Chapter
        id="timeline-persona"
        label="Chapter 08"
        title="Interactive Timeline, Persona Score & Achievements"
        text="Follow your contribution timeline, track your persona score, and unlock gamified badges as your public profile grows."
      >
        <TimelinePersonaPage embedded />
      </Chapter>

      <Chapter
        id="predictive-ethical"
        label="Chapter 09"
        title="Predictive Analytics & Ethical Verification"
        text="See projected visibility trends with practical next steps and verify that all analysis stays within ethical public-data boundaries."
      >
        <PredictiveEthicsPage embedded />
      </Chapter>

      <Chapter
        id="profile-dashboard"
        label="Chapter 10"
        title="User Profile & Dashboard"
        text="Manage your profile picture and details, review dynamic charts, and open settings from one unified dashboard."
      >
        <div className="space-y-6">
          <ProfileDashboardPage embedded />
          <SettingsPage embedded />
        </div>
      </Chapter>
    </div>
  );
}
