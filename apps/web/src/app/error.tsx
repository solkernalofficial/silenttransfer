'use client';

import { useEffect } from 'react';
import { isWalletExtensionNoise } from '@/lib/suppress-wallet-extension-errors';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (isWalletExtensionNoise(error.message)) {
      // Wallet extension noise — recover immediately
      reset();
    }
  }, [error, reset]);

  if (isWalletExtensionNoise(error.message)) {
    return null;
  }

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-lg font-semibold text-[var(--text)]">Something went wrong</h2>
      <p className="text-sm text-[var(--text-muted)] max-w-md">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold"
      >
        Try again
      </button>
    </div>
  );
}
