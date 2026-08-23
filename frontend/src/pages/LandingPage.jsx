import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';

const sections = [
  {
    id: 'photo-recognition',
    label: '01',
    title: 'Photo Recognition',
    description:
      'Find your public profiles from a photo. Upload one image and get clear, ethical matches from publicly available profile pages.',
    bullets: ['Public profile links only', 'Readable confidence indicators', 'Hover cards with quick previews'],
  },
  {
    id: 'username',
    label: '02',
    title: 'Username Engine',
    description:
      'Search by name or handle and discover where that identity appears online. Results are shown as clean cards with reachable links.',
    bullets: ['Smart name variations', 'Platform-focused cards', 'Only reachable results shown'],
  },
  {
    id: 'digital-footprint',
    label: '03',
    title: 'Digital Footprint Overview',
    description:
      'Discover your digital presence in one place. See categories, account counts, and visibility highlights with interactive visuals.',
    bullets: ['Neon-highlighted summary charts', 'Live category breakdown', 'Simple, user-friendly insights'],
  },
  {
    id: 'research',
    label: '04',
    title: 'Research Paper Detection',
    description:
      'Find likely papers by full name, institution, or both. Review titles, sources, years, and citations in clean, hoverable cards.',
    bullets: ['Readable publication cards', 'Name + institution matching', 'Quick source links'],
  },
  {
    id: 'reputation',
    label: '05',
    title: 'Reputation Insights',
    description:
      'Understand how visible you are online with actionable tips. See what is strong, what is missing, and what to improve first.',
    bullets: ['Visibility score panel', 'Action recommendations', 'Smooth animated indicators'],
  },
  {
    id: 'dashboard',
    label: '06',
    title: 'Dashboard & Profile',
    description:
      'Use one immersive dashboard for profile, charts, timeline, and reports. Smooth updates keep modules alive and easy to follow.',
    bullets: ['Glassmorphic stat panels', 'Neon chart accents', 'Quick jump into live app'],
  },
];

function FeatureSection({ section, index }) {
  return (
    <motion.section
      id={section.id}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.45, delay: index * 0.04 }}
      className="sg-section mx-auto max-w-7xl px-6 py-14 md:px-12 md:py-20"
    >
      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <p className="sg-kicker">Feature {section.label}</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight text-text md:text-[48px]">{section.title}</h2>
          <p className="mt-5 max-w-3xl text-base leading-8 text-muted md:text-lg">{section.description}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {section.bullets.map((item) => (
              <span key={item} className="sg-chip">
                {item}
              </span>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/auth" className="sg-button-primary">
              Open This Feature
            </Link>
            <Link to="/app/overview" className="sg-button-secondary">
              View Live Dashboard
            </Link>
          </div>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          className="sg-card p-5 md:p-6"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-[#00BFFF]">Module Preview</p>
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-white/10 bg-[#1a1a1f]/80 p-3">
              <p className="text-sm text-text">Live status</p>
              <div className="mt-2 h-2 rounded bg-white/10">
                <motion.div
                  initial={{ width: '22%' }}
                  whileInView={{ width: '84%' }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.1, ease: 'easeOut' }}
                  className="h-2 rounded bg-gradient-to-r from-[#00BFFF] via-[#1ED760] to-[#FF6B6B]"
                />
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#1a1a1f]/80 p-3 text-xs leading-6 text-muted">
              This preview represents live backend-connected cards, scan states, and profile insights from your actual modules.
            </div>
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}

export default function LandingPage() {
  const { scrollYProgress } = useScroll();
  const parallax = useTransform(scrollYProgress, [0, 1], [0, -110]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#000000] px-4 pb-20 pt-4 md:px-8">
      <motion.div style={{ y: parallax }} className="matrix-overlay pointer-events-none absolute inset-0" />
      <div className="cyber-grid pointer-events-none absolute inset-0 opacity-35" />
      <div className="particle-layer" />

      <section className="relative mx-auto flex min-h-screen max-w-7xl items-center justify-center px-4 text-center">
        <div className="pointer-events-none absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[#00BFFF]/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-10 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-[#1ED760]/10 blur-3xl" />

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }} className="relative z-10 max-w-6xl">
          <h1 className="hero-title hero-glow hero-pulse text-7xl font-black tracking-tight md:text-[120px] md:leading-[0.9]">
            ShadowGraph
          </h1>
          <p className="hero-subtitle mx-auto mt-7 max-w-4xl text-xl leading-9 text-text/90 md:text-[30px] md:leading-[1.35]">
            Explore your complete digital presence
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <a href="#photo-recognition" className="sg-button-primary px-8 py-4 text-base">
              Get Started
            </a>
          </div>
        </motion.div>
      </section>

      <div className="space-y-8">
        {sections.map((section, idx) => (
          <FeatureSection key={section.id} section={section} index={idx} />
        ))}
      </div>

      <section className="sg-section mx-auto mt-8 max-w-7xl px-6 py-10 text-center md:px-12 md:py-14">
        <h3 className="text-3xl font-semibold tracking-tight text-text md:text-[48px]">Ready to explore your digital presence?</h3>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-muted">
          Enter the live workspace and run your scans with full cinematic dashboards.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link to="/auth" className="sg-button-primary">
            Enter ShadowGraph
          </Link>
          <Link to="/app/overview" className="sg-button-secondary">
            Open Dashboard
          </Link>
        </div>
      </section>

      <footer className="mx-auto mt-12 max-w-7xl border-t border-white/10 py-6 text-center text-sm text-muted">
        © {new Date().getFullYear()} ShadowGraph
      </footer>
    </div>
  );
}
