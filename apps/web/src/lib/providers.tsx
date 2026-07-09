'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';

/**
 * Demo mode uses session wallet (localStorage + JWT) — no MetaMask / window.ethereum.
 * Skipping Wagmi avoids multi-wallet extension fights:
 *   "Cannot redefine property: ethereum" (Phantom, MetaMask, etc.)
 *
 * When wiring real wallet connect later, add Wagmi only behind
 * NEXT_PUBLIC_DEMO_MODE=false and a single connector strategy.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
