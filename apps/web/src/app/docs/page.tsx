import type { Metadata } from 'next';
import type { ComponentType, ReactNode } from 'react';
import Link from 'next/link';
import BrandLogo, { SILENT_PAGE_URL } from '@/components/BrandLogo';
import { SILENT_ADDRESS, truncAddr } from '@/lib/tokens';
import {
  SILENT_TOTAL_SUPPLY_SHORT,
  SILENT_ALLOCATION,
  SILENT_VC_PERCENT,
} from '@/lib/tokenomics';
import { protocolFeePercentLabel, plannedFeePercentLabel, FEE_COPY } from '@/lib/fees';
import {
  ArrowLeft,
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  BookOpen,
  Shield,
  Layers,
  Workflow,
  AlertTriangle,
  Coins,
  Server,
  KeyRound,
  EyeOff,
  Radio,
  Repeat2,
  Ban,
  Rocket,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Docs — SilentTransfer',
  description:
    'Deep documentation: stealth addresses (ERC-5564 / ERC-6538), how SilentTransfer works today, privacy limits, fees, $SILENT, roadmap — honest, no fake claims.',
};

const TOC = [
  { id: 'overview', label: '1. Overview' },
  { id: 'problem', label: '2. Problem we solve' },
  { id: 'stealth-theory', label: '3. Stealth addresses (standards)' },
  { id: 'product-vs-ideal', label: '4. Ideal crypto vs our demo' },
  { id: 'how-demo', label: '5. How SilentTransfer works today' },
  { id: 'architecture', label: '6. Architecture' },
  { id: 'privacy', label: '7. Privacy guarantees & limits' },
  { id: 'fees', label: '8. Fees' },
  { id: 'token', label: '9. $SILENT' },
  { id: 'status', label: '10. Status: done / not done' },
  { id: 'future', label: '11. Future roadmap' },
  { id: 'threats', label: '12. Threat model notes' },
  { id: 'hosting', label: '13. Hosting & domains' },
];

const DONE = [
  {
    title: 'Private receive setup',
    detail:
      'Console + API register spend/view public keys for a wallet (demo auth). No KYC gate.',
  },
  {
    title: 'Private send log (Alice → Bob)',
    detail:
      'Authenticated announce records one-time stealth address, amount, token, and intended recipient (to_address) in the API database.',
  },
  {
    title: 'Recipient scan',
    detail:
      'Scanner matches payments where metadata.to_address equals the viewer wallet — Bob can find payments meant for him.',
  },
  {
    title: 'Demo gasless claim',
    detail:
      'Relayer withdraw returns a synthetic tx hash in DEMO_MODE and records fee/history. Not EntryPoint-executed mainnet settlement.',
  },
  {
    title: 'SilentToken (SILENT)',
    detail:
      'Non-upgradeable ERC-20, no transfer whitelist, hard-capped at 1B (no mint above max). Deploy mints up to 1B. Fees 0% now; planned 0.5% for ops + buyback.',
  },
  {
    title: 'Operator console + landing',
    detail:
      'Send / Receive / Scanner / Relayer, Alice–Bob demo helpers, docs + $SILENT pages, honest demo labels.',
  },
  {
    title: 'Smoke tests',
    detail:
      'End-to-end user journey (register → send → scan → claim) and security smoke for auth boundaries.',
  },
];

const NOT_DONE = [
  {
    title: 'Full cryptographic stealth derivation in the UI path',
    detail:
      'Ideal ERC-5564 uses ECDH shared secrets so only Bob can recognize payments. The live demo path primarily matches by to_address in the announcement log for usability.',
  },
  {
    title: 'Live mainnet money movement',
    detail:
      'Console private send does not currently complete a real on-chain ERC-20 transfer + messenger announce as one atomic user product path.',
  },
  {
    title: 'Production ERC-4337 paymaster',
    detail:
      'SilentPaymaster is a mock: fee math + events. No EntryPoint.handleOps gas sponsorship of real sweeps yet.',
  },
  {
    title: 'On-chain token vesting / allocation locks',
    detail:
      '1B allocation (60/35/15, VC 0%) is published policy. Vesting contracts are not claimed deployed.',
  },
  {
    title: 'Independent security audit',
    detail: 'Contracts and API have not been marketed as audited.',
  },
  {
    title: 'SIWE-only production auth',
    detail: 'Demo JWT login remains the primary UX for the walkthrough.',
  },
];

