'use client';

import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, ensureDemoAuth } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useSessionWallet } from '@/hooks/useSessionWallet';
import {
  TOKENS,
  TOKEN_LIST,
  DEFAULT_TOKEN,
  DEMO_WALLETS,
  truncAddr,
  toWeiString,
  tokenLabel,
} from '@/lib/tokens';
import { FEE_COPY } from '@/lib/fees';
import {
  Send,
  Loader2,
  AlertCircle,
  CheckCircle,
  EyeOff,
  ArrowDown,
  User,
  Sparkles,
} from 'lucide-react';

interface AnnounceResponse {
  success?: boolean;
  stealth_address?: string;
  from_address?: string;
  to_address?: string;
  amount?: string;
  message?: string;
  mode?: string;
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

export default function SendTab() {
  const { showToast } = useToast();
  const { wallet: sessionWallet, connect } = useSessionWallet();
  const [fromWallet, setFromWallet] = useState('');
  const [toWallet, setToWallet] = useState('');
  const [token, setToken] = useState(DEFAULT_TOKEN);
  const [amount, setAmount] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<AnnounceResponse | null>(null);

  useEffect(() => {
    if (sessionWallet && !fromWallet) setFromWallet(sessionWallet);
  }, [sessionWallet, fromWallet]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      await connect(fromWallet);
      await ensureDemoAuth(fromWallet);
      const stealth_address = `0x${randomHex(20)}`;
      const ephemeral_pubkey = `0x04${randomHex(64)}`;
      const body = {
        stealth_address,
        caller: fromWallet.toLowerCase(),
        to_address: toWallet.toLowerCase(),
        ephemeral_pubkey,
        token_address: TOKENS[token] || TOKENS.USDG,
        amount: toWeiString(amount),
        block_number: 0,
        metadata: {
          token_symbol: token,
          private_transfer: true,
          demo: true,
        },
      };
      return api<AnnounceResponse>('/api/announce', 'POST', body, {
        auth: true,
        wallet: fromWallet,
      });
    },
    onSuccess: (data) => {
      if (data?.success) {
        setResult(data);
        showToast(
          'success',
          `Private transfer recorded: ${truncAddr(fromWallet)} → ${truncAddr(toWallet)}`
        );
      } else {
        showToast('error', 'Private transfer failed');
      }
    },
    onError: (e: Error) => {
      setResult(null);
      showToast('error', e.message || 'Could not complete private transfer');
    },
  });

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!fromWallet) errs.from = 'Enter the sender wallet address';
    else if (!/^0x[a-fA-F0-9]{40}$/.test(fromWallet))
      errs.from = 'Sender address must start with 0x';
    if (!toWallet) errs.to = 'Enter the recipient wallet address';
    else if (!/^0x[a-fA-F0-9]{40}$/.test(toWallet))
      errs.to = 'Recipient address must start with 0x';
    else if (fromWallet.toLowerCase() === toWallet.toLowerCase())
      errs.to = 'Sender and recipient must be different accounts';
    if (!amount) errs.amount = 'Enter an amount';
    else if (isNaN(Number(amount)) || Number(amount) <= 0)
      errs.amount = 'Amount must be greater than 0';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    sendMutation.mutate();
  };

  const fillDemoAliceToBob = async () => {
    setFromWallet(DEMO_WALLETS.alice);
    setToWallet(DEMO_WALLETS.bob);
    setAmount('10');
    setToken(DEFAULT_TOKEN);
    setErrors({});
    setResult(null);
    try {
      await connect(DEMO_WALLETS.alice);
      await ensureDemoAuth(DEMO_WALLETS.alice);
    } catch {
      /* still allow fill */
    }
    showToast(
      'success',
      `Reference transfer prepared: Alice → Bob · 10 ${DEFAULT_TOKEN}`
    );
  };

  return (
    <div className="max-w-lg space-y-6">
      <div className="rh-card p-6">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h2 className="text-lg font-semibold text-[var(--text)]">Private transfer</h2>
          <button
            type="button"
            onClick={fillDemoAliceToBob}
            className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)] bg-[var(--accent-soft)] border border-[#bbf7d0] rounded-lg px-2.5 py-1.5 hover:bg-emerald-100 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Reference: Alice → Bob
          </button>
        </div>
        <p className="text-sm text-[var(--text-muted)] mb-5 leading-relaxed">
          Transfer value to a one-time destination so the recipient relationship is not exposed as a
          reusable public address.
        </p>

        <div className="mb-6 flex items-center justify-center gap-2 text-xs font-medium">
          <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
            Sender
          </span>
          <span className="text-[var(--text-faint)]">—— private ——▶</span>
          <span className="px-3 py-1.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200">
            Recipient
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="rh-label flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> From — sender wallet
            </label>
            <input
              type="text"
              value={fromWallet}
              onChange={(e) => {
                setFromWallet(e.target.value);
                setErrors((p) => ({ ...p, from: '' }));
              }}
              placeholder="0x… wallet sending funds"
              className={`rh-input font-mono ${errors.from ? 'rh-input-error' : ''}`}
            />
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
                setToWallet(e.target.value);
                setErrors((p) => ({ ...p, to: '' }));
              }}
              placeholder="0x… wallet receiving funds"
              className={`rh-input font-mono ${errors.to ? 'rh-input-error' : ''}`}
            />
            {errors.to && <p className="text-red-600 text-xs mt-1">{errors.to}</p>}
            <p className="text-[11px] text-[var(--text-faint)] mt-1.5">
              The recipient discovers the payment in Scanner using this wallet address.
            </p>
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
              <label className="rh-label">Amount</label>
              <input
                type="text"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setErrors((p) => ({ ...p, amount: '' }));
                }}
                placeholder="10"
                className={`rh-input font-mono ${errors.amount ? 'rh-input-error' : ''}`}
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
                Default asset is <strong>SILENT</strong> (hard-capped protocol token; no KYC). In
                evaluation environments, transfers are recorded for workflow testing; production
                settlement is staged separately.
              </p>
              <p className="text-[var(--text-faint)]">{FEE_COPY.send}</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={sendMutation.isPending}
            className="rh-btn-primary"
          >
            {sendMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {sendMutation.isPending ? 'Sending privately…' : 'Send privately'}
          </button>
        </form>

        {result?.success && (
          <div className="mt-5 p-4 rounded-xl rh-alert-success space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <CheckCircle className="w-4 h-4" />
              Transfer recorded
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
            </div>
            <p className="text-[11px] text-emerald-800/80 pt-1">
              Next: open <strong>Scanner</strong> as the recipient, then complete settlement in{' '}
              <strong>Relayer</strong>.
            </p>
          </div>
        )}

        {sendMutation.isError && (
          <div className="mt-4 p-3 rounded-lg rh-alert-error flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="text-xs text-[var(--danger-text)]">
              {(sendMutation.error as Error)?.message ||
                'Transfer failed. Check the addresses and try again.'}
            </div>
          </div>
        )}
      </div>

      <div className="rh-card p-5">
        <h3 className="text-sm font-semibold text-[var(--text)] mb-3">How it works</h3>
        <ol className="text-sm text-[var(--text-muted)] space-y-2 list-decimal pl-4 leading-relaxed">
          <li>
            On <strong className="text-[var(--text-secondary)]">Receive</strong>, enable private
            receive for the recipient wallet.
          </li>
          <li>
            Set <strong className="text-[var(--text-secondary)]">From</strong>,{' '}
            <strong className="text-[var(--text-secondary)]">To</strong>, asset, and amount, then
            submit.
          </li>
          <li>
            On <strong className="text-[var(--text-secondary)]">Scanner</strong>, the recipient
            discovers the payment and proceeds to settlement.
          </li>
        </ol>
      </div>
    </div>
  );
}
