'use client';

import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  useBalance,
  useReadContract,
  useSendTransaction,
  useWriteContract,
  useSwitchChain,
} from 'wagmi';
import { waitForTransactionReceipt } from 'wagmi/actions';
import { parseEther, parseUnits, isAddress, formatEther, formatUnits } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { api, getAuthMode, getStoredToken, getStoredWallet } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useSessionWallet } from '@/hooks/useSessionWallet';
import {
  TOKENS,
  DEFAULT_TOKEN,
  truncAddr,
  toWeiString,
  NATIVE_ETH_ADDRESS,
  TOKEN_META,
} from '@/lib/tokens';
import { FEE_COPY } from '@/lib/fees';
import { explorerTxUrl } from '@/lib/explorer';
import { appChain, wagmiConfig } from '@/lib/wagmi';
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
} from 'lucide-react';

const ERC20_ABI = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const;

interface AnnounceResponse {
  success?: boolean;
  stealth_address?: string;
  from_address?: string;
  to_address?: string;
  amount?: string;
  message?: string;
  mode?: string;
  funded_on_chain?: boolean;
  funding_tx_hash?: string;
  tx_hash?: string;
}

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
  const [token, setToken] = useState(DEFAULT_TOKEN);
  const [amount, setAmount] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<SendPhase>('idle');
  const [result, setResult] = useState<AnnounceResponse | null>(null);
  const [fundingTx, setFundingTx] = useState<`0x${string}` | undefined>();
  const [statusMsg, setStatusMsg] = useState('');

  const fromWallet = sessionWallet || '';
  const isEth = token === 'ETH';
  const isRealWallet = source === 'wallet' && Boolean(fromWallet);
  const walletAddr =
    fromWallet && isAddress(fromWallet) ? (fromWallet as `0x${string}`) : undefined;
  const tokenAddr =
    !isEth && TOKENS[token] && isAddress(TOKENS[token])
      ? (TOKENS[token] as `0x${string}`)
      : undefined;
  const tokenDecimals = TOKEN_META[token]?.decimals ?? 18;

  // wagmi v3 useBalance is native ETH only — ERC-20 via balanceOf
  const { data: ethBalance, refetch: refetchEth } = useBalance({
    address: walletAddr,
    chainId: expectedChainId,
    query: { enabled: Boolean(walletAddr) },
  });

  const {
    data: erc20Raw,
    refetch: refetchToken,
  } = useReadContract({
    address: tokenAddr,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: walletAddr ? [walletAddr] : undefined,
    chainId: expectedChainId,
    query: { enabled: Boolean(walletAddr && tokenAddr) },
  });

  const balance = useMemo(() => {
    if (isEth) {
      if (!ethBalance) return null;
      return {
        value: ethBalance.value,
        decimals: ethBalance.decimals,
        symbol: ethBalance.symbol || 'ETH',
        formatted: formatEther(ethBalance.value),
      };
    }
    if (erc20Raw === undefined) return null;
    const value = erc20Raw as bigint;
    return {
      value,
      decimals: tokenDecimals,
      symbol: token,
      formatted: formatUnits(value, tokenDecimals),
    };
  }, [isEth, ethBalance, erc20Raw, token, tokenDecimals]);

  const balanceLabel = useMemo(() => {
    if (!balance) return '—';
    const n = Number(balance.formatted);
    if (!Number.isFinite(n)) return `${balance.formatted} ${balance.symbol}`;
    return `${n.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${balance.symbol}`;
  }, [balance]);

  const { sendTransactionAsync, isPending: isSendingNative } = useSendTransaction();
  const { writeContractAsync, isPending: isSendingToken } = useWriteContract();

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
          'Connect a real wallet (MetaMask / WalletConnect) to send real ETH. Operator/demo profiles cannot fund on-chain.'
        );
      }
      if (!isAddress(toWallet)) {
        throw new Error('Enter a valid recipient address');
      }
      if (fromWallet.toLowerCase() === toWallet.toLowerCase()) {
        throw new Error('Sender and recipient must be different');
      }
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) {
        throw new Error('Enter an amount greater than 0');
      }

      setPhase('preparing');
      setStatusMsg('Preparing one-time private address…');
      setResult(null);

      try {
        await switchChainAsync({ chainId: expectedChainId });
      } catch {
        throw new Error(`Switch wallet network to ${chainName} (chain ${expectedChainId})`);
      }

      await ensureAuth(fromWallet);

      const claimPrivateKey = generatePrivateKey();
      const stealthAccount = privateKeyToAccount(claimPrivateKey);
      const stealthAddress = stealthAccount.address;

      setPhase('awaiting_wallet');
      setStatusMsg('Confirm the transfer in your wallet…');

      let hash: `0x${string}`;
      if (isEth) {
        hash = await sendTransactionAsync({
          chainId: expectedChainId,
          to: stealthAddress,
          value: parseEther(amount),
        });
      } else {
        const tokenAddr = TOKENS[token] as `0x${string}`;
        if (!tokenAddr || tokenAddr.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase()) {
          throw new Error('Unknown token contract');
        }
        const decimals = balance?.decimals ?? tokenDecimals;
        hash = await writeContractAsync({
          chainId: expectedChainId,
          address: tokenAddr,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [stealthAddress, parseUnits(amount, decimals)],
        });
      }

      setFundingTx(hash);
      setPhase('confirming');
      setStatusMsg('Waiting for on-chain confirmation…');

      const receipt = await waitForTransactionReceipt(wagmiConfig, {
        hash,
        chainId: expectedChainId,
        confirmations: 1,
      });
      if (receipt.status !== 'success') {
        throw new Error('On-chain transfer failed / reverted');
      }

      setPhase('announcing');
      setStatusMsg('Recording private payment for recipient…');

      const eph = generatePrivateKey();
      const body = {
        stealth_address: stealthAddress.toLowerCase(),
        caller: fromWallet.toLowerCase(),
        to_address: toWallet.toLowerCase(),
        ephemeral_pubkey: eph,
        token_address: isEth ? NATIVE_ETH_ADDRESS : TOKENS[token],
        amount: toWeiString(amount),
        block_number: Number(receipt.blockNumber),
        funding_tx_hash: hash,
        claim_private_key: claimPrivateKey,
        metadata: {
          token_symbol: token,
          private_transfer: true,
          real_transfer: true,
          funded_on_chain: true,
        },
      };

      const ann = await api<AnnounceResponse>('/api/announce', 'POST', body, {
        auth: true,
        wallet: fromWallet,
      });
      if (!ann?.success) {
        throw new Error(
          'On-chain transfer succeeded but announce failed — save this tx hash: ' + hash
        );
      }
      return { ...ann, funding_tx_hash: hash, funded_on_chain: true };
    },
    onSuccess: (data) => {
      setPhase('done');
      setStatusMsg('');
      setResult(data);
      showToast(
        'success',
        `Real private send complete: ${amount} ${token} → ${truncAddr(toWallet)}`
      );
      refetchEth();
      refetchToken();
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
    else if (balance) {
      try {
        const need = isEth
          ? parseEther(amount)
          : parseUnits(amount, balance.decimals);
        if (need > balance.value) {
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
    if (!balance) return;
    if (isEth) {
      const gasReserve = parseEther('0.00005');
      const zero = BigInt(0);
      const v = balance.value > gasReserve ? balance.value - gasReserve : zero;
      const s = formatEther(v);
      setAmount(s.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '') || '0');
    } else {
      // trim trailing zeros for cleaner input
      const n = Number(balance.formatted);
      setAmount(
        Number.isFinite(n)
          ? String(n).replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '')
          : balance.formatted
      );
    }
    setErrors((p) => ({ ...p, amount: '' }));
  };

  const busy =
    sendMutation.isPending ||
    isSendingNative ||
    isSendingToken ||
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
          <h2 className="text-lg font-semibold text-[var(--text)]">Private transfer</h2>
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
            Real on-chain
          </span>
        </div>
        <p className="text-sm text-[var(--text-muted)] mb-5 leading-relaxed">
          Pick a recipient and amount. Your wallet sends real {token} to a one-time private
          address — then the recipient claims it into their wallet.
        </p>

        {!isRealWallet && (
          <div className="mb-4 p-3 rounded-lg rh-alert-info text-xs text-[var(--text-muted)]">
            Connect a <strong className="text-[var(--text)]">real wallet</strong> (MetaMask /
            WalletConnect) to send. Operator Alice/Bob profiles cannot fund on-chain.
            <button
              type="button"
              onClick={() => connectWallet().catch(() => {})}
              className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)]"
            >
              <Wallet className="w-3.5 h-3.5" /> Connect wallet
            </button>
          </div>
        )}

        {wrongChain && (
          <div className="mb-4 p-3 rounded-lg rh-alert-error text-xs">
            Switch wallet network to <strong>{chainName}</strong> (chain {expectedChainId}).
          </div>
        )}

        <div className="mb-6 flex items-center justify-center gap-2 text-xs font-medium">
          <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
            You
          </span>
          <span className="text-[var(--text-faint)]">—— private ——▶</span>
          <span className="px-3 py-1.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200">
            Recipient
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
              <User className="w-3.5 h-3.5" /> To — recipient wallet
            </label>
            <input
              type="text"
              value={toWallet}
              onChange={(e) => {
                setToWallet(e.target.value.trim());
                setErrors((p) => ({ ...p, to: '' }));
              }}
              placeholder="0x… wallet receiving funds"
              className={`rh-input font-mono ${errors.to ? 'rh-input-error' : ''}`}
              disabled={busy}
            />
            {errors.to && <p className="text-red-600 text-xs mt-1">{errors.to}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="rh-label">Asset</label>
              <select
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="rh-input"
                disabled={busy}
              >
                <option value="ETH">ETH · Ether</option>
                <option value="SILENT">SILENT</option>
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="rh-label">Amount</label>
                <button
                  type="button"
                  onClick={setMax}
                  disabled={!balance || busy}
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
              {errors.amount && (
                <p className="text-red-600 text-xs mt-1">{errors.amount}</p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 rh-alert-info">
            <EyeOff className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
            <div className="text-[11px] text-[var(--text-muted)] leading-relaxed space-y-1">
              <p>
                <strong className="text-[var(--text)]">Real send:</strong> wallet signs a
                transfer to a one-time address. Chain sees payment to a fresh address — not a
                direct public transfer to the recipient.
              </p>
              <p className="text-[var(--text-faint)]">{FEE_COPY.send}</p>
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
            {busy ? 'Sending…' : `Send ${token} privately`}
          </button>
        </form>

        {result?.success && (
          <div className="mt-5 p-4 rounded-xl rh-alert-success space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <CheckCircle className="w-4 h-4" />
              {result.funded_on_chain ? 'On-chain private send complete' : 'Transfer recorded'}
            </div>
            <div className="text-xs space-y-1.5 font-mono text-emerald-900/90">
              <div>
                <span className="text-emerald-700/70">From </span>
                {truncAddr(result.from_address || fromWallet)}
              </div>
              <div>
                <span className="text-emerald-700/70">To </span>
                {truncAddr(result.to_address || toWallet)}
              </div>
              <div>
                <span className="text-emerald-700/70">Amount </span>
                {amount} {token}
              </div>
              <div className="break-all pt-1 border-t border-emerald-200">
                <span className="text-emerald-700/70">One-time private address </span>
                <br />
                {result.stealth_address}
              </div>
              {(result.funding_tx_hash || result.tx_hash) && (
                <div className="break-all">
                  <span className="text-emerald-700/70">Funding tx </span>
                  <br />
                  {result.funding_tx_hash || result.tx_hash}
                </div>
              )}
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
            <p className="text-[11px] text-emerald-800/80 pt-1">
              Recipient: open <strong>Scanner</strong> with their wallet →{' '}
              <strong>Relayer</strong> to claim funds into their address.
            </p>
          </div>
        )}

        {(sendMutation.isError || phase === 'error') && (
          <div className="mt-4 p-3 rounded-lg rh-alert-error flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="text-xs text-[var(--danger-text)]">
              {(sendMutation.error as Error)?.message ||
                'Transfer failed. Check balance, network, and try again.'}
            </div>
          </div>
        )}
      </div>

      <div className="rh-card p-5">
        <h3 className="text-sm font-semibold text-[var(--text)] mb-3">How it works</h3>
        <ol className="text-sm text-[var(--text-muted)] space-y-2 list-decimal pl-4 leading-relaxed">
          <li>
            Connect wallet → enter <strong className="text-[var(--text-secondary)]">To</strong>{' '}
            + amount → confirm in wallet (real chain tx).
          </li>
          <li>
            Funds land on a <strong className="text-[var(--text-secondary)]">one-time</strong>{' '}
            address (not the recipient&apos;s public wallet).
          </li>
          <li>
            Recipient uses <strong className="text-[var(--text-secondary)]">Scanner</strong> +{' '}
            <strong className="text-[var(--text-secondary)]">Relayer</strong> to claim into
            their wallet.
          </li>
        </ol>
        <p className="text-[11px] text-[var(--text-faint)] mt-3">
          Network: {appChain.name} (chain {appChain.id})
        </p>
      </div>
    </div>
  );
}
