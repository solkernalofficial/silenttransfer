'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, ensureDemoAuth } from '@/lib/api';
import { useSessionWallet } from '@/hooks/useSessionWallet';
import { humanEthFromWei } from '@/lib/vault';
import { explorerTxUrl } from '@/lib/explorer';
import { truncAddr } from '@/lib/tokens';
import { Inbox, Loader2, Shield, ExternalLink, EyeOff } from 'lucide-react';
import EmptyState from '@/components/EmptyState';

interface IncomingItem {
  batch_id: string;
  amount_wei: string;
  status: string;
  payout_tx_hash?: string | null;
  source: string;
  message: string;
}

export default function VaultInboxTab() {
  const { wallet: sessionWallet, connect } = useSessionWallet();
  const [viewer, setViewer] = useState('');

  useEffect(() => {
    if (sessionWallet) setViewer(sessionWallet);
  }, [sessionWallet]);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['vault-incoming', viewer],
    enabled: Boolean(viewer && /^0x[a-fA-F0-9]{40}$/i.test(viewer)),
    queryFn: async () => {
      await connect(viewer);
      try {
        await ensureDemoAuth(viewer);
      } catch {
        /* may already have SIWE */
      }
      return api<{ found: number; items: IncomingItem[] }>('/api/vault/incoming', 'GET', undefined, {
        auth: true,
        wallet: viewer,
      });
    },
  });

  return (
    <div className="max-w-xl space-y-6">
      <div className="rh-card p-6">
        <h2 className="text-lg font-semibold text-[var(--text)] flex items-center gap-2 mb-1">
          <Inbox className="w-5 h-5 text-[var(--accent)]" />
          Vault inbox
        </h2>
        <p className="text-sm text-[var(--text-muted)] mb-4">
          Private vault payments to your wallet. <strong>Sender address is hidden</strong> — you
          only see Silent Vault as the source.
        </p>

        <div className="mb-4 p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] text-[11px] flex gap-2">
          <EyeOff className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[var(--accent)]" />
          <span>
            This is the B-side of vault transfers: A deposited into the pool; you received from the
            vault.
          </span>
        </div>

        <div className="flex gap-2 mb-4">
          <input
            className="rh-input font-mono flex-1"
            value={viewer}
            onChange={(e) => setViewer(e.target.value.trim())}
            placeholder="0x… your wallet"
          />
          <button
            type="button"
            className="rh-btn-primary w-auto px-4"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : !data?.items?.length ? (
          <EmptyState
            compact
            title="No vault payments yet"
            description="When someone sends you a private vault transfer, it appears here without their wallet address."
          />
        ) : (
          <div className="space-y-3">
            {data.items.map((item, i) => {
              const link = item.payout_tx_hash
                ? explorerTxUrl(item.payout_tx_hash)
                : null;
              return (
                <div
                  key={`${item.batch_id}-${i}`}
                  className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-emerald-900">
                      +{humanEthFromWei(item.amount_wei)} ETH
                    </span>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border border-emerald-300 text-emerald-800">
                      {item.status}
                    </span>
                  </div>
                  <div className="text-xs text-emerald-900/80 flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    From: {item.source}
                  </div>
                  <p className="text-[11px] text-emerald-800/70">{item.message}</p>
                  <div className="text-[10px] font-mono text-emerald-900/60 break-all">
                    Batch {truncAddr(item.batch_id, 10, 8)}
                  </div>
                  {link && (
                    <a
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 underline"
                    >
                      Payout tx <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
