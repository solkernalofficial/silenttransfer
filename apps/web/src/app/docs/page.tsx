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
    'Honest documentation: private vault payouts on testnet, privacy limits, fees, $SILENT — no fake completion claims.',
};

const TOC = [
  { id: 'overview', label: '1. Overview' },
  { id: 'problem', label: '2. Problem we solve' },
  { id: 'stealth-theory', label: '3. Stealth addresses (standards)' },
  { id: 'product-vs-ideal', label: '4. Ideal crypto vs live product' },
  { id: 'how-live', label: '5. How SilentTransfer works today' },
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
    title: 'Private vault (primary product)',
    detail:
      'SilentUserVault on testnet: deposit ETH to a wallet-bound balance, then withdraw single or batch to any addresses. Recipients receive automatically — no claim site, no note backup. Connected wallet is the key.',
  },
  {
    title: 'Real wallet connect + SIWE',
    detail:
      'MetaMask / WalletConnect + EIP-4361 sign-in (EIP-55 checksum). Operator JWT (Alice/Bob) remains optional for evaluation only — not for real funding.',
  },
  {
    title: 'Auto-receive for recipients',
    detail:
      'Vault payouts land in ordinary wallets. B never visits SilentTransfer. No claim code for the primary vault path.',
  },
  {
    title: 'Wrong-network helper',
    detail:
      'If the wallet is on another chain, the UI offers wallet_addEthereumChain for Robinhood Chain Testnet (RPC, chain ID, explorer).',
  },
  {
    title: 'sthood (SILENT)',
    detail:
      'Token name sthood, ticker SILENT. Non-upgradeable ERC-20, hard-capped at 1B. Vault deposit may charge an on-chain protocol fee; planned sponsored-flow fee for ops + buyback.',
  },
  {
    title: 'Console + docs + landing',
    detail:
      'Minimal private-vault console; public docs state live vs ideal privacy without overselling absolute untraceability.',
  },
];

const NOT_DONE = [
  {
    title: 'Absolute untraceability',
    detail:
      'Vault payouts are harder to map as plain A→B, but deposit/withdraw graphs, amounts, and timing on a public chain remain analysis surfaces. Not marketed as “untraceable forever.”',
  },
  {
    title: 'Production ZK shield / Groth16',
    detail:
      'Shield pool exists on testnet with Merkle-witness style proofs. Production ceremony and full path-hiding are not claimed complete.',
  },
  {
    title: 'Mainnet production money + audit',
    detail:
      'Live path is Robinhood Chain Testnet. Mainnet TVL, audited contracts, and renounced/hardened ops are not claimed.',
  },
  {
    title: 'Strong anonymity sets by default',
    detail:
      'Fixed-size delayed payouts and large shared anonymity sets are roadmap, not default guarantees today.',
  },
  {
    title: 'On-chain vesting locks',
    detail:
      '1B allocation policy is published. Vesting lock contracts are not claimed as fully live.',
  },
];

