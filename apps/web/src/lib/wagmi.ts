'use client';

import { http, createConfig, createStorage, cookieStorage } from 'wagmi';
import { injected, walletConnect, metaMask } from 'wagmi/connectors';
import { getAppChain } from '@/lib/chains';

const projectId =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID) || '';

const appChain = getAppChain();

const connectors = [
  injected({ shimDisconnect: true }),
  metaMask(),
  ...(projectId
    ? [
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
        }),
      ]
    : []),
];

export const wagmiConfig = createConfig({
  chains: [appChain],
  connectors,
  transports: {
    [appChain.id]: http(appChain.rpcUrls.default.http[0]),
  },
  ssr: true,
  storage: createStorage({
    storage: cookieStorage,
  }),
  multiInjectedProviderDiscovery: true,
});

export function hasWalletConnect(): boolean {
  return Boolean(projectId);
}

export { appChain };
