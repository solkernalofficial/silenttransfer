/**
 * Protocol fee model (SilentTransfer).
 *
 * Current: 0% product fee on private send and gasless claim.
 * Planned: 0.5% (50 bps) on gasless / protocol-sponsored flows, allocated to
 * protocol operations and open-market sthood buybacks.
 *
 * Private send remains 0% product fee (network gas applies only on-chain).
 * Self-funded withdrawal: 0% product fee.
 */

/** Basis points: 50 = 0.5%, 0 = free. Override via NEXT_PUBLIC_PROTOCOL_FEE_BPS */
export const PROTOCOL_FEE_BPS = (() => {
  const raw =
    typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_PROTOCOL_FEE_BPS
      : undefined;
  const n = raw !== undefined && raw !== '' ? Number(raw) : 0;
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.floor(n), 1000);
})();

/** Planned fee when charging is enabled. */
export const PLANNED_PROTOCOL_FEE_BPS = 50;

export function protocolFeePercentLabel(bps: number = PROTOCOL_FEE_BPS): string {
  const pct = bps / 100;
  if (Number.isInteger(pct)) return `${pct}%`;
  return `${pct.toFixed(2).replace(/\.?0+$/, '')}%`;
}

export function plannedFeePercentLabel(): string {
  return protocolFeePercentLabel(PLANNED_PROTOCOL_FEE_BPS);
}

export function calcProtocolFee(amountHuman: string, bps: number = PROTOCOL_FEE_BPS): number {
  const n = Number(amountHuman);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return (n * bps) / 10000;
}

export function formatFeePreview(amountHuman: string): {
  fee: string;
  net: string;
  percent: string;
} {
  const n = Number(amountHuman);
  const percent = protocolFeePercentLabel();
  if (!Number.isFinite(n) || n <= 0) {
    return { fee: '0', net: '0', percent };
  }
  const fee = calcProtocolFee(amountHuman);
  const net = Math.max(0, n - fee);
  const fmt = (x: number) =>
    Number.isInteger(x) ? String(x) : x.toFixed(6).replace(/\.?0+$/, '');
  return { fee: fmt(fee), net: fmt(net), percent };
}

export const FEE_COPY = {
  send:
    'Protocol fee on private transfer: 0%. When executed on-chain, only network gas applies.',
  gasless: (percent: string) =>
    Number(percent.replace('%', '')) === 0
      ? 'Sponsored claim fee: 0% in the current environment. Planned rate: 0.5%, allocated to protocol operations and open-market sthood buybacks.'
      : `Sponsored claim fee: ${percent} of amount. Proceeds support protocol operations and open-market sthood buybacks.`,
  selfWithdraw: 'Self-funded withdrawal (user pays gas): 0% protocol fee.',
  policy:
    'Product fees are currently 0%. A planned 0.5% fee on sponsored claims will fund protocol operations and open-market sthood buybacks—not venture distributions.',
} as const;
