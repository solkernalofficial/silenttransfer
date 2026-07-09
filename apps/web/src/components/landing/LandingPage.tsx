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
  Menu,
  X,
  CheckCircle2,
  Building2,
  BookOpen,
  Coins,
  ExternalLink,
} from 'lucide-react';

const NAV = [
  { label: 'Platform', href: '#platform' },
  { label: 'How it works', href: '#how' },
  { label: 'Docs', href: DOCS_URL, external: DOCS_URL.startsWith('http') },
  { label: '$SILENT', href: SILENT_PAGE_URL },
  { label: 'Security', href: '#security' },
];

const FEATURES = [
  {
    icon: EyeOff,
    image: '/brand/feature-stealth.jpg',
    title: 'Stealth destinations',
    body: 'One-time payment addresses designed to reduce the public link between sender, recipient, and transfer history.',
  },
  {
    icon: Lock,
    image: '/brand/feature-enterprise.jpg',
    title: 'Identity-optional by design',
    body: 'No KYC requirement and no identity oracle in the product path. Private transfer without identity gates.',
  },
  {
    icon: Zap,
    image: '/brand/feature-gasless.jpg',
    title: 'Sponsored settlement path',
    body: 'A gas-sponsored claim flow for recipients. Evaluation environments simulate completion; production settlement is staged separately.',
  },
  {
    icon: Network,
    image: '/brand/feature-standards.jpg',
    title: 'Standards-aligned',
    body: 'Architecture aligned with ERC-6538 registry and ERC-5564 announcement patterns for interoperability.',
  },
  {
    icon: ScanSearch,
    image: '/brand/feature-discovery.jpg',
    title: 'Private discovery',
    body: 'Recipients locate payments intended for them without relying on a public inbox or reused deposit addresses.',
  },
  {
    icon: Shield,
    image: '/brand/feature-stealth.jpg',
    title: 'Operations console',
    body: 'Register, send, discover, settle, and review history from a single professional control surface.',
  },
];

const STEPS = [
  {
    step: '01',
    image: '/brand/feature-enterprise.jpg',
    title: 'Enable private receive',
    body: 'The recipient registers spending and viewing public keys once for their wallet.',
  },
  {
    step: '02',
    image: '/brand/feature-stealth.jpg',
    title: 'Execute private transfer',
    body: 'The sender creates a one-time destination and records the private transfer (default asset: ETH).',
  },
  {
    step: '03',
    image: '/brand/feature-discovery.jpg',
    title: 'Discover and settle',
    body: 'The recipient discovers payments and completes settlement through the sponsored claim path when available.',
  },
];

