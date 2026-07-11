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

function pickConnector(
  connectors: ReturnType<typeof useConnectors>,
  connectorId?: string
) {
  if (connectorId) {
    const found = connectors.find((c) => c.id === connectorId);
    if (found) return found;
  }
  const hasInjected =
    typeof window !== 'undefined' &&
    Boolean((window as unknown as { ethereum?: unknown }).ethereum);

  if (hasInjected) {
    return (
      connectors.find(
        (c) =>
          c.type === 'injected' ||
          c.id === 'injected' ||
          /metamask|injected|rabby/i.test(`${c.id} ${c.name}`)
      ) || connectors[0]
    );
  }
  return (
    connectors.find((c) => /walletConnect|walletconnect/i.test(c.id + c.name)) ||
    connectors[0]
  );
}

/**
 * Unified session:
 * - Real wallets via Wagmi (injected / WalletConnect) + SIWE
 * - Operator profiles via demo-login JWT (testnet evaluation)
 *
 * Critical: isWagmiConnected must be true before writeContract / sendTransaction.
 * Session address alone is NOT enough — that caused "Connector not connected".
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

  const isWagmiConnected = Boolean(wagmiConnected && address);

  const wallet = useMemo(() => {
    if (source === 'operator') return sessionWallet;
    if (address) return address.toLowerCase();
    // Don't treat stale session as connected for txs — only display until reconnect
    return sessionWallet;
  }, [address, sessionWallet, source]);

  /** Console unlock: live wallet connector OR operator demo session */
  const isConnected =
    source === 'operator' ? Boolean(sessionWallet) : isWagmiConnected;

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

  /** Connect browser wallet then SIWE. */
  const connectWallet = useCallback(
    async (connectorId?: string) => {
      setAuthError(null);
      setAuthBusy(true);
      try {
        // Already live — just SIWE if needed
        if (wagmiConnected && address) {
          const addr = address.toLowerCase();
          try {
            await ensureCorrectChain();
          } catch {
            /* continue */
          }
          setSessionWallet(addr);
          setLocalSession(addr);
          setSource('wallet');
          if (getAuthMode() !== 'siwe' || getStoredWallet() !== addr) {
            await loginWithSiwe(addr, async ({ message }) =>
              signMessageAsync({ message })
            );
          }
          return addr;
        }

        const connector = pickConnector(connectors, connectorId);
        if (!connector) {
          throw new Error(
            'No wallet found. Install MetaMask (or another Web3 wallet), refresh, then try again.'
          );
        }

        // If connector thinks it's connected but wagmi isn't, force reconnect
        try {
          const result = await connectAsync({
            connector,
            chainId: appChain.id,
          });
          const addr = (result.accounts[0] || '').toLowerCase();
          if (!addr) throw new Error('No account returned from wallet');

          try {
            await ensureCorrectChain();
          } catch {
            /* some wallets add chain on next prompt */
          }

          setSessionWallet(addr);
          setLocalSession(addr);
          setSource('wallet');

          await loginWithSiwe(addr, async ({ message }) => {
            return signMessageAsync({ message });
          });

          return addr;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          // Already connected to this connector — pull address via reconnect path
          if (/already connected|connected/i.test(msg) && address) {
            const addr = address.toLowerCase();
            setSessionWallet(addr);
            setLocalSession(addr);
            setSource('wallet');
            await loginWithSiwe(addr, async ({ message }) =>
              signMessageAsync({ message })
            );
            return addr;
          }
          throw e;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Wallet connect failed';
        // Friendlier message for the common wagmi error
        const friendly = /connector not connected/i.test(msg)
          ? 'Wallet disconnected. Click Connect wallet and approve in MetaMask.'
          : msg;
        setAuthError(friendly);
        throw new Error(friendly);
      } finally {
        setAuthBusy(false);
      }
    },
    [
      connectors,
      connectAsync,
      ensureCorrectChain,
      signMessageAsync,
      wagmiConnected,
      address,
    ]
  );

  /**
   * Call before any sendTransaction / writeContract.
   * Reconnects the connector if session exists but wagmi is dead.
   */
  const ensureLiveWallet = useCallback(async () => {
    if (source === 'operator') {
      throw new Error(
        'Operator/demo profiles cannot send on-chain. Connect MetaMask for real transfers.'
      );
    }
    if (isWagmiConnected && address) {
      try {
        await ensureCorrectChain();
      } catch {
        /* user may switch manually */
      }
      return address.toLowerCase();
    }
    return connectWallet();
  }, [source, isWagmiConnected, address, ensureCorrectChain, connectWallet]);

  const signInWithEthereum = useCallback(async () => {
    const addr = await ensureLiveWallet();
    setAuthBusy(true);
    setAuthError(null);
    try {
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
  }, [ensureLiveWallet, signMessageAsync]);

  const connect = useCallback(
    async (addressInput: string) => {
      const addr = addressInput.toLowerCase();
      setAuthError(null);
      setAuthBusy(true);
      try {
        try {
          await disconnectAsync();
        } catch {
          /* ignore */
        }
        setSessionWallet(addr);
        setLocalSession(addr);
        setSource('operator');
        const token = await ensureOperatorAuth(addr);
        if (!token)
          throw new Error('Operator login failed — is ALLOW_OPERATOR_LOGIN enabled?');
        return addr;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Operator login failed';
        setAuthError(msg);
        throw e;
      } finally {
        setAuthBusy(false);
      }
    },
    [disconnectAsync]
  );

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
    isWagmiConnected &&
    Boolean(wallet) &&
    (getAuthMode() !== 'siwe' || getStoredWallet() !== wallet);

  return {
    wallet,
    ready,
    connect,
    connectWallet,
    ensureLiveWallet,
    signInWithEthereum,
    disconnect,
    isConnected,
    isWagmiConnected,
    source,
    authBusy,
    authError,
    connectPending,
    connectError: connectError?.message || authError,
    connectors,
    chainId,
    expectedChainId: appChain.id,
    chainName: appChain.name,
    wrongChain: Boolean(isWagmiConnected && chainId && chainId !== appChain.id),
    ensureCorrectChain,
    needsSiwe,
    wagmiStatus: status,
  };
}
