'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  imageSrc?: string;
  compact?: boolean;
}

export default function EmptyState({
  title,
  description,
  action,
  imageSrc = '/brand/empty-state.jpg',
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center text-center ${
        compact ? 'py-8 px-4 gap-2' : 'py-12 px-6 gap-3'
      }`}
    >
      <div
        className={`relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-muted)] shadow-sm ${
          compact ? 'w-28 h-28' : 'w-40 h-40 sm:w-48 sm:h-48'
        }`}
      >
        <Image src={imageSrc} alt="" fill className="object-cover" sizes="192px" />
      </div>
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-semibold text-[var(--text)]">{title}</p>
        {description && (
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
