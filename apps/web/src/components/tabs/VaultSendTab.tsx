'use client';

import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useBalance, useWriteContract, useSwitchChain } from 'wagmi';
import { isAddress, formatEther, parseEther } from 'viem';
import { getAuthMode, getStoredToken, getStoredWallet } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useSessionWallet } from '@/hooks/useSessionWallet';
import { truncAddr } from '@/lib/tokens';
import { explorerTxUrl } from '@/lib/explorer';
import { switchOrAddAppChain } from '@/lib/addChain';
import NetworkSwitchBanner from '@/components/NetworkSwitchBanner';
import FaucetLinks from '@/components/FaucetLinks';
import {
  executeVaultPrivateTransfer,
  parseRecipientLines,
  estimateGross,
  humanEthFromWei,
  getVaultAddress,
} from '@/lib/vault';
import {
  Send,
  Loader2,
  AlertCircle,
  CheckCircle,
  Users,
  User,
  ExternalLink,
  Wallet,
} from 'lucide-react';

const DEFAULT_FEE_BPS = 50;

export default function VaultSendTab() {
  const { showToast } = useToast();
  const {
    wallet: sessionWallet,
    source,
    connectWallet,
    signInWithEthereum,
    needsSiwe,
    wrongChain,
    chainName,
    expectedChainId,
  } = useSessionWallet();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, isPending: isWriting } = useWriteContract();

  const [mode, setMode] = useState<'one' | 'many'>('one');
  const [toOne, setToOne] = useState('');
  const [amountOne, setAmountOne] = useState('');
  const [rawMany, setRawMany] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof executeVaultPrivateTransfer>
  > | null>(null);

  const fromWallet = sessionWallet || '';
  const isRealWallet = source === 'wallet' && Boolean(fromWallet);
  const walletAddr =
    fromWallet && isAddress(fromWallet) ? (fromWallet as `0x${string}`) : undefined;

  const { data: ethBalance, refetch: refetchEth } = useBalance({
    address: walletAddr,
    chainId: expectedChainId,
    query: { enabled: Boolean(walletAddr) },
  });

  const lines = useMemo(() => {
    if (mode === 'one') {
      if (!toOne.trim() || !amountOne.trim()) return [];
      return [{ address: toOne.trim(), amount: amountOne.trim() }];
    }
    return parseRecipientLines(rawMany).lines;
  }, [mode, toOne, amountOne, rawMany]);

  const est = useMemo(() => estimateGross(lines, DEFAULT_FEE_BPS), [lines]);
  const parseErrs = mode === 'many' ? parseRecipientLines(rawMany).errors : [];

  const ensureAuth = async (addr: string) => {
    const m = getAuthMode();
    const stored = getStoredWallet();
    const tokenJwt = getStoredToken();
    if (tokenJwt && stored === addr.toLowerCase() && m === 'siwe') return;
    if (needsSiwe || m !== 'siwe' || stored !== addr.toLowerCase()) {
      await signInWithEthereum();
    }
  };

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!fromWallet || !isAddress(fromWallet)) throw new Error('Connect a wallet first');
      if (source !== 'wallet') {
        throw new Error('Connect MetaMask / a real wallet to send on-chain');
      }
      if (!lines.length) throw new Error(mode === 'one' ? 'Enter address and amount' : 'Add recipients');
      if (mode === 'one') {
        if (!isAddress(toOne)) throw new Error('Invalid address');
        if (!Number(amountOne) || Number(amountOne) <= 0) throw new Error('Invalid amount');
      }
      if (parseErrs.length) throw new Error(parseErrs[0]);

      if (ethBalance && est.gross > 0) {
        const need = parseEther(String(est.gross));
        if (need > ethBalance.value) {
          throw new Error(
            `Need ~${est.gross.toFixed(6)} ETH (amount + fee). Balance too low.`
          );
        }
      }

      await switchOrAddAppChain({
        currentChainId: undefined,
        switchChain: (args) => switchChainAsync(args),
      });
      await ensureAuth(fromWallet);

      return executeVaultPrivateTransfer({
        fromWallet,
        chainId: expectedChainId,
        lines,
        writeContractAsync: writeContractAsync as never,
        onStatus: setStatusMsg,
      });
    },
    onSuccess: (data) => {
      setStatusMsg('');
      setResult(data);
      showToast('success', 'Private transfer sent');
      refetchEth();
    },
    onError: (e: Error) => {
      setStatusMsg('');
      const msg = e.message || 'Transfer failed';
      if (/user rejected|denied|reject/i.test(msg)) {
        showToast('error', 'Wallet rejected the transaction');
      } else {
        showToast('error', msg);
      }
    },
  });

  const busy = sendMutation.isPending || isWriting;
  const txLink = result?.deposit_tx_hash
    ? explorerTxUrl(result.deposit_tx_hash)
    : null;

  return (
    <div className="space-y-5">
      {/* Mode switch — only two actions */}
      <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-[var(--bg-muted)] border border-[var(--border)]">
        <button
          type="button"
          onClick={() => setMode('one')}
          className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
            mode === 'one'
              ? 'bg-white text-emerald-900 shadow-sm border border-emerald-100'
              : 'text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <User className="w-4 h-4" />
          To one person
        </button>
        <button
          type="button"
          onClick={() => setMode('many')}
          className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
            mode === 'many'
              ? 'bg-white text-emerald-900 shadow-sm border border-emerald-100'
              : 'text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <Users className="w-4 h-4" />
          To many
        </button>
      </div>

      <div className="rh-card p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text)]">
            {mode === 'one' ? 'Private transfer' : 'Private batch transfer'}
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1 leading-relaxed">
            {mode === 'one'
              ? 'Enter their wallet and amount. They get ETH in their wallet automatically — no claim on the website.'
              : 'Pay many wallets in one transaction. Everyone receives in their wallet automatically.'}
          </p>
        </div>

        {!isRealWallet && (
          <button
            type="button"
            onClick={() => connectWallet().catch(() => {})}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--text)] hover:bg-[var(--bg-hover)]"
          >
            <Wallet className="w-4 h-4" /> Connect wallet to send
          </button>
        )}

        {wrongChain && <NetworkSwitchBanner variant="full" />}

        {isRealWallet && ethBalance && ethBalance.value === BigInt(0) && (
          <FaucetLinks variant="card" title="Get test ETH first" />
        )}

        {mode === 'one' ? (
          <div className="space-y-4">
            <div>
              <label className="rh-label">Their address</label>
              <input
                className="rh-input font-mono text-sm"
                value={toOne}
                onChange={(e) => setToOne(e.target.value.trim())}
                placeholder="0x…"
                disabled={busy}
                autoComplete="off"
              />
            </div>
            <div>
              <label className="rh-label">Amount (ETH)</label>
              <input
                className="rh-input font-mono text-sm"
                value={amountOne}
                onChange={(e) => setAmountOne(e.target.value)}
                placeholder="0.01"
                inputMode="decimal"
                disabled={busy}
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="rh-label">Recipients</label>
            <textarea
              className="rh-input font-mono text-xs min-h-[140px] leading-relaxed"
              value={rawMany}
              onChange={(e) => setRawMany(e.target.value)}
              placeholder={'0xabc…,0.01\n0xdef…,0.02\n0xghi…,0.005'}
              disabled={busy}
              spellCheck={false}
            />
            <p className="text-[11px] text-[var(--text-faint)] mt-1.5">
              One line each: address, amount
            </p>
            {parseErrs[0] && (
              <p className="text-red-600 text-xs mt-1">{parseErrs[0]}</p>
            )}
          </div>
        )}

        {/* Simple total */}
        {lines.length > 0 && (
          <div className="rounded-xl bg-[var(--bg-muted)] border border-[var(--border)] px-4 py-3 text-sm space-y-1">
            {mode === 'many' && (
              <div className="flex justify-between text-[var(--text-muted)]">
                <span>People</span>
                <span className="font-medium text-[var(--text)]">{lines.length}</span>
              </div>
            )}
            <div className="flex justify-between text-[var(--text-muted)]">
              <span>They get</span>
              <span className="font-mono text-[var(--text)]">{est.net.toFixed(6)} ETH</span>
            </div>
            <div className="flex justify-between text-[var(--text-muted)]">
              <span>Fee (0.5%)</span>
              <span className="font-mono text-[var(--text)]">{est.fee.toFixed(6)} ETH</span>
            </div>
            <div className="flex justify-between font-semibold pt-1 border-t border-[var(--border)]">
              <span>You pay</span>
              <span className="font-mono">~{est.gross.toFixed(6)} ETH + gas</span>
            </div>
          </div>
        )}

        {statusMsg && (
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {statusMsg}
          </div>
        )}

        <button
          type="button"
          disabled={busy || wrongChain || !lines.length}
          onClick={() => sendMutation.mutate()}
          className="rh-btn-primary w-full py-3.5 text-sm"
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          {busy
            ? 'Sending…'
            : mode === 'one'
              ? 'Send privately'
              : `Send to ${lines.length || 0} privately`}
        </button>

        {sendMutation.isError && (
          <div className="flex gap-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {(sendMutation.error as Error)?.message}
          </div>
        )}

        {result && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
              <CheckCircle className="w-4 h-4" /> Sent
            </div>
            <p className="text-xs text-emerald-900/80">
              Money is already in their wallets. They do <strong>not</strong> need to open the site
              to claim. (Receive tab is only a history view.)
            </p>
            {result.recipients?.slice(0, 8).map((r) => (
              <div
                key={r.payout_id}
                className="flex justify-between text-xs font-mono text-emerald-900/90"
              >
                <span>{truncAddr(r.address)}</span>
                <span>{humanEthFromWei(r.amount_wei)} ETH</span>
              </div>
            ))}
            {txLink && (
              <a
                href={txLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 underline"
              >
                View transaction <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {!getVaultAddress() && (
              <p className="text-[10px] text-amber-800">
                Vault contract optional — payout recorded for demo if vault not deployed.
              </p>
            )}
          </div>
        )}
      </div>

      <p className="text-center text-[11px] text-[var(--text-faint)] px-4 leading-relaxed">
        Private send uses a vault payout so recipients don&apos;t see your address.
        {isRealWallet && ethBalance
          ? ` · Balance ${Number(formatEther(ethBalance.value)).toFixed(4)} ETH`
          : ''}
      </p>
    </div>
  );
}
