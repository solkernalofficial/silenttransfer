'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useConnection,
  useConnect,
  useDisconnect,
  useSignMessage,
  useSwitchChain,
  useConnectors,
} from 'wagmi';
import {
  clearSessionWallet,
  getSessionWallet,
  onSessionWalletChange,
  setSessionWallet,
} from '@/lib/session';
import {
  ensureOperatorAuth,
  clearAuthSession,
  getAuthMode,
  getStoredWallet,
} from '@/lib/api';
import { loginWithSiwe } from '@/lib/siwe';
import { appChain } from '@/lib/wagmi';
import { switchOrAddAppChain } from '@/lib/addChain';

export type ConnectSource = 'wallet' | 'operator';

/**
 * Unified session:
 * - Real wallets via Wagmi (injected / MetaMask / WalletConnect) + SIWE
 * - Operator profiles (Alice/Bob) via demo-login JWT (testnet evaluation)
 */
export function useSessionWallet() {
  const { address, isConnected: wagmiConnected, chainId, status } = useConnection();
  const { connectAsync, isPending: connectPending, error: connectError } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { switchChainAsync } = useSwitchChain();
  const connectors = useConnectors();

  const [sessionWallet, setLocalSession] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [source, setSource] = useState<ConnectSource | null>(null);

  useEffect(() => {
    const w = getSessionWallet();
    setLocalSession(w);
    if (w && getAuthMode() === 'operator') setSource('operator');
    else if (w) setSource('wallet');
    setReady(true);
    return onSessionWalletChange((addr) => {
      setLocalSession(addr);
    });
  }, []);

  // Sync wagmi address into session when user connects a real wallet
  useEffect(() => {
    if (address && wagmiConnected) {
      const addr = address.toLowerCase();
      setSessionWallet(addr);
      setLocalSession(addr);
      setSource('wallet');
    }
  }, [address, wagmiConnected]);

  const wallet = useMemo(() => {
    if (source === 'operator') return sessionWallet;
    if (address) return address.toLowerCase();
    return sessionWallet;
  }, [address, sessionWallet, source]);

  const isConnected = Boolean(wallet);

  /**
   * Switch to app chain; if wallet does not know it, prompt wallet_addEthereumChain
   * with Robinhood (or env) RPC / explorer details.
   */
  const ensureCorrectChain = useCallback(async () => {
    if (chainId === appChain.id) return 'already' as const;
    try {
      return await switchOrAddAppChain({
        currentChainId: chainId,
        switchChain: (args) => switchChainAsync(args),
      });
    } catch (e) {
      console.warn('switchOrAddAppChain failed', e);
      throw e instanceof Error
        ? e
        : new Error(
            `Add / switch wallet network to ${appChain.name} (chain ${appChain.id})`
          );
    }
  }, [chainId, switchChainAsync]);

  /** Connect auto-detected wallet then SIWE sign-in. */
  const connectWallet = useCallback(
    async (connectorId?: string) => {
      setAuthError(null);
      setAuthBusy(true);
      try {
        // Auto-detect order: explicit id → injected browser wallet → MetaMask → WalletConnect → first
        const hasInjected =
          typeof window !== 'undefined' &&
          Boolean((window as unknown as { ethereum?: unknown }).ethereum);

        const connector =
          (connectorId && connectors.find((c) => c.id === connectorId)) ||
          (hasInjected &&
            connectors.find(
              (c) =>
                c.type === 'injected' ||
                c.id === 'injected' ||
                c.id === 'metaMaskSDK' ||
                c.id === 'metaMask' ||
                /metamask|injected/i.test(c.name)
            )) ||
          connectors.find((c) => c.id === 'metaMaskSDK' || c.id === 'metaMask') ||
          connectors.find((c) => /walletConnect|walletconnect/i.test(c.id + c.name)) ||
          connectors[0];
        if (!connector) {
          throw new Error(
            'No wallet found. Install MetaMask or another Web3 wallet, then retry.'
          );
        }

        const result = await connectAsync({ connector, chainId: appChain.id });
        const addr = (result.accounts[0] || '').toLowerCase();
        if (!addr) throw new Error('No account returned from wallet');

        try {
          await ensureCorrectChain();
        } catch {
          // continue — some wallets auto-add on next sign
        }

        setSessionWallet(addr);
        setLocalSession(addr);
        setSource('wallet');

        await loginWithSiwe(addr, async ({ message }) => {
          return signMessageAsync({ message });
        });

        return addr;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Wallet connect failed';
        setAuthError(msg);
        throw e;
      } finally {
        setAuthBusy(false);
      }
    },
    [connectors, connectAsync, ensureCorrectChain, signMessageAsync]
  );

  /** Re-run SIWE for an already-connected wagmi wallet. */
  const signInWithEthereum = useCallback(async () => {
    const addr = (address || wallet || '').toLowerCase();
    if (!addr) throw new Error('Connect a wallet first');
    setAuthBusy(true);
    setAuthError(null);
    try {
      await ensureCorrectChain();
      await loginWithSiwe(addr, async ({ message }) => signMessageAsync({ message }));
      setSessionWallet(addr);
      setLocalSession(addr);
      setSource('wallet');
      return addr;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'SIWE failed';
      setAuthError(msg);
      throw e;
    } finally {
      setAuthBusy(false);
    }
  }, [address, wallet, ensureCorrectChain, signMessageAsync]);

  /**
   * Operator login (Alice/Bob/manual address) — no MetaMask.
   * Used for evaluation walkthroughs on testnet.
   */
  const connect = useCallback(async (addressInput: string) => {
    const addr = addressInput.toLowerCase();
    setAuthError(null);
    setAuthBusy(true);
    try {
      // Disconnect real wallet so UI doesn't mix sources
      try {
        await disconnectAsync();
      } catch {
        /* ignore */
      }
      setSessionWallet(addr);
      setLocalSession(addr);
      setSource('operator');
      const token = await ensureOperatorAuth(addr);
      if (!token) throw new Error('Operator login failed — is ALLOW_OPERATOR_LOGIN enabled?');
      return addr;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Operator login failed';
      setAuthError(msg);
      throw e;
    } finally {
      setAuthBusy(false);
    }
  }, [disconnectAsync]);

  const disconnect = useCallback(async () => {
    try {
      await disconnectAsync();
    } catch {
      /* ignore */
    }
    clearSessionWallet();
    clearAuthSession();
    setLocalSession(null);
    setSource(null);
    setAuthError(null);
  }, [disconnectAsync]);

  const needsSiwe =
    source === 'wallet' &&
    Boolean(wallet) &&
    (getAuthMode() !== 'siwe' || getStoredWallet() !== wallet);

  return {
    wallet,
    ready,
    connect,
    connectWallet,
    signInWithEthereum,
    disconnect,
    isConnected,
    source,
    authBusy,
    authError,
    connectPending,
    connectError: connectError?.message || authError,
    connectors,
    chainId,
    expectedChainId: appChain.id,
    chainName: appChain.name,
    wrongChain: Boolean(address && chainId && chainId !== appChain.id),
    ensureCorrectChain,
    needsSiwe,
    wagmiStatus: status,
  };
}
