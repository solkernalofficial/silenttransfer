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
  SILENT_LAUNCH_NOTE,
  silentAllocationSummary,
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
    icon: Lock,
    image: '/brand/feature-enterprise.jpg',
    title: 'Private vault',
    body: 'Deposit into a wallet-bound vault. Later send any amount—once or in pieces—to any address. Your connected wallet is the key. No note files to back up.',
  },
  {
    icon: EyeOff,
    image: '/brand/feature-stealth.jpg',
    title: 'Break the public A→B link',
    body: 'Payouts leave the vault, not your everyday wallet. Recipients receive ETH directly—without a public one-to-one send from your known address.',
  },
  {
    icon: Zap,
    image: '/brand/feature-gasless.jpg',
    title: 'Recipients never open the site',
    body: 'Batch or single send from the vault. Funds land in their wallet automatically. No claim step, no app install for the receiver.',
  },
  {
    icon: ScanSearch,
    image: '/brand/feature-discovery.jpg',
    title: 'Send when you choose',
    body: 'Deposit once. Withdraw later—different times, different amounts, one wallet or many. Timing is under your control.',
  },
  {
    icon: Network,
    image: '/brand/feature-standards.jpg',
    title: 'Standards path (advanced)',
    body: 'Optional ERC-5564 / ERC-6538 stealth tooling and a shield pool remain available for power users. Docs mark what is live vs experimental.',
  },
  {
    icon: Shield,
    image: '/brand/feature-compliance.jpg',
    title: 'Honest privacy docs',
    body: 'We document what is harder to trace today—and what still links on a public chain (amounts, timing, funding graph). No fake anonymity claims.',
  },
];

const STEPS = [
  {
    step: '01',
    icon: Wallet,
    image: '/brand/feature-enterprise.jpg',
    title: 'Connect your wallet',
    body: 'Open the console and connect. Your wallet signs deposits and sends. That same wallet owns your vault balance—nothing else to store.',
  },
  {
    step: '02',
    icon: Send,
    image: '/brand/feature-stealth.jpg',
    title: 'Deposit into the vault',
    body: 'Move ETH into your private vault on-chain. A small protocol fee may apply on deposit. Balance sits ready until you decide to pay out.',
  },
  {
    step: '03',
    icon: Inbox,
    image: '/brand/feature-discovery.jpg',
    title: 'Send single or batch anytime',
    body: 'Pay one address or many. Recipients get funds in their wallet with no website visit. You control amounts and timing.',
  },
];

const PROBLEMS = [
  {
    title: 'Public chains are permanent ledgers',
    body: 'A direct A→B transfer is forever readable. Counterparties, amounts, and patterns sit on a public graph anyone can query.',
  },
  {
    title: 'Reused wallets build a history',
    body: 'Every payment from the same address deepens a profile. Private payouts need a different path than “send from main wallet.”',
  },
  {
    title: 'Claim UX kills privacy products',
    body: 'If the receiver must visit a site, paste codes, or set up special keys, adoption dies. SilentTransfer pays wallets directly from the vault.',
  },
];

const STATS = [
  { value: '1', label: 'Primary flow: private vault' },
  { value: '0', label: 'Claim steps for recipients' },
  { value: '1B', label: 'SILENT hard cap' },
  { value: '0%', label: 'Venture allocation' },
];

const ROADMAP: {
  title: string;
  body: string;
  status: 'Live' | 'Next' | 'Later';
}[] = [
  {
    status: 'Live',
    title: 'Private vault',
    body: 'Deposit into a wallet-bound vault. Single or batch send anytime. Recipients auto-receive—no claim site. Wallet is the key.',
  },
  {
    status: 'Live',
    title: 'Harder-to-trace payouts',
    body: 'Funds leave the vault contract, not a plain A→B send from your hot wallet. Split amounts and timing under your control.',
  },
  {
    status: 'Live',
    title: 'Console, docs & $SILENT',
    body: 'Minimal operations console, honest privacy docs, and SILENT (1B hard cap, community-majority, 0% VC) on testnet.',
  },
  {
    status: 'Next',
    title: 'Stronger unlinkability',
    body: 'Delayed and fixed-size payout patterns, larger shared anonymity sets, and hygiene guidance against amount/timing correlation.',
  },
  {
    status: 'Next',
    title: 'Shield pool maturity',
    body: 'Testnet shield notes exist today. Production Groth16 path-hiding ships only when ceremony and product scope allow—not claimed complete.',
  },
  {
    status: 'Next',
    title: 'Payroll & treasury scheduling',
    body: 'Recurring private batch payouts for operators and DAOs—same auto-receive model for every recipient line.',
  },
  {
    status: 'Later',
    title: 'Mainnet + external audit',
    body: 'Production money path only after audit and hardened ops. Mainnet TVL is not claimed today.',
  },
  {
    status: 'Later',
    title: 'Multi-chain expansion',
    body: 'Additional networks after the primary vault path is stable and documented on the first production chain.',
  },
];

