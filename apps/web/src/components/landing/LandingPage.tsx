'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import BrandLogo, { BrandMark, DOCS_URL, SILENT_PAGE_URL } from '@/components/BrandLogo';
import { SILENT_ADDRESS, truncAddr } from '@/lib/tokens';
import { protocolFeePercentLabel, plannedFeePercentLabel, FEE_COPY } from '@/lib/fees';
import {
  SILENT_TOTAL_SUPPLY_SHORT,
  SILENT_ALLOCATION,
} from '@/lib/tokenomics';
import AllocationPie from '@/components/AllocationPie';
import {
  ArrowRight,
  Shield,
  EyeOff,
  Zap,
  Lock,
  Network,
  ScanSearch,
  ChevronRight,
  ChevronDown,
  Menu,
  X,
  CheckCircle2,
  BookOpen,
  ExternalLink,
  Wallet,
  Send,
  Inbox,
  AlertTriangle,
} from 'lucide-react';

const NAV = [
  { label: 'Product', href: '#product' },
  { label: 'How it works', href: '#how' },
  { label: 'Roadmap', href: '#roadmap' },
  { label: 'Security', href: '#security' },
  { label: '$SILENT', href: SILENT_PAGE_URL },
];

const FEATURES = [
  {
    icon: EyeOff,
    image: '/brand/feature-stealth.jpg',
    title: 'One-time destinations',
    body: 'Every payment lands on a fresh address. No reused deposit link. No public trail tying sender and recipient together.',
  },
  {
    icon: Lock,
    image: '/brand/feature-enterprise.jpg',
    title: 'No KYC in the path',
    body: 'Connect a wallet and move. SilentTransfer never asks for identity and never routes payments through a compliance gate.',
  },
  {
    icon: ScanSearch,
    image: '/brand/feature-discovery.jpg',
    title: 'Private payment discovery',
    body: 'Recipients scan for payments meant for them—without broadcasting a permanent public deposit address.',
  },
  {
    icon: Zap,
    image: '/brand/feature-gasless.jpg',
    title: 'Claim into your wallet',
    body: 'Funds sit at a one-time address until the recipient claims. On testnet, private send moves real ETH on-chain.',
  },
  {
    icon: Network,
    image: '/brand/feature-standards.jpg',
    title: 'Standards-aligned',
    body: 'Built around ERC-6538 registry and ERC-5564 announcement patterns—so privacy infrastructure stays interoperable.',
  },
  {
    icon: Shield,
    image: '/brand/feature-compliance.jpg',
    title: 'One operations console',
    body: 'Send, scan, claim, and review history in a single console. Docs spell out what is private today—and what is not.',
  },
];

const STEPS = [
  {
    step: '01',
    icon: Wallet,
    image: '/brand/feature-enterprise.jpg',
    title: 'Connect your wallet',
    body: 'Open the console, connect MetaMask or WalletConnect, and sign in with SIWE. No account form. No identity upload.',
  },
  {
    step: '02',
    icon: Send,
    image: '/brand/feature-stealth.jpg',
    title: 'Send to a one-time address',
    body: 'Enter the recipient and amount. SilentTransfer funds a fresh destination on-chain and announces the payment for claim.',
  },
  {
    step: '03',
    icon: Inbox,
    image: '/brand/feature-discovery.jpg',
    title: 'Discover and claim',
    body: 'The recipient scans for payments and claims into their wallet. Cleaner than a direct public send—documented as partial privacy, not full anonymity.',
  },
];

const PROBLEMS = [
  {
    title: 'Public chains leak intent',
    body: 'A direct A→B transfer is forever readable. Counterparties, amounts, and patterns sit on a public ledger anyone can query.',
  },
  {
    title: 'Reused addresses create history',
    body: 'Every payment to the same wallet builds a permanent profile. Recipients who share one deposit link give up privacy by default.',
  },
  {
    title: 'Identity should not be the product',
    body: 'Most “private” rails bolt on KYC or custody. SilentTransfer is built for transfers first—identity optional, never required.',
  },
];

