'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useBalance, useReadContract, useWriteContract, useSwitchChain } from 'wagmi';
import { isAddress, formatEther, parseEther } from 'viem';
import { useToast } from '@/components/Toast';
import { useSessionWallet } from '@/hooks/useSessionWallet';
import { explorerTxUrl } from '@/lib/explorer';
import { switchOrAddAppChain } from '@/lib/addChain';
import NetworkSwitchBanner from '@/components/NetworkSwitchBanner';
import FaucetLinks from '@/components/FaucetLinks';
import { truncAddr } from '@/lib/tokens';
import {
  getUserVaultAddress,
  USER_VAULT_ABI,
  depositToVault,
  withdrawFromVault,
  withdrawManyFromVault,
  parseRecipientLines,
  sumLinesEth,
} from '@/lib/userVault';
import {
  Loader2,
  Wallet,
  ArrowDownToLine,
  Send,
  Users,
  User,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';

type Mode = 'deposit' | 'send';
type SendMode = 'one' | 'many';

export default function PrivateVaultTab() {
  const { showToast } = useToast();
  const {
    wallet,
    ensureLiveWallet,
    connectWallet,
    isWagmiConnected,
    wrongChain,
    expectedChainId,
  } = useSessionWallet();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, isPending: writing } = useWriteContract();

  const [mode, setMode] = useState<Mode>('deposit');
  const [sendMode, setSendMode] = useState<SendMode>('one');
  const [depositAmt, setDepositAmt] = useState('');
  const [toOne, setToOne] = useState('');
  const [amountOne, setAmountOne] = useState('');
  const [rawMany, setRawMany] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [lastTx, setLastTx] = useState<string | null>(null);

  const vault = getUserVaultAddress();
  const live = isWagmiConnected && Boolean(wallet);
  const walletAddr =
    wallet && isAddress(wallet) ? (wallet as `0x${string}`) : undefined;

  const { data: ethBalance, refetch: refetchEth } = useBalance({
    address: walletAddr,
    chainId: expectedChainId,
    query: { enabled: Boolean(walletAddr) },
  });

  const {
    data: vaultBal,
    refetch: refetchVault,
    isFetching: vaultLoading,
  } = useReadContract({
    address: vault,
    abi: USER_VAULT_ABI,
    functionName: 'balanceOf',
    args: walletAddr ? [walletAddr] : undefined,
    chainId: expectedChainId,
    query: { enabled: Boolean(vault && walletAddr) },
  });

  const { data: feeBps } = useReadContract({
    address: vault,
    abi: USER_VAULT_ABI,
    functionName: 'feeBps',
    chainId: expectedChainId,
    query: { enabled: Boolean(vault) },
  });

  const vaultEth = vaultBal !== undefined ? formatEther(vaultBal as bigint) : '0';
  const feePct = feeBps !== undefined ? Number(feeBps) / 100 : 0.5;

  const many = useMemo(() => parseRecipientLines(rawMany), [rawMany]);
  const manyTotal = sumLinesEth(many.lines);

  const prepare = async () => {
    const addr = await ensureLiveWallet();
    await switchOrAddAppChain({
      currentChainId: undefined,
      switchChain: (args) => switchChainAsync(args),
    });
    return addr;
  };

  const depositMut = useMutation({
    mutationFn: async () => {
      await prepare();
      if (!depositAmt || !(Number(depositAmt) > 0)) throw new Error('Enter deposit amount');
      const hash = await depositToVault({
        chainId: expectedChainId,
        amountEth: depositAmt,
        writeContractAsync: writeContractAsync as never,
        onStatus: setStatusMsg,
      });
      return hash;
    },
    onSuccess: (hash) => {
      setStatusMsg('');
      setLastTx(hash);
      setDepositAmt('');
      showToast('success', 'Deposited to your private vault');
      refetchEth();
      refetchVault();
    },
    onError: (e: Error) => {
      setStatusMsg('');
      const m = e.message || 'Deposit failed';
      showToast('error', /reject|denied/i.test(m) ? 'Wallet rejected' : m);
    },
  });

  const sendMut = useMutation({
    mutationFn: async () => {
      await prepare();
      if (sendMode === 'one') {
        if (!isAddress(toOne)) throw new Error('Invalid address');
        if (!amountOne || !(Number(amountOne) > 0)) throw new Error('Invalid amount');
        const need = parseEther(amountOne);
        if (vaultBal !== undefined && need > (vaultBal as bigint)) {
          throw new Error('Not enough vault balance — deposit more first');
        }
        return withdrawFromVault({
          chainId: expectedChainId,
          to: toOne,
          amountEth: amountOne,
          writeContractAsync: writeContractAsync as never,
          onStatus: setStatusMsg,
        });
      }
      if (many.errors.length) throw new Error(many.errors[0]);
      if (!many.lines.length) throw new Error('Add recipients');
      const need = parseEther(String(manyTotal));
      if (vaultBal !== undefined && need > (vaultBal as bigint)) {
        throw new Error('Not enough vault balance for this batch');
      }
      return withdrawManyFromVault({
        chainId: expectedChainId,
        lines: many.lines,
        writeContractAsync: writeContractAsync as never,
        onStatus: setStatusMsg,
      });
    },
    onSuccess: (hash) => {
      setStatusMsg('');
      setLastTx(hash);
      showToast(
        'success',
        'Sent — recipients already have ETH in their wallets (no claim)'
      );
      setAmountOne('');
      refetchVault();
    },
    onError: (e: Error) => {
      setStatusMsg('');
      const m = e.message || 'Send failed';
      showToast('error', /reject|denied/i.test(m) ? 'Wallet rejected' : m);
    },
  });

  const busy = writing || depositMut.isPending || sendMut.isPending;
  const txLink = lastTx ? explorerTxUrl(lastTx) : null;

  return (
    <div className="space-y-5">
      {/* Balance card */}
      <div className="rh-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
              Your private vault
            </p>
            <p className="text-2xl font-semibold text-[var(--text)] mt-1 font-mono">
              {vaultLoading ? '…' : Number(vaultEth).toLocaleString(undefined, { maximumFractionDigits: 6 })}{' '}
              <span className="text-base font-medium text-[var(--text-muted)]">ETH</span>
            </p>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">
              Controlled by your connected wallet — wallet is the key, no note backup.
            </p>
          </div>
          <button
            type="button"
            onClick={() => refetchVault()}
            className="p-2 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${vaultLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {!vault && (
          <p className="text-xs text-amber-800 mt-3 bg-amber-50 border border-amber-100 rounded-lg p-2">
            Vault address not set. Deploy SilentUserVault and set NEXT_PUBLIC_USER_VAULT_ADDRESS.
          </p>
        )}
      </div>

      {/* Deposit | Send */}
      <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-[var(--bg-muted)] border border-[var(--border)]">
        <button
          type="button"
          onClick={() => setMode('deposit')}
          className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold ${
            mode === 'deposit'
              ? 'bg-white shadow-sm border border-emerald-100 text-emerald-900'
              : 'text-[var(--text-muted)]'
          }`}
        >
          <ArrowDownToLine className="w-4 h-4" /> Deposit
        </button>
        <button
          type="button"
          onClick={() => setMode('send')}
          className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold ${
            mode === 'send'
              ? 'bg-white shadow-sm border border-emerald-100 text-emerald-900'
              : 'text-[var(--text-muted)]'
          }`}
        >
          <Send className="w-4 h-4" /> Send
        </button>
      </div>

      <div className="rh-card p-6 space-y-4">
        {!live && (
          <button
            type="button"
            onClick={() => connectWallet().catch(() => {})}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-semibold"
          >
            <Wallet className="w-4 h-4" /> Connect wallet
          </button>
        )}
        {wrongChain && <NetworkSwitchBanner variant="full" />}
        {live && ethBalance && ethBalance.value === BigInt(0) && mode === 'deposit' && (
          <FaucetLinks variant="card" title="Get test ETH to deposit" />
        )}

        {mode === 'deposit' ? (
          <>
            <div>
              <h2 className="text-lg font-semibold text-[var(--text)]">Add funds to vault</h2>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                Deposit from your wallet into the private vault. Later send any amount, any time,
                to anyone — they get paid automatically.
              </p>
            </div>
            <div>
              <label className="rh-label">Amount (ETH)</label>
              <input
                className="rh-input font-mono"
                value={depositAmt}
                onChange={(e) => setDepositAmt(e.target.value)}
                placeholder="0.1"
                inputMode="decimal"
                disabled={busy}
              />
              {feePct > 0 && depositAmt && Number(depositAmt) > 0 && (
                <p className="text-[11px] text-[var(--text-faint)] mt-1.5">
                  Fee {feePct}% · ~{(Number(depositAmt) * (1 - feePct / 100)).toFixed(6)} ETH
                  credited to your vault
                </p>
              )}
            </div>
            <button
              type="button"
              disabled={busy || !vault || wrongChain}
              onClick={() => depositMut.mutate()}
              className="rh-btn-primary w-full py-3.5"
            >
              {depositMut.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowDownToLine className="w-4 h-4" />
              )}
              {depositMut.isPending ? 'Depositing…' : 'Deposit to vault'}
            </button>
          </>
        ) : (
          <>
            <div>
              <h2 className="text-lg font-semibold text-[var(--text)]">Send from vault</h2>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                Pay any wallet from your vault balance. They receive in MetaMask — no website, no
                claim.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSendMode('one')}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border ${
                  sendMode === 'one'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'border-[var(--border)] text-[var(--text-muted)]'
                }`}
              >
                <User className="w-3.5 h-3.5" /> One wallet
              </button>
              <button
                type="button"
                onClick={() => setSendMode('many')}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border ${
                  sendMode === 'many'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'border-[var(--border)] text-[var(--text-muted)]'
                }`}
              >
                <Users className="w-3.5 h-3.5" /> Many wallets
              </button>
            </div>

            {sendMode === 'one' ? (
              <div className="space-y-3">
                <div>
                  <label className="rh-label">To</label>
                  <input
                    className="rh-input font-mono text-sm"
                    value={toOne}
                    onChange={(e) => setToOne(e.target.value.trim())}
                    placeholder="0x…"
                    disabled={busy}
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
                  className="rh-input font-mono text-xs min-h-[120px]"
                  value={rawMany}
                  onChange={(e) => setRawMany(e.target.value)}
                  placeholder={'0xabc…,0.01\n0xdef…,0.02'}
                  disabled={busy}
                  spellCheck={false}
                />
                {many.lines.length > 0 && (
                  <p className="text-[11px] text-[var(--text-faint)] mt-1">
                    {many.lines.length} wallets · {manyTotal.toFixed(6)} ETH total
                  </p>
                )}
                {many.errors[0] && (
                  <p className="text-xs text-red-600 mt-1">{many.errors[0]}</p>
                )}
              </div>
            )}

            <button
              type="button"
              disabled={busy || !vault || wrongChain || Number(vaultEth) <= 0}
              onClick={() => sendMut.mutate()}
              className="rh-btn-primary w-full py-3.5"
            >
              {sendMut.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {sendMut.isPending
                ? 'Sending…'
                : sendMode === 'one'
                  ? 'Send privately'
                  : 'Send batch privately'}
            </button>
          </>
        )}

        {statusMsg && (
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {statusMsg}
          </div>
        )}

        {(depositMut.isError || sendMut.isError) && (
          <div className="flex gap-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {(depositMut.error as Error)?.message ||
              (sendMut.error as Error)?.message}
          </div>
        )}

        {lastTx && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-900 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold">
              <CheckCircle className="w-4 h-4" /> Done
            </div>
            {txLink && (
              <a
                href={txLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 underline font-semibold"
              >
                View transaction <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}
      </div>

      <div className="text-center text-[11px] text-[var(--text-faint)] px-2 space-y-1 leading-relaxed">
        <p>
          <strong className="text-[var(--text-muted)]">1.</strong> Deposit →{' '}
          <strong className="text-[var(--text-muted)]">2.</strong> Send anytime (pieces / batch) →{' '}
          <strong className="text-[var(--text-muted)]">3.</strong> They receive in wallet
        </p>
        {wallet && (
          <p className="font-mono text-[10px]">You {truncAddr(wallet, 6, 4)}</p>
        )}
      </div>
    </div>
  );
}
