'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  api,
  ensureDemoAuth,
  getAuthMode,
  getStoredToken,
  getStoredWallet,
  API_BASE,
} from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useSessionWallet } from '@/hooks/useSessionWallet';
import {
  TOKENS,
  TOKEN_LIST,
  DEFAULT_TOKEN,
  DEMO_WALLETS,
  truncAddr,
  toWeiString,
  formatTokenAmount,
  tokenLabel,
} from '@/lib/tokens';
import { FEE_COPY, formatFeePreview, protocolFeePercentLabel } from '@/lib/fees';
import {
  clearPendingWithdraw,
  getPendingWithdraw,
} from '@/lib/pendingWithdraw';
import { explorerTxUrl } from '@/lib/explorer';
import { Repeat, Loader2, AlertCircle, CheckCircle, History, Sparkles, ExternalLink } from 'lucide-react';
import EmptyState from '@/components/EmptyState';

interface RelayRecord {
  id: string;
  stealth_address: string;
  target_owner: string;
  fee_token: string;
  amount: string;
  status: string;
  tx_hash: string | null;
  created_at?: string;
}

interface ScanAnnouncement {
  stealth_address: string;
  amount: string;
  announce_metadata?: { token_symbol?: string };
  to_address?: string | null;
}

function humanAmount(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  if (n >= 1e15) {
    const v = n / 1e18;
    if (Math.abs(v - Math.round(v)) < 1e-9) return String(Math.round(v));
    return String(Number(v.toFixed(6)));
  }
  return String(n);
}

