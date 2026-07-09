'use client';

import {
  SILENT_ALLOCATION,
  SILENT_TOTAL_SUPPLY_SHORT,
  SILENT_VC_PERCENT,
  allocationPieSlices,
  pieSlicePath,
} from '@/lib/tokenomics';

type Props = {
  /** Outer radius of pie (viewBox is 0..200) */
  size?: number;
  /** Show center label */
  showCenter?: boolean;
  className?: string;
};

/**
 * Colored donut pie for SILENT allocation (Community / Foundation / Team).
 */
export default function AllocationPie({
  size = 220,
  showCenter = true,
  className = '',
}: Props) {
  const cx = 100;
  const cy = 100;
  const rOuter = 88;
  const rInner = 52;
  const slices = allocationPieSlices();

  return (
    <div className={`flex flex-col items-center gap-5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        role="img"
        aria-label="SILENT allocation pie chart: Community 60%, Foundation 35%, Team 15%"
        className="drop-shadow-sm"
      >
        {/* Soft plate */}
        <circle cx={cx} cy={cy} r={rOuter + 4} fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />

        {slices.map((s) => (
          <path
            key={s.id}
            d={pieSlicePath(cx, cy, rOuter, rInner, s.startDeg, s.endDeg)}
            fill={s.color}
            stroke="#ffffff"
            strokeWidth="2"
            className="transition-opacity hover:opacity-90"
          >
            <title>{`${s.label}: ${s.percent}% (${s.amountLabel} SILENT)`}</title>
          </path>
        ))}

        {/* Hole */}
        <circle cx={cx} cy={cy} r={rInner - 1} fill="#ffffff" />

        {showCenter && (
          <>
            <text
              x={cx}
              y={cy - 6}
              textAnchor="middle"
              className="fill-slate-900"
              style={{ fontSize: 18, fontWeight: 700, fontFamily: 'ui-sans-serif, system-ui' }}
            >
              {SILENT_TOTAL_SUPPLY_SHORT}
            </text>
            <text
              x={cx}
              y={cy + 14}
              textAnchor="middle"
              className="fill-slate-500"
              style={{ fontSize: 10, fontWeight: 600, fontFamily: 'ui-sans-serif, system-ui' }}
            >
              hard cap · VC {SILENT_VC_PERCENT}%
            </text>
          </>
        )}
      </svg>

      {/* Legend */}
      <ul className="w-full max-w-sm space-y-2.5">
        {SILENT_ALLOCATION.map((row) => (
          <li
            key={row.id}
            className="flex items-center gap-3 text-sm"
          >
            <span
              className="w-3.5 h-3.5 rounded-full shrink-0 ring-2 ring-white shadow-sm"
              style={{ backgroundColor: row.color }}
              aria-hidden
            />
            <span className="flex-1 text-[var(--text-secondary)] font-medium">{row.label}</span>
            <span className="font-mono font-bold text-[var(--text)] tabular-nums">
              {row.percent}%
            </span>
          </li>
        ))}
        <li className="flex items-center gap-3 text-sm pt-1 border-t border-[var(--border)]">
          <span className="w-3.5 h-3.5 rounded-full shrink-0 bg-slate-200 ring-2 ring-white" />
          <span className="flex-1 text-[var(--text-muted)] font-medium">VC</span>
          <span className="font-mono font-bold text-emerald-700 tabular-nums">0%</span>
        </li>
      </ul>
    </div>
  );
}
