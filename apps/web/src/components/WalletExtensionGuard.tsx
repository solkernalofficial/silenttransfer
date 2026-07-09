'use client';

import { useEffect } from 'react';
import { installWalletExtensionErrorSuppressor } from '@/lib/suppress-wallet-extension-errors';

/** Client-side install (backup if public script already ran). */
export default function WalletExtensionGuard() {
  useEffect(() => {
    installWalletExtensionErrorSuppressor();
  }, []);
  return null;
}
