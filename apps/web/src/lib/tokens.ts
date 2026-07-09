/**
 * Token addresses.
 * SILENT = SilentTransfer product token (privacy-first ERC-20, no KYC).
 * Override via NEXT_PUBLIC_SILENT_ADDRESS after deploy.
 */

/**
 * Fallback if env not set.
 * Robinhood Chain Testnet (46630) SilentToken deployment.
 */
const SILENT_FALLBACK = '0xE429a44C3572353E3EE6a3c9100FF9BeC74498C4';

const silentFromEnv =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SILENT_ADDRESS
    ? process.env.NEXT_PUBLIC_SILENT_ADDRESS
    : '';

export const SILENT_ADDRESS =
  silentFromEnv && /^0x[a-fA-F0-9]{40}$/.test(silentFromEnv)
    ? silentFromEnv
    : SILENT_FALLBACK;

/** Native ETH uses zero address; remaining entries are ERC-20s. */
export const NATIVE_ETH_ADDRESS = '0x0000000000000000000000000000000000000000';

/** Deployed token addresses + native ETH + SILENT product token. */
export const TOKENS: Record<string, string> = {
  ETH: NATIVE_ETH_ADDRESS,
  SILENT: SILENT_ADDRESS,
  USDG: '0x03592B5E147d7752000723A9AA23fc6c70d968Ce',
  AAPL: '0x702175Be5D1888a054E5545312849464Daf29a24',
  NVDA: '0xFb97026d12bA25e36A3D95fF5E8eF455Df6597fF',
  GOOGL: '0x9A0bFeb84A8b2b849825190c6699280B7e9a4B04',
  MSFT: '0x1548B9503201f6ceC79a3b71caB9432Cf905C1eB',
};

export const TOKEN_META: Record<
  string,
  { name: string; primary?: boolean; decimals: number }
> = {
  ETH: { name: 'Ether', primary: true, decimals: 18 },
  SILENT: { name: 'Silent', decimals: 18 },
  USDG: { name: 'USDG Stablecoin', decimals: 18 },
  AAPL: { name: 'Apple Stock Token', decimals: 18 },
  NVDA: { name: 'NVIDIA Stock Token', decimals: 18 },
  GOOGL: { name: 'Google Stock Token', decimals: 18 },
  MSFT: { name: 'Microsoft Stock Token', decimals: 18 },
};

/** ETH first in dropdowns (default send asset). */
export const TOKEN_LIST = [
  'ETH',
  ...Object.keys(TOKENS).filter((k) => k !== 'ETH'),
];

export const DEFAULT_TOKEN = 'ETH';

/** Demo personas for one-click walkthrough (not real keys). */
export const DEMO_WALLETS = {
  alice: '0x1111111111111111111111111111111111111111',
  bob: '0x2222222222222222222222222222222222222222',
} as const;

export function truncAddr(a: string, left = 6, right = 4) {
  if (!a || a.length < left + right + 2) return a;
  return `${a.slice(0, left)}…${a.slice(-right)}`;
}

/** Human amount → wei string (18 decimals). */
export function toWeiString(amount: string): string {
  const cleaned = amount.trim();
  if (!cleaned) return '0';
  if (!cleaned.includes('.')) {
    try {
      const n = BigInt(cleaned);
      const wei = n * BigInt('1000000000000000000');
      return wei.toString();
    } catch {
      return cleaned;
    }
  }
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return '0';
  return String(Math.floor(n * 1e18));
}

export function formatTokenAmount(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  if (n >= 1e15) return (n / 1e18).toLocaleString(undefined, { maximumFractionDigits: 6 });
  return String(n);
}

export function tokenLabel(symbol: string): string {
  const meta = TOKEN_META[symbol];
  if (!meta) return symbol;
  return meta.primary ? `${symbol} · ${meta.name}` : symbol;
}
