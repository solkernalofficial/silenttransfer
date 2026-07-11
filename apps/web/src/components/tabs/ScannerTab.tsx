'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api, API_BASE, ensureDemoAuth } from '@/lib/api';
import { useSessionWallet } from '@/hooks/useSessionWallet';
import { useToast } from '@/components/Toast';
import { DEMO_WALLETS, truncAddr, formatTokenAmount, weiToHuman } from '@/lib/tokens';
import { setPendingWithdraw } from '@/lib/pendingWithdraw';
import { getStealthVault, ensureStealthVault } from '@/lib/stealth/vault';
import { scanAnnouncementsForKeys } from '@/lib/stealth/crypto';
import {
  ScanSearch,
  Loader2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Shield,
  Lock,
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
  ephemeral_pubkey: string;
  announce_metadata?: {
    token_symbol?: string;
    claim_mode?: string;
    scheme?: string;
    funded_on_chain?: boolean;
  };
}

interface MatchedPayment extends Announcement {
  claim_private_key?: `0x${string}`;
  match_type: 'stealth-ecdh' | 'to_address';
}

export default function ScannerTab() {
  const router = useRouter();
  const { showToast } = useToast();
  const { wallet: sessionWallet, connect } = useSessionWallet();
  const [viewer, setViewer] = useState('');
  const [viewerError, setViewerError] = useState('');
  const [matches, setMatches] = useState<MatchedPayment[] | null>(null);

  useEffect(() => {
    if (sessionWallet && !viewer) setViewer(sessionWallet);
  }, [sessionWallet, viewer]);

  const { data: allAnnouncements, isLoading: allLoading, refetch: refetchAll } = useQuery<
    Announcement[]
  >({
    queryKey: ['announcements-scanner'],
    queryFn: async () => (await api<Announcement[]>('/api/announcements?limit=100')) || [],
  });

  const scanMutation = useMutation({
    mutationFn: async (address: string) => {
      const vault = getStealthVault(address) || null;
      // Pull full announcement list for client ECDH scan
      const list =
        (await api<Announcement[]>('/api/announcements?limit=100')) ||
        allAnnouncements ||
        [];

      const found: MatchedPayment[] = [];

      // 1) True stealth: client-side ECDH with vault keys
      if (vault) {
        const stealthHits = scanAnnouncementsForKeys(list, {
          spendingPrivateKey: vault.spendingPrivateKey,
          viewingPrivateKey: vault.viewingPrivateKey,
        });
        for (const h of stealthHits) {
          found.push({
            ...h,
            claim_private_key: h.claim_private_key,
            match_type: 'stealth-ecdh',
          });
        }
      }

      // 2) Legacy server scan by to_address (non-stealth path)
      const res = await fetch(
        `${API_BASE}/api/scan?viewer=${encodeURIComponent(address)}`
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.announcements)) {
        for (const a of data.announcements as Announcement[]) {
          if (found.some((f) => f.stealth_address === a.stealth_address)) continue;
          found.push({ ...a, match_type: 'to_address' });
        }
      }

      return {
        viewer: address,
        found: found.length,
        announcements: found,
        hasVault: Boolean(vault),
        message: vault
          ? found.length
            ? `Matched ${found.length} payment(s) via ECDH viewing key (+ legacy).`
            : 'No stealth payments for this vault yet.'
          : 'No stealth vault on this browser — enable Receive first for ECDH scan, or use legacy to_address match.',
      };
    },
    onSuccess: (data) => {
      setMatches(data.announcements);
      if (data.found === 0) {
        showToast('error', data.message || 'No payments found');
      } else {
        showToast('success', `Found ${data.found} private payment(s)`);
      }
    },
    onError: (e: Error) => {
      setMatches(null);
      showToast('error', e.message || 'Scan failed');
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
      ensureStealthVault(bob);
    } catch {
      /* still scan */
    }
    scanMutation.mutate(bob);
    refetchAll();
  };

  const withdrawPayment = async (a: MatchedPayment) => {
    const owner = (a.to_address || viewer || DEMO_WALLETS.bob).toLowerCase();
    const symbol = a.announce_metadata?.token_symbol || 'ETH';
    setPendingWithdraw({
      stealth_address: a.stealth_address,
      target_owner: owner,
      amount: weiToHuman(a.amount),
      token_symbol: symbol,
      from_address: a.caller,
      claim_private_key: a.claim_private_key,
      claim_mode:
        a.match_type === 'stealth-ecdh'
          ? 'stealth'
          : (a.announce_metadata?.claim_mode as 'client' | 'server' | undefined) ||
            'client',
    });
    try {
      await connect(owner);
      await ensureDemoAuth(owner);
    } catch {
      /* continue */
    }
    if (a.match_type === 'stealth-ecdh' && a.claim_private_key) {
      showToast('success', 'Stealth spend key derived — opening Relayer to claim');
    } else if (a.announce_metadata?.claim_mode === 'stealth' && !a.claim_private_key) {
      showToast(
        'error',
        'Stealth payment needs this browser’s Receive vault (viewing key) to derive claim'
      );
    } else {
      showToast('success', 'Opening Relayer with payment details');
    }
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
            Scan as Bob
          </button>
        </div>
        <p className="text-sm text-[var(--text-muted)] mb-4 leading-relaxed">
          Connect the wallet that was paid. We find private payments for that address — no setup
          required for simple sends. If you enabled Receive, we also match stealth (ECDH) payments.
        </p>

        <div className="mb-4 p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] text-[11px] text-[var(--text-muted)] flex items-start gap-2">
          <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[var(--accent)]" />
          <span>
            Privacy hygiene: optional delay before claim, avoid claiming into a CEX deposit, consider
            a privacy-aware RPC/VPN for scan IP.
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={viewer}
              onChange={(e) => {
                setViewer(e.target.value.trim());
                setViewerError('');
              }}
              placeholder="0x… recipient wallet (with Receive vault)"
              className={`rh-input font-mono ${viewerError ? 'rh-input-error' : ''}`}
            />
            {viewerError && <p className="text-red-600 text-xs mt-1">{viewerError}</p>}
          </div>
          <button
            type="button"
            onClick={handleScan}
            disabled={scanMutation.isPending}
            className="rh-btn-primary sm:w-auto"
          >
            {scanMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ScanSearch className="w-4 h-4" />
            )}
            Scan
          </button>
        </div>

        {scanMutation.isError && (
          <div className="mt-4 p-3 rounded-lg rh-alert-error flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="text-xs">{(scanMutation.error as Error)?.message}</div>
          </div>
        )}
      </div>

      {matches && (
        <div className="rh-card p-5">
          <h3 className="text-sm font-semibold text-[var(--text)] mb-3">
            Results ({matches.length})
          </h3>
          {matches.length === 0 ? (
            <EmptyState
              compact
              title="No payments found"
              description="Enable Receive on this browser, then ask the sender to use private A→B send to your address."
            />
          ) : (
            <div className="space-y-3">
              {matches.map((a) => (
                <div
                  key={a.stealth_address}
                  className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono text-[var(--text)]">
                      {truncAddr(a.stealth_address)}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                        a.match_type === 'stealth-ecdh'
                          ? 'bg-violet-50 text-violet-800 border-violet-200'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {a.match_type === 'stealth-ecdh' ? 'ECDH stealth' : 'legacy match'}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    From {truncAddr(a.caller)} · {weiToHuman(a.amount)}{' '}
                    {a.announce_metadata?.token_symbol || 'ETH'}
                    {a.amount && (
                      <span className="text-[var(--text-faint)]">
                        {' '}
                        ({formatTokenAmount(a.amount)} wei)
                      </span>
                    )}
                  </div>
                  {a.match_type === 'stealth-ecdh' && (
                    <p className="text-[11px] text-violet-800 flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Spend key derived locally — ready to claim
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => withdrawPayment(a)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)]"
                  >
                    Claim in Relayer <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {allLoading && !matches && (
        <div className="text-sm text-[var(--text-muted)] flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading announcements…
        </div>
      )}
    </div>
  );
}
