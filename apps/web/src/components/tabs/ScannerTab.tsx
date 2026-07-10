'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api, API_BASE, ensureDemoAuth } from '@/lib/api';
import { useSessionWallet } from '@/hooks/useSessionWallet';
import { useToast } from '@/components/Toast';
import { DEMO_WALLETS, truncAddr, formatTokenAmount, weiToHuman } from '@/lib/tokens';
import { setPendingWithdraw } from '@/lib/pendingWithdraw';
import {
  ScanSearch,
  Loader2,
  AlertCircle,
  Eye,
  ArrowRight,
  Sparkles,
  Repeat2,
} from 'lucide-react';
import EmptyState from '@/components/EmptyState';

interface Announcement {
  stealth_address: string;
  caller: string;
  to_address?: string | null;
  token_address?: string;
  amount: string;
  block_number: number;
  announced_at?: string;
  announce_metadata?: { token_symbol?: string };
}

interface ScanResult {
  viewer: string;
  found: number;
  announcements: Announcement[];
  message?: string | null;
}



export default function ScannerTab() {
  const router = useRouter();
  const { showToast } = useToast();
  const { wallet: sessionWallet, connect } = useSessionWallet();
  const [viewer, setViewer] = useState('');
  const [viewerError, setViewerError] = useState('');

  useEffect(() => {
    if (sessionWallet && !viewer) setViewer(sessionWallet);
  }, [sessionWallet, viewer]);

  const { data: allAnnouncements, isLoading: allLoading, refetch: refetchAll } = useQuery<
    Announcement[]
  >({
    queryKey: ['announcements-scanner'],
    queryFn: async () => (await api<Announcement[]>('/api/announcements')) || [],
  });

  const scanMutation = useMutation({
    mutationFn: async (address: string) => {
      const res = await fetch(
        `${API_BASE}/api/scan?viewer=${encodeURIComponent(address)}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.detail === 'string' ? data.detail : 'Scan failed'
        );
      }
      return data as ScanResult;
    },
  });

  const validateViewer = () => {
    if (!viewer) {
      setViewerError('Enter the recipient wallet address');
      return false;
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(viewer)) {
      setViewerError('Enter a valid address starting with 0x');
      return false;
    }
    setViewerError('');
    return true;
  };

  const handleScan = () => {
    if (!validateViewer()) return;
    scanMutation.mutate(viewer);
  };

  const scanAsBob = async () => {
    setViewerError('');
    const bob = DEMO_WALLETS.bob;
    setViewer(bob);
    try {
      await connect(bob);
      await ensureDemoAuth(bob);
    } catch {
      /* still scan even if connect soft-fails */
    }
    scanMutation.mutate(bob);
    refetchAll();
  };

  const withdrawPayment = async (a: Announcement) => {
    const owner = (a.to_address || viewer || DEMO_WALLETS.bob).toLowerCase();
    const symbol = a.announce_metadata?.token_symbol || 'USDG';
    setPendingWithdraw({
      stealth_address: a.stealth_address,
      target_owner: owner,
      amount: weiToHuman(a.amount),
      token_symbol: symbol,
      from_address: a.caller,
    });
    try {
      await connect(owner);
      await ensureDemoAuth(owner);
    } catch {
      /* continue to relayer */
    }
    showToast('success', 'Opening Relayer with payment details prefilled');
    router.push('/dashboard?tab=relayer', { scroll: false });
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="rh-card p-6">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h2 className="text-lg font-semibold text-[var(--text)]">Payment discovery</h2>
          <button
            type="button"
            onClick={scanAsBob}
            disabled={scanMutation.isPending}
            className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-sky-700 bg-sky-50 border border-sky-200 rounded-lg px-2.5 py-1.5 hover:bg-sky-100 transition-colors disabled:opacity-60"
          >
            {scanMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            Scan recipient (Bob)
          </button>
        </div>
        <p className="text-sm text-[var(--text-muted)] mb-5 leading-relaxed">
          Enter the recipient wallet to discover private payments directed to that address.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="rh-label">Recipient wallet</label>
            <input
              type="text"
              value={viewer}
              onChange={(e) => {
                setViewer(e.target.value);
                setViewerError('');
              }}
              placeholder="0x… recipient address"
              className={`rh-input font-mono ${viewerError ? 'rh-input-error' : ''}`}
            />
            {viewerError && <p className="text-red-600 text-xs mt-1">{viewerError}</p>}
          </div>
          <div className="sm:pt-6">
            <button
              type="button"
              onClick={handleScan}
              disabled={scanMutation.isPending}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white font-semibold text-sm rounded-lg px-5 py-2.5 transition-colors shadow-sm"
            >
              {scanMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ScanSearch className="w-4 h-4" />
              )}
              Discover payments
            </button>
          </div>
        </div>

        {scanMutation.isError && (
          <div className="mt-4 p-3 rounded-lg rh-alert-error flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="text-xs text-[var(--danger-text)]">
              {(scanMutation.error as Error)?.message || 'Scan failed'}
            </div>
          </div>
        )}

        {scanMutation.data && (
          <div className="mt-5 p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)] mb-1">
              <Eye className="w-4 h-4 text-[var(--accent)]" />
              {scanMutation.data.found === 0
                ? 'No payments found for this wallet'
                : `${scanMutation.data.found} payment${scanMutation.data.found === 1 ? '' : 's'} found`}
            </div>
            {scanMutation.data.message && (
              <p className="text-xs text-[var(--text-muted)] mb-3">{scanMutation.data.message}</p>
            )}

            {scanMutation.data.found === 0 && (
              <p className="text-xs text-[var(--text-muted)] mt-2 leading-relaxed">
                Complete a private transfer to this recipient, then run discovery again.
              </p>
            )}

            {scanMutation.data.announcements.length > 0 && (
              <div className="space-y-2 mt-3">
                {scanMutation.data.announcements.map((a, i) => (
                  <div
                    key={a.stealth_address || i}
                    className="p-3 rounded-lg bg-white border border-[var(--border)] text-xs"
                  >
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[var(--text-secondary)]">
                      <span className="text-emerald-700">{truncAddr(a.caller)}</span>
                      <ArrowRight className="w-3 h-3 text-[var(--text-faint)]" />
                      <span className="text-sky-700">
                        {truncAddr(a.to_address || viewer)}
                      </span>
                      <span className="text-[var(--text-faint)]">(private)</span>
                    </div>
                    <div className="mt-2 grid gap-1 text-[var(--text-muted)]">
                      <div>
                        Amount:{' '}
                        <span className="font-mono text-[var(--text)]">
                          {formatTokenAmount(a.amount)}
                        </span>
                        {a.announce_metadata?.token_symbol
                          ? ` ${a.announce_metadata.token_symbol}`
                          : ''}
                      </div>
                      <div className="font-mono break-all">
                        Private address: {a.stealth_address}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => withdrawPayment(a)}
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg px-3 py-1.5 transition-colors"
                    >
                      <Repeat2 className="w-3.5 h-3.5" />
                      Settle (sponsored)
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rh-card p-5">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">
          Recent private transfers
        </h3>
        {allLoading ? (
          <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading...
          </div>
        ) : !allAnnouncements || allAnnouncements.length === 0 ? (
          <EmptyState
            compact
            title="No private transfers yet"
            description="Use Send to transfer privately from one wallet to another."
            imageSrc="/brand/feature-discovery.jpg"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-[var(--text-muted)] border-b border-[var(--border)]">
                  <th className="text-left py-2 pr-3">From</th>
                  <th className="text-left py-2 pr-3">To</th>
                  <th className="text-left py-2 pr-3">Private address</th>
                  <th className="text-right py-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {allAnnouncements.map((a, i) => (
                  <tr
                    key={a.stealth_address || i}
                    className="border-b border-[var(--border)]/80 hover:bg-[var(--bg-hover)]"
                  >
                    <td className="py-2 pr-3 text-emerald-700">{truncAddr(a.caller)}</td>
                    <td className="py-2 pr-3 text-sky-700">
                      {a.to_address ? truncAddr(a.to_address) : '—'}
                    </td>
                    <td className="py-2 pr-3 text-[var(--text-faint)]">
                      {truncAddr(a.stealth_address)}
                    </td>
                    <td className="py-2 text-right text-[var(--text-secondary)]">
                      {formatTokenAmount(a.amount)}
                    </td>
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
