'use client';

import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingUp, Shield, FileCode, EyeOff } from 'lucide-react';
import { api } from '@/lib/api';

interface Stats {
  total_wallets: number;
  total_stealth_addresses: number;
  total_relay_requests: number;
  completed_relays: number;
  total_volume_wei: string;
  privacy_score: number;
  demo_mode: boolean;
}

export default function AnalyticsTab() {
  const { data: stats } = useQuery<Stats>({
    queryKey: ['stats-analytics'],
    queryFn: async () =>
      (await api<Stats>('/api/stats')) || {
        total_wallets: 0,
        total_stealth_addresses: 0,
        total_relay_requests: 0,
        completed_relays: 0,
        total_volume_wei: '0',
        privacy_score: 0,
        demo_mode: true,
      },
  });

  const s = stats;
  const privacyScore = s ? Math.round(s.privacy_score) : 0;
  const stealth = s?.total_stealth_addresses ?? 0;
  const relays = s?.completed_relays ?? 0;
  const demo = s?.demo_mode ?? true;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rh-card p-5">
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mb-3">
            <Shield className="w-4 h-4 text-[var(--accent)]" />
            <span>Privacy score</span>
          </div>
          <div className="text-2xl font-mono font-bold text-[var(--accent)]">
            {privacyScore}/100
          </div>
          <div className="text-[10px] text-[var(--text-muted)] mt-1">
            Based on environment activity metrics
          </div>
        </div>
        <div className="rh-card p-5">
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mb-3">
            <EyeOff className="w-4 h-4 text-[var(--accent)]" />
            <span>One-time destinations</span>
          </div>
          <div className="text-2xl font-mono font-bold text-[var(--accent)]">{stealth}</div>
          <div className="text-[10px] text-[var(--text-muted)] mt-1">
            Recorded private destinations in this environment
          </div>
        </div>
        <div className="rh-card p-5">
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mb-3">
            <TrendingUp className="w-4 h-4 text-[var(--accent)]" />
            <span>Sponsored settlements</span>
          </div>
          <div className="text-2xl font-mono font-bold text-[var(--accent)]">{relays}</div>
          <div className="text-[10px] text-[var(--text-muted)] mt-1">
            Completed settlement records{demo ? ' · demo environment' : ' · live / testnet API'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rh-card p-5">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">
            Privacy heuristics
          </h3>
          <div className="h-48 flex items-center justify-center">
            <div className="text-center">
              <BarChart3 className="w-10 h-10 text-[var(--text-faint)] mx-auto mb-2" />
              <div className="text-xs text-[var(--text-muted)]">Visualization pending</div>
              <div className="text-[10px] text-[var(--text-faint)] mt-1">
                Chart series will connect to live metrics when available
              </div>
            </div>
          </div>
        </div>

        <div className="rh-card p-5">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">
            Token volume breakdown
          </h3>
          <div className="h-48 flex items-center justify-center">
            <div className="text-center">
              <BarChart3 className="w-10 h-10 text-[var(--text-faint)] mx-auto mb-2" />
              <div className="text-xs text-[var(--text-muted)]">Visualization pending</div>
              <div className="text-[10px] text-[var(--text-faint)] mt-1">
                Token volume series not connected in this environment
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rh-card p-6">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4 flex items-center gap-2">
          <FileCode className="w-4 h-4 text-[var(--accent)]" />
          Capability matrix
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-[var(--text-muted)] border-b border-[var(--border)]">
                <th className="text-left py-2.5 pr-4 font-medium">Capability</th>
                <th className="text-left py-2.5 pr-4 font-medium text-[var(--accent)]">
                  Implementation
                </th>
                <th className="text-left py-2.5 font-medium text-[var(--text-muted)]">
                  Current status
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Private receive', 'Meta-key registration API', 'Available'],
                ['Private transfer', 'Announcement / transfer log', 'Available'],
                ['Payment discovery', 'Recipient wallet scan', 'Available'],
                ['Sponsored settlement', 'Relayer path', 'Live claim sweep (testnet)'],
                ['Batch 1→many private send', 'Multi-recipient payroll / list', 'Roadmap'],
                ['Fully private transfer', 'Viewing-key path, no server claim keys', 'Roadmap'],
                ['Identity / KYC', 'Not required', 'Out of product scope'],
                ['Mainnet settlement', 'Staged production path', 'Not enabled here'],
              ].map(([feature, rabin, vanilla], i) => (
                <tr
                  key={i}
                  className="border-b border-[var(--border)] hover:bg-[var(--bg-hover)]"
                >
                  <td className="py-2.5 pr-4 text-[var(--text-muted)]">{feature}</td>
                  <td className="py-2.5 pr-4 text-[var(--accent)]">{rabin}</td>
                  <td className="py-2.5 text-[var(--text-muted)]">{vanilla}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-[10px] text-[var(--text-faint)] leading-relaxed">
          SilentTransfer provides a private transfer workflow (register, transfer, discover,
          settle). Protocol asset: SILENT (hard-capped). No KYC. Production on-chain settlement is
          staged and documented separately.
        </div>
      </div>
    </div>
  );
}
