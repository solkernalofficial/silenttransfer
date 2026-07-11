'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useWriteContract, useSwitchChain } from 'wagmi';
import { waitForTransactionReceipt } from 'wagmi/actions';
import { api, ensureDemoAuth } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useSessionWallet } from '@/hooks/useSessionWallet';
import { DEMO_WALLETS, truncAddr } from '@/lib/tokens';
import { ensureStealthVault, exportStealthVaultJson, getStealthVault } from '@/lib/stealth/vault';
import { getRegistryAddress, REGISTRY_ABI } from '@/lib/stealth/abis';
import { selfTestStealthRoundTrip } from '@/lib/stealth/crypto';
import { appChain, wagmiConfig } from '@/lib/wagmi';
import { switchOrAddAppChain } from '@/lib/addChain';
import {
  Download,
  Loader2,
  Wallet,
  Shield,
  Eye,
  Banknote,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  KeyRound,
  Copy,
} from 'lucide-react';
import EmptyState from '@/components/EmptyState';

interface Registration {
  id?: string;
  user_address: string;
  spending_pubkey: string;
  viewing_pubkey: string;
  registered_at?: string;
}

export default function ReceiveTab() {
  const { showToast } = useToast();
  const { wallet: sessionWallet, connect, source, expectedChainId } = useSessionWallet();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [wallet, setWallet] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showExplain, setShowExplain] = useState(false);
  const [bobBusy, setBobBusy] = useState(false);
  const [onChainBusy, setOnChainBusy] = useState(false);
  const [cryptoOk] = useState(() => {
    try {
      return selfTestStealthRoundTrip();
    } catch {
      return false;
    }
  });

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
  const vault = wallet ? getStealthVault(wallet) : null;

  const registerMutation = useMutation({
    mutationFn: async (addr: string) => {
      await connect(addr);
      await ensureDemoAuth(addr);
      const entry = ensureStealthVault(addr);
      return api<{ success: boolean; message: string }>(
        '/api/register',
        'POST',
        {
          user_address: addr.toLowerCase(),
          spending_pubkey: entry.spendingPublicKey,
          viewing_pubkey: entry.viewingPublicKey,
        },
        { auth: true, wallet: addr }
      );
    },
    onSuccess: (data) => {
      if (data?.success) {
        showToast(
          'success',
          'Private receive enabled — real ERC-5564 meta-keys saved in this browser only'
        );
        refetch();
      } else {
        showToast('error', 'Could not turn on private receive');
      }
    },
    onError: (e: Error) => {
      showToast('error', e.message || 'Something went wrong. Try again.');
    },
  });

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

  const handleEnable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateWallet()) return;
    registerMutation.mutate(wallet);
  };

  const registerOnChain = async () => {
    if (!validateWallet()) return;
    const entry = ensureStealthVault(wallet);
    const registry = getRegistryAddress();
    if (!registry) {
      showToast('error', 'Registry address not configured');
      return;
    }
    if (source !== 'wallet') {
      showToast('error', 'Connect a real wallet to register on-chain');
      return;
    }
    setOnChainBusy(true);
    try {
      await switchOrAddAppChain({
        currentChainId: undefined,
        switchChain: (args) => switchChainAsync(args),
      });
      const hash = await writeContractAsync({
        chainId: expectedChainId,
        address: registry,
        abi: REGISTRY_ABI,
        functionName: 'registerKeys',
        args: [entry.spendingPublicKey, entry.viewingPublicKey],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash, chainId: expectedChainId });
      showToast('success', 'On-chain ERC-6538 registry updated');
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'On-chain register failed');
    } finally {
      setOnChainBusy(false);
    }
  };

  const setupBob = async () => {
    setBobBusy(true);
    setErrors({});
    try {
      const bob = DEMO_WALLETS.bob;
      setWallet(bob);
      await connect(bob);
      await ensureDemoAuth(bob);
      const entry = ensureStealthVault(bob);
      const data = await api<{ success: boolean }>(
        '/api/register',
        'POST',
        {
          user_address: bob,
          spending_pubkey: entry.spendingPublicKey,
          viewing_pubkey: entry.viewingPublicKey,
        },
        { auth: true, wallet: bob }
      );
      if (data?.success) {
        showToast('success', 'Bob registered with real stealth meta-keys (this browser vault)');
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
            {bobReady ? 'Refresh Bob keys' : 'Configure Bob (demo)'}
          </button>
        </div>
        <p className="text-sm text-[var(--text-muted)] mb-3 leading-relaxed">
          <strong>Optional upgrade.</strong> Anyone can already receive private sends without this —
          just connect, scan, and claim. Enable here only if you want stronger{' '}
          <strong>ERC-5564 stealth</strong> (only your keys can claim; no server spend key).
        </p>

        <div
          className={`mb-4 p-3 rounded-xl border text-xs ${
            cryptoOk
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          Stealth crypto self-test: {cryptoOk ? 'OK (ECDH round-trip)' : 'FAILED'}
        </div>

        <div className="mb-5 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] p-4 space-y-3">
          <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
            How private A→B works
          </p>
          <div className="flex gap-3 items-start">
            <KeyRound className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Your <strong>private</strong> spending/viewing keys stay in this browser. Only public
              keys go to the API (and optional on-chain registry).
            </p>
          </div>
          <div className="flex gap-3 items-start">
            <Banknote className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Sender funds a stealth address derived from your meta-keys — not a random C with a
              shared claim code.
            </p>
          </div>
          <div className="flex gap-3 items-start">
            <Eye className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              You scan with your viewing key and derive the spend key locally, then claim.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowExplain((v) => !v)}
          className="mb-4 flex items-center gap-1.5 text-xs font-medium text-[var(--accent)] hover:underline"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          {showExplain ? 'Hide limits' : 'Honest privacy limits'}
        </button>
        {showExplain && (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950 leading-relaxed">
            Recipient privacy is cryptographic (ERC-5564). On a public chain, <strong>sender</strong>{' '}
            and <strong>amount</strong> on the funding transaction remain visible. This is not a ZK
            shielded pool.
          </div>
        )}

        <form onSubmit={handleEnable} className="space-y-4">
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
            {registerMutation.isPending ? 'Enabling…' : 'Enable private receive (ERC-5564)'}
          </button>

          <button
            type="button"
            onClick={registerOnChain}
            disabled={onChainBusy || !getRegistryAddress()}
            className="w-full flex items-center justify-center gap-2 border border-[var(--border)] rounded-lg py-2.5 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
          >
            {onChainBusy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Wallet className="w-4 h-4" />
            )}
            Also register on-chain (ERC-6538)
          </button>
        </form>

        {vault && (
          <div className="mt-5 p-3 rounded-xl border border-emerald-200 bg-emerald-50/60 text-xs space-y-2">
            <div className="flex items-center gap-2 font-semibold text-emerald-900">
              <CheckCircle2 className="w-4 h-4" /> Meta-keys in this browser
            </div>
            <div className="font-mono break-all text-emerald-900/80">
              View pub: {truncAddr(vault.viewingPublicKey, 10, 8)}
            </div>
            <div className="font-mono break-all text-emerald-900/80">
              Spend pub: {truncAddr(vault.spendingPublicKey, 10, 8)}
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1 font-semibold text-emerald-800"
              onClick={async () => {
                const j = exportStealthVaultJson(wallet);
                if (!j) return;
                try {
                  await navigator.clipboard.writeText(j);
                  showToast('success', 'Vault backup copied — store offline securely');
                } catch {
                  showToast('error', 'Copy failed');
                }
              }}
            >
              <Copy className="w-3 h-3" /> Backup vault JSON
            </button>
            <p className="text-[11px] text-emerald-800/70">
              Back up before clearing browser data — without private keys you cannot claim stealth
              payments.
            </p>
          </div>
        )}
      </div>

      <div className="rh-card p-5">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[var(--accent)]" />
          Registered meta-addresses
        </h3>
        {isLoading ? (
          <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading...
          </div>
        ) : !registrations || registrations.length === 0 ? (
          <EmptyState
            compact
            title="No one set up yet"
            description="Enable private receive to publish your stealth meta-address for A→B private sends."
            imageSrc="/brand/feature-enterprise.jpg"
          />
        ) : (
          <div className="space-y-2">
            {registrations.map((r, i) => (
              <div
                key={r.id || i}
                className="p-3.5 rounded-xl border flex items-center gap-3 bg-[var(--bg-muted)] border-[var(--border)]"
              >
                <div className="w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 bg-emerald-50 border-emerald-100">
                  <Shield className="w-4 h-4 text-emerald-700" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-mono font-medium truncate text-emerald-800">
                    {truncAddr(r.user_address)}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    ERC-5564 meta-address · {appChain.name}
                  </div>
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0 border text-emerald-700 bg-emerald-50 border-emerald-200">
                  Ready
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