const FUTURE = [
  'Wire real on-chain path: transfer SILENT to stealth address + ERC-5564-style announce.',
  'Client-side or SDK path for true viewing-key scan (shared-secret match), not only to_address.',
  'Relayer that executes real withdrawals with transparent fee deduction.',
  'Optional self-withdraw (user pays gas, 0% protocol fee).',
  'Publish team vesting schedule when locks go on-chain.',
  'Host app.silenttransfer.com + docs.silenttransfer.com in production.',
  'External audit before any mainnet treasury or public TVL claims.',
];

function Section({
  id,
  icon: Icon,
  title,
  children,
}: {
  id: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 rh-card p-6 sm:p-8 space-y-4">
      <h2 className="text-xl font-bold tracking-tight flex items-center gap-2.5 text-[var(--text)]">
        <span className="w-9 h-9 rounded-xl bg-[var(--accent-soft)] border border-emerald-100 flex items-center justify-center shrink-0">
          <Icon className="w-4.5 h-4.5 text-[var(--accent)] w-4 h-4" />
        </span>
        {title}
      </h2>
      <div className="text-sm text-[var(--text-muted)] leading-relaxed space-y-3 prose-docs">
        {children}
      </div>
    </section>
  );
}

export default function DocsPage() {
  const feePct = protocolFeePercentLabel();
  const plannedPct = plannedFeePercentLabel();

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-white/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <BrandLogo size={36} subtitle="Docs" />
          <div className="flex items-center gap-3 text-sm">
            <Link
              href={SILENT_PAGE_URL}
              className="hidden sm:inline text-[var(--text-muted)] hover:text-[var(--accent)] font-medium"
            >
              $SILENT
            </Link>
            <Link
              href="/dashboard"
              className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-semibold"
            >
              Console
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-10 grid lg:grid-cols-[220px_minmax(0,1fr)] gap-8 lg:gap-10">
        {/* TOC */}
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)] mb-3 px-2">
              On this page
            </div>
            {TOC.map((t) => (
              <a
                key={t.id}
                href={`#${t.id}`}
                className="block text-xs text-[var(--text-muted)] hover:text-[var(--accent)] px-2 py-1.5 rounded-md hover:bg-white border border-transparent hover:border-[var(--border)] transition-colors"
              >
                {t.label}
              </a>
            ))}
            <div className="pt-4 px-2 text-[10px] text-[var(--text-faint)] leading-relaxed">
              Host: docs.silenttransfer.com → this page
            </div>
          </nav>
        </aside>

        <main className="space-y-6 min-w-0 max-w-3xl">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--accent)] mb-4"
            >
              <ArrowLeft className="w-4 h-4" /> Home
            </Link>
            <div className="flex items-center gap-2 text-[var(--accent)] mb-2">
              <BookOpen className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Documentation</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--text)] mb-3">
              SilentTransfer documentation
            </h1>
            <p className="text-[var(--text-muted)] leading-relaxed text-[15px] max-w-2xl">
              Technical reference for operators and integrators: stealth address standards,
              product capabilities, privacy properties, fees, $SILENT, and current limitations—stated
              precisely without overstatement.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                Privacy-first
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full bg-sky-50 text-sky-800 border border-sky-200">
                No KYC
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                Scope documented
              </span>
            </div>
          </div>

          {/* Mobile TOC */}
          <div className="lg:hidden rh-card p-4">
            <div className="text-xs font-bold text-[var(--text-secondary)] mb-2">Contents</div>
            <div className="flex flex-wrap gap-2">
              {TOC.map((t) => (
                <a
                  key={t.id}
                  href={`#${t.id}`}
                  className="text-[11px] px-2 py-1 rounded-md bg-[var(--bg-muted)] text-[var(--text-muted)] border border-[var(--border)]"
                >
                  {t.label}
                </a>
              ))}
            </div>
          </div>

          <Section id="overview" icon={BookOpen} title="1. Overview">
            <p>
              <strong className="text-[var(--text)]">SilentTransfer</strong> is a privacy-oriented
              private-transfer stack: web console, FastAPI backend, and Solidity contracts. The goal
              is simple to say and hard to do well:{' '}
              <strong className="text-[var(--text)]">
                let Alice send value to Bob without a clear public link between Bob’s known wallet
                and the payment destination
              </strong>
              .
            </p>
            <p>
              On public blockchains, every transfer is visible. Anyone can graph who paid whom if
              both addresses are known. Stealth-address designs attack that{' '}
              <em>recipient-link</em> problem: the funds land on a one-time address that only the
              recipient can control, while an announcement helps the recipient discover the payment
              without broadcasting “this payment is for Bob’s ENS / exchange deposit address.”
            </p>
            <p>
              SilentTransfer’s product token is <strong className="text-[var(--text)]">SILENT</strong>{' '}
              (see §9). The console defaults to ETH for private transfers (SILENT and other tokens optional). There is{' '}
              <strong className="text-[var(--text)]">no KYC</strong> in the product surface.
            </p>
          </Section>

          <Section id="problem" icon={EyeOff} title="2. Problem we solve">
            <p>
              <strong className="text-[var(--text)]">Transparent ledgers leak relationship graphs.</strong>{' '}
              If Bob’s salary wallet is public, every payroll transfer is public. If a merchant’s
              address is reused, customers and competitors can measure volume. Privacy tools on
              public chains usually trade off different properties:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-[var(--text)]">Stealth addresses</strong> (this family of
                designs) — primarily <em>recipient unlinkability</em> per payment, non-interactive
                for the recipient after meta-address registration.
              </li>
              <li>
                <strong className="text-[var(--text)]">Mixers / pooling</strong> — different threat
                model, often heavier regulatory and UX cost; not SilentTransfer’s product pitch.
              </li>
              <li>
                <strong className="text-[var(--text)]">Private L2s / encrypted mempools</strong> —
                different stack; out of scope for this docs page.
              </li>
            </ul>
            <p>
              SilentTransfer focuses on a walkable product path: register → private send → scan →
              claim, with fees and tokenomics stated in plain language.
            </p>
          </Section>

          <Section id="stealth-theory" icon={KeyRound} title="3. Stealth addresses (ERC-5564 / ERC-6538)">
            <p>
              Ethereum’s community standardized stealth flows so wallets and apps can interoperate:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-[var(--text)]">
                  <a
                    href="https://eips.ethereum.org/EIPS/eip-5564"
                    className="text-[var(--accent)] hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    ERC-5564 — Stealth Addresses
                  </a>
                </strong>
                : defines how to generate one-time addresses and how to{' '}
                <em>announce</em> enough information (ephemeral public key + metadata) so the
                recipient can find the payment by scanning the chain.
              </li>
              <li>
                <strong className="text-[var(--text)]">
                  <a
                    href="https://eips.ethereum.org/EIPS/eip-6538"
                    className="text-[var(--accent)] hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    ERC-6538 — Stealth Meta-Address Registry
                  </a>
                </strong>
                : a canonical place for a user to publish a{' '}
                <em>stealth meta-address</em> so senders can look it up without an out-of-band chat.
              </li>
            </ul>

            <h3 className="text-sm font-semibold text-[var(--text)] pt-2">Keys (ideal model)</h3>
            <p>A recipient typically holds two key pairs:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-[var(--text)]">Spending keys</strong> — control funds at
                derived stealth addresses. The private spending key must stay secret forever if
                funds should remain safe.
              </li>
              <li>
                <strong className="text-[var(--text)]">Viewing keys</strong> — used to scan
                announcements and detect which stealth addresses belong to the recipient. A viewing
                key can be shared with a light scanner service (weaker privacy vs self-scan).
              </li>
            </ul>
            <p>
              Together, the public spending key + public viewing key form the{' '}
              <strong className="text-[var(--text)]">stealth meta-address</strong>. ERC-5564
              describes a meta-address format of the shape{' '}
              <code className="text-[11px] bg-[var(--bg-muted)] px-1.5 py-0.5 rounded">
                st:eth:0x&lt;spendingPubKey&gt;&lt;viewingPubKey&gt;
              </code>
              .
            </p>

            <h3 className="text-sm font-semibold text-[var(--text)] pt-2">
              Ideal send (Alice → Bob)
            </h3>
            <ol className="list-decimal pl-5 space-y-2">
              <li>Alice fetches Bob’s meta-address from a registry (or Bob shares it privately).</li>
              <li>
                Alice generates an <strong className="text-[var(--text)]">ephemeral</strong> key
                pair and computes a shared secret with Bob’s viewing public key (ECDH on the curve
                used by the scheme, commonly secp256k1 in Ethereum tooling).
              </li>
              <li>
                From that secret and Bob’s spending public key, Alice derives a{' '}
                <strong className="text-[var(--text)]">one-time stealth address</strong>.
              </li>
              <li>Alice transfers tokens to that stealth address.</li>
              <li>
                Alice emits an <strong className="text-[var(--text)]">announcement</strong> (via a
                messenger/announcer contract) containing the ephemeral public key and metadata so
                Bob can discover the payment.
              </li>
            </ol>

            <h3 className="text-sm font-semibold text-[var(--text)] pt-2">Ideal receive (Bob)</h3>
            <ol className="list-decimal pl-5 space-y-2">
              <li>Bob scans announcements with his viewing private key.</li>
              <li>
                For each announcement, he recomputes the shared secret and checks whether the
                derived stealth address matches.
              </li>
              <li>
                On match, only Bob can spend — using a spending key derived from the same secret
                material (scheme-specific).
              </li>
            </ol>
            <p className="text-xs text-[var(--text-faint)] border-t border-[var(--border)] pt-3">
              Further reading:{' '}
              <a
                href="https://stealthaddress.dev/"
                className="text-[var(--accent)] hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                stealthaddress.dev
              </a>
              , EIP-5564, EIP-6538.
            </p>
          </Section>

          <Section id="product-vs-ideal" icon={AlertTriangle} title="4. Ideal crypto vs our demo (critical)">
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-950 text-sm leading-relaxed">
              <strong>Read this carefully.</strong> Many stealth docs describe the full ECDH
              protocol. SilentTransfer’s <em>clickable demo today</em> prioritizes a usable Alice→Bob
              walkthrough. That means parts of the flow are simplified for product testing.
            </div>
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[var(--text-faint)]">
                    <th className="py-2 pr-3 font-medium">Capability</th>
                    <th className="py-2 pr-3 font-medium">Full ERC-5564 ideal</th>
                    <th className="py-2 font-medium">SilentTransfer demo today</th>
                  </tr>
                </thead>
                <tbody className="text-[var(--text-muted)]">
                  {[
                    [
                      'Recipient discovery',
                      'Viewing-key scan over announcements',
                      'Scan by viewer wallet vs metadata.to_address',
                    ],
                    [
                      'Stealth address',
                      'ECDH-derived one-time address',
                      'Random one-time address recorded in API log',
                    ],
                    [
                      'On-chain transfer',
                      'ERC-20/ETH to stealth address',
                      'Demo log — not guaranteed live settlement',
                    ],
                    [
                      'Announce',
                      'Messenger contract event',
                      'API /api/announce (+ contracts exist for future wire)',
                    ],
                    [
                      'Gasless claim',
                      'ERC-4337 paymaster + real UserOp',
                      'SilentPaymaster mock + synthetic tx hash in DEMO_MODE',
                    ],
                    ['KYC', 'Optional external products', 'None in product surface'],
                  ].map(([a, b, c]) => (
                    <tr key={a} className="border-b border-[var(--border)]/80 align-top">
                      <td className="py-2.5 pr-3 font-medium text-[var(--text-secondary)]">{a}</td>
                      <td className="py-2.5 pr-3">{b}</td>
                      <td className="py-2.5">{c}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Contracts in the repo (
              <code className="text-[11px] bg-[var(--bg-muted)] px-1 rounded">ERC6538Registry</code>,{' '}
              <code className="text-[11px] bg-[var(--bg-muted)] px-1 rounded">ERC5564Messenger</code>,{' '}
              <code className="text-[11px] bg-[var(--bg-muted)] px-1 rounded">SilentPaymaster</code>,{' '}
              <code className="text-[11px] bg-[var(--bg-muted)] px-1 rounded">SilentToken</code>
              ) are real Solidity artifacts. The gap is the{' '}
              <strong className="text-[var(--text)]">end-to-end product wire</strong> to full
              cryptographic + on-chain settlement — not pretend that gap does not exist.
            </p>
          </Section>

          <Section id="how-demo" icon={Workflow} title="5. How SilentTransfer works today">
            <p>The console walkthrough is four steps. Use Alice / Bob demo wallets or any valid 0x addresses.</p>

            <div className="space-y-4 not-prose">
              {[
                {
                  n: '1',
                  icon: Radio,
                  title: 'Receive — turn on private receive',
                  body: 'Bob connects (demo JWT) and registers spending + viewing public keys for his wallet. In demo mode keys can be auto-generated for convenience. The registry list shows wallets ready to receive privately. There is no identity or KYC check.',
                },
                {
                  n: '2',
                  icon: Layers,
                  title: 'Send — private transfer log',
                  body: `Alice authenticates as sender, chooses recipient Bob, token (default ETH), and amount. The app creates a random one-time stealth address and posts /api/announce with caller, to_address, amount, token, and ephemeral pubkey fields. Success message is a recorded private-send log — not a claim of mainnet settlement.`,
                },
                {
                  n: '3',
                  icon: EyeOff,
                  title: 'Scanner — find my payments',
                  body: 'Bob opens Scanner, pastes his wallet (or Scan as Bob). The API returns announcements whose metadata recipient matches Bob. Each hit can hand off to Relayer via “Withdraw”.',
                },
                {
                  n: '4',
                  icon: Repeat2,
                  title: 'Relayer — gasless claim (demo)',
                  body: `Bob submits stealth address + owner + amount. In DEMO_MODE the API simulates completion, returns a synthetic transaction hash, and records fee history. Protocol fee on gasless claim defaults to ${feePct} of amount; private send product fee is 0%.`,
                },
              ].map((step) => (
                <div
                  key={step.n}
                  className="flex gap-3 p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/40"
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center shrink-0">
                    {step.n}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[var(--text)] flex items-center gap-2">
                      <step.icon className="w-4 h-4 text-[var(--accent)]" />
                      {step.title}
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-1.5 leading-relaxed">
                      {step.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section id="architecture" icon={Server} title="6. Architecture">
            <pre className="text-[11px] font-mono bg-slate-900 text-slate-100 p-4 rounded-xl overflow-x-auto leading-relaxed">
{`┌─────────────┐     REST / JWT      ┌──────────────┐
│  apps/web   │ ──────────────────► │  apps/api    │
│  Next.js    │                     │  FastAPI     │
│  console    │                     │  SQLite/PG   │
└─────────────┘                     └──────┬───────┘
                                           │ (future full wire)
                                           ▼
                                    ┌──────────────┐
                                    │  contracts/  │
                                    │  Registry    │
                                    │  Messenger   │
                                    │  Paymaster   │
                                    │  SilentToken │
                                    └──────────────┘`}
            </pre>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-[var(--text)]">apps/web</strong> — landing, docs, $SILENT,
                dashboard tabs; demo session wallet (no forced MetaMask).
              </li>
              <li>
                <strong className="text-[var(--text)]">apps/api</strong> — auth (demo-login + JWT),
                register, announce, scan, relay, stats, contracts config.
              </li>
              <li>
                <strong className="text-[var(--text)]">contracts</strong> — Hardhat project; SilentToken
                (1B deploy mint), registry/messenger/paymaster sources and tests.
              </li>
            </ul>
          </Section>

          <Section id="privacy" icon={Shield} title="7. Privacy guarantees & limits">
            <h3 className="text-sm font-semibold text-[var(--text)]">What stealth designs aim to provide</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-[var(--text)]">Recipient privacy</strong> — observers should
                not trivially map a payment’s destination to Bob’s public identity wallet.
              </li>
              <li>
                <strong className="text-[var(--text)]">Unlinkable destinations</strong> — each payment
                can use a fresh address so two payments to Bob do not obviously share a label.
              </li>
              <li>
                <strong className="text-[var(--text)]">Forward-looking privacy</strong> — after funds
                enter a stealth destination, later activity is not automatically labeled as “Bob”
                unless Bob links it (e.g. withdraws to a known CEX deposit).
              </li>
            </ul>

            <h3 className="text-sm font-semibold text-[var(--text)] pt-2">What they do not provide</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-[var(--text)]">Not sender privacy by default</strong> —
                Alice’s funding address is often still visible on a public chain.
              </li>
              <li>
                <strong className="text-[var(--text)]">Not metadata-free</strong> — time, gas, amount
                patterns, and interaction graphs remain analysis surfaces.
              </li>
              <li>
                <strong className="text-[var(--text)]">Not IP privacy</strong> — RPC and API calls leak
                IP unless the user uses VPN/Tor/self-hosted nodes.
              </li>
              <li>
                <strong className="text-[var(--text)]">Withdrawal linkability</strong> — sweeping a
                stealth address into a known wallet re-links identity. This is a common failure mode
                in real usage.
              </li>
            </ul>
            <p>
              SilentTransfer’s demo path stores recipient association in API metadata for product
              scanning. Treat that as{' '}
              <strong className="text-[var(--text)]">weaker than pure viewing-key-only discovery</strong>{' '}
              until full cryptographic scan is productized.
            </p>
          </Section>

          <Section id="fees" icon={Coins} title="8. Fees">
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-[var(--text)]">Now:</strong> product fees are{' '}
                <strong className="text-[var(--text)]">{feePct}</strong> on private send and gasless
                claim (demo). Network gas still applies only when a real on-chain path is used.
              </li>
              <li>
                <strong className="text-[var(--text)]">Soon:</strong> planned{' '}
                <strong className="text-[var(--text)]">{plannedPct}</strong> fee on gasless / protocol
                use. Proceeds are intended for{' '}
                <strong className="text-[var(--text)]">protocol running costs</strong> and to{' '}
                <strong className="text-[var(--text)]">buy SILENT from the open market (buyback)</strong>
                — not VC extraction.
              </li>
              <li>
                <strong className="text-[var(--text)]">Private send</strong> stays{' '}
                <strong className="text-[var(--text)]">0%</strong> product fee in the plan (user pays
                network gas on-chain).
              </li>
              <li>
                <strong className="text-[var(--text)]">Self-withdraw</strong> (user pays gas): 0%
                product fee when that path ships.
              </li>
            </ul>
            <p className="text-xs text-[var(--text-faint)]">{FEE_COPY.policy}</p>
          </Section>

          <Section id="token" icon={Coins} title="9. $SILENT">
            <p>
              <strong className="text-[var(--text)]">Silent</strong> / ticker{' '}
              <strong className="text-[var(--text)]">SILENT</strong> is the product ERC-20.{' '}
              <strong className="text-[var(--text)]">Hard cap:</strong>{' '}
              {SILENT_TOTAL_SUPPLY_SHORT} (1,000,000,000) — contract does not allow mint above the
              cap. <strong className="text-[var(--text)]">No VC allocation</strong> (
              {SILENT_VC_PERCENT}%).
            </p>
            <ul className="list-disc pl-5 space-y-2">
              {SILENT_ALLOCATION.map((a) => (
                <li key={a.id}>
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle"
                    style={{ backgroundColor: a.color }}
                  />
                  <strong className="text-[var(--text)]">
                    {a.label} {a.percent}%
                  </strong>{' '}
                  — {a.amountLabel} SILENT. {a.lock}
                </li>
              ))}
            </ul>
            <p>
              Contract address (configured):{' '}
              <code className="text-[11px] font-mono bg-[var(--bg-muted)] px-1.5 py-0.5 rounded break-all">
                {SILENT_ADDRESS}
              </code>{' '}
              ({truncAddr(SILENT_ADDRESS)}). Non-upgradeable; no transfer KYC whitelist;{' '}
              <strong className="text-[var(--text)]">1B hard cap</strong> (no mint beyond max supply).
            </p>
            <p>
              Allocation is a <strong className="text-[var(--text)]">public policy</strong>. On-chain
              vesting locks are not claimed live until those contracts ship.
            </p>
            <Link
              href={SILENT_PAGE_URL}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent)] hover:underline not-prose"
            >
              Open full $SILENT page <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </Section>

          <Section id="status" icon={CheckCircle2} title="10. Status: done / not done">
            <h3 className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Built and usable
            </h3>
            <ul className="space-y-3 not-prose">
              {DONE.map((item) => (
                <li
                  key={item.title}
                  className="flex gap-2 text-sm border border-emerald-100 bg-emerald-50/50 rounded-xl p-3"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-[var(--text)]">{item.title}</div>
                    <div className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">
                      {item.detail}
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <h3 className="text-sm font-semibold text-amber-900 flex items-center gap-2 pt-4">
              <Ban className="w-4 h-4" /> Not done — do not market as complete
            </h3>
            <ul className="space-y-3 not-prose">
              {NOT_DONE.map((item) => (
                <li
                  key={item.title}
                  className="flex gap-2 text-sm border border-amber-100 bg-amber-50/50 rounded-xl p-3"
                >
                  <CircleDashed className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-[var(--text)]">{item.title}</div>
                    <div className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">
                      {item.detail}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          <Section id="future" icon={Rocket} title="11. Future roadmap">
            <ul className="space-y-2">
              {FUTURE.map((item) => (
                <li key={item} className="flex gap-2 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0 mt-2" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-[var(--text-faint)]">
              Roadmap items are intentions, not delivery dates or guaranteed launches.
            </p>
          </Section>

          <Section id="threats" icon={Shield} title="12. Threat model notes">
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-[var(--text)]">API / JWT compromise</strong> — demo auth is
                for product testing; production needs hardened SIWE, secrets, rate limits, and ops
                hygiene.
              </li>
              <li>
                <strong className="text-[var(--text)]">Owner key on SilentToken</strong> — unlimited
                mint risk until ownership is renounced or supply is capped by design.
              </li>
              <li>
                <strong className="text-[var(--text)]">User seed phishing</strong> — no contract can
                save a user who signs away keys.
              </li>
              <li>
                <strong className="text-[var(--text)]">Metadata & timing</strong> — always assume a
                motivated observer can correlate patterns.
              </li>
              <li>
                <strong className="text-[var(--text)]">Demo vs money</strong> — never deposit funds
                you cannot lose into unaudited demo infrastructure.
              </li>
            </ul>
          </Section>

          <Section id="hosting" icon={Server} title="13. Hosting & domains">
            <ul className="list-disc pl-5 space-y-2">
              <li>
                This docs UI is served at{' '}
                <code className="text-[11px] bg-[var(--bg-muted)] px-1 rounded">/docs</code> on the
                web app.
              </li>
              <li>
                Production intent:{' '}
                <strong className="text-[var(--text)]">docs.silenttransfer.com</strong> points at
                this deployment (host redirect already configured in Next config when DNS is set).
              </li>
              <li>
                Product site: <strong className="text-[var(--text)]">silenttransfer.com</strong> ·
                console under <code className="text-[11px] bg-[var(--bg-muted)] px-1 rounded">/dashboard</code>.
              </li>
              <li>
                Local default: Docs nav uses <code className="text-[11px] bg-[var(--bg-muted)] px-1 rounded">/docs</code>{' '}
                so content is readable without public DNS.
              </li>
            </ul>
          </Section>

          <div className="flex flex-wrap gap-3 pt-2 pb-16">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold"
            >
              Open console
            </Link>
            <Link
              href={SILENT_PAGE_URL}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--border)] text-sm font-semibold hover:bg-white"
            >
              $SILENT details
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-[var(--text-muted)] hover:text-[var(--accent)]"
            >
              Home
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
