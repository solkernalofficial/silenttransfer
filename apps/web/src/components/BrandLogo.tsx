'use client';

import Link from 'next/link';

/** Production docs host; local dev uses /docs so content is viewable without DNS. */
export const DOCS_URL =
  process.env.NEXT_PUBLIC_DOCS_URL ||
  (process.env.NODE_ENV === 'development'
    ? '/docs'
    : 'https://docs.silenttransfer.com');

export const SILENT_PAGE_URL = '/silent';

type BrandLogoProps = {
  size?: number;
  /** Show wordmark next to mark */
  withWordmark?: boolean;
  /** Subtitle under SilentTransfer — never the full domain */
  subtitle?: string;
  href?: string;
  className?: string;
  dark?: boolean;
};

/** Clean SilentTransfer mark (SVG) + optional wordmark. */
export function BrandMark({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-[0.75rem] overflow-hidden shadow-sm ring-1 ring-black/5 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/logo.svg"
        alt=""
        width={size}
        height={size}
        className="w-full h-full object-cover"
      />
    </span>
  );
}

export default function BrandLogo({
  size = 40,
  withWordmark = true,
  subtitle = 'Privacy',
  href = '/',
  className = '',
}: BrandLogoProps) {
  const inner = (
    <>
      <BrandMark size={size} />
      {withWordmark && (
        <span className="lp-brand-text leading-tight">
          <span className="lp-brand-name">SilentTransfer</span>
          {subtitle ? <span className="lp-brand-sub">{subtitle}</span> : null}
        </span>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`lp-brand ${className}`} title="SilentTransfer home">
        {inner}
      </Link>
    );
  }
  return <span className={`lp-brand ${className}`}>{inner}</span>;
}
