'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';
import { WagmiProvider } from 'wagmi';
import { wagmiConfig } from '@/lib/wagmi';
import OfficialCaPopup from '@/components/OfficialCaPopup';

/**
 * Wagmi (WalletConnect + injected + MetaMask) for real testnet wallets.
 * Session/operator login still works via SIWE or demo-login for Alice/Bob.
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

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
        <OfficialCaPopup />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