const FUTURE = [
  'Next — Delayed / fixed-size vault payouts to weaken amount and timing correlation.',
  'Next — Stronger shared anonymity sets for vault withdrawals.',
  'Next — Shield pool maturity (production Groth16 when ceremony + scope allow).',
  'Next — Payroll & treasury scheduling for recurring private batch payouts.',
  'Later — External audit before mainnet treasury or public TVL claims.',
  'Later — Mainnet production path with hardened ops (not claimed today).',
  'Later — On-chain vesting when allocation locks ship.',
  'Later — Multi-chain expansion after primary path is stable.',
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
                Live private vault
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full bg-sky-50 text-sky-800 border border-sky-200">
                Harder to trace than plain A→B
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200">
                Not absolute untraceability
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
              <strong className="text-[var(--text)]">SilentTransfer</strong> is private transfer
              infrastructure for public blockchains: web console, FastAPI backend, and Solidity
              contracts. The product goal is{' '}
              <strong className="text-[var(--text)]">
                untraceable-oriented private payouts — make payments harder to map as a plain public
                A→B transfer, without forcing the recipient onto a privacy app
              </strong>
              .
            </p>
            <p>
              On public blockchains, every transfer is visible. Anyone can graph who paid whom if
              both addresses are known. SilentTransfer’s primary path uses a{' '}
              <strong className="text-[var(--text)]">private vault</strong>: Alice deposits, then
              pays Bob (or many recipients) from the vault at times and amounts she chooses. Bob
              receives ETH in a normal wallet automatically.
            </p>
            <p>
              Product token: <strong className="text-[var(--text)]">SILENT</strong> (see §9). Console
              transfers use <strong className="text-[var(--text)]">ETH</strong> by default. This is a
              privacy product, not an identity product—scope is transfer mechanics, not user
              onboarding forms.
            </p>
            <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/80 text-emerald-950 text-xs leading-relaxed not-prose">
              <strong>Live today (testnet):</strong> deposit into <em>SilentUserVault</em>, then
              single or batch send with real on-chain ETH. Recipients auto-receive. This is{' '}
              <strong>harder to trace</strong> than a plain send, <strong>not</strong> absolute
              untraceability, and <strong>not</strong> mainnet production guarantees — see §4 and §7.
            </div>
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
              SilentTransfer focuses on a usable path:{' '}
              <strong className="text-[var(--text)]">
                connect wallet → deposit vault → send single or batch → recipients auto-receive
              </strong>
              , with fees, privacy limits, and tokenomics stated in plain language.
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

          <Section id="product-vs-ideal" icon={AlertTriangle} title="4. Ideal crypto vs live product (critical)">
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-950 text-sm leading-relaxed">
              <strong>Read this carefully.</strong> Ideal privacy designs aim for strong
              unlinkability (large anonymity sets, amount hiding, viewing-key-only discovery).
              SilentTransfer’s <em>live testnet product</em> moves <strong>real funds</strong> through
              a private vault with auto-receive. That is <strong>harder to trace</strong> than a plain
              send—we do <strong>not</strong> claim absolute untraceability or full anonymity.
            </div>
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[var(--text-faint)]">
                    <th className="py-2 pr-3 font-medium">Capability</th>
                    <th className="py-2 pr-3 font-medium">Ideal strong privacy</th>
                    <th className="py-2 font-medium">SilentTransfer live (testnet)</th>
                  </tr>
                </thead>
                <tbody className="text-[var(--text-muted)]">
                  {[
                    [
                      'Primary UX',
                      'Shielded pool / full stealth with auto UX',
                      'Private vault: deposit → single/batch send',
                    ],
                    [
                      'Recipient',
                      'Unlinkable spend without site visit',
                      'Auto-receive in normal wallet — no claim site',
                    ],
                    [
                      'Key model',
                      'Notes / viewing keys / ZK witnesses',
                      'Wallet-bound vault balance (wallet is the key)',
                    ],
                    [
                      'On-chain transfer',
                      'Hidden amounts in strong anonymity set',
                      'Yes — real ETH deposit/withdraw on vault contract',
                    ],
                    [
                      'Trace resistance',
                      'Hard for analysts under stated threat model',
                      'Weaker plain A→B link; amount/timing still public',
                    ],
                    [
                      'Mainnet audit',
                      'Audited production TVL',
                      'Not claimed — testnet only for production money claims',
                    ],
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
              Core live contract:{' '}
              <code className="text-[11px] bg-[var(--bg-muted)] px-1 rounded">SilentUserVault</code>.
              Advanced modules (
              <code className="text-[11px] bg-[var(--bg-muted)] px-1 rounded">SilentShieldPool</code>,{' '}
              <code className="text-[11px] bg-[var(--bg-muted)] px-1 rounded">ERC5564Messenger</code>,{' '}
              <code className="text-[11px] bg-[var(--bg-muted)] px-1 rounded">SilentToken</code>
              ) exist in the repo. The remaining gap is{' '}
              <strong className="text-[var(--text)]">stronger unlinkability + production ZK</strong>
              — not “no money moves.” Real ETH can move on testnet today.
            </p>
          </Section>

          <Section id="how-live" icon={Workflow} title="5. How SilentTransfer works today">
            <p>
              Primary path uses a <strong className="text-[var(--text)]">real wallet</strong> on{' '}
              <strong className="text-[var(--text)]">Robinhood Chain Testnet (46630)</strong> with{' '}
              <strong className="text-[var(--text)]">SilentUserVault</strong>. Operator Alice/Bob
              logins cannot fund on-chain transfers.
            </p>

            <div className="space-y-4 not-prose">
              {[
                {
                  n: '1',
                  icon: Radio,
                  title: 'Connect — wallet',
                  body: 'Connect MetaMask or a browser wallet. Switch/add Robinhood Chain if needed (site can prompt wallet_addEthereumChain with RPC + chain ID). Your wallet is the vault key.',
                },
                {
                  n: '2',
                  icon: Layers,
                  title: 'Deposit — fund private vault',
                  body: `Deposit ETH into SilentUserVault. On-chain balance is bound to your address. A protocol fee may apply on deposit. Product fee label: ${feePct}. Network gas applies.`,
                },
                {
                  n: '3',
                  icon: EyeOff,
                  title: 'Send — single or batch anytime',
                  body: 'Withdraw any amount to one address or many. Split payouts over time to reduce amount/timing fingerprinting. Funds leave the vault contract, not a plain A→B transfer from your hot wallet.',
                },
                {
                  n: '4',
                  icon: Repeat2,
                  title: 'Receive — automatic for B',
                  body: 'Recipients get ETH in their normal wallets. No website, no claim step, no note files. Not mainnet production; residual chain analysis risk remains.',
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
{`┌─────────────┐   SIWE / JWT REST    ┌──────────────┐
│  apps/web   │ ──────────────────► │  apps/api    │
│  Next.js    │                     │  FastAPI     │
│  wagmi/viem │                     │  Postgres    │
└──────┬──────┘                     └──────┬───────┘
       │ wallet txs                         │ live claim sweep
       ▼                                    │ (funded path)
┌─────────────┐                             │
│  Chain RPC  │ ◄───────────────────────────┘
│  RH testnet │
│  46630      │
└─────────────┘
       │
       ▼ (deployed / staged)
 contracts: SilentUserVault · ShieldPool · SilentToken · stealth modules`}
            </pre>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-[var(--text)]">apps/web</strong> — landing, docs, $SILENT,
                private vault console; real wallet deposit/send.
              </li>
              <li>
                <strong className="text-[var(--text)]">apps/api</strong> — SIWE auth, config, stats,
                optional advanced announce/scan paths for stealth modules.
              </li>
              <li>
                <strong className="text-[var(--text)]">contracts</strong> — Hardhat; SilentUserVault
                (primary), SilentToken (1B), shield pool, optional ERC-5564/6538 modules.
              </li>
            </ul>
          </Section>

          <Section id="privacy" icon={Shield} title="7. Privacy guarantees & limits">
            <h3 className="text-sm font-semibold text-[var(--text)]">What “untraceable-oriented” means here</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-[var(--text)]">Break plain A→B</strong> — payouts leave the
                vault contract rather than a direct transfer from Alice’s everyday wallet to Bob.
              </li>
              <li>
                <strong className="text-[var(--text)]">User-controlled timing & amounts</strong> —
                deposit once; send in pieces later to weaken simple fingerprinting.
              </li>
              <li>
                <strong className="text-[var(--text)]">Zero claim friction for B</strong> — receivers
                never open the site; adoption does not leak through a claim portal.
              </li>
            </ul>

            <h3 className="text-sm font-semibold text-[var(--text)] pt-2">What we do not provide</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-[var(--text)]">Not absolute untraceability</strong> — vault
                deposit/withdraw txs, amounts, and timing remain public on-chain.
              </li>
              <li>
                <strong className="text-[var(--text)]">Not production ZK by default</strong> — shield
                pool is advanced/testnet; Groth16 production path is not claimed complete.
              </li>
              <li>
                <strong className="text-[var(--text)]">Not IP privacy</strong> — RPC and API calls leak
                IP unless the user uses VPN/Tor/self-hosted nodes.
              </li>
              <li>
                <strong className="text-[var(--text)]">Not legal advice</strong> — users remain
                responsible for applicable law in their jurisdiction.
              </li>
            </ul>
            <p>
              <strong className="text-[var(--text)]">Live path honesty:</strong> treat privacy as{' '}
              <strong className="text-[var(--text)]">
                harder to trace than plain public send
              </strong>
              , not full anonymity. See{' '}
              <code className="text-[11px] bg-[var(--bg-muted)] px-1 rounded">docs/PRIVACY_STATUS.md</code>.
            </p>
          </Section>

          <Section id="fees" icon={Coins} title="8. Fees">
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-[var(--text)]">Now:</strong> product fees are{' '}
                <strong className="text-[var(--text)]">{feePct}</strong> on private send and claim.
                On-chain sends and claims still pay <strong className="text-[var(--text)]">network gas</strong>.
              </li>
              <li>
                <strong className="text-[var(--text)]">Soon:</strong> planned{' '}
                <strong className="text-[var(--text)]">{plannedPct}</strong> fee on sponsored / protocol
                claim paths. Proceeds intended for{' '}
                <strong className="text-[var(--text)]">protocol ops</strong> and{' '}
                <strong className="text-[var(--text)]">open-market SILENT buyback</strong> — not VC
                extraction.
              </li>
              <li>
                <strong className="text-[var(--text)]">Private send</strong> product fee stays{' '}
                <strong className="text-[var(--text)]">0%</strong> in the plan (user pays network gas).
              </li>
              <li>
                <strong className="text-[var(--text)]">Self-withdraw</strong> (user pays gas): 0%
                product fee when that path ships as a first-class option.
              </li>
            </ul>
            <p className="text-xs text-[var(--text-faint)]">{FEE_COPY.policy}</p>
          </Section>

          <Section id="token" icon={Coins} title="9. $SILENT">
            <p>
              <strong className="text-[var(--text)]">sthood</strong> / ticker{' '}
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
              ({truncAddr(SILENT_ADDRESS)}). Non-upgradeable; standard ERC-20 transfers;{' '}
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
            <p>
              Canonical roadmap lives in the repo at{' '}
              <code className="text-[11px] bg-[var(--bg-muted)] px-1 rounded">docs/ROADMAP.md</code>{' '}
              and on the marketing site{' '}
              <a href="/#roadmap" className="text-[var(--accent)] hover:underline">
                #roadmap
              </a>
              . Labels: <strong className="text-[var(--text)]">Live</strong> (testnet today),{' '}
              <strong className="text-[var(--text)]">Next</strong>,{' '}
              <strong className="text-[var(--text)]">Later</strong>.
            </p>
            <ul className="space-y-2">
              {FUTURE.map((item) => (
                <li key={item} className="flex gap-2 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0 mt-2" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-[var(--text-faint)]">
              Roadmap items are intentions, not delivery dates or guaranteed launches. Absolute
              untraceability and production Groth16 are not claimed.
            </p>
          </Section>

          <Section id="threats" icon={Shield} title="12. Threat model notes">
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-[var(--text)]">API / JWT compromise</strong> — SIWE is the
                real-wallet path; operator login is evaluation-only. Production still needs secrets
                hygiene, rate limits, and minimal claim-key retention.
              </li>
              <li>
                <strong className="text-[var(--text)]">Vault contract risk</strong> — funds sit in
                SilentUserVault until withdrawn; contract bugs and owner/admin powers are operational
                risk until audited and hardened for mainnet.
              </li>
              <li>
                <strong className="text-[var(--text)]">Owner key on SilentToken</strong> — treat
                ownership and mint policy as operational risk until renounce/cap is verified for
                mainnet.
              </li>
              <li>
                <strong className="text-[var(--text)]">User seed phishing</strong> — no contract can
                save a user who signs away keys.
              </li>
              <li>
                <strong className="text-[var(--text)]">Metadata & timing</strong> — funding and claim
                txs on a public chain can be linked by amount, time, and graph analysis.
              </li>
              <li>
                <strong className="text-[var(--text)]">Testnet vs mainnet</strong> — only risk funds
                you can lose on testnet; no audited mainnet TVL claim.
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
