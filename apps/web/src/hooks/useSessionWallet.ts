'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  clearSessionWallet,
  getSessionWallet,
  onSessionWalletChange,
  setSessionWallet,
} from '@/lib/session';
import { ensureDemoAuth, clearAuthSession } from '@/lib/api';

/**
 * Shared wallet for the demo app (no MetaMask required).
 */
export function useSessionWallet() {
  const [wallet, setWallet] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setWallet(getSessionWallet());
    setReady(true);
    return onSessionWalletChange((w) => setWallet(w));
  }, []);

  const connect = useCallback(async (address: string) => {
    const addr = address.toLowerCase();
    setSessionWallet(addr);
    setWallet(addr);
    await ensureDemoAuth(addr);
    return addr;
  }, []);

  const disconnect = useCallback(() => {
    clearSessionWallet();
    clearAuthSession();
    setWallet(null);
  }, []);

  return { wallet, ready, connect, disconnect, isConnected: Boolean(wallet) };
}
