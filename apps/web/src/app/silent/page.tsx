import type { Metadata } from 'next';
import Link from 'next/link';
import BrandLogo, { DOCS_URL } from '@/components/BrandLogo';
import { SILENT_ADDRESS, truncAddr } from '@/lib/tokens';
import {
  PROTOCOL_FEE_BPS,
  protocolFeePercentLabel,
  plannedFeePercentLabel,
  FEE_COPY,
} from '@/lib/fees';
import {
  SILENT_ALLOCATION,
  SILENT_TOTAL_SUPPLY_LABEL,
  SILENT_TOTAL_SUPPLY_SHORT,
  SILENT_VC_PERCENT,
  SILENT_TEAM_PERCENT,
  SILENT_HARD_CAP_NOTE,
  SILENT_LAUNCH_NOTE,
  SILENT_COMMUNITY_PERCENT,
  SILENT_PROTOCOL_PERCENT,
  silentAllocationSummary,
} from '@/lib/tokenomics';
import AllocationPie from '@/components/AllocationPie';
import {
  ArrowLeft,
  Coins,
  FileCode,
  Info,
  Shield,
  AlertTriangle,
  Users,
  Building2,
} from 'lucide-react';

export const metadata: Metadata = {
  title: '$sthood — SilentTransfer token',
  description: `sthood: 1B total supply. ${silentAllocationSummary()}. Virtual-style fair launch. No VC.`,
};

const DECIMALS = 18;

const ICONS = {
  community: Users,
  protocol: Building2,
} as const;

