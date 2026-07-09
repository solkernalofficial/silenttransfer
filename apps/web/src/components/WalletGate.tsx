'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Wallet, Loader2, Shield, ArrowLeft, Network } from 'lucide-react';
import { useSessionWallet } from '@/hooks/useSessionWallet';
import { BrandMark } from '@/components/BrandLogo';
import { getNetworkDetails } from '@/lib/addChain';

/**
 * Console unlocks only after a real wallet session.
 * One button: auto-detect injected wallet (MetaMask etc.) or WalletConnect.
 * No multi-option list / operator chooser on this screen.
 */
export default function WalletGate({ children }: { children: ReactNode }) {
  const {
    ready,
    isConnected,
    connectWallet,
    authBusy,
    chainName,
    expectedChainId,
    connectors,
  } = useSessionWallet();

  const [error, setError] = useState('');
  const [detected, setDetected] = useState<string | null>(null);
  const autoTried = useRef(false);

  const detectLabel = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const eth = (window as unknown as { ethereum?: { isMetaMask?: boolean; isRabby?: boolean } })
      .ethereum;
    if (!eth) return null;
    if (eth.isMetaMask) return 'MetaMask';
    if (eth.isRabby) return 'Rabby';
    return 'Browser wallet';
  }, []);

  useEffect(() => {
    setDetected(detectLabel());
  }, [detectLabel]);

  const onConnect = useCallback(async () => {
    setError('');
    try {
      // Prefer injected when present; connectWallet already auto-picks best connector
      await connectWallet();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Wallet connection failed';
      // User rejected is normal
      if (/reject|denied|cancel/i.test(msg)) {
        setError('Connection cancelled. Try again when ready.');
      } else {
        setError(msg);
      }
    }
  }, [connectWallet]);

  // Soft auto-prompt once when a browser wallet is already installed
  useEffect(() => {
    if (!ready || isConnected || autoTried.current) return;
    if (!detectLabel()) return;
    if (connectors.length === 0) return;
    autoTried.current = true;
    // slight delay so UI paints first
    const t = window.setTimeout(() => {
      void onConnect();
    }, 400);
    return () => window.clearTimeout(t);
  }, [ready, isConnected, detectLabel, connectors.length, onConnect]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center rh-page text-[var(--text-muted)] text-sm">
        <Loader2 className="w-5 h-5 animate-spin mr-2 text-[var(--accent)]" />
        Loading…
      </div>
    );
  }

  if (isConnected) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen rh-page flex flex-col">
      <header className="h-14 border-b border-[var(--border)] bg-white/80 backdrop-blur flex items-center px-4 lg:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          <ArrowLeft className="w-4 h-4" />
          <BrandMark size={28} />
          <span className="font-semibold text-[var(--text)]">SilentTransfer</span>
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 lg:p-8">
        <div className="w-full max-w-sm rh-card p-6 lg:p-8 shadow-lg border border-[var(--border)] text-center">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)] mb-4">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-[var(--text)] mb-1">Connect wallet</h1>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed mb-4">
            {detected ? (
              <>
                Detected <strong className="text-[var(--text)]">{detected}</strong>. Connect and
                sign in to open the console on {chainName} ({expectedChainId}).
              </>
            ) : (
              <>
                No browser wallet detected. Connect via WalletConnect or install a wallet for{' '}
                {chainName} (chain {expectedChainId}).
              </>
            )}
          </p>

          <div className="mb-5 text-left rounded-lg border border-[var(--border)] bg-[var(--bg-muted)]/60 p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-secondary)]">
              <Network className="w-3.5 h-3.5 text-[var(--accent)]" />
              Required network (auto-added if missing)
            </div>
            {(() => {
              const n = getNetworkDetails();
              return (
                <ul className="text-[10px] font-mono text-[var(--text-muted)] space-y-0.5 leading-relaxed">
                  <li>
                    <span className="text-[var(--text-faint)]">Name</span> {n.name}
                  </li>
                  <li>
                    <span className="text-[var(--text-faint)]">Chain ID</span> {n.chainId} (
                    {n.chainIdHex})
                  </li>
                  <li className="break-all">
                    <span className="text-[var(--text-faint)]">RPC</span> {n.rpcUrl}
                  </li>
                </ul>
              );
            })()}
          </div>

          <button
            type="button"
            disabled={authBusy}
            onClick={() => void onConnect()}
            className="w-full flex items-center justify-center gap-2 rh-btn-primary text-sm py-3 rounded-xl disabled:opacity-60"
          >
            {authBusy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Connecting…
              </>
            ) : (
              <>
                <Wallet className="w-4 h-4" />
                {detected ? `Connect ${detected}` : 'Connect wallet'}
              </>
            )}
          </button>

          {error && (
            <p className="text-red-600 text-[11px] mt-4 leading-snug text-left whitespace-pre-wrap">
              {error}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
