/**
 * SILENT tokenomics — public allocation policy.
 * Hard cap: 1,000,000,000 SILENT (enforced on-chain; no mint above cap).
 * No venture capital allocation.
 *
 * Foundation/team vesting schedules will be published when lock contracts deploy.
 */

export const SILENT_TOTAL_SUPPLY = 1_000_000_000;
export const SILENT_TOTAL_SUPPLY_LABEL = '1,000,000,000';
export const SILENT_TOTAL_SUPPLY_SHORT = '1B';

export type SilentAllocationSlice = {
  id: 'community' | 'foundation' | 'team';
  label: string;
  percent: number;
  amount: number;
  amountLabel: string;
  lock: string;
  color: string;
  soft: string;
  border: string;
};

export const SILENT_ALLOCATION: SilentAllocationSlice[] = [
  {
    id: 'community',
    label: 'Community',
    percent: 60,
    amount: 600_000_000,
    amountLabel: '600,000,000',
    lock: 'Reserved for ecosystem programs, contributors, and end-user distribution under published policies.',
    color: '#059669',
    soft: '#ecfdf5',
    border: '#a7f3d0',
  },
  {
    id: 'foundation',
    label: 'Foundation / Protocol',
    percent: 35,
    amount: 350_000_000,
    amountLabel: '350,000,000',
    lock: 'Reserved for foundation and protocol operations. Intended lock period applies; not available as venture supply.',
    color: '#0284c7',
    soft: '#f0f9ff',
    border: '#7dd3fc',
  },
  {
    id: 'team',
    label: 'Team',
    percent: 15,
    amount: 150_000_000,
    amountLabel: '150,000,000',
    lock: 'Team allocation subject to a published vesting schedule. Not unrestricted day-one float.',
    color: '#7c3aed',
    soft: '#f5f3ff',
    border: '#c4b5fd',
  },
];

export const SILENT_VC_PERCENT = 0;

export const SILENT_HARD_CAP = true;
export const SILENT_HARD_CAP_NOTE =
  'Maximum supply is hard-capped at 1,000,000,000 SILENT on-chain. Minting above the cap is not permitted.';

export function silentAmountFromPercent(percent: number): number {
  return (SILENT_TOTAL_SUPPLY * percent) / 100;
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
