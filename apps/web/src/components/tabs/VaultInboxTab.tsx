'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, ensureDemoAuth } from '@/lib/api';
import { useSessionWallet } from '@/hooks/useSessionWallet';
import { humanEthFromWei } from '@/lib/vault';
import { explorerTxUrl } from '@/lib/explorer';
import { truncAddr } from '@/lib/tokens';
import { Loader2, Inbox, ExternalLink, Wallet } from 'lucide-react';

interface IncomingItem {
  batch_id: string;
  amount_wei: string;
  status: string;
  payout_tx_hash?: string | null;
  source: string;
  message: string;
}

export default function VaultInboxTab() {
  const { wallet: sessionWallet, connect, source, connectWallet } = useSessionWallet();
  const [viewer, setViewer] = useState('');

  useEffect(() => {
    if (sessionWallet) setViewer(sessionWallet);
  }, [sessionWallet]);

  const enabled = Boolean(viewer && /^0x[a-fA-F0-9]{40}$/i.test(viewer));

  const { data, isLoading, refetch, isFetching, isError, error } = useQuery({
    queryKey: ['vault-incoming', viewer],
    enabled,
    queryFn: async () => {
      await connect(viewer);
      try {
        await ensureDemoAuth(viewer);
      } catch {
        /* SIWE may already be set */
      }
      return api<{ found: number; items: IncomingItem[] }>(
        '/api/vault/incoming',
        'GET',
        undefined,
        { auth: true, wallet: viewer }
      );
    },
  });

  return (
    <div className="space-y-5">
      <div className="rh-card p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text)] flex items-center gap-2">
            <Inbox className="w-5 h-5 text-emerald-700" />
            Receive
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1 leading-relaxed">
            History of private vault payments. Funds already arrive in your wallet — no claim
            button needed. Sender stays hidden.
          </p>
        </div>

        {!sessionWallet && (
          <button
            type="button"
            onClick={() => connectWallet().catch(() => {})}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-[var(--border)] text-sm font-semibold"
          >
            <Wallet className="w-4 h-4" /> Connect wallet
          </button>
        )}

        <div className="flex gap-2">
          <input
            className="rh-input font-mono text-sm flex-1"
            value={viewer}
            onChange={(e) => setViewer(e.target.value.trim())}
            placeholder="0x… your wallet"
          />
          <button
            type="button"
            onClick={() => refetch()}
            disabled={!enabled || isFetching}
            className="rh-btn-primary w-auto px-4"
          >
            {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Check'}
          </button>
        </div>

        {isLoading && (
          <div className="flex justify-center py-10 text-sm text-[var(--text-muted)] gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        )}

        {isError && (
          <p className="text-xs text-red-600">
            {(error as Error)?.message || 'Could not load payments'}
          </p>
        )}

        {!isLoading && enabled && data && !data.items?.length && (
          <div className="text-center py-10 px-4">
            <p className="text-sm font-medium text-[var(--text)]">No payments logged yet</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              When someone sends privately, ETH goes to your wallet on-chain. This list is optional
              history.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {data?.items?.map((item, i) => {
            const link = item.payout_tx_hash
              ? explorerTxUrl(item.payout_tx_hash)
              : null;
            return (
              <div
                key={`${item.batch_id}-${i}`}
                className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/60"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-base font-semibold text-emerald-950">
                    +{humanEthFromWei(item.amount_wei)} ETH
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-800 bg-white/80 border border-emerald-200 px-2 py-0.5 rounded-full">
                    {item.status}
                  </span>
                </div>
                <p className="text-xs text-emerald-900/70 mt-1">From private vault · sender hidden</p>
                {link && (
                  <a
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 underline mt-2"
                  >
                    View tx <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                <p className="text-[10px] font-mono text-emerald-900/40 mt-1 break-all">
                  {truncAddr(item.batch_id, 8, 6)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
