'use client';

import { useCallback, useState } from 'react';
import { useSwitchChain, useWalletClient } from 'wagmi';
import {
  AlertTriangle,
  Loader2,
  Network,
  Copy,
  Check,
  ExternalLink,
  Plus,
} from 'lucide-react';
import { useSessionWallet } from '@/hooks/useSessionWallet';
import {
  formatNetworkDetailsForCopy,
  getNetworkDetails,
  switchOrAddAppChain,
} from '@/lib/addChain';
import { useToast } from '@/components/Toast';

type Props = {
  /** compact = header chip; full = detailed card with copyable fields */
  variant?: 'compact' | 'full';
  className?: string;
};

/**
 * When wallet is on the wrong chain, guide the user to add/switch
 * Robinhood Chain Testnet (or whatever app chain is configured).
 */
export default function NetworkSwitchBanner({
  variant = 'full',
  className = '',
}: Props) {
  const { showToast } = useToast();
  const {
    wrongChain,
    chainId,
    chainName,
    expectedChainId,
    source,
    isConnected,
  } = useSessionWallet();
  const { switchChainAsync } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const details = getNetworkDetails();

  const onAddOrSwitch = useCallback(async () => {
    setBusy(true);
    try {
      const request = walletClient
        ? (args: { method: string; params?: unknown[] }) =>
            walletClient.request(args as never)
        : undefined;
      const result = await switchOrAddAppChain({
        currentChainId: chainId,
        switchChain: (args) => switchChainAsync(args),
        request,
      });
      if (result === 'added') {
        showToast('success', `${details.name} added — switch confirmed`);
      } else if (result === 'switched') {
        showToast('success', `Switched to ${details.name}`);
      } else {
        showToast('success', `Already on ${details.name}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not switch network';
      if (/cancel/i.test(msg)) {
        showToast('error', 'Network switch cancelled');
      } else {
        showToast('error', msg.split('\n')[0] || msg);
      }
    } finally {
      setBusy(false);
    }
  }, [chainId, switchChainAsync, walletClient, showToast, details.name]);

  const onCopyDetails = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(formatNetworkDetailsForCopy());
      setCopied(true);
      showToast('success', 'Network details copied');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('error', 'Could not copy — select the fields manually');
    }
  }, [showToast]);

  // Only real wallets can add chains
  if (!isConnected || source === 'operator' || !wrongChain) return null;

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={() => void onAddOrSwitch()}
        disabled={busy}
        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 disabled:opacity-60 ${className}`}
        title={`Add / switch to ${chainName}`}
      >
        {busy ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <AlertTriangle className="w-3 h-3" />
        )}
        {busy ? 'Switching…' : 'Wrong network — fix'}
      </button>
    );
  }

  return (
    <div
      className={`rounded-xl border border-amber-200 bg-amber-50/90 p-4 space-y-3 ${className}`}
      role="alert"
    >
      <div className="flex items-start gap-2">
        <Network className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-950">
            Switch to {details.name}
          </p>
          <p className="text-xs text-amber-900/80 mt-0.5 leading-relaxed">
            Your wallet is on chain{' '}
            <strong className="font-mono">{chainId ?? '—'}</strong>. SilentTransfer
            needs <strong className="font-mono">{expectedChainId}</strong>. Tap the
            button — we&apos;ll ask your wallet to add this network if it is missing.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono bg-white/70 border border-amber-100 rounded-lg p-3">
        <Detail label="Network" value={details.name} />
        <Detail label="Chain ID" value={`${details.chainId} (${details.chainIdHex})`} />
        <Detail label="Currency" value={details.currencySymbol} />
        <Detail label="RPC" value={details.rpcUrl} breakAll />
        {details.explorerUrl && (
          <div className="sm:col-span-2 flex items-center gap-1.5 min-w-0">
            <span className="text-amber-800/70 shrink-0">Explorer</span>
            <a
              href={details.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="text-amber-950 underline truncate inline-flex items-center gap-1"
            >
              {details.explorerUrl}
              <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void onAddOrSwitch()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-amber-700 text-white hover:bg-amber-800 disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
          {busy ? 'Opening wallet…' : `Add / switch to ${details.name}`}
        </button>
        <button
          type="button"
          onClick={() => void onCopyDetails()}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-white border border-amber-200 text-amber-950 hover:bg-amber-50"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-600" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
          {copied ? 'Copied' : 'Copy network details'}
        </button>
      </div>

      <p className="text-[10px] text-amber-900/70 leading-relaxed">
        MetaMask: if the prompt does not appear, open Settings → Networks → Add
        network manually with the details above (or paste from Copy).
      </p>
    </div>
  );
}

function Detail({
  label,
  value,
  breakAll,
}: {
  label: string;
  value: string;
  breakAll?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-amber-800/70 text-[10px] font-sans font-medium mb-0.5">
        {label}
      </div>
      <div
        className={`text-amber-950 ${breakAll ? 'break-all' : 'truncate'}`}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}
