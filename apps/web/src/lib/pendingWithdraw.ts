/**
 * Hand-off between Scanner → Relayer so Bob can claim a payment in one click.
 */

const KEY = 'rh_pending_withdraw';

export interface PendingWithdraw {
  stealth_address: string;
  target_owner: string;
  amount: string; // human token amount string, e.g. "10"
  token_symbol?: string;
  from_address?: string;
  /** Client-held claim key when available from local vault */
  claim_private_key?: string;
  claim_mode?: 'client' | 'server' | 'stealth';
}

export function setPendingWithdraw(p: PendingWithdraw) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(KEY, JSON.stringify(p));
}

export function getPendingWithdraw(): PendingWithdraw | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PendingWithdraw;
    if (!p?.stealth_address || !p?.target_owner) return null;
    return p;
  } catch {
    return null;
  }
}

export function clearPendingWithdraw() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(KEY);
}
