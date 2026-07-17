/**
 * SILENT tokenomics — public allocation policy.
 * Hard cap: 1,000,000,000 sthood (enforced on-chain; no mint above cap).
 *
 * Launch model: Pons launchpad fair-launch style —
 * majority community supply, small protocol share for ops. No VC. No separate team pool.
 */

export const SILENT_TOTAL_SUPPLY = 1_000_000_000;
export const SILENT_TOTAL_SUPPLY_LABEL = '1,000,000,000';
export const SILENT_TOTAL_SUPPLY_SHORT = '1B';

/** Protocol / operations share (5–10% band). Rest is community. */
export const SILENT_PROTOCOL_PERCENT = 10;
export const SILENT_COMMUNITY_PERCENT = 100 - SILENT_PROTOCOL_PERCENT;

export const SILENT_VC_PERCENT = 0;
export const SILENT_TEAM_PERCENT = 0;

export const SILENT_HARD_CAP = true;
export const SILENT_HARD_CAP_NOTE =
  'Maximum supply is hard-capped at 1,000,000,000 sthood on-chain. Minting above the cap is not permitted.';

export const SILENT_LAUNCH_NOTE =
  'Launched on Pons launchpad: community-majority supply with a small protocol share for operations. No venture allocation and no separate team pool.';

export type SilentAllocationId = 'community' | 'protocol';

export type SilentAllocationSlice = {
  id: SilentAllocationId;
  label: string;
  percent: number;
  amount: number;
  amountLabel: string;
  lock: string;
  color: string;
  soft: string;
  border: string;
};

export function silentAmountFromPercent(percent: number): number {
  return (SILENT_TOTAL_SUPPLY * percent) / 100;
}

function amountLabelFromPercent(percent: number): string {
  return silentAmountFromPercent(percent).toLocaleString('en-US');
}

export const SILENT_ALLOCATION: SilentAllocationSlice[] = [
  {
    id: 'community',
    label: 'Community',
    percent: SILENT_COMMUNITY_PERCENT,
    amount: silentAmountFromPercent(SILENT_COMMUNITY_PERCENT),
    amountLabel: amountLabelFromPercent(SILENT_COMMUNITY_PERCENT),
    lock: 'Public / community supply via Pons launchpad. Ecosystem, users, and open-market float—not a VC pool.',
    color: '#059669',
    soft: '#ecfdf5',
    border: '#a7f3d0',
  },
  {
    id: 'protocol',
    label: 'Protocol',
    percent: SILENT_PROTOCOL_PERCENT,
    amount: silentAmountFromPercent(SILENT_PROTOCOL_PERCENT),
    amountLabel: amountLabelFromPercent(SILENT_PROTOCOL_PERCENT),
    lock: 'Small protocol share for ops, infra, and continuity. Not venture supply. Within the 5–10% protocol band.',
    color: '#0284c7',
    soft: '#f0f9ff',
    border: '#7dd3fc',
  },
];

/** Human-readable one-liner for marketing pages. */
export function silentAllocationSummary(): string {
  return SILENT_ALLOCATION.map((a) => `${a.label} ${a.percent}%`).join(' · ');
}

/** True when slice percents sum to 100. */
export function silentAllocationIsBalanced(): boolean {
  const sum = SILENT_ALLOCATION.reduce((n, a) => n + a.percent, 0);
  return Math.abs(sum - 100) < 1e-9;
}

export function pieSlicePath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startDeg: number,
  endDeg: number
): string {
  const toRad = (d: number) => ((d - 90) * Math.PI) / 180;
  const large = endDeg - startDeg > 180 ? 1 : 0;
  const x0 = cx + rOuter * Math.cos(toRad(startDeg));
  const y0 = cy + rOuter * Math.sin(toRad(startDeg));
  const x1 = cx + rOuter * Math.cos(toRad(endDeg));
  const y1 = cy + rOuter * Math.sin(toRad(endDeg));
  const xi0 = cx + rInner * Math.cos(toRad(endDeg));
  const yi0 = cy + rInner * Math.sin(toRad(endDeg));
  const xi1 = cx + rInner * Math.cos(toRad(startDeg));
  const yi1 = cy + rInner * Math.sin(toRad(startDeg));

  if (rInner <= 0) {
    return [
      `M ${cx} ${cy}`,
      `L ${x0} ${y0}`,
      `A ${rOuter} ${rOuter} 0 ${large} 1 ${x1} ${y1}`,
      'Z',
    ].join(' ');
  }

  return [
    `M ${x0} ${y0}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${x1} ${y1}`,
    `L ${xi0} ${yi0}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${xi1} ${yi1}`,
    'Z',
  ].join(' ');
}

export function allocationPieSlices() {
  let cursor = 0;
  return SILENT_ALLOCATION.map((row) => {
    const start = cursor;
    const end = cursor + (row.percent / 100) * 360;
    cursor = end;
    return { ...row, startDeg: start, endDeg: end };
  });
}
