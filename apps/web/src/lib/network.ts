/**
 * Network / environment helpers for SilentTransfer console.
 */

export type AppEnvironment = 'demo' | 'testnet' | 'mainnet';

export function getEnvironment(): AppEnvironment {
  const raw = (
    typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_ENVIRONMENT : ''
  )?.toLowerCase();
  if (raw === 'mainnet' || raw === 'demo' || raw === 'testnet') return raw;
  // Legacy: DEMO_MODE=true → demo
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return 'demo';
  }
  return 'testnet';
}

export function isDemoMode(): boolean {
  return getEnvironment() === 'demo';
}

export function isTestnetMode(): boolean {
  return getEnvironment() === 'testnet';
}

export function getChainId(): number {
  const raw =
    typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_CHAIN_ID : undefined;
  const n = raw ? Number(raw) : 46630;
  return Number.isFinite(n) ? n : 46630;
}

export function getNetworkName(): string {
  return (
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_NETWORK_NAME) ||
    'Robinhood Chain Testnet'
  );
}

export function getRpcUrl(): string {
  return (
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_RPC_URL) ||
    'https://rpc.testnet.chain.robinhood.com'
  );
}

export function environmentBadgeLabel(): string {
  const env = getEnvironment();
  if (env === 'mainnet') return 'MAINNET';
  if (env === 'testnet') return 'TESTNET';
  return 'DEMO';
}