const STATS = [
  { value: '0', label: 'KYC required' },
  { value: '4', label: 'Core workflow steps' },
  { value: 'SILENT', label: 'Protocol asset' },
  { value: '1B', label: 'Hard-capped supply' },
];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const feePct = protocolFeePercentLabel();
  const plannedPct = plannedFeePercentLabel();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const NavItem = ({
    label,
    href,
    external,
    onClick,
    className = 'lp-nav-link',
  }: {
    label: string;
    href: string;
    external?: boolean;
    onClick?: () => void;
    className?: string;
  }) => {
    if (external) {
      return (
        <a
          href={href}
          className={className}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClick}
        >
          {label}
        </a>
      );
    }
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

  return (
    <div className="lp">
      <header className={`lp-nav ${scrolled ? 'lp-nav--solid' : ''}`}>
        <div className="lp-container lp-nav-inner">
          <BrandLogo size={40} subtitle="Privacy" href="/" />

          <nav className="lp-nav-links" aria-label="Primary">
            {NAV.map((item) => (
              <NavItem key={item.label} {...item} />
            ))}
          </nav>

          <div className="lp-nav-actions">
            <a
              href={DOCS_URL}
              className="lp-btn lp-btn--ghost lp-btn--sm hidden sm:inline-flex"
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
              aria-label="Toggle menu"
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="lp-mobile">
            {NAV.map((item) => (
              <NavItem
                key={item.label}
                {...item}
                className="lp-mobile-link"
                onClick={() => setMobileOpen(false)}
              />
            ))}
            <Link
              href="/dashboard"
              className="lp-btn lp-btn--primary lp-btn--block"
              onClick={() => setMobileOpen(false)}
            >
              Launch app
            </Link>
          </div>
        )}
      </header>

      {/* Hero */}
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
              Institutional private transfer infrastructure
            </div>
            <h1 className="lp-h1">
              Private value transfer
              <span className="lp-h1-accent"> without identity gates</span>
            </h1>
            <p className="lp-lead">
              SilentTransfer enables private transfers using one-time destinations, recipient
              discovery, and a sponsored settlement path—without KYC. Protocol asset:{' '}
              <strong>$SILENT</strong>, hard-capped at 1B. Scope and limitations are documented with
              precision.
            </p>
            <div className="lp-hero-cta">
              <Link href="/dashboard" className="lp-btn lp-btn--primary lp-btn--lg">
                Open console
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href={SILENT_PAGE_URL} className="lp-btn lp-btn--secondary lp-btn--lg">
                <Coins className="w-4 h-4" />
                $SILENT
              </Link>
            </div>
            <div className="lp-trust-row">
              <span className="lp-trust-item">
                <CheckCircle2 className="w-3.5 h-3.5" /> No KYC
              </span>
              <span className="lp-trust-item">
                <CheckCircle2 className="w-3.5 h-3.5" /> Hard-capped supply
              </span>
              <span className="lp-trust-item">
                <CheckCircle2 className="w-3.5 h-3.5" /> Documented limitations
              </span>
            </div>
          </div>

          <div className="lp-hero-panel">
            <div className="lp-panel">
              <div className="lp-panel-visual flex items-center justify-center bg-gradient-to-br from-emerald-900 to-slate-900 min-h-[180px]">
                <BrandMark size={88} className="!rounded-2xl !shadow-xl !ring-white/10" />
              </div>
              <div className="lp-panel-body">
                <div className="lp-panel-top">
                  <div className="lp-panel-pills">
                    <span className="lp-pill lp-pill--live">Console</span>
                    <span className="lp-pill">SILENT</span>
                  </div>
                  <span className="lp-panel-meta">Platform</span>
                </div>
                <div className="space-y-2 py-2">
                  <div className="text-sm font-semibold text-[var(--text)]">SilentTransfer</div>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    End-to-end private transfer workflow in four steps. Production settlement is
                    staged and documented separately.
                  </p>
                </div>
                <div className="lp-panel-rows">
                  {[
                    ['Receive', 'Registration', 'Available'],
                    ['Send', 'Private transfer', 'Available'],
                    ['Settle', 'Sponsored path', 'Staged'],
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

      <section className="lp-strip">
        <div className="lp-container lp-strip-inner">
          <p className="lp-strip-label">Built for private transfer—not identity infrastructure</p>
          <div className="lp-strip-items">
            {['Stealth destinations', 'Private discovery', 'No KYC', '$SILENT', 'Operations console'].map(
              (t) => (
                <span key={t} className="lp-strip-chip">
                  {t}
                </span>
              )
            )}
          </div>
        </div>
      </section>

      <section id="platform" className="lp-section">
        <div className="lp-container">
          <div className="lp-section-head">
            <p className="lp-kicker">Platform</p>
            <h2 className="lp-h2">Privacy infrastructure you can operate</h2>
            <p className="lp-section-lead">
              Console and API for private receive, transfer, discovery, and settlement—focused on
              recipient unlinkability, not identity collection.
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

      <section id="how" className="lp-section lp-section--muted">
        <div className="lp-container">
          <div className="lp-section-head">
            <p className="lp-kicker">How it works</p>
            <h2 className="lp-h2">Three steps from registration to settlement</h2>
          </div>
          <div className="lp-steps">
            {STEPS.map((s) => (
              <article key={s.step} className="lp-step">
                <div className="lp-step-media">
                  <Image src={s.image} alt="" width={640} height={400} className="lp-step-photo" />
                </div>
                <div className="lp-step-num">{s.step}</div>
                <h3 className="lp-step-title">{s.title}</h3>
                <p className="lp-step-body">{s.body}</p>
              </article>
            ))}
          </div>
          <div className="lp-section-cta" role="group" aria-label="Section actions">
            <Link href="/dashboard?tab=receive" className="lp-btn lp-btn--primary lp-btn--lg">
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
              Documentation
            </a>
          </div>
        </div>
      </section>

      {/* $SILENT */}
      <section id="silent" className="lp-section">
        <div className="lp-container">
          <div className="lp-section-head">
            <p className="lp-kicker">Protocol asset</p>
            <h2 className="lp-h2">$SILENT</h2>
            <p className="lp-section-lead">
              Hard-capped supply of <strong>{SILENT_TOTAL_SUPPLY_SHORT}</strong>. No venture
              allocation. Community 60% · Foundation / protocol 35% (locked) · Team 15%.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            <div className="rh-card p-5">
              <div className="text-xs text-[var(--text-muted)] mb-1">Name / ticker</div>
              <div className="text-lg font-bold">Silent · SILENT</div>
              <p className="text-[11px] text-[var(--text-faint)] mt-2">No KYC · zero VC allocation</p>
            </div>
            <div className="rh-card p-5">
              <div className="text-xs text-[var(--text-muted)] mb-1">Hard-capped supply</div>
              <div className="text-lg font-mono font-bold text-[var(--accent)]">
                {SILENT_TOTAL_SUPPLY_SHORT}
              </div>
              <p className="text-[11px] text-[var(--text-faint)] mt-2">
                1,000,000,000 maximum · mint above cap disabled
              </p>
            </div>
            <div className="rh-card p-5">
              <div className="text-xs text-[var(--text-muted)] mb-1">Contract</div>
              <div className="text-sm font-mono break-all">{truncAddr(SILENT_ADDRESS, 8, 6)}</div>
              <p className="text-[11px] text-[var(--text-faint)] mt-2">
                Configure via environment after network deployment
              </p>
            </div>
          </div>

          <div className="max-w-4xl mx-auto mt-6 grid grid-cols-1 md:grid-cols-[minmax(0,220px)_1fr] gap-8 items-center">
            <div className="flex justify-center md:justify-start w-full">
              <AllocationPie size={200} />
            </div>
            <div className="space-y-2.5 min-w-0">
              {SILENT_ALLOCATION.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-3 p-3 rounded-xl border text-sm"
                  style={{ backgroundColor: a.soft, borderColor: a.border }}
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0 ring-2 ring-white shadow-sm"
                    style={{ backgroundColor: a.color }}
                  />
                  <span className="flex-1 font-medium text-[var(--text-secondary)]">{a.label}</span>
                  <span className="font-mono font-bold tabular-nums" style={{ color: a.color }}>
                    {a.percent}%
                  </span>
                </div>
              ))}
              <div className="text-xs font-semibold text-emerald-800 pl-1">
                Venture allocation: 0%
              </div>
            </div>
          </div>

          <div className="max-w-4xl mx-auto mt-6 rh-card p-5 text-sm text-[var(--text-muted)] leading-relaxed space-y-2">
            <p>
              <strong className="text-[var(--text)]">Hard cap:</strong> Maximum supply is 1B SILENT.
              The contract does not permit minting above the cap.
            </p>
            <p>
              <strong className="text-[var(--text)]">Fees (current):</strong> {feePct} protocol fee.{' '}
              <strong className="text-[var(--text)]">Fees (planned):</strong> {plannedPct} on
              sponsored claims, allocated to protocol operations and open-market SILENT buybacks.
            </p>
            <p className="text-xs text-[var(--text-faint)]">{FEE_COPY.policy}</p>
            <p>
              <strong className="text-[var(--text)]">Scope note:</strong> Exchange listings, market
              pricing, yield products, and live vesting contracts are outside current product claims.
            </p>
            <Link
              href={SILENT_PAGE_URL}
              className="inline-flex items-center gap-1.5 text-[var(--accent)] font-semibold text-sm pt-1 hover:underline"
            >
              View $SILENT overview <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      <section id="security" className="lp-section lp-section--dark">
        <div className="lp-security-bg" aria-hidden>
          <Image src="/brand/security-bg.jpg" alt="" fill sizes="100vw" className="lp-security-photo" />
          <div className="lp-security-scrim" />
        </div>
        <div className="lp-container lp-security-content">
          <div className="lp-section-head lp-section-head--light">
            <p className="lp-kicker lp-kicker--light">Security & trust</p>
            <h2 className="lp-h2 lp-h2--light">Built for scrutiny</h2>
            <p className="lp-section-lead lp-section-lead--light">
              Privacy claims are only as strong as the model behind them. SilentTransfer documents
              capabilities and limitations with equal rigor.
            </p>
          </div>
          <div className="lp-security-grid">
            <div className="lp-security-card">
              <Building2 className="w-5 h-5" />
              <h3>Staged settlement</h3>
              <p>
                Sponsored settlement in evaluation environments is simulated. Production mainnet
                settlement is staged and subject to independent review.
              </p>
            </div>
            <div className="lp-security-card">
              <Shield className="w-5 h-5" />
              <h3>Documented threat model</h3>
              <p>
                Documentation covers privacy properties and residual risks—including metadata, IP
                exposure, and operational key management.
              </p>
            </div>
            <div className="lp-security-card">
              <EyeOff className="w-5 h-5" />
              <h3>No KYC requirement</h3>
              <p>
                The product path does not collect identity or route through a compliance oracle.
              </p>
            </div>
          </div>
        </div>
      </section>

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
              <h2 className="lp-h2">Operate private transfers from the console</h2>
              <p className="lp-section-lead lp-section-lead--left">
                Configure receive, execute private transfer, discover payments, and review
                settlement. Full technical detail is in Documentation.
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

      <footer className="lp-footer">
        <div className="lp-container lp-footer-inner">
          <div className="lp-footer-brand">
            <BrandLogo size={40} subtitle="Privacy" href="/" />
            <p className="lp-footer-tag">
              Private transfer infrastructure. Protocol asset: SILENT.
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
              <a href="#platform">Platform</a>
              <a href="#security">Security</a>
              <Link href="/dashboard?tab=settings">Settings</Link>
            </div>
          </div>
        </div>
        <div className="lp-container lp-footer-bottom">
          <p>
            Evaluation environments may use synthetic settlement data. Protocol asset: SILENT
            (hard-capped). Scope and limitations are documented.
          </p>
          <p>© {new Date().getFullYear()} SilentTransfer</p>
        </div>
      </footer>
    </div>
  );
}
