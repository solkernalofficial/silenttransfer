import { defineChain } from 'viem';
import { getChainId, getNetworkName, getRpcUrl } from '@/lib/network';

/**
 * Robinhood Chain Testnet (and env-driven overrides for other chains).
 */
export const robinhoodTestnet = defineChain({
  id: 46630,
  name: 'Robinhood Chain Testnet',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.testnet.chain.robinhood.com'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Robinhood Explorer',
      url: 'https://explorer.testnet.chain.robinhood.com',
    },
  },
  testnet: true,
});

/** Active app chain from env (defaults to Robinhood testnet). */
export function getAppChain() {
  const id = getChainId();
  const name = getNetworkName();
  const rpc = getRpcUrl();
  if (id === 46630) {
    return {
      ...robinhoodTestnet,
      name,
      rpcUrls: { default: { http: [rpc] } },
    };
  }
  return defineChain({
    id,
    name,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rpc] } },
    testnet: id !== 1,
  });
}
