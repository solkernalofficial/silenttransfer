'use client';

import { http, createConfig, createStorage, cookieStorage, type Config } from 'wagmi';
import { injected, walletConnect } from 'wagmi/connectors';
import { getAppChain } from '@/lib/chains';

const projectId =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID) || '';

const appChain = getAppChain();

/**
 * Prefer a single injected connector (MetaMask / Rabby / etc.).
 * Avoid stacking metaMask() + injected() — dual connectors cause
 * "Connector not connected" after reload when the wrong one is restored.
 */
function buildConnectors() {
  const list = [
    injected({
      shimDisconnect: true,
      // Wait for async inject (extension loads after page)
      unstable_shimAsyncInject: 2_000,
    }),
  ];
  if (projectId) {
    list.push(
      walletConnect({
        projectId,
        showQrModal: true,
        metadata: {
          name: 'SilentTransfer',
          description: 'Private transfer infrastructure for public blockchains',
          url:
            (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SITE_URL) ||
            'https://silenttransfer.com',
          icons: [
            `${
              (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SITE_URL) ||
              'https://silenttransfer.com'
            }/brand/logo.svg`,
          ],
        },
      })
    );
  }
  return list;
}

/** Client-friendly storage: localStorage reconnects injected wallets more reliably than cookies alone. */
function createAppStorage() {
  if (typeof window === 'undefined') {
    return createStorage({ storage: cookieStorage });
  }
  return createStorage({
    storage: window.localStorage,
    key: 'silenttransfer.wagmi',
  });
}

export const wagmiConfig: Config = createConfig({
  chains: [appChain],
  connectors: buildConnectors(),
  transports: {
    [appChain.id]: http(appChain.rpcUrls.default.http[0], {
      timeout: 30_000,
      retryCount: 2,
    }),
  },
  ssr: true,
  storage: createAppStorage(),
  multiInjectedProviderDiscovery: true,
});

export function hasWalletConnect(): boolean {
  return Boolean(projectId);
}

export { appChain };
