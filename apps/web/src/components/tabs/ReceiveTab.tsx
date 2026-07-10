'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, ensureDemoAuth } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useSessionWallet } from '@/hooks/useSessionWallet';
import { DEMO_WALLETS, truncAddr } from '@/lib/tokens';
import {
  Download,
  Loader2,
  Wallet,
  Shield,
  Eye,
  Banknote,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import EmptyState from '@/components/EmptyState';

interface Registration {
  id?: string;
  user_address: string;
  spending_pubkey: string;
  viewing_pubkey: string;
  registered_at?: string;
}

/**
 * Uncompressed-style pubkey hex for testnet registration helpers.
 * Must be 0x + 128–130 hex digits only (API validates [a-f0-9]).
 * NOTE: suffix must be hex — 's' is NOT hex and was rejecting spend keys.
 */
function padDemoPubkey(seed: string): string {
  const hexOnly = seed
    .replace(/^0x/i, '')
    .toLowerCase()
    .replace(/[^a-f0-9]/g, 'a');
  // 64-byte x||y body (128 hex); prefix 04 → 130 hex after 0x (viem-compatible length)
  const body = (hexOnly + 'a'.repeat(128)).slice(0, 128);
  return `0x04${body}`;
}

export default function ReceiveTab() {
  const { showToast } = useToast();
  const { wallet: sessionWallet, connect } = useSessionWallet();
  const [wallet, setWallet] = useState('');
  const [spendingKey, setSpendingKey] = useState('');
  const [viewingKey, setViewingKey] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showExplain, setShowExplain] = useState(false);
  const [bobBusy, setBobBusy] = useState(false);

  useEffect(() => {
    if (sessionWallet && !wallet) setWallet(sessionWallet);
  }, [sessionWallet, wallet]);

  const { data: registrations, isLoading, refetch } = useQuery<Registration[]>({
    queryKey: ['registrations'],
    queryFn: async () => (await api<Registration[]>('/api/registrations')) || [],
  });

  const bobReady = Boolean(
    registrations?.some((r) => r.user_address?.toLowerCase() === DEMO_WALLETS.bob)
  );

  const registerMutation = useMutation({
    mutationFn: async (payload: {
      wallet: string;
      spending_pubkey: string;
      viewing_pubkey: string;
    }) => {
      await connect(payload.wallet);
      await ensureDemoAuth(payload.wallet);
      return api<{ success: boolean; message: string }>(
        '/api/register',
        'POST',
        {
          user_address: payload.wallet.toLowerCase(),
          spending_pubkey: payload.spending_pubkey,
          viewing_pubkey: payload.viewing_pubkey,
        },
        { auth: true, wallet: payload.wallet }
      );
    },
    onSuccess: (data) => {
      if (data?.success) {
        showToast('success', 'Private receive enabled for this wallet');
        setSpendingKey('');
        setViewingKey('');
        setShowAdvanced(false);
        refetch();
      } else {
        showToast('error', 'Could not turn on private receive');
      }
    },
    onError: (e: Error) => {
      showToast('error', e.message || 'Something went wrong. Try again.');
    },
  });

  const ensureKeys = (w: string) => {
    // Distinct hex domains for spend vs view (use only hex suffixes: a-f, 0-9)
    const base = w.replace(/^0x/i, '').toLowerCase();
    const spend = spendingKey || padDemoPubkey(`${base}aa`);
    const view = viewingKey || padDemoPubkey(`${base}bb`);
    setSpendingKey(spend);
    setViewingKey(view);
    return { spend, view };
  };

  const validateWallet = () => {
    if (!wallet) {
      setErrors({ wallet: 'Please enter your wallet address' });
      return false;
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      setErrors({ wallet: 'Use a valid address starting with 0x' });
      return false;
    }
    setErrors({});
    return true;
  };

  const handleSimpleEnable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateWallet()) return;
    const { spend, view } = ensureKeys(wallet);
    registerMutation.mutate({
      wallet,
      spending_pubkey: spend,
      viewing_pubkey: view,
    });
  };

  const handleAdvancedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateWallet()) return;
    const errs: Record<string, string> = {};
    const pkOk = (k: string) => {
      const body = k.trim().replace(/^0x/i, '').toLowerCase();
      return /^[a-f0-9]+$/.test(body) && [64, 66, 128, 130].includes(body.length);
    };
    if (!spendingKey || !pkOk(spendingKey)) {
      errs.spendingKey = 'Invalid spend public key (hex, compressed or uncompressed)';
    }
    if (!viewingKey || !pkOk(viewingKey)) {
      errs.viewingKey = 'Invalid view public key (hex, compressed or uncompressed)';
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    registerMutation.mutate({
      wallet,
      spending_pubkey: spendingKey,
      viewing_pubkey: viewingKey,
    });
  };

  /** One-click: connect as Bob + turn on private receive. */
  const setupBob = async () => {
    setBobBusy(true);
    setErrors({});
    try {
      const bob = DEMO_WALLETS.bob;
      setWallet(bob);
      await connect(bob);
      await ensureDemoAuth(bob);
      const { spend, view } = ensureKeys(bob);
      const data = await api<{ success: boolean; message: string }>(
        '/api/register',
        'POST',
        {
          user_address: bob,
          spending_pubkey: spend,
          viewing_pubkey: view,
        },
        { auth: true, wallet: bob }
      );
      if (data?.success) {
        showToast(
          'success',
          bobReady
            ? 'Recipient profile ready — private receive already enabled'
            : 'Recipient profile configured for private receive'
        );
        await refetch();
      } else {
        showToast('error', 'Unable to configure recipient profile');
      }
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Configuration failed');
    } finally {
      setBobBusy(false);
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <div className="rh-card p-6">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h2 className="text-base font-semibold text-[var(--text)]">Private receive</h2>
          <button
            type="button"
            onClick={setupBob}
            disabled={bobBusy || registerMutation.isPending}
            className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-sky-700 bg-sky-50 border border-sky-200 rounded-lg px-2.5 py-1.5 hover:bg-sky-100 transition-colors disabled:opacity-60"
          >
            {bobBusy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {bobReady ? 'Use recipient profile' : 'Configure recipient (Bob)'}
          </button>
        </div>
        <p className="text-sm text-[var(--text-muted)] mb-3 leading-relaxed">
          Enable private receive so counterparties can send to a one-time destination without
          reusing your public address as the payment label.
        </p>

        {bobReady && (
          <div className="mb-4 flex items-start gap-2 p-3 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-900">
            <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <div>
              <strong>Recipient profile ready</strong> ({truncAddr(DEMO_WALLETS.bob)}). Next:
              complete a private transfer, then open <strong>Scanner</strong> to discover and settle.
            </div>
          </div>
        )}

        <div className="mb-5 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] p-4 space-y-3">
          <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
            Components
          </p>
          <div className="flex gap-3 items-start">
            <div className="w-8 h-8 rounded-lg bg-white border border-[var(--border)] flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4 text-[var(--accent)]" />
            </div>
            <div>
              <div className="text-sm font-medium text-[var(--text)]">Wallet address</div>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                Your controlling address. Required for registration and discovery.
              </p>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <div className="w-8 h-8 rounded-lg bg-white border border-[var(--border)] flex items-center justify-center shrink-0">
              <Banknote className="w-4 h-4 text-[var(--accent)]" />
            </div>
            <div>
              <div className="text-sm font-medium text-[var(--text)]">Spending public key</div>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                Enables control of private destinations. Generated automatically when empty.
              </p>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <div className="w-8 h-8 rounded-lg bg-white border border-[var(--border)] flex items-center justify-center shrink-0">
              <Eye className="w-4 h-4 text-[var(--accent)]" />
            </div>
            <div>
              <div className="text-sm font-medium text-[var(--text)]">Viewing public key</div>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                Supports payment discovery. Generated automatically when empty.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowExplain((v) => !v)}
          className="mb-4 flex items-center gap-1.5 text-xs font-medium text-[var(--accent)] hover:underline"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          {showExplain ? 'Hide reference workflow' : 'View reference workflow'}
        </button>

        {showExplain && (
          <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-xs text-emerald-900 leading-relaxed space-y-2">
            <p>
              <strong>Reference workflow:</strong> recipient enables private receive; sender
              completes a private transfer; recipient discovers the payment in Scanner and settles
              via Relayer.
            </p>
            <ol className="list-decimal pl-4 space-y-1.5">
              <li>
                Select <em>Configure recipient (Bob)</em> to register the reference profile.
              </li>
              <li>
                On Send, use <em>Reference: Alice → Bob</em> and submit the transfer.
              </li>
              <li>
                On Scanner, run discovery for the recipient wallet.
              </li>
              <li>
                On Relayer, complete sponsored settlement.
              </li>
            </ol>
          </div>
        )}

        <form onSubmit={handleSimpleEnable} className="space-y-4">
          <div>
            <label className="rh-label">Your wallet address</label>
            <input
              type="text"
              value={wallet}
              onChange={(e) => {
                setWallet(e.target.value);
                setErrors((prev) => ({ ...prev, wallet: '' }));
              }}
              placeholder="0x… wallet address"
              className={`rh-input font-mono ${errors.wallet ? 'rh-input-error' : ''}`}
              autoComplete="off"
            />
            {errors.wallet && <p className="text-red-600 text-xs mt-1">{errors.wallet}</p>}
            <p className="text-[11px] text-[var(--text-faint)] mt-1.5">
              Wallet address is required. Optional: configure the Bob reference profile in one step.
            </p>
          </div>

          <button
            type="submit"
            disabled={registerMutation.isPending || bobBusy}
            className="rh-btn-primary"
          >
            {registerMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Shield className="w-4 h-4" />
            )}
            {registerMutation.isPending ? 'Enabling…' : 'Enable private receive'}
          </button>
        </form>

        <div className="mt-6 border-t border-[var(--border)] pt-4">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="w-full flex items-center justify-between text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            <span>Advanced (for developers — optional)</span>
            {showAdvanced ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {showAdvanced && (
            <form onSubmit={handleAdvancedSubmit} className="mt-4 space-y-4">
              <p className="text-[11px] text-[var(--text-faint)] leading-relaxed">
                Normal users should skip this. These are technical public keys for the registry.
              </p>
              <div>
                <label className="rh-label">Spending public key</label>
                <input
                  type="text"
                  value={spendingKey}
                  onChange={(e) => setSpendingKey(e.target.value)}
                  placeholder="Auto-filled if empty"
                  className={`rh-input font-mono text-[11px] ${errors.spendingKey ? 'rh-input-error' : ''}`}
                />
                {errors.spendingKey && (
                  <p className="text-red-600 text-xs mt-1">{errors.spendingKey}</p>
                )}
              </div>
              <div>
                <label className="rh-label">Viewing public key</label>
                <input
                  type="text"
                  value={viewingKey}
                  onChange={(e) => setViewingKey(e.target.value)}
                  placeholder="Auto-filled if empty"
                  className={`rh-input font-mono text-[11px] ${errors.viewingKey ? 'rh-input-error' : ''}`}
                />
                {errors.viewingKey && (
                  <p className="text-red-600 text-xs mt-1">{errors.viewingKey}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!validateWallet()) return;
                  ensureKeys(wallet);
                  showToast('success', 'Reference keys generated — you may save now');
                }}
                className="text-xs text-[var(--accent)] font-semibold hover:underline"
              >
                Generate reference keys
              </button>
              <button
                type="submit"
                disabled={registerMutation.isPending}
                className="w-full flex items-center justify-center gap-2 border border-[var(--border)] rounded-lg py-2.5 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              >
                <Download className="w-4 h-4" />
                Save advanced keys
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="rh-card p-5">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[var(--accent)]" />
          Wallets ready for private receive
        </h3>
        {isLoading ? (
          <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading...
          </div>
        ) : !registrations || registrations.length === 0 ? (
          <EmptyState
            compact
            title="No one set up yet"
            description="Enter a wallet address and enable private receive, or configure the reference recipient profile."
            imageSrc="/brand/feature-enterprise.jpg"
          />
        ) : (
          <div className="space-y-2">
            {registrations.map((r, i) => {
              const isBob = r.user_address?.toLowerCase() === DEMO_WALLETS.bob;
              const isAlice = r.user_address?.toLowerCase() === DEMO_WALLETS.alice;
              return (
                <div
                  key={r.id || i}
                  className={`p-3.5 rounded-xl border flex items-center gap-3 ${
                    isBob
                      ? 'bg-sky-50/80 border-sky-200'
                      : 'bg-[var(--bg-muted)] border-[var(--border)]'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${
                      isBob
                        ? 'bg-sky-100 border-sky-200'
                        : 'bg-emerald-50 border-emerald-100'
                    }`}
                  >
                    <Shield
                      className={`w-4 h-4 ${isBob ? 'text-sky-700' : 'text-emerald-700'}`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-sm font-mono font-medium truncate ${
                        isBob ? 'text-sky-800' : 'text-emerald-800'
                      }`}
                    >
                      {truncAddr(r.user_address)}
                      {isBob && (
                        <span className="ml-2 text-[10px] font-sans font-bold uppercase tracking-wide text-sky-600">
                          Bob
                        </span>
                      )}
                      {isAlice && (
                        <span className="ml-2 text-[10px] font-sans font-bold uppercase tracking-wide text-emerald-600">
                          Alice
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      Private receive enabled · no KYC
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0 border ${
                      isBob
                        ? 'text-sky-700 bg-sky-50 border-sky-200'
                        : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    }`}
                  >
                    Ready
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