const FAQS = [
  {
    q: 'Is this fully untraceable?',
    a: 'The product is built to make transfers harder to trace than a plain public send: payouts come from the vault, recipients do not claim on a website, and you can split amounts over time. On a public chain, funding, vault interactions, amounts, and timing can still be analyzed. We do not claim absolute anonymity or “invisible forever.”',
  },
  {
    q: 'Does the recipient need SilentTransfer?',
    a: 'No. When you send from the private vault, ETH arrives in their normal wallet. No site visit, no claim code, no setup.',
  },
  {
    q: 'What is the main product flow today?',
    a: 'Connect wallet → deposit into your private vault → later send single or batch to any 0x addresses. Your connected wallet is the key; no local note backup.',
  },
  {
    q: 'Is private send live?',
    a: 'Yes on Robinhood Chain Testnet: real on-chain vault deposit and withdraw. Mainnet production and formal audits are not claimed.',
  },
  {
    q: 'What is $SILENT?',
    a: 'SILENT is the protocol asset—hard-capped at 1B. Community-majority allocation, 0% VC. Fees support ops and open-market buybacks when enabled.',
  },
  {
    q: 'Who is this for?',
    a: 'Individuals and teams who need private, untraceable-oriented payouts on public rails—payroll-style batches, vendor pays, and personal transfers—without forcing receivers onto a privacy app.',
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
              Untraceable transfer · public chains
            </div>
            <h1 className="lp-h1">
              Private payouts that are
              <span className="lp-h1-accent"> harder to trace</span>
            </h1>
            <p className="lp-lead">
              SilentTransfer is private transfer infrastructure for public blockchains.
              Deposit into a vault, then pay any wallet—single or batch, any time.
              Recipients never open the site. Built to break the public A→B link.
            </p>
            <div className="lp-hero-cta">
              <Link href="/dashboard" className="lp-btn lp-btn--primary lp-btn--lg">
                Open console
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="#how" className="lp-btn lp-btn--secondary lp-btn--lg">
                See how it works
              </a>
            </div>
            <div className="lp-trust-row">
              <span className="lp-trust-item">
                <CheckCircle2 className="w-3.5 h-3.5" /> Vault-based payouts
              </span>
              <span className="lp-trust-item">
                <CheckCircle2 className="w-3.5 h-3.5" /> Auto-receive for B
              </span>
              <span className="lp-trust-item">
                <CheckCircle2 className="w-3.5 h-3.5" /> Honest privacy limits
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
                  <div className="lp-panel-title">Private vault flow</div>
                  <p className="lp-panel-desc">
                    Deposit → vault balance → send single or batch. Wallet is the key.
                  </p>
                </div>
                <div className="lp-panel-rows">
                  {[
                    ['Deposit', 'Into private vault', 'Live'],
                    ['Send', 'One or many wallets', 'Live'],
                    ['Receive', 'Auto — no claim', 'Live'],
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
          <p className="lp-strip-label">Built for untraceable-oriented private transfers</p>
          <div className="lp-strip-items">
            {[
              'Private vault',
              'Batch & single payout',
              'No recipient claim',
              'Wallet as key',
              'Honest docs',
            ].map((t) => (
              <span key={t} className="lp-strip-chip">
                {t}
              </span>
            ))}
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
              Every direct transfer is a permanent public record. Privacy tools that force receivers
              through claim portals fail in the real world. SilentTransfer focuses on vault payouts
              that land in ordinary wallets—harder to map as a simple A→B payment.
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
              A minimal console for vault deposit, private send, and batch payout—focused on
              breaking public payment graphs, not collecting identity.
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
            <h2 className="lp-h2">Three steps. Wallet is the key.</h2>
            <p className="lp-section-lead">
              From deposit to payout in one continuous flow—designed so receivers never need the app.
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
            <h2 className="lp-h2">Live today. Building next. Honest later.</h2>
            <p className="lp-section-lead">
              Private vault is live on testnet. Everything below is labeled Live, Next, or Later—
              intentions with clear status, not fake ship dates or overstated completion.
            </p>
          </div>
          <div className="lp-roadmap-legend" aria-label="Roadmap status legend">
            <span className="lp-roadmap-badge lp-roadmap-badge--live">Live</span>
            <span className="lp-roadmap-badge lp-roadmap-badge--next">Next</span>
            <span className="lp-roadmap-badge lp-roadmap-badge--later">Later</span>
          </div>
          <div className="lp-roadmap-grid">
            {ROADMAP.map((item, i) => (
              <article
                key={item.title}
                className={`lp-roadmap-card lp-roadmap-card--${item.status.toLowerCase()}`}
              >
                <div className="lp-roadmap-card-top">
                  <div className="lp-roadmap-num">{String(i + 1).padStart(2, '0')}</div>
                  <span
                    className={`lp-roadmap-badge lp-roadmap-badge--${item.status.toLowerCase()}`}
                  >
                    {item.status}
                  </span>
                </div>
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
            <a
              href="https://github.com/SilentTransfer/silenttransfer/blob/main/docs/ROADMAP.md"
              className="lp-btn lp-btn--ghost lp-btn--lg"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub roadmap
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </section>

      {/* ── $SILENT ──────────────────────────────────────────────────────── */}
      <section id="silent" className="lp-section">
        <div className="lp-container">
          <div className="lp-section-head">
            <p className="lp-kicker">Protocol asset</p>
            <h2 className="lp-h2">$SILENT — hard-capped. Community-majority.</h2>
            <p className="lp-section-lead">
              Maximum supply of <strong>{SILENT_TOTAL_SUPPLY_SHORT}</strong>.{' '}
              {silentAllocationSummary()} · Venture capital <strong>0%</strong> · separate team pool{' '}
              <strong>0%</strong>. Community-first fair launch design.
            </p>
          </div>

          <div className="lp-silent-cards">
            <div className="lp-silent-card">
              <div className="lp-silent-label">Name / ticker</div>
              <div className="lp-silent-value">sthood · SILENT</div>
              <p className="lp-silent-hint">Zero VC · community-majority</p>
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
              <div className="lp-alloc-vc">VC + separate team pool: 0%</div>
            </div>
          </div>

          <div className="lp-silent-note">
            <p>
              <strong>Launch:</strong> {SILENT_LAUNCH_NOTE}
            </p>
            <p>
              <strong>Hard cap:</strong> Maximum supply is 1B SILENT. The contract does not permit
              minting above the cap.
            </p>
            <p>
              <strong>Fees (current):</strong> {feePct} product fee on many paths; vault deposit may
              charge a protocol fee on-chain.{' '}
              <strong>Fees (planned):</strong> {plannedPct} on sponsored flows—for protocol
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
              We ship capabilities and limits with equal rigor. Harder to trace—not invisible to
              every analyst forever.
            </p>
          </div>
          <div className="lp-security-grid">
            <div className="lp-security-card">
              <Network className="w-5 h-5" />
              <h3>Testnet live · mainnet staged</h3>
              <p>
                Real vault deposit and send run on Robinhood Chain Testnet. Mainnet production
                money movement is staged and should not be assumed audited.
              </p>
            </div>
            <div className="lp-security-card">
              <Shield className="w-5 h-5" />
              <h3>Documented threat model</h3>
              <p>
                Public metadata, amount fingerprinting, timing linkability, and vault interaction
                graphs—written down so operators know the real envelope.
              </p>
            </div>
            <div className="lp-security-card">
              <EyeOff className="w-5 h-5" />
              <h3>What “untraceable” means here</h3>
              <p>
                Payouts leave a shared vault path rather than a plain A→B send; receivers need no
                app. We still disclose residual chain analysis risk. Users remain responsible for
                applicable law.
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
              <h2 className="lp-h2">Start with a private vault transfer</h2>
              <p className="lp-section-lead lp-section-lead--left">
                Connect a wallet, deposit on testnet, send single or batch. Limitations are
                documented. The path is real.
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
              <Link href="/dashboard">Private vault</Link>
              <Link href={SILENT_PAGE_URL}>$SILENT</Link>
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
            <div>
              <div className="lp-footer-h">Community</div>
              <a
                href="https://github.com/SilentTransfer"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
              <a
                href="https://x.com/silenttransfer"
                target="_blank"
                rel="noopener noreferrer"
              >
                X
              </a>
            </div>
          </div>
        </div>
        <div className="lp-container lp-footer-bottom">
          <p>
            Testnet vault send is real on-chain. Built for harder-to-trace private payouts—not full
            anonymity. Scope and limitations live in Docs.
          </p>
          <p>© {new Date().getFullYear()} SilentTransfer</p>
        </div>
      </footer>
    </div>
  );
}