export default function SilentTokenPage() {
  const feePct = protocolFeePercentLabel();
  const plannedPct = plannedFeePercentLabel();
  const chainId = process.env.NEXT_PUBLIC_CHAIN_ID || '46630';
  const networkName = process.env.NEXT_PUBLIC_NETWORK_NAME || 'Robinhood Chain Testnet';
  const isTestnet =
    (process.env.NEXT_PUBLIC_ENVIRONMENT || 'testnet') === 'testnet' || chainId === '46630';

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-white/90 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <BrandLogo size={36} subtitle="$sthood" />
          <div className="flex items-center gap-2 text-sm">
            <a
              href={DOCS_URL}
              className="hidden sm:inline text-[var(--text-muted)] hover:text-[var(--accent)] font-medium"
            >
              Docs
            </a>
            <Link
              href="/dashboard?tab=send"
              className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-semibold"
            >
              Send sthood
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--accent)] mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Home
          </Link>
          <div className="flex items-center gap-2 text-[var(--accent)] mb-2">
            <Coins className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Token</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">$sthood</h1>
          <p className="text-[var(--text-muted)] leading-relaxed text-[15px]">
            Product token for SilentTransfer. Name:{' '}
            <strong className="text-[var(--text)]">sthood</strong>. Ticker:{' '}
            <strong className="text-[var(--text)]">sthood</strong>. Total supply{' '}
            <strong className="text-[var(--text)]">{SILENT_TOTAL_SUPPLY_SHORT}</strong>.{' '}
            <strong className="text-[var(--text)]">Community-majority · no VC.</strong>
          </p>
        </div>

        {isTestnet && (
          <div className="flex gap-2 p-4 rounded-xl border border-sky-200 bg-sky-50 text-sky-950 text-sm leading-relaxed">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <strong>Testnet:</strong> {networkName} (chain {chainId}). sthood contract{' '}
              <span className="font-mono text-xs">{truncAddr(SILENT_ADDRESS)}</span>. Allocation
              below is published policy for a Virtual-style fair launch. On-chain distribution
              mechanics follow the launch venue.
            </div>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rh-card p-5">
            <div className="text-xs text-[var(--text-muted)] mb-1 flex items-center gap-1.5">
              <FileCode className="w-3.5 h-3.5" /> Official contract
            </div>
            <div className="font-mono text-sm break-all text-[var(--text)]">{SILENT_ADDRESS}</div>
            <div className="text-[11px] text-[var(--text-faint)] mt-2">
              sthood · {DECIMALS} decimals · non-upgradeable ERC-20
            </div>
          </div>
          <div className="rh-card p-5">
            <div className="text-xs text-[var(--text-muted)] mb-1 flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5" /> Hard-capped supply
            </div>
            <div className="text-2xl font-mono font-bold text-[var(--accent)]">
              {SILENT_TOTAL_SUPPLY_LABEL}
            </div>
            <div className="text-[11px] text-[var(--text-faint)] mt-2">
              Max 1B on-chain · no mint above cap · VC {SILENT_VC_PERCENT}%
            </div>
          </div>
        </div>

        <div className="flex gap-2 p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-950 text-sm leading-relaxed">
          <Shield className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <strong>Hard cap:</strong> {SILENT_HARD_CAP_NOTE} Owner cannot mint past 1B.
          </div>
        </div>

        {/* Allocation — pie chart */}
        <section className="rh-card p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold">Allocation (Virtual-style)</h2>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              1B sthood · {silentAllocationSummary()} · VC {SILENT_VC_PERCENT}% · Team pool{' '}
              {SILENT_TEAM_PERCENT}%
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,240px)_1fr] gap-8 items-start">
            <div className="flex justify-center md:justify-start w-full overflow-hidden">
              <AllocationPie size={220} />
            </div>

            <div className="space-y-3 min-w-0">
              {SILENT_ALLOCATION.map((row) => {
                const Icon = ICONS[row.id] || Coins;
                return (
                  <div
                    key={row.id}
                    className="p-4 rounded-xl border min-w-0"
                    style={{
                      backgroundColor: row.soft,
                      borderColor: row.border,
                    }}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-white shadow-sm"
                        style={{ backgroundColor: row.color }}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between gap-1 sm:gap-2">
                          <div className="text-sm font-semibold text-[var(--text)]">
                            {row.label}
                            {row.id === 'protocol' ? (
                              <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide text-sky-800 bg-white/70 px-1.5 py-0.5 rounded">
                                ops
                              </span>
                            ) : null}
                          </div>
                          <div
                            className="font-mono text-sm font-bold tabular-nums break-all"
                            style={{ color: row.color }}
                          >
                            {row.percent}% · {row.amountLabel}
                          </div>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                          {row.lock}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-[11px] text-[var(--text-faint)] leading-relaxed border-t border-[var(--border)] pt-3">
            Allocations sum to 100% ({SILENT_COMMUNITY_PERCENT} + {SILENT_PROTOCOL_PERCENT}).{' '}
            {SILENT_LAUNCH_NOTE} Protocol share stays in the 5–10% band for operations—not venture
            supply.
          </p>
        </section>

        <section className="rh-card p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Info className="w-5 h-5 text-[var(--accent)]" /> Utility and fees
          </h2>
          <ul className="text-sm text-[var(--text-muted)] space-y-2.5 leading-relaxed list-disc pl-5">
            <li>
              <strong className="text-[var(--text)]">Supported transfer asset</strong> in private
              send / claim console (default send asset is ETH; sthood remains available).
            </li>
            <li>
              <strong className="text-[var(--text)]">Fees now:</strong> {feePct} product fee (bps=
              {PROTOCOL_FEE_BPS}) on send and gasless claim.
            </li>
            <li>
              <strong className="text-[var(--text)]">Fees soon:</strong> planned{' '}
              <strong className="text-[var(--text)]">{plannedPct}</strong> on gasless / protocol use
              — used for <strong className="text-[var(--text)]">protocol running costs</strong> and
              to <strong className="text-[var(--text)]">buy sthood from the market (buyback)</strong>.
              Not VC revenue.
            </li>
            <li>
              <strong className="text-[var(--text)]">Community {SILENT_COMMUNITY_PERCENT}%</strong>{' '}
              via fair-launch rails — not VC.
            </li>
            <li>
              <strong className="text-[var(--text)]">Not claimed:</strong> CEX listings, market
              price, or yield product.
            </li>
          </ul>
          <p className="text-xs text-[var(--text-faint)] border-t border-[var(--border)] pt-3">
            {FEE_COPY.policy}
          </p>
        </section>

        <section className="rh-card p-6 space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5 text-[var(--accent)]" /> Token design
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <tbody>
                {[
                  ['Name', 'sthood'],
                  ['Ticker', 'sthood'],
                  ['Hard cap', `${SILENT_TOTAL_SUPPLY_LABEL} (1B) — no mint above`],
                  ['Launch style', 'Virtual-style fair launch (community-majority)'],
                  ['VC allocation', `${SILENT_VC_PERCENT}%`],
                  ['Team (separate pool)', `${SILENT_TEAM_PERCENT}%`],
                  [
                    'Community',
                    `${SILENT_COMMUNITY_PERCENT}% (${SILENT_ALLOCATION.find((a) => a.id === 'community')?.amountLabel})`,
                  ],
                  [
                    'Protocol',
                    `${SILENT_PROTOCOL_PERCENT}% (${SILENT_ALLOCATION.find((a) => a.id === 'protocol')?.amountLabel}) — ops`,
                  ],
                  ['Fees now', '0%'],
                  ['Fees planned', '0.5% gasless → ops + market buyback'],
                  ['Standard', 'ERC-20 (OpenZeppelin)'],
                  ['Decimals', String(DECIMALS)],
                  ['Transfer restrictions', 'None (standard ERC-20)'],
                  ['Upgradeable', 'No'],
                ].map(([k, v]) => (
                  <tr key={k} className="border-b border-[var(--border)]">
                    <td className="py-2.5 pr-4 text-[var(--text-muted)]">{k}</td>
                    <td className="py-2.5 text-[var(--text)] font-sans font-medium">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rh-card p-6 space-y-2 text-sm text-[var(--text-muted)] leading-relaxed">
          <h2 className="text-lg font-semibold text-[var(--text)]">Risks</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Supply hard-capped at 1B — owner cannot mint past cap (contract enforced).</li>
            <li>
              Allocation is product policy; actual Virtual (or other venue) parameters must match
              at launch.
            </li>
            <li>0.5% fee is planned policy, not charged until enabled (env / paymaster bps).</li>
            <li>Demo app does not settle mainnet money by itself.</li>
            <li>No audit claim for sthood token yet.</li>
          </ul>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard?tab=send" className="rh-btn-primary text-sm px-4 py-2.5 rounded-lg">
            Try private send (sthood)
          </Link>
          <a
            href={DOCS_URL}
            className="inline-flex items-center gap-1.5 text-sm font-semibold border border-[var(--border)] rounded-lg px-4 py-2.5 hover:bg-[var(--bg-hover)]"
          >
            Read docs
          </a>
        </div>
      </main>
    </div>
  );
}
