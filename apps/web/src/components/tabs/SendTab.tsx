'use client';

import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  useBalance,
  useSendTransaction,
  useWriteContract,
  useSwitchChain,
} from 'wagmi';
import { parseEther, isAddress, formatEther } from 'viem';
import { getAuthMode, getStoredToken, getStoredWallet } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useSessionWallet } from '@/hooks/useSessionWallet';
import { truncAddr } from '@/lib/tokens';
import { explorerTxUrl } from '@/lib/explorer';
import { appChain } from '@/lib/wagmi';
import { switchOrAddAppChain } from '@/lib/addChain';
import NetworkSwitchBanner from '@/components/NetworkSwitchBanner';
import FaucetLinks from '@/components/FaucetLinks';
import {
  executeSendAny,
  resultLabel,
  type UnifiedSendResult,
} from '@/lib/stealth/sendAny';
import {
  Send,
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowDown,
  User,
  Wallet,
  ExternalLink,
  Shield,
} from 'lucide-react';

type SendPhase =
  | 'idle'
  | 'preparing'
  | 'awaiting_wallet'
  | 'confirming'
  | 'announcing'
  | 'done'
  | 'error';

export default function SendTab() {
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

  const [toWallet, setToWallet] = useState('');
  const [amount, setAmount] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<SendPhase>('idle');
  const [result, setResult] = useState<UnifiedSendResult | null>(null);
  const [fundingTx, setFundingTx] = useState<`0x${string}` | undefined>();
  const [statusMsg, setStatusMsg] = useState('');

  const fromWallet = sessionWallet || '';
  const isRealWallet = source === 'wallet' && Boolean(fromWallet);
  const walletAddr =
    fromWallet && isAddress(fromWallet) ? (fromWallet as `0x${string}`) : undefined;

  const { data: ethBalance, refetch: refetchEth } = useBalance({
    address: walletAddr,
    chainId: expectedChainId,
    query: { enabled: Boolean(walletAddr) },
  });

  const balanceLabel = useMemo(() => {
    if (!ethBalance) return '—';
    const n = Number(formatEther(ethBalance.value));
    if (!Number.isFinite(n)) return `${formatEther(ethBalance.value)} ETH`;
    return `${n.toLocaleString(undefined, { maximumFractionDigits: 6 })} ETH`;
  }, [ethBalance]);

  const { sendTransactionAsync, isPending: isSendingNative } = useSendTransaction();
  const { writeContractAsync, isPending: isWriting } = useWriteContract();

  const ensureAuth = async (addr: string) => {
    const mode = getAuthMode();
    const stored = getStoredWallet();
    const tokenJwt = getStoredToken();
    if (tokenJwt && stored === addr.toLowerCase() && mode === 'siwe') return;
    if (needsSiwe || mode !== 'siwe' || stored !== addr.toLowerCase()) {
      await signInWithEthereum();
    }
  };

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!fromWallet || !isAddress(fromWallet)) {
        throw new Error('Connect a wallet first');
      }
      if (source !== 'wallet') {
        throw new Error(
          'Connect a real wallet (MetaMask / WalletConnect) for on-chain private send.'
        );
      }
      if (!isAddress(toWallet)) throw new Error('Enter a valid recipient address');
      if (fromWallet.toLowerCase() === toWallet.toLowerCase()) {
        throw new Error('Sender and recipient must be different');
      }
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) {
        throw new Error('Enter an amount greater than 0');
      }

      setPhase('preparing');
      setStatusMsg('Preparing private transfer…');
      setResult(null);

      try {
        await switchOrAddAppChain({
          currentChainId: undefined,
          switchChain: (args) => switchChainAsync(args),
        });
      } catch (e) {
        throw new Error(
          e instanceof Error
            ? e.message
            : `Add / switch wallet network to ${chainName} (chain ${expectedChainId})`
        );
      }

      await ensureAuth(fromWallet);
      setPhase('awaiting_wallet');

      const data = await executeSendAny({
        fromWallet,
        toWallet,
        amount,
        chainId: expectedChainId,
        sendTransactionAsync,
        writeContractAsync: writeContractAsync as never,
        onStatus: (msg) => {
          setStatusMsg(msg);
          if (msg.includes('Confirm') || msg.includes('funding') || msg.includes('Sending'))
            setPhase('awaiting_wallet');
          else if (msg.includes('Waiting')) setPhase('confirming');
          else if (msg.includes('Recording') || msg.includes('announce'))
            setPhase('announcing');
          else setPhase('preparing');
        },
      });
      setFundingTx(data.funding_tx_hash as `0x${string}`);
      return data;
    },
    onSuccess: (data) => {
      setPhase('done');
      setStatusMsg('');
      setResult(data);
      showToast(
        'success',
        data.path === 'stealth'
          ? `Stealth send done → ${truncAddr(toWallet)}`
          : `Private send done → ${truncAddr(toWallet)} (they just claim)`
      );
      refetchEth();
    },
    onError: (e: Error) => {
      setPhase('error');
      setStatusMsg('');
      setResult(null);
      const msg = e.message || 'Private transfer failed';
      if (/user rejected|denied|reject/i.test(msg)) {
        showToast('error', 'Wallet rejected the transaction');
      } else {
        showToast('error', msg);
      }
    },
  });

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!fromWallet) errs.from = 'Connect your wallet first';
    else if (!isAddress(fromWallet)) errs.from = 'Invalid sender wallet';
    if (!toWallet) errs.to = 'Enter the recipient wallet address';
    else if (!isAddress(toWallet)) errs.to = 'Recipient address must start with 0x';
    else if (fromWallet && fromWallet.toLowerCase() === toWallet.toLowerCase())
      errs.to = 'Sender and recipient must be different accounts';
    if (!amount) errs.amount = 'Enter an amount';
    else if (isNaN(Number(amount)) || Number(amount) <= 0)
      errs.amount = 'Amount must be greater than 0';
    else if (ethBalance) {
      try {
        const need = parseEther(amount);
        if (need > ethBalance.value) {
          errs.amount = `Insufficient balance (have ${balanceLabel})`;
        }
      } catch {
        errs.amount = 'Invalid amount';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (!isRealWallet) {
      try {
        await connectWallet();
      } catch {
        showToast('error', 'Connect a real wallet to send on-chain');
        return;
      }
    }
    sendMutation.mutate();
  };

  const setMax = () => {
    if (!ethBalance) return;
    const gasReserve = parseEther('0.00008');
    const zero = BigInt(0);
    const v = ethBalance.value > gasReserve ? ethBalance.value - gasReserve : zero;
    const s = formatEther(v);
    setAmount(s.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '') || '0');
    setErrors((p) => ({ ...p, amount: '' }));
  };

  const busy =
    sendMutation.isPending ||
    isSendingNative ||
    isWriting ||
    phase === 'awaiting_wallet' ||
    phase === 'confirming' ||
    phase === 'announcing' ||
    phase === 'preparing';

  const txLink = result?.funding_tx_hash
    ? explorerTxUrl(result.funding_tx_hash)
    : fundingTx
      ? explorerTxUrl(fundingTx)
      : null;

  return (
    <div className="max-w-lg space-y-6">
      <div className="rh-card p-6">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h2 className="text-lg font-semibold text-[var(--text)]">Send privately</h2>
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
            Any address
          </span>
        </div>
        <p className="text-sm text-[var(--text-muted)] mb-5 leading-relaxed">
          Enter their wallet and amount. They do <strong>not</strong> need to set anything up
          first — they just open Scanner and claim.
        </p>

        {!isRealWallet && (
          <div className="mb-4 p-3 rounded-lg rh-alert-info text-xs text-[var(--text-muted)]">
            Connect a <strong className="text-[var(--text)]">real wallet</strong> to send.
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
            <FaucetLinks variant="card" title="Wallet balance is 0 — get test ETH" />
          </div>
        )}

        <div className="mb-6 flex items-center justify-center gap-2 text-xs font-medium">
          <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
            You
          </span>
          <span className="text-[var(--text-faint)]">—— private ——▶</span>
          <span className="px-3 py-1.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200">
            Anyone (0x…)
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="rh-label flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5" /> From
            </label>
            <div className="rh-input font-mono bg-black/[0.03] text-[var(--text-muted)] flex items-center justify-between gap-2">
              <span className="truncate">
                {fromWallet ? truncAddr(fromWallet, 8, 6) : 'Not connected'}
              </span>
              {fromWallet && (
                <span className="text-[11px] font-sans font-medium text-[var(--text)] shrink-0">
                  {balanceLabel}
                </span>
              )}
            </div>
            {errors.from && <p className="text-red-600 text-xs mt-1">{errors.from}</p>}
          </div>

          <div className="flex justify-center text-[var(--text-faint)]">
            <ArrowDown className="w-5 h-5" />
          </div>

          <div>
            <label className="rh-label flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> To — any wallet
            </label>
            <input
              type="text"
              value={toWallet}
              onChange={(e) => {
                setToWallet(e.target.value.trim());
                setErrors((p) => ({ ...p, to: '' }));
              }}
              placeholder="0x… friend or any address"
              className={`rh-input font-mono ${errors.to ? 'rh-input-error' : ''}`}
              disabled={busy}
            />
            {errors.to && <p className="text-red-600 text-xs mt-1">{errors.to}</p>}
            <p className="text-[11px] text-[var(--text-faint)] mt-1.5">
              No need for them to enable Receive first.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="rh-label">Amount (ETH)</label>
              <button
                type="button"
                onClick={setMax}
                disabled={!ethBalance || busy}
                className="text-[11px] font-semibold text-[var(--accent)] disabled:opacity-40"
              >
                Max
              </button>
            </div>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setErrors((p) => ({ ...p, amount: '' }));
              }}
              placeholder="0.01"
              className={`rh-input font-mono ${errors.amount ? 'rh-input-error' : ''}`}
              disabled={busy}
            />
            {errors.amount && <p className="text-red-600 text-xs mt-1">{errors.amount}</p>}
          </div>

          <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] text-[11px] text-[var(--text-muted)] leading-relaxed space-y-1">
            <p>
              <strong className="text-[var(--text)]">Auto path:</strong> if they already turned
              on private receive → stronger stealth. Otherwise → simple private send (they only
              claim).
            </p>
          </div>

          {statusMsg && (
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {statusMsg}
            </div>
          )}

          <button type="submit" disabled={busy || wrongChain} className="rh-btn-primary">
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {busy ? 'Sending…' : 'Send privately'}
          </button>
        </form>

        {result?.success && (
          <div className="mt-5 p-4 rounded-xl rh-alert-success space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <CheckCircle className="w-4 h-4" />
              Private send complete
            </div>
            <p className="text-xs text-emerald-900/90">{resultLabel(result)}</p>
            <div className="text-xs space-y-1.5 font-mono text-emerald-900/90">
              <div>
                <span className="text-emerald-700/70">To </span>
                {truncAddr(result.to_address)}
              </div>
              <div>
                <span className="text-emerald-700/70">Amount </span>
                {result.amount} ETH
              </div>
              <div className="break-all pt-1 border-t border-emerald-200">
                <span className="text-emerald-700/70">One-time address </span>
                <br />
                {result.stealth_address}
              </div>
            </div>
            {txLink && (
              <a
                href={txLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 underline"
              >
                View on explorer <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <p className="text-[11px] text-emerald-800/80 pt-1 flex items-start gap-1.5">
              <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                Tell them: open SilentTransfer → connect this wallet →{' '}
                <strong>Scanner</strong> → <strong>Claim</strong>. No setup required for simple
                path.
              </span>
            </p>
          </div>
        )}

        {(sendMutation.isError || phase === 'error') && (
          <div className="mt-4 p-3 rounded-lg rh-alert-error flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="text-xs text-[var(--danger-text)]">
              {(sendMutation.error as Error)?.message || 'Transfer failed. Try again.'}
            </div>
          </div>
        )}
      </div>

      <div className="rh-card p-5">
        <h3 className="text-sm font-semibold text-[var(--text)] mb-3">3 steps</h3>
        <ol className="text-sm text-[var(--text-muted)] space-y-2 list-decimal pl-4 leading-relaxed">
          <li>You connect wallet and enter their 0x address + amount.</li>
          <li>Confirm in MetaMask (real on-chain private destination).</li>
          <li>
            They open the console, connect the same wallet, scan, and claim.
          </li>
        </ol>
        <p className="text-[11px] text-[var(--text-faint)] mt-3">
          Network: {appChain.name} · Optional: they can enable Receive later for stronger stealth
          next time.
        </p>
        <div className="mt-3 pt-3 border-t border-[var(--border)]">
          <FaucetLinks variant="inline" />
        </div>
      </div>
    </div>
  );
}
