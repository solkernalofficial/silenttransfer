'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  Wallet,
  DollarSign,
  EyeOff,
  Layers,
  Shield,
  Loader2,
  ArrowRight,
  Download,
  Send,
  ScanSearch,
  Repeat2,
} from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import { formatTokenAmount, truncAddr } from '@/lib/tokens';

interface Announcement {
  stealth_address: string;
  caller: string;
  token_address?: string;
  token?: string;
  amount: string;
  block_number: number;
  status?: string;
  timestamp?: string;
  announced_at?: string;
}

interface Stats {
  total_wallets: number;
  total_stealth_addresses: number;
  total_relay_requests: number;
  completed_relays: number;
  total_volume_wei: string;
  privacy_score: number;
  demo_mode: boolean;
}

const EMPTY_STATS: Stats = {
  total_wallets: 0,
  total_stealth_addresses: 0,
  total_relay_requests: 0,
  completed_relays: 0,
  total_volume_wei: '0',
  privacy_score: 0,
  demo_mode: true,
};

function weiToEth(wei: string | number | undefined): number {
  const n = Number(wei ?? 0);
  if (!Number.isFinite(n)) return 0;
  return n / 1e18;
}

function PrivacyGauge({ score }: { score: number }) {
  const r = 48;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#15803d' : score >= 50 ? '#eab308' : '#ef4444';

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#d4e0d6" strokeWidth="8" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
        <text x="60" y="48" textAnchor="middle" fill="#18181b" fontSize="24" fontWeight="bold" fontFamily="JetBrains Mono, monospace">
          {score}
        </text>
        <text x="60" y="66" textAnchor="middle" fill="#71717a" fontSize="10" fontFamily="JetBrains Mono, monospace">
          /100
        </text>
      </svg>
      <span className="text-xs text-[var(--text-muted)]">Privacy Score</span>
    </div>
  );
}

