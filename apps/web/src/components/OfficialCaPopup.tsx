'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, FileCode, X } from 'lucide-react';
import { SILENT_ADDRESS, TOKEN_SYMBOL } from '@/lib/tokens';

const STORAGE_KEY = 'sthood_ca_popup_dismissed_v1';

/**
 * Site-wide popup: Official CA for sthood.
 * Address is click-to-copy (button + address row).
 */
export default function OfficialCaPopup() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      if (window.sessionStorage.getItem(STORAGE_KEY) === '1') return;
    } catch {
      /* ignore storage errors */
    }
    const t = window.setTimeout(() => setOpen(true), 600);
    return () => window.clearTimeout(t);
  }, []);

  const dismiss = useCallback(() => {
    setOpen(false);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
  }, []);

  const copyCa = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(SILENT_ADDRESS);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers / insecure context
      try {
        const el = document.createElement('textarea');
        el.value = SILENT_ADDRESS;
        el.setAttribute('readonly', '');
        el.style.position = 'fixed';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, dismiss]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="official-ca-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[3px]"
        aria-label="Close official CA popup"
        onClick={dismiss}
      />

      <div className="relative w-full max-w-md rounded-2xl border border-[var(--border)] bg-white shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
              <FileCode className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                Official CA
              </p>
              <h2 id="official-ca-title" className="text-lg font-semibold text-[var(--text)] truncate">
                ${TOKEN_SYMBOL}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)] transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-4">
          <p className="text-sm text-[var(--text-muted)] leading-relaxed">
            Official contract address for <strong className="text-[var(--text)]">{TOKEN_SYMBOL}</strong>.
            Tap the address to copy.
          </p>

          <button
            type="button"
            onClick={copyCa}
            className="group w-full text-left rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] hover:border-emerald-300 hover:bg-emerald-50/60 transition-colors p-3.5"
            title="Click to copy"
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
                Contract address
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 opacity-70 group-hover:opacity-100" /> Copy
                  </>
                )}
              </span>
            </div>
            <code className="block font-mono text-[12px] sm:text-[13px] leading-relaxed break-all text-[var(--text)] select-all">
              {SILENT_ADDRESS}
            </code>
          </button>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={copyCa}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold px-4 py-2.5 hover:opacity-95 transition-opacity"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" /> Copied to clipboard
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" /> Copy official CA
                </>
              )}
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="sm:w-auto inline-flex items-center justify-center rounded-xl border border-[var(--border)] text-sm font-semibold px-4 py-2.5 text-[var(--text-muted)] hover:bg-[var(--bg-muted)] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