const STATS = [
  { value: '0', label: 'KYC steps' },
  { value: '1', label: 'Primary CTA: open console' },
  { value: '1B', label: 'SILENT hard cap' },
  { value: '0%', label: 'Venture allocation' },
];

const ROADMAP = [
  {
    title: 'Batch private transfer (1 → many)',
    body: 'One wallet pays many recipients in one flow—CSV or address list, per-recipient amounts, bulk one-time destinations. Built for payroll, multi-vendor payouts, and private airdrops.',
  },
  {
    title: 'Fully private transfer',
    body: 'Viewing-key-only discovery, client-held claim material, and stronger unlinkability than today’s partial one-time-address path—no server-held spend keys.',
  },
  {
    title: 'Gasless claim & self-withdraw',
    body: 'ERC-4337 paymaster when ready, plus optional self-withdraw where the user pays network gas and keeps product fee at 0%.',
  },
  {
    title: 'Standards-complete stealth',
    body: 'Full ERC-5564 ECDH + ERC-6538 registry as the default UI path, with on-chain messenger as primary discovery.',
  },
];

const FAQS = [
  {
    q: 'Is this full anonymity?',
    a: 'No. SilentTransfer improves unlinkability with one-time destinations and recipient claim. On public chains, metadata and timing can still leak. Fully private transfer is on the product roadmap.',
  },
  {
    q: 'Is private send live?',
    a: 'Yes on Robinhood Chain Testnet: funded private sends can move real ETH to a one-time address and claim on-chain. Mainnet production remains staged.',
  },
  {
    q: 'Will you support batch payouts?',
    a: 'Yes—batch private transfer (one wallet → many recipients) is on the roadmap for payroll-style and multi-destination private sends.',
  },
  {
    q: 'What is $SILENT?',
    a: 'SILENT is the protocol asset—hard-capped at 1B, with 0% venture allocation. Fees are 0% today; a planned sponsored-claim fee funds operations and open-market buybacks.',
  },
  {
    q: 'Who is this for?',
    a: 'Teams and individuals who need private receive and transfer on public rails—operators, builders, and privacy-conscious payers.',
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`lp-faq-item ${open ? 'lp-faq-item--open' : ''}`}>
      <button
        type="button"
        className="lp-faq-q"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{q}</span>
        <ChevronDown className="lp-faq-chevron" aria-hidden />
      </button>
      {open && <p className="lp-faq-a">{a}</p>}
    </div>
  );
}

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const feePct = protocolFeePercentLabel();
  const plannedPct = plannedFeePercentLabel();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const NavItem = ({
    label,
    href,
    onClick,
    className = 'lp-nav-link',
  }: {
    label: string;
    href: string;
    onClick?: () => void;
    className?: string;
  }) => {
    if (href.startsWith('#')) {
      return (
        <a href={href} className={className} onClick={onClick}>
          {label}
        </a>
      );
    }
    return (
      <Link href={href} className={className} onClick={onClick}>
        {label}
      </Link>
    );
  };

  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="lp">
      <header className={`lp-nav ${scrolled ? 'lp-nav--solid' : ''} ${mobileOpen ? 'lp-nav--open' : ''}`}>
        <div className="lp-container lp-nav-inner">
          <BrandLogo size={36} subtitle="" href="/" className="lp-brand--nav" />

          <nav className="lp-nav-links" aria-label="Primary">
            {NAV.map((item) => (
              <NavItem key={item.label} {...item} />
            ))}
          </nav>

          <div className="lp-nav-actions">
            <a
              href={DOCS_URL}
              className="lp-btn lp-btn--ghost lp-btn--sm lp-nav-docs"
              {...(DOCS_URL.startsWith('http')
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : {})}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Docs
            </a>
            <Link href="/dashboard" className="lp-btn lp-btn--primary lp-btn--sm">
              Launch app
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <button
              type="button"
              className="lp-menu-btn"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="lp-mobile" role="dialog" aria-label="Mobile navigation">
            <nav className="lp-mobile-nav" aria-label="Mobile primary">
              {NAV.map((item) => (
                <NavItem
                  key={item.label}
                  {...item}
                  className="lp-mobile-link"
                  onClick={closeMobile}
                />
              ))}
              <a
                href={DOCS_URL}
                className="lp-mobile-link"
                onClick={closeMobile}
                {...(DOCS_URL.startsWith('http')
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : {})}
              >
                Documentation
              </a>
            </nav>
            <Link
              href="/dashboard"
              className="lp-btn lp-btn--primary lp-btn--block"
              onClick={closeMobile}
            >
              Launch app
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="lp-hero">
        <div className="lp-hero-media" aria-hidden>
          <Image
            src="/brand/hero-bg.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="lp-hero-photo"
          />
          <div className="lp-hero-scrim" />
        </div>
        <div className="lp-container lp-hero-inner">
          <div className="lp-hero-copy">
            <div className="lp-eyebrow">
              <span className="lp-dot" />
              Private transfer · public chains
            </div>
            <h1 className="lp-h1">
              Send crypto privately
              <span className="lp-h1-accent"> without KYC</span>
            </h1>
            <p className="lp-lead">
              SilentTransfer turns public blockchains into private payment rails.
              One-time destinations. Recipient claim. No identity gates.
              Open the console and move value today on testnet.
            </p>
            <div className="lp-hero-cta">
              <Link href="/dashboard" className="lp-btn lp-btn--primary lp-btn--lg">
                Open console
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#how"
                className="lp-btn lp-btn--secondary lp-btn--lg"
              >
                See how it works
              </a>
            </div>
            <div className="lp-trust-row">
              <span className="lp-trust-item">
                <CheckCircle2 className="w-3.5 h-3.5" /> No KYC required
              </span>
              <span className="lp-trust-item">
                <CheckCircle2 className="w-3.5 h-3.5" /> One-time addresses
              </span>
              <span className="lp-trust-item">
                <CheckCircle2 className="w-3.5 h-3.5" /> Honest privacy docs
              </span>
            </div>
          </div>

          <div className="lp-hero-panel">
            <div className="lp-panel">
              <div className="lp-panel-visual flex items-center justify-center bg-gradient-to-br from-emerald-900 via-slate-900 to-slate-950 min-h-[180px]">
                <BrandMark size={88} className="!rounded-2xl !shadow-xl !ring-white/10" />
              </div>
              <div className="lp-panel-body">
                <div className="lp-panel-top">
                  <div className="lp-panel-pills">
                    <span className="lp-pill lp-pill--live">Testnet live</span>
                    <span className="lp-pill">SILENT</span>
                  </div>
                  <span className="lp-panel-meta">Console</span>
                </div>
                <div className="lp-panel-intro">
                  <div className="lp-panel-title">Private transfer flow</div>
                  <p className="lp-panel-desc">
                    Connect → fund a one-time address → recipient scans and claims.
                  </p>
                </div>
                <div className="lp-panel-rows">
                  {[
                    ['Connect', 'Wallet + SIWE', 'Live'],
                    ['Send', 'One-time address', 'Testnet'],
                    ['Claim', 'Into your wallet', 'Testnet'],
                  ].map(([a, b, c]) => (
                    <div key={a} className="lp-panel-row">
                      <span>{a}</span>
                      <span className="lp-mono">{b}</span>
                      <span className="lp-status">{c}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Proof strip ──────────────────────────────────────────────────── */}
      <section className="lp-strip" aria-label="Product principles">
        <div className="lp-container lp-strip-inner">
          <p className="lp-strip-label">Built for transfers—not identity theater</p>
          <div className="lp-strip-items">
            {['One-time destinations', 'Private discovery', 'No KYC', 'ERC-5564 aligned', 'Operations console'].map(
              (t) => (
                <span key={t} className="lp-strip-chip">
                  {t}
                </span>
              )
            )}
          </div>
        </div>
      </section>

      {/* ── Problem ──────────────────────────────────────────────────────── */}
      <section className="lp-section lp-section--muted" id="why">
        <div className="lp-container">
          <div className="lp-section-head">
            <p className="lp-kicker">The problem</p>
            <h2 className="lp-h2">Public rails were never designed for private payments</h2>
            <p className="lp-section-lead">
              Every direct transfer is a permanent public record. Reused wallets build history.
              Most fixes either demand identity or overpromise anonymity. SilentTransfer does neither.
            </p>
          </div>
          <div className="lp-problem-grid">
            {PROBLEMS.map((p) => (
              <article key={p.title} className="lp-problem-card">
                <div className="lp-problem-icon" aria-hidden>
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <h3 className="lp-problem-title">{p.title}</h3>
                <p className="lp-problem-body">{p.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Product / features ───────────────────────────────────────────── */}
      <section id="product" className="lp-section">
        <div className="lp-container">
          <div className="lp-section-head">
            <p className="lp-kicker">Product</p>
            <h2 className="lp-h2">Everything you need to move value privately</h2>
            <p className="lp-section-lead">
              A console and API for private receive, transfer, discovery, and claim—
              focused on unlinkability, not collecting who you are.
            </p>
          </div>
          <div className="lp-feature-grid">
            {FEATURES.map(({ icon: Icon, image, title, body }) => (
              <article key={title} className="lp-feature">
                <div className="lp-feature-media">
                  <Image src={image} alt="" width={640} height={640} className="lp-feature-photo" />
                  <div className="lp-feature-icon">
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="lp-feature-title">{title}</h3>
                <p className="lp-feature-body">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section id="how" className="lp-section lp-section--muted">
        <div className="lp-container">
          <div className="lp-section-head">
            <p className="lp-kicker">How it works</p>
            <h2 className="lp-h2">Three steps. No identity form.</h2>
            <p className="lp-section-lead">
              From wallet connect to claim in one continuous flow—designed so the “aha” is the transfer, not the paperwork.
            </p>
          </div>
          <div className="lp-steps">
            {STEPS.map((s) => {
              const Icon = s.icon;
              return (
                <article key={s.step} className="lp-step">
                  <div className="lp-step-media">
                    <Image src={s.image} alt="" width={640} height={400} className="lp-step-photo" />
                  </div>
                  <div className="lp-step-meta">
                    <span className="lp-step-num">{s.step}</span>
                    <span className="lp-step-icon" aria-hidden>
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                  </div>
                  <h3 className="lp-step-title">{s.title}</h3>
                  <p className="lp-step-body">{s.body}</p>
                </article>
              );
            })}
          </div>
          <div className="lp-section-cta" role="group" aria-label="Section actions">
            <Link href="/dashboard" className="lp-btn lp-btn--primary lp-btn--lg">
              Open console
              <ChevronRight className="w-4 h-4 shrink-0" />
            </Link>
            <a
              href={DOCS_URL}
              className="lp-btn lp-btn--secondary lp-btn--lg"
              {...(DOCS_URL.startsWith('http')
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : {})}
            >
              Read the docs
            </a>
          </div>
        </div>
      </section>

      {/* ── Roadmap ─────────────────────────────────────────────────────── */}
      <section id="roadmap" className="lp-section lp-section--muted">
        <div className="lp-container">
          <div className="lp-section-head">
            <p className="lp-kicker">Roadmap</p>
            <h2 className="lp-h2">What we&apos;re building next</h2>
            <p className="lp-section-lead">
              Live today: one-to-one private send, scan, and claim on testnet.
              Next: batch payouts, fuller privacy, and standards-complete stealth—documented as
              intentions, not ship dates.
            </p>
          </div>
          <div className="lp-roadmap-grid">
            {ROADMAP.map((item, i) => (
              <article key={item.title} className="lp-roadmap-card">
                <div className="lp-roadmap-num">{String(i + 1).padStart(2, '0')}</div>
                <h3 className="lp-roadmap-title">{item.title}</h3>
                <p className="lp-roadmap-body">{item.body}</p>
              </article>
            ))}
          </div>
          <div className="lp-section-cta">
            <a
              href={DOCS_URL.startsWith('http') ? `${DOCS_URL}#future` : '/docs#future'}
              className="lp-btn lp-btn--secondary lp-btn--lg"
              {...(DOCS_URL.startsWith('http')
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : {})}
            >
              Full roadmap in docs
            </a>
          </div>
        </div>
      </section>

      {/* ── $SILENT ──────────────────────────────────────────────────────── */}
      <section id="silent" className="lp-section">
        <div className="lp-container">
          <div className="lp-section-head">
            <p className="lp-kicker">Protocol asset</p>
            <h2 className="lp-h2">$SILENT — hard-capped. Zero VC.</h2>
            <p className="lp-section-lead">
              Maximum supply of <strong>{SILENT_TOTAL_SUPPLY_SHORT}</strong>. Community 60% ·
              Foundation 35% · Team 15% · Venture capital <strong>0%</strong>.
            </p>
          </div>

          <div className="lp-silent-cards">
            <div className="lp-silent-card">
              <div className="lp-silent-label">Name / ticker</div>
              <div className="lp-silent-value">Silent · SILENT</div>
              <p className="lp-silent-hint">No KYC · zero VC allocation</p>
            </div>
            <div className="lp-silent-card">
              <div className="lp-silent-label">Hard-capped supply</div>
              <div className="lp-silent-value lp-silent-value--accent">
                {SILENT_TOTAL_SUPPLY_SHORT}
              </div>
              <p className="lp-silent-hint">1,000,000,000 max · mint above cap disabled</p>
            </div>
            <div className="lp-silent-card">
              <div className="lp-silent-label">Contract</div>
              <div className="lp-silent-value lp-silent-value--mono">
                {truncAddr(SILENT_ADDRESS, 8, 6)}
              </div>
              <p className="lp-silent-hint">Set via environment after deployment</p>
            </div>
          </div>

          <div className="lp-silent-alloc">
            <div className="lp-silent-pie">
              <AllocationPie size={200} />
            </div>
            <div className="lp-silent-slices">
              {SILENT_ALLOCATION.map((a) => (
                <div
                  key={a.id}
                  className="lp-alloc-row"
                  style={{ backgroundColor: a.soft, borderColor: a.border }}
                >
                  <span
                    className="lp-alloc-dot"
                    style={{ backgroundColor: a.color }}
                  />
                  <span className="lp-alloc-label">{a.label}</span>
                  <span className="lp-alloc-pct" style={{ color: a.color }}>
                    {a.percent}%
                  </span>
                </div>
              ))}
              <div className="lp-alloc-vc">Venture allocation: 0%</div>
            </div>
          </div>

          <div className="lp-silent-note">
            <p>
              <strong>Hard cap:</strong> Maximum supply is 1B SILENT. The contract does not permit
              minting above the cap.
            </p>
            <p>
              <strong>Fees (current):</strong> {feePct} protocol fee.{' '}
              <strong>Fees (planned):</strong> {plannedPct} on sponsored claims—for protocol
              operations and open-market SILENT buybacks.
            </p>
            <p className="lp-silent-policy">{FEE_COPY.policy}</p>
            <p>
              <strong>Scope:</strong> Exchange listings, market pricing, and live vesting contracts
              are outside current product claims.
            </p>
            <Link href={SILENT_PAGE_URL} className="lp-silent-link">
              Full $SILENT overview <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Security ─────────────────────────────────────────────────────── */}
      <section id="security" className="lp-section lp-section--dark">
        <div className="lp-security-bg" aria-hidden>
          <Image src="/brand/security-bg.jpg" alt="" fill sizes="100vw" className="lp-security-photo" />
          <div className="lp-security-scrim" />
        </div>
        <div className="lp-container lp-security-content">
          <div className="lp-section-head lp-section-head--light">
            <p className="lp-kicker lp-kicker--light">Security & trust</p>
            <h2 className="lp-h2 lp-h2--light">Privacy claims you can audit</h2>
            <p className="lp-section-lead lp-section-lead--light">
              We ship capabilities and limits with equal rigor. No “untraceable” marketing.
              No identity theater.
            </p>
          </div>
          <div className="lp-security-grid">
            <div className="lp-security-card">
              <Network className="w-5 h-5" />
              <h3>Testnet live · mainnet staged</h3>
              <p>
                Real private send and claim run on Robinhood Chain Testnet. Mainnet production
                money movement is staged and should not be assumed audited.
              </p>
            </div>
            <div className="lp-security-card">
              <Shield className="w-5 h-5" />
              <h3>Documented threat model</h3>
              <p>
                Partial privacy, public metadata, timing linkability, and trusted API limits—
                written down so operators know the real envelope.
              </p>
            </div>
            <div className="lp-security-card">
              <EyeOff className="w-5 h-5" />
              <h3>No KYC requirement</h3>
              <p>
                The product path does not collect identity or route through a compliance oracle.
                Users remain responsible for applicable law.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <section className="lp-stats">
        <div className="lp-container lp-stats-grid">
          {STATS.map((s) => (
            <div key={s.label} className="lp-stat">
              <div className="lp-stat-value">{s.value}</div>
              <div className="lp-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section id="faq" className="lp-section lp-section--muted">
        <div className="lp-container lp-faq-layout">
          <div className="lp-section-head lp-section-head--faq">
            <p className="lp-kicker">FAQ</p>
            <h2 className="lp-h2">Straight answers</h2>
            <p className="lp-section-lead">
              The questions people ask before they click Launch app—answered without spin.
            </p>
          </div>
          <div className="lp-faq-list">
            {FAQS.map((f) => (
              <FaqItem key={f.q} q={f.q} a={f.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className="lp-cta">
        <div className="lp-container lp-cta-shell">
          <div className="lp-cta-art" aria-hidden>
            <Image
              src="/brand/empty-state.jpg"
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 40vw"
              className="lp-cta-photo"
            />
          </div>
          <div className="lp-cta-inner">
            <div>
              <h2 className="lp-h2">Start with a private transfer</h2>
              <p className="lp-section-lead lp-section-lead--left">
                Connect a wallet, send on testnet, discover payments, and claim.
                Limitations are documented. The path is real.
              </p>
            </div>
            <div className="lp-cta-actions">
              <Link href="/dashboard" className="lp-btn lp-btn--primary lp-btn--lg">
                Open console
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href={DOCS_URL}
                className="lp-btn lp-btn--secondary lp-btn--lg"
                {...(DOCS_URL.startsWith('http')
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : {})}
              >
                Documentation
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="lp-footer">
        <div className="lp-container lp-footer-inner">
          <div className="lp-footer-brand">
            <BrandLogo size={36} subtitle="" href="/" />
            <p className="lp-footer-tag">
              Private transfer infrastructure for public blockchains. Protocol asset: SILENT.
            </p>
          </div>
          <div className="lp-footer-cols">
            <div>
              <div className="lp-footer-h">Product</div>
              <Link href="/dashboard">Console</Link>
              <Link href="/dashboard?tab=send">Send</Link>
              <Link href={SILENT_PAGE_URL}>$SILENT</Link>
              <Link href="/dashboard?tab=scanner">Scanner</Link>
            </div>
            <div>
              <div className="lp-footer-h">Resources</div>
              <a
                href={DOCS_URL}
                {...(DOCS_URL.startsWith('http')
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : {})}
              >
                Docs
              </a>
              <a href="#product">Product</a>
              <a href="#roadmap">Roadmap</a>
              <a href="#security">Security</a>
              <a href="#faq">FAQ</a>
            </div>
            <div>
              <div className="lp-footer-h">Company</div>
              <a href="#why">Why SilentTransfer</a>
              <Link href="/dashboard?tab=settings">Settings</Link>
            </div>
          </div>
        </div>
        <div className="lp-container lp-footer-bottom">
          <p>
            Testnet private send is real on-chain. Privacy is partial—not full anonymity.
            Scope and limitations live in Docs.
          </p>
          <p>© {new Date().getFullYear()} SilentTransfer</p>
        </div>
      </footer>
    </div>
  );
}
