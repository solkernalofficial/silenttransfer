'use client';

import { Droplets, ExternalLink } from 'lucide-react';
import { getAppFaucets, type FaucetLink } from '@/lib/faucets';
import { getNetworkDetails } from '@/lib/addChain';

type Variant = 'inline' | 'card' | 'compact';

type Props = {
  variant?: Variant;
  className?: string;
  /** Override chain; defaults to app network */
  chainId?: number;
  title?: string;
};

/**
 * Testnet faucet links — place next to network details / wrong-chain UI.
 */
export default function FaucetLinks({
  variant = 'card',
  className = '',
  chainId,
  title,
}: Props) {
  const faucets = getAppFaucets(chainId);
  if (!faucets.length) return null;

  const net = getNetworkDetails();
  const heading = title || `Get test ${net.currencySymbol}`;

  if (variant === 'compact') {
    return (
      <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] ${className}`}>
        <span className="inline-flex items-center gap-1 text-[var(--text-muted)] font-medium">
          <Droplets className="w-3 h-3 text-sky-600" />
          Faucet:
        </span>
        {faucets.map((f, i) => (
          <span key={f.url} className="inline-flex items-center gap-1">
            {i > 0 && <span className="text-[var(--text-faint)]">·</span>}
            <FaucetAnchor faucet={f} className="text-sky-700 hover:text-sky-900 font-semibold underline-offset-2 hover:underline" />
          </span>
        ))}
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <p className={`text-[11px] text-[var(--text-muted)] leading-relaxed ${className}`}>
        <Droplets className="w-3 h-3 text-sky-600 inline-block mr-1 align-text-bottom" />
        Need testnet {net.currencySymbol}?{' '}
        {faucets.map((f, i) => (
          <span key={f.url}>
            {i > 0 && <span className="text-[var(--text-faint)]"> · </span>}
            <FaucetAnchor faucet={f} className="font-semibold text-sky-800 underline underline-offset-2" />
          </span>
        ))}
      </p>
    );
  }

  // card
  return (
    <div
      className={`rounded-xl border border-sky-200 bg-sky-50/80 p-3.5 space-y-2.5 ${className}`}
    >
      <div className="flex items-start gap-2">
        <div className="w-8 h-8 rounded-lg bg-sky-100 border border-sky-200 flex items-center justify-center shrink-0">
          <Droplets className="w-4 h-4 text-sky-700" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-sky-950">{heading}</p>
          <p className="text-[11px] text-sky-900/75 leading-relaxed mt-0.5">
            Request free testnet {net.currencySymbol} on {net.name} for gas and private sends.
            Faucets may rate-limit — try the alternate if one is busy.
          </p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        {faucets.map((f) => (
          <a
            key={f.url}
            href={f.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-between gap-2 flex-1 px-3 py-2 rounded-lg bg-white border border-sky-200 text-xs font-semibold text-sky-950 hover:bg-sky-100/80 hover:border-sky-300 transition-colors"
          >
            <span className="truncate">
              {f.name}
              {f.note && (
                <span className="block text-[10px] font-normal text-sky-800/70 mt-0.5">
                  {f.note}
                </span>
              )}
            </span>
            <ExternalLink className="w-3.5 h-3.5 shrink-0 text-sky-600" />
          </a>
        ))}
      </div>
    </div>
  );
}

function FaucetAnchor({
  faucet,
  className,
}: {
  faucet: FaucetLink;
  className?: string;
}) {
  return (
    <a href={faucet.url} target="_blank" rel="noopener noreferrer" className={className}>
      {faucet.name.replace(/\s*faucet$/i, '') || faucet.name}
      <ExternalLink className="w-2.5 h-2.5 inline-block ml-0.5 align-text-top opacity-70" />
    </a>
  );
}