export default function DashboardTab() {
  const router = useRouter();
  const { data: announcements, isLoading: announcementsLoading } = useQuery<Announcement[]>({
    queryKey: ['announcements'],
    queryFn: async () => (await api<Announcement[]>('/api/announcements')) || [],
  });

  const { data: stats } = useQuery<Stats>({
    queryKey: ['stats'],
    queryFn: async () => (await api<Stats>('/api/stats')) || EMPTY_STATS,
  });

  const s = stats ?? EMPTY_STATS;
  const recentTxs = (announcements || []).slice(0, 5);
  const privacyScore = Number.isFinite(s.privacy_score) ? Math.round(s.privacy_score) : 0;

  const go = (tab: string) => router.push(`/dashboard?tab=${tab}`, { scroll: false });

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Quick start for users */}
      <div className="rh-card p-5 border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/40">
        <h2 className="text-base font-semibold text-[var(--text)] mb-1">
          Guided workflow
        </h2>
        <p className="text-sm text-[var(--text-muted)] mb-4 leading-relaxed">
          Complete a private transfer end to end. Use the header to switch reference profiles
          (Alice / Bob) or connect any valid wallet address.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              n: '1',
              title: 'Receive',
              desc: 'Enable private receive for the recipient',
              icon: Download,
              tab: 'receive',
              tint: 'sky',
            },
            {
              n: '2',
              title: 'Send',
              desc: 'Execute a private transfer to the recipient',
              icon: Send,
              tab: 'send',
              tint: 'emerald',
            },
            {
              n: '3',
              title: 'Scanner',
              desc: 'Discover payments for the recipient wallet',
              icon: ScanSearch,
              tab: 'scanner',
              tint: 'sky',
            },
            {
              n: '4',
              title: 'Relayer',
              desc: 'Complete sponsored settlement',
              icon: Repeat2,
              tab: 'relayer',
              tint: 'sky',
            },
          ].map(({ n, title, desc, icon: Icon, tab, tint }) => (
            <button
              key={tab}
              type="button"
              onClick={() => go(tab)}
              className={`text-left p-3.5 rounded-xl bg-white border border-[var(--border)] hover:shadow-sm transition-all group ${
                tint === 'sky' ? 'hover:border-sky-300' : 'hover:border-emerald-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                    tint === 'sky'
                      ? 'bg-sky-100 text-sky-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {n}
                </span>
                <Icon className="w-4 h-4 text-[var(--accent)]" />
                <span className="text-sm font-semibold text-[var(--text)]">{title}</span>
                <ArrowRight className="w-3.5 h-3.5 ml-auto text-[var(--text-faint)] group-hover:text-[var(--accent)]" />
              </div>
              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed pl-8">{desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Wallet, label: 'Total Wallets', value: Number(s.total_wallets ?? 0).toLocaleString() },
          { icon: DollarSign, label: 'Total Volume', value: `${weiToEth(s.total_volume_wei).toFixed(2)} ETH` },
          { icon: EyeOff, label: 'Stealth Addresses', value: Number(s.total_stealth_addresses ?? 0).toLocaleString() },
          { icon: Layers, label: 'Completed Relays', value: Number(s.completed_relays ?? 0).toLocaleString() },
        ].map(({ icon: Icon, label, value }) => (
          <div
            key={label}
            className="rh-card p-4 rh-card-hover"
          >
            <div className="flex items-center gap-2 text-[var(--text-muted)] text-xs mb-3">
              <Icon className="w-4 h-4 text-[var(--accent)]" />
              <span>{label}</span>
            </div>
            <div className="text-xl font-mono font-bold text-[var(--text)]">{value}</div>
          </div>
        ))}
      </div>

      {/* Flow diagram + Privacy gauge */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Transaction flow */}
        <div className="lg:col-span-2 rh-card p-5">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">Transaction Flow</h3>
          <svg viewBox="0 0 580 100" className="w-full max-w-full h-auto" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            {/* Alice */}
            <rect x="10" y="25" width="70" height="40" rx="6" fill="#dcfce7" stroke="#15803d" strokeWidth="1.5" />
            <text x="45" y="50" textAnchor="middle" fill="#15803d" fontSize="11" fontWeight="bold">Alice</text>

            {/* Arrow */}
            <line x1="80" y1="45" x2="130" y2="45" stroke="#15803d66" strokeWidth="1.5" />
            <polygon points="128,40 138,45 128,50" fill="#15803d66" />

            {/* Registry */}
            <rect x="140" y="15" width="90" height="60" rx="6" fill="#f1f5f9" stroke="#2563eb" strokeWidth="1.5" />
            <text x="185" y="38" textAnchor="middle" fill="#2563eb" fontSize="9" fontWeight="bold">ERC6538</text>
            <text x="185" y="52" textAnchor="middle" fill="#2563eb" fontSize="9" fontWeight="bold">Registry</text>

            {/* Arrow */}
            <line x1="230" y1="45" x2="275" y2="45" stroke="#15803d66" strokeWidth="1.5" />
            <polygon points="273,40 283,45 273,50" fill="#15803d66" />

            {/* Stealth Addr */}
            <rect x="285" y="20" width="80" height="50" rx="6" fill="#f1f5f9" stroke="#9333ea" strokeWidth="1.5" />
            <text x="325" y="40" textAnchor="middle" fill="#9333ea" fontSize="8" fontWeight="bold">Stealth</text>
            <text x="325" y="54" textAnchor="middle" fill="#9333ea" fontSize="8" fontWeight="bold">Address</text>

            {/* Arrow down */}
            <line x1="325" y1="70" x2="325" y2="105" stroke="#15803d66" strokeWidth="1.5" />
            <polygon points="320,103 325,113 330,103" fill="#15803d66" />

            {/* Paymaster */}
            <rect x="275" y="115" width="100" height="45" rx="6" fill="#f1f5f9" stroke="#ca8a04" strokeWidth="1.5" />
            <text x="325" y="134" textAnchor="middle" fill="#ca8a04" fontSize="9" fontWeight="bold">Silent</text>
            <text x="325" y="148" textAnchor="middle" fill="#ca8a04" fontSize="9" fontWeight="bold">Paymaster</text>

            {/* Arrow right */}
            <line x1="375" y1="137" x2="430" y2="137" stroke="#15803d66" strokeWidth="1.5" />
            <polygon points="428,132 438,137 428,142" fill="#15803d66" />

            {/* Bob */}
            <rect x="440" y="117" width="70" height="40" rx="6" fill="#dcfce7" stroke="#15803d" strokeWidth="1.5" />
            <text x="475" y="142" textAnchor="middle" fill="#15803d" fontSize="11" fontWeight="bold">Bob</text>
          </svg>
          <div className="flex items-center gap-4 mt-3 text-[10px] text-[var(--text-muted)] flex-wrap font-mono">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-[var(--accent)]" /> Sender</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-[#3b82f6]" /> Registry</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-[#a855f7]" /> Stealth</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-[#eab308]" /> Paymaster</span>
          </div>
        </div>

        {/* Privacy gauge */}
        <div className="rh-card p-5 flex flex-col items-center justify-center">
          <PrivacyGauge score={privacyScore} />
          <div className="mt-3 text-[10px] text-[var(--text-muted)] text-center leading-relaxed">
            <div className="flex items-center justify-center gap-1 text-emerald-700 text-xs">
              <Shield className="w-3 h-3" />{' '}
              {privacyScore >= 80 ? 'Strong Privacy' : privacyScore >= 50 ? 'Moderate Privacy' : 'Building Privacy'}
            </div>
            Stealth addresses mask on-chain links
          </div>
        </div>
      </div>

      {/* Recent transactions */}
      <div className="rh-card p-5">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">Recent Transactions</h3>
        {announcementsLoading ? (
          <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading...
          </div>
        ) : recentTxs.length === 0 ? (
          <EmptyState
            compact
            title="No transactions yet"
            description="Send a stealth payment or wait for announcements to appear here."
            imageSrc="/brand/empty-state.jpg"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-[var(--text-muted)] border-b border-[var(--border)]">
                  <th className="text-left py-2 pr-4">Stealth Address</th>
                  <th className="text-left py-2 pr-4">Token</th>
                  <th className="text-right py-2 pr-4">Amount</th>
                  <th className="text-right py-2">Block</th>
                </tr>
              </thead>
              <tbody>
                {recentTxs.map((tx, i) => (
                  <tr key={i} className="border-b border-[var(--border)]/80 hover:bg-[var(--bg-hover)]">
                    <td className="py-2.5 pr-4 text-emerald-700 font-medium">{truncAddr(tx.stealth_address)}</td>
                    <td className="py-2.5 pr-4 text-[var(--text-muted)]">{truncAddr(tx.token_address || tx.token || '—')}</td>
                    <td className="py-2.5 pr-4 text-right text-[var(--text-secondary)] font-medium">
                      {formatTokenAmount(tx.amount)}
                    </td>
                    <td className="py-2.5 text-right text-[var(--text-faint)]">#{tx.block_number ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
