const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
const TOKEN_KEY = 'rh_access_token';
const WALLET_KEY = 'rh_auth_wallet';
const AUTH_MODE_KEY = 'rh_auth_mode'; // 'siwe' | 'operator'

export type AuthMode = 'siwe' | 'operator';

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredWallet(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(WALLET_KEY);
}

export function getAuthMode(): AuthMode | null {
  if (typeof window === 'undefined') return null;
  const m = localStorage.getItem(AUTH_MODE_KEY);
  return m === 'siwe' || m === 'operator' ? m : null;
}

export function setAuthSession(token: string, wallet: string, mode: AuthMode = 'operator') {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(WALLET_KEY, wallet.toLowerCase());
  localStorage.setItem(AUTH_MODE_KEY, mode);
}

export function clearAuthSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(WALLET_KEY);
  localStorage.removeItem(AUTH_MODE_KEY);
}

/**
 * Operator / evaluation login (Alice, Bob, or any 0x address) — no wallet signature.
 * Available when API ALLOW_OPERATOR_LOGIN=true (demo + testnet).
 */
export async function ensureOperatorAuth(wallet: string): Promise<string | null> {
  const addr = wallet.toLowerCase();
  const existingToken = getStoredToken();
  const existingWallet = getStoredWallet();
  if (existingToken && existingWallet === addr) {
    return existingToken;
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/demo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet_address: addr }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(
        typeof err.detail === 'string' ? err.detail : 'Operator login failed'
      );
    }
    const data = (await res.json()) as { token: string; wallet_address: string };
    setAuthSession(data.token, data.wallet_address, 'operator');
    return data.token;
  } catch (e) {
    console.warn('ensureOperatorAuth failed', e);
    return null;
  }
}

/** @deprecated use ensureOperatorAuth — kept for call-site compatibility */
export async function ensureDemoAuth(wallet: string): Promise<string | null> {
  return ensureOperatorAuth(wallet);
}

export async function api<T = unknown>(
  path: string,
  method: string = 'GET',
  body?: unknown,
  opts?: { auth?: boolean; wallet?: string }
): Promise<T | null> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (opts?.auth) {
    let token = getStoredToken();
    // Only auto-mint operator JWT when already in operator mode or no SIWE session
    if (opts.wallet) {
      const mode = getAuthMode();
      const stored = getStoredWallet();
      if (!token || stored !== opts.wallet.toLowerCase()) {
        if (mode !== 'siwe') {
          token = (await ensureOperatorAuth(opts.wallet)) || token;
        }
      }
    }
    if (!token) {
      throw new Error('Not authenticated — connect wallet and sign in');
    }
    headers.Authorization = `Bearer ${token}`;
  } else {
    const token = getStoredToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const init: RequestInit = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);

  try {
    const res = await fetch(`${API_BASE}${path}`, init);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      const detail = err.detail;
      const msg =
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? detail.map((d: { msg?: string }) => d.msg).join(', ')
            : err.error || res.statusText || 'API Error';
      if (opts?.auth) throw new Error(msg);
      console.warn('API error', path, msg);
      return null;
    }
    return res.json();
  } catch (e) {
    console.warn('API error', path, e);
    if (opts?.auth) throw e;
    return null;
  }
}

export function useApi() {
  return {
    api,
    API_BASE,
    ensureDemoAuth,
    ensureOperatorAuth,
    getStoredToken,
    getStoredWallet,
    getAuthMode,
  };
}

export { API_BASE };
