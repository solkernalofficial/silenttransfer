'use client';

import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useBalance, useWriteContract, useSwitchChain } from 'wagmi';
import { isAddress, formatEther, parseEther } from 'viem';
import { getAuthMode, getStoredToken, getStoredWallet, api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useSessionWallet } from '@/hooks/useSessionWallet';
import { truncAddr } from '@/lib/tokens';
import { explorerTxUrl } from '@/lib/explorer';
import { appChain } from '@/lib/wagmi';
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
  Shield,
  Vault,
  Wallet,
  ExternalLink,
  EyeOff,
} from 'lucide-react';

const DEFAULT_FEE_BPS = 50; // 0.5%

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

  const [mode, setMode] = useState<'single' | 'many'>('single');
  const [toOne, setToOne] = useState('');
  const [amountOne, setAmountOne] = useState('');
  const [rawMany, setRawMany] = useState(
    '# address,amount\n# 0xBob…,0.01\n# 0xCarol…,0.02\n'
  );
  const [statusMsg, setStatusMsg] = useState('');
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof executeVaultPrivateTransfer>
  > | null>(null);
  const [feeBps] = useState(DEFAULT_FEE_BPS);

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
    if (mode === 'single') {
      if (!toOne || !amountOne) return [];
      return [{ address: toOne.trim(), amount: amountOne.trim() }];
    }
    return parseRecipientLines(rawMany).lines;
  }, [mode, toOne, amountOne, rawMany]);

  const est = useMemo(() => estimateGross(lines, feeBps), [lines, feeBps]);
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
        throw new Error('Connect a real wallet to deposit into the vault on-chain');
      }
      if (!lines.length) throw new Error('Add at least one recipient');
      if (mode === 'single') {
        if (!isAddress(toOne)) throw new Error('Invalid recipient address');
        if (!Number(amountOne) || Number(amountOne) <= 0) throw new Error('Invalid amount');
      }
      if (parseErrs.length) throw new Error(parseErrs[0]);

      if (ethBalance && est.gross > 0) {
        try {
          const need = parseEther(String(est.gross));
          // leave tiny gas headroom for deposit tx
          if (need > ethBalance.value) {
            throw new Error(
              `Need ~${est.gross.toFixed(6)} ETH (amount + ${feeBps / 100}% fee). Balance too low.`
            );
          }
        } catch (e) {
          if (e instanceof Error && e.message.startsWith('Need')) throw e;
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
      showToast(
        'success',
        `Vault transfer done → ${data.recipients?.length || lines.length} recipient(s)`
      );
      refetchEth();
    },
    onError: (e: Error) => {
      setStatusMsg('');
      const msg = e.message || 'Vault transfer failed';
      if (/user rejected|denied|reject/i.test(msg)) {
        showToast('error', 'Wallet rejected the transaction');
      } else {
        showToast('error', msg);
      }
    },
  });

  const busy = sendMutation.isPending || isWriting;
  const vaultAddr = getVaultAddress();
  const txLink = result?.deposit_tx_hash
    ? explorerTxUrl(result.deposit_tx_hash)
    : null;

  return (
    <div className="max-w-xl space-y-6">
      <div className="rh-card p-6">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h2 className="text-lg font-semibold text-[var(--text)] flex items-center gap-2">
            <Vault className="w-5 h-5 text-[var(--accent)]" />
            Private vault transfer
          </h2>
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md bg-violet-50 text-violet-800 border border-violet-200">
            A → Vault → B
          </span>
        </div>
        <p className="text-sm text-[var(--text-muted)] mb-4 leading-relaxed">
          You enter any 0x address(es) + amount. You pay <strong>amount + fee</strong> once.
          Recipients get paid <strong>from the Silent Vault</strong> — they do not see your wallet
          on the receive side.
        </p>

        <div className="mb-4 p-3 rounded-xl border border-violet-200 bg-violet-50/60 text-[11px] text-violet-950 space-y-1.5">
          <p className="font-semibold flex items-center gap-1.5">
            <EyeOff className="w-3.5 h-3.5" /> What “private” means here
          </p>
          <p>
            <strong>B sees:</strong> ETH from Silent Vault (not from A).
          </p>
          <p>
            <strong>You pay:</strong> net to recipients + protocol fee ({feeBps / 100}%) + network
            gas.
          </p>
          <p className="text-violet-900/70">
            Honest limit: on a public chain, your deposit A→Vault is still visible to analysts. Full
            ZK hiding of amount/deposit needs a shielded pool later.
          </p>
        </div>

        {!isRealWallet && (
          <div className="mb-4 p-3 rounded-lg rh-alert-info text-xs">
            Connect a real wallet to deposit.
            <button
              type="button"
              onClick={() => connectWallet().catch(() => {})}
              className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)]"
            >
              <Wallet className="w-3.5 h-3.5" /> Connect wallet
            </button>
          </div>
        )}
        {wrongChain && <NetworkSwitchBanner variant="full" className="mb-4" />}
        {isRealWallet && ethBalance && ethBalance.value === BigInt(0) && (
          <div className="mb-4">
            <FaucetLinks variant="card" title="Need test ETH for deposit" />
          </div>
        )}

        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold border ${
              mode === 'single'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'border-[var(--border)] text-[var(--text-muted)]'
            }`}
          >
            One recipient
          </button>
          <button
            type="button"
            onClick={() => setMode('many')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1 ${
              mode === 'many'
                ? 'bg-violet-50 border-violet-300 text-violet-900'
                : 'border-[var(--border)] text-[var(--text-muted)]'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> Many (B, C, D…)
          </button>
        </div>

        {mode === 'single' ? (
          <div className="space-y-3 mb-4">
            <div>
              <label className="rh-label">To — any 0x address</label>
              <input
                className="rh-input font-mono"
                value={toOne}
                onChange={(e) => setToOne(e.target.value.trim())}
                placeholder="0x…"
                disabled={busy}
              />
            </div>
            <div>
              <label className="rh-label">Amount (ETH)</label>
              <input
                className="rh-input font-mono"
                value={amountOne}
                onChange={(e) => setAmountOne(e.target.value)}
                placeholder="0.01"
                disabled={busy}
              />
            </div>
          </div>
        ) : (
          <div className="mb-4">
            <label className="rh-label">Recipients (address,amount per line)</label>
            <textarea
              className="rh-input font-mono text-xs min-h-[140px]"
              value={rawMany}
              onChange={(e) => setRawMany(e.target.value)}
              disabled={busy}
            />
            {parseErrs.length > 0 && (
              <p className="text-red-600 text-xs mt-1">{parseErrs[0]}</p>
            )}
          </div>
        )}

        <div className="mb-4 p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] text-xs space-y-1 font-mono">
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">Recipients</span>
            <span>{lines.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">They receive (net)</span>
            <span>{est.net.toFixed(6)} ETH</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">Protocol fee ({feeBps / 100}%)</span>
            <span>{est.fee.toFixed(6)} ETH</span>
          </div>
          <div className="flex justify-between font-semibold text-[var(--text)] border-t border-[var(--border)] pt-1">
            <span>You pay (gross)</span>
            <span>{est.gross.toFixed(6)} ETH + gas</span>
          </div>
          {ethBalance && (
            <div className="text-[10px] text-[var(--text-faint)]">
              Balance {Number(formatEther(ethBalance.value)).toFixed(6)} ETH
            </div>
          )}
          {!vaultAddr && (
            <div className="text-[10px] text-amber-800 pt-1">
              Vault contract address not set — batch still works in simulated payout mode until
              SilentVault is deployed.
            </div>
          )}
        </div>

        {statusMsg && (
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mb-3">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {statusMsg}
          </div>
        )}

        <button
          type="button"
          disabled={busy || wrongChain || !lines.length}
          onClick={() => sendMutation.mutate()}
          className="rh-btn-primary"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {busy
            ? 'Processing…'
            : `Pay ${est.gross > 0 ? est.gross.toFixed(4) : '—'} ETH & send privately`}
        </button>

        {sendMutation.isError && (
          <div className="mt-4 p-3 rounded-lg rh-alert-error flex gap-2 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {(sendMutation.error as Error)?.message}
          </div>
        )}

        {result && (
          <div className="mt-5 p-4 rounded-xl rh-alert-success space-y-2 text-xs">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <CheckCircle className="w-4 h-4" /> Vault transfer {result.status}
            </div>
            <p className="text-emerald-900/90">{result.message}</p>
            <div className="font-mono break-all">
              Batch {truncAddr(result.batch_id, 10, 8)}
            </div>
            {result.recipients?.map((r) => (
              <div
                key={r.payout_id}
                className="p-2 rounded-lg bg-white/50 border border-emerald-100 flex justify-between gap-2"
              >
                <span>{truncAddr(r.address)}</span>
                <span>
                  {humanEthFromWei(r.amount_wei)} ETH · {r.status}
                </span>
              </div>
            ))}
            {txLink && (
              <a
                href={txLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-emerald-800 underline"
              >
                Deposit tx <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <p className="flex items-start gap-1.5 text-emerald-800/80 pt-1">
              <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Recipients: open console → <strong>Vault inbox</strong> / Scanner — source shows
              Silent Vault, not your address.
            </p>
          </div>
        )}
      </div>

      <div className="rh-card p-5 text-sm text-[var(--text-muted)] space-y-2">
        <h3 className="font-semibold text-[var(--text)]">How the vault works</h3>
        <ol className="list-decimal pl-4 space-y-1.5 leading-relaxed">
          <li>You approve one deposit: amount for everyone + protocol fee.</li>
          <li>Funds sit in SilentVault (pooled).</li>
          <li>Protocol pays each recipient from the vault (separate payout leg).</li>
          <li>B/C/D receive ETH from the vault address — not from you.</li>
        </ol>
        <p className="text-[11px] text-[var(--text-faint)]">Network: {appChain.name}</p>
      </div>
    </div>
  );
}