export default function RelayerTab() {
  const { showToast } = useToast();
  const {
    wallet: sessionWallet,
    connect,
    source,
    signInWithEthereum,
    needsSiwe,
  } = useSessionWallet();
  const [stealthAddr, setStealthAddr] = useState('');
  const [target, setTarget] = useState('');
  const [token, setToken] = useState(DEFAULT_TOKEN);
  const [amount, setAmount] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [bobBusy, setBobBusy] = useState(false);
  const [prefillNote, setPrefillNote] = useState('');
  const [lastClaimTx, setLastClaimTx] = useState<string | null>(null);
  const feePreview = formatFeePreview(amount);
  const feePct = protocolFeePercentLabel();

  // Apply session wallet only if empty
  useEffect(() => {
    if (sessionWallet && !target) setTarget(sessionWallet);
  }, [sessionWallet, target]);

  // Apply Scanner → Relayer hand-off once on mount
  useEffect(() => {
    const pending = getPendingWithdraw();
    if (!pending) return;
    setStealthAddr(pending.stealth_address);
    setTarget(pending.target_owner);
    setAmount(pending.amount);
    if (pending.token_symbol && TOKEN_LIST.includes(pending.token_symbol)) {
      setToken(pending.token_symbol);
    }
    setPrefillNote(
      `Filled from Scanner: ${truncAddr(pending.stealth_address)} · ${pending.amount} ${pending.token_symbol || 'tokens'}`
    );
    clearPendingWithdraw();
    connect(pending.target_owner).catch(() => {});
  }, [connect]);

  const ensureClaimAuth = async (addr: string) => {
    const mode = getAuthMode();
    const stored = getStoredWallet();
    const tokenJwt = getStoredToken();
    if (tokenJwt && stored === addr.toLowerCase()) {
      // Real wallet path: require SIWE when available
      if (source === 'wallet' || mode === 'siwe') {
        if (mode === 'siwe' && !needsSiwe) return;
        if (mode === 'siwe' && needsSiwe) {
          await signInWithEthereum();
          return;
        }
      }
      return;
    }
    if (source === 'wallet' || mode === 'siwe') {
      await signInWithEthereum();
      return;
    }
    await ensureDemoAuth(addr);
  };

  const { data: relayHistory, isLoading: historyLoading, refetch } = useQuery<RelayRecord[]>({
    queryKey: ['relay-history'],
    queryFn: async () => (await api<RelayRecord[]>('/api/relay/history')) || [],
  });

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      await connect(target);
      await ensureClaimAuth(target);
      return api<{ tx_hash: string; success: boolean; mode: string; message?: string }>(
        '/api/relay/withdraw',
        'POST',
        {
          stealth_address: stealthAddr.toLowerCase(),
          target_owner: target.toLowerCase(),
          fee_token: TOKENS[token] || TOKENS.ETH,
          amount: toWeiString(amount),
        },
        { auth: true, wallet: target }
      );
    },
    onSuccess: (data) => {
      if (data?.success) {
        setLastClaimTx(data.tx_hash || null);
        showToast(
          'success',
          data.mode === 'live'
            ? `Claimed on-chain: ${truncAddr(data.tx_hash || '')}`
            : `Withdrawal recorded: ${truncAddr(data.tx_hash || '')}`
        );
        setStealthAddr('');
        setAmount('');
        setPrefillNote('');
        refetch();
      } else {
        showToast('error', 'Relay withdrawal failed');
      }
    },
    onError: (e: Error) => {
      showToast('error', e.message || 'Network error during relay');
    },
  });

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!stealthAddr) {
      errs.stealthAddr = 'Stealth address is required';
    } else if (!/^0x[a-fA-F0-9]{40}$/.test(stealthAddr)) {
      errs.stealthAddr = 'Invalid stealth address format';
    }
    if (!target) {
      errs.target = 'Target wallet is required';
    } else if (!/^0x[a-fA-F0-9]{40}$/.test(target)) {
      errs.target = 'Invalid target wallet format';
    }
    if (!amount) {
      errs.amount = 'Amount is required';
    } else if (isNaN(Number(amount)) || Number(amount) <= 0) {
      errs.amount = 'Must be a positive number';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    withdrawMutation.mutate();
  };

  /** Connect as Bob, load his latest private payment, optionally withdraw. */
  const claimAsBob = async (autoWithdraw: boolean) => {
    setBobBusy(true);
    setErrors({});
    try {
      const bob = DEMO_WALLETS.bob;
      await connect(bob);
      await ensureDemoAuth(bob);
      setTarget(bob);

      const res = await fetch(
        `${API_BASE}/api/scan?viewer=${encodeURIComponent(bob)}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.detail === 'string' ? data.detail : 'Scan failed');
      }

      const anns = (data.announcements || []) as ScanAnnouncement[];
      if (!anns.length) {
        showToast(
          'error',
          'No payments found for this recipient. Complete a private transfer first.'
        );
        setPrefillNote('No payments available — complete a private transfer, then load again.');
        return;
      }

      const a = anns[0];
      const symbol = a.announce_metadata?.token_symbol || DEFAULT_TOKEN;
      const human = humanAmount(a.amount);
      setStealthAddr(a.stealth_address);
      setAmount(human);
      if (TOKEN_LIST.includes(symbol)) setToken(symbol);
      else setToken(DEFAULT_TOKEN);
      setPrefillNote(
        `Latest payment: ${truncAddr(a.stealth_address)} · ${human} ${symbol}`
      );

      if (!autoWithdraw) {
        showToast('success', 'Payment details loaded — submit to settle');
        return;
      }

      // Full one-click claim
      await ensureDemoAuth(bob);
      const feeTokenSym = TOKEN_LIST.includes(symbol) ? symbol : DEFAULT_TOKEN;
      const result = await api<{ tx_hash: string; success: boolean; mode: string }>(
        '/api/relay/withdraw',
        'POST',
        {
          stealth_address: a.stealth_address.toLowerCase(),
          target_owner: bob,
          fee_token: TOKENS[feeTokenSym] || TOKENS[DEFAULT_TOKEN],
          amount: toWeiString(human),
        },
        { auth: true, wallet: bob }
      );
      if (result?.success) {
        showToast(
          'success',
          `Settlement recorded: ${human} ${symbol} · ${truncAddr(result.tx_hash || '')}`
        );
        setStealthAddr('');
        setAmount('');
        setPrefillNote(`Last settlement · ${truncAddr(result.tx_hash || '')}`);
        refetch();
      } else {
        showToast('error', 'Settlement failed');
      }
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Settlement failed');
    } finally {
      setBobBusy(false);
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <div className="rh-card p-6">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <h2 className="text-base font-semibold text-[var(--text)]">Claim private payment</h2>
            <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
              Real on-chain when funded
            </span>
          </div>
          <div className="flex flex-col sm:flex-row gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => claimAsBob(false)}
              disabled={bobBusy || withdrawMutation.isPending}
              className="flex items-center justify-center gap-1.5 text-xs font-semibold text-sky-700 bg-sky-50 border border-sky-200 rounded-lg px-2.5 py-1.5 hover:bg-sky-100 transition-colors disabled:opacity-60"
            >
              {bobBusy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              Load demo payment
            </button>
            <button
              type="button"
              onClick={() => claimAsBob(true)}
              disabled={bobBusy || withdrawMutation.isPending}
              className="flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-sky-600 border border-sky-700 rounded-lg px-2.5 py-1.5 hover:bg-sky-700 transition-colors disabled:opacity-60"
            >
              {bobBusy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Repeat className="w-3.5 h-3.5" />
              )}
              Demo settle (Bob)
            </button>
          </div>
        </div>
        <p className="text-xs text-[var(--text-muted)] mb-4 leading-relaxed">
          Connect the recipient wallet, load the payment from Scanner, and claim. Funded private
          sends sweep real ETH from the one-time address into your wallet on-chain.
        </p>

        {prefillNote && (
          <div className="mb-4 p-3 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-900">
            {prefillNote}
          </div>
        )}

        <div className="mb-4 p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] text-[11px] text-[var(--text-muted)] space-y-1 leading-relaxed">
          <p className="font-semibold text-[var(--text-secondary)]">Fee model</p>
          <p>{FEE_COPY.gasless(feePct)}</p>
          <p>{FEE_COPY.selfWithdraw}</p>
          {amount && Number(amount) > 0 && (
            <p className="font-mono text-[var(--text)] pt-1 border-t border-[var(--border)]">
              Preview: fee {feePreview.fee} {token} · you receive ~{feePreview.net} {token}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="rh-label">Stealth Address</label>
            <input
              type="text"
              value={stealthAddr}
              onChange={(e) => {
                setStealthAddr(e.target.value);
                setErrors((prev) => ({ ...prev, stealthAddr: '' }));
              }}
              placeholder="0x… from Scanner result"
              className={`rh-input font-mono ${errors.stealthAddr ? 'rh-input-error' : ''}`}
            />
            {errors.stealthAddr && (
              <p className="text-red-600 text-xs mt-1">{errors.stealthAddr}</p>
            )}
          </div>

          <div>
            <label className="rh-label">Your wallet (owner)</label>
            <input
              type="text"
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
                setErrors((prev) => ({ ...prev, target: '' }));
              }}
              placeholder="0x… Bob or recipient"
              className={`rh-input font-mono ${errors.target ? 'rh-input-error' : ''}`}
            />
            {errors.target && <p className="text-red-600 text-xs mt-1">{errors.target}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="rh-label">Token</label>
              <select
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="rh-input"
              >
                {TOKEN_LIST.map((t) => (
                  <option key={t} value={t}>
                    {tokenLabel(t)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="rh-label">Amount (tokens)</label>
              <input
                type="text"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setErrors((prev) => ({ ...prev, amount: '' }));
                }}
                placeholder="10"
                className={`rh-input font-mono ${errors.amount ? 'rh-input-error' : ''}`}
              />
              {errors.amount && <p className="text-red-600 text-xs mt-1">{errors.amount}</p>}
            </div>
          </div>

          <button
            type="submit"
            disabled={withdrawMutation.isPending || bobBusy}
            className="rh-btn-primary"
          >
            {withdrawMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Repeat className="w-4 h-4" />
            )}
            {withdrawMutation.isPending ? 'Claiming…' : 'Claim into my wallet'}
          </button>
        </form>

        {withdrawMutation.data?.success && (
          <div className="mt-4 p-3 rounded-lg rh-alert-success space-y-2">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div className="text-xs font-mono text-[var(--success-text)]">
                Mode: {withdrawMutation.data.mode} | Tx:{' '}
                {truncAddr(withdrawMutation.data.tx_hash || '')}
              </div>
            </div>
            {withdrawMutation.data.message && (
              <p className="text-[11px] text-emerald-800/80 leading-relaxed">
                {withdrawMutation.data.message}
              </p>
            )}
            {(lastClaimTx || withdrawMutation.data.tx_hash) &&
              explorerTxUrl(lastClaimTx || withdrawMutation.data.tx_hash || '') && (
                <a
                  href={
                    explorerTxUrl(lastClaimTx || withdrawMutation.data.tx_hash || '') || '#'
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 underline"
                >
                  View claim on explorer <ExternalLink className="w-3 h-3" />
                </a>
              )}
          </div>
        )}

        {withdrawMutation.isError && (
          <div className="mt-4 p-3 rounded-lg rh-alert-error flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="text-xs text-[var(--danger-text)]">
              {(withdrawMutation.error as Error)?.message ||
                'Relay failed. Verify the stealth address and try again.'}
            </div>
          </div>
        )}
      </div>

      <div className="rh-card p-5">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4 flex items-center gap-2">
          <History className="w-4 h-4 text-[var(--accent)]" /> Relay History
        </h3>
        {historyLoading ? (
          <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading...
          </div>
        ) : !relayHistory || relayHistory.length === 0 ? (
          <EmptyState
            compact
            title="No relay requests yet"
            description="Load a discovered payment or prefill from Scanner, then submit settlement."
            imageSrc="/brand/feature-gasless.jpg"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-[var(--text-muted)] border-b border-[var(--border)]">
                  <th className="text-left py-2 pr-3">Stealth</th>
                  <th className="text-left py-2 pr-3">Owner</th>
                  <th className="text-right py-2 pr-3">Amount</th>
                  <th className="text-center py-2 pr-3">Status</th>
                  <th className="text-right py-2">When</th>
                </tr>
              </thead>
              <tbody>
                {relayHistory.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-[var(--border)]/80 hover:bg-[var(--bg-hover)]"
                  >
                    <td className="py-2 pr-3 text-emerald-700">{truncAddr(r.stealth_address)}</td>
                    <td className="py-2 pr-3 text-sky-700">{truncAddr(r.target_owner)}</td>
                    <td className="py-2 pr-3 text-right text-[var(--text-faint)]">
                      {formatTokenAmount(r.amount)}
                    </td>
                    <td className="py-2 pr-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] ${
                          r.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : r.status === 'pending'
                              ? 'bg-yellow-50 text-[var(--warn-text)] border border-yellow-200'
                              : 'bg-red-50 text-red-600 border border-red-200'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-2 text-right text-[var(--text-muted)]">
                      {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
