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
  executeStealthSend,
  type StealthSendResult,
} from '@/lib/stealth/sendStealth';
import {
  Send,
  Loader2,
  AlertCircle,
  CheckCircle,
  EyeOff,
  ArrowDown,
  User,
  Wallet,
  ExternalLink,
  Shield,
  Lock,
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
  const [result, setResult] = useState<StealthSendResult | null>(null);
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
      setStatusMsg('Preparing ERC-5564 stealth transfer…');
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

      const data = await executeStealthSend({
        fromWallet,
        toWallet,
        amount,
        chainId: expectedChainId,
        sendTransactionAsync,
        writeContractAsync: writeContractAsync as never,
        onStatus: (msg) => {
          setStatusMsg(msg);
          if (msg.includes('Confirm') || msg.includes('funding')) setPhase('awaiting_wallet');
          else if (msg.includes('Waiting')) setPhase('confirming');
          else if (msg.includes('announce') || msg.includes('Recording'))
            setPhase('announcing');
          else if (msg.includes('Deriving') || msg.includes('Looking'))
            setPhase('preparing');
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
        `Private A→B send complete: ${amount} ETH → stealth for ${truncAddr(toWallet)}`
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
          <h2 className="text-lg font-semibold text-[var(--text)]">Private transfer A→B</h2>
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md bg-violet-50 text-violet-800 border border-violet-200">
            ERC-5564 stealth
          </span>
        </div>
        <p className="text-sm text-[var(--text-muted)] mb-5 leading-relaxed">
          Send ETH to a <strong>recipient-bound stealth address</strong> derived from B&apos;s
          meta-keys. Only B can scan and claim — no claim code, no server spend key.
        </p>

        {!isRealWallet && (
          <div className="mb-4 p-3 rounded-lg rh-alert-info text-xs text-[var(--text-muted)]">
            Connect a <strong className="text-[var(--text)]">real wallet</strong> to send on-chain.
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
            You (A)
          </span>
          <span className="text-[var(--text-faint)]">—— stealth ECDH ——▶</span>
          <span className="px-3 py-1.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200">
            Recipient (B)
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="rh-label flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5" /> From — your wallet
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
              <User className="w-3.5 h-3.5" /> To — recipient (must enable Receive)
            </label>
            <input
              type="text"
              value={toWallet}
              onChange={(e) => {
                setToWallet(e.target.value.trim());
                setErrors((p) => ({ ...p, to: '' }));
              }}
              placeholder="0x… registered private receive wallet"
              className={`rh-input font-mono ${errors.to ? 'rh-input-error' : ''}`}
              disabled={busy}
            />
            {errors.to && <p className="text-red-600 text-xs mt-1">{errors.to}</p>}
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

          <div className="flex items-start gap-2 p-3 rh-alert-info">
            <Lock className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
            <div className="text-[11px] text-[var(--text-muted)] leading-relaxed space-y-1">
              <p>
                <strong className="text-[var(--text)]">Private A→B (stealth):</strong> ECDH from
                B&apos;s viewing key → unique stealth address. B alone derives the spend key.
              </p>
              <p className="text-[var(--text-faint)]">
                Public chain limit: your address + amount stay visible on the funding tx. Not a ZK
                shield for amounts.
              </p>
            </div>
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
            {busy ? 'Sending…' : 'Send ETH privately (A→B stealth)'}
          </button>
        </form>

        {result?.success && (
          <div className="mt-5 p-4 rounded-xl rh-alert-success space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <CheckCircle className="w-4 h-4" />
              Private A→B stealth send complete
            </div>
            <div className="text-xs space-y-1.5 font-mono text-emerald-900/90">
              <div>
                <span className="text-emerald-700/70">From </span>
                {truncAddr(result.from_address)}
              </div>
              <div>
                <span className="text-emerald-700/70">To (recipient) </span>
                {truncAddr(result.to_address)}
              </div>
              <div>
                <span className="text-emerald-700/70">Amount </span>
                {result.amount} ETH
              </div>
              <div className="break-all pt-1 border-t border-emerald-200">
                <span className="text-emerald-700/70">Stealth address (B-only claim) </span>
                <br />
                {result.stealth_address}
              </div>
              <div className="break-all">
                <span className="text-emerald-700/70">Scheme </span>
                {result.scheme}
              </div>
            </div>
            {txLink && (
              <a
                href={txLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 underline"
              >
                View funding tx <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <p className="text-[11px] text-emerald-800/80 pt-1 flex items-start gap-1.5">
              <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                No claim code to share. Recipient opens <strong>Scanner</strong> with their Receive
                vault and claims via <strong>Relayer</strong>.
              </span>
            </p>
          </div>
        )}

        {(sendMutation.isError || phase === 'error') && (
          <div className="mt-4 p-3 rounded-lg rh-alert-error flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="text-xs text-[var(--danger-text)]">
              {(sendMutation.error as Error)?.message ||
                'Transfer failed. Recipient must enable private receive first.'}
            </div>
          </div>
        )}
      </div>

      <div className="rh-card p-5">
        <h3 className="text-sm font-semibold text-[var(--text)] mb-3 flex items-center gap-2">
          <EyeOff className="w-4 h-4" /> How private A→B works
        </h3>
        <ol className="text-sm text-[var(--text-muted)] space-y-2 list-decimal pl-4 leading-relaxed">
          <li>
            B enables <strong className="text-[var(--text-secondary)]">Receive</strong> (meta-keys
            in browser + API pubkeys).
          </li>
          <li>
            A enters B&apos;s address → app ECDH-derives a one-time stealth address for B.
          </li>
          <li>A funds that stealth address on-chain (real ETH).</li>
          <li>
            B scans with viewing key → derives spend key → claims (no Alice claim code).
          </li>
        </ol>
        <p className="text-[11px] text-[var(--text-faint)] mt-3">
          Network: {appChain.name} (chain {appChain.id}) · Messenger optional on-chain announce
        </p>
        <div className="mt-3 pt-3 border-t border-[var(--border)]">
          <FaucetLinks variant="inline" />
        </div>
      </div>
    </div>
  );
}
