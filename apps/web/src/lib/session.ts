/**
 * Shared demo session wallet — one address used across Send / Receive / Scanner / Relayer.
 * Works without MetaMask in DEMO_MODE.
 */

const SESSION_WALLET_KEY = 'rh_session_wallet';
const SESSION_EVENT = 'rh-session-wallet';

export function getSessionWallet(): string | null {
  if (typeof window === 'undefined') return null;
  const v = localStorage.getItem(SESSION_WALLET_KEY);
  return v && /^0x[a-fA-F0-9]{40}$/i.test(v) ? v.toLowerCase() : null;
}

export function setSessionWallet(wallet: string) {
  const addr = wallet.toLowerCase();
  localStorage.setItem(SESSION_WALLET_KEY, addr);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SESSION_EVENT, { detail: addr }));
  }
}

export function clearSessionWallet() {
  localStorage.removeItem(SESSION_WALLET_KEY);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SESSION_EVENT, { detail: null }));
  }
}

export function isValidAddress(v: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(v);
}

/** React-friendly: subscribe to session wallet changes. */
export function onSessionWalletChange(cb: (wallet: string | null) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<string | null>).detail;
    cb(detail ?? getSessionWallet());
  };
  const storageHandler = (e: StorageEvent) => {
    if (e.key === SESSION_WALLET_KEY) cb(getSessionWallet());
  };
  window.addEventListener(SESSION_EVENT, handler);
  window.addEventListener('storage', storageHandler);
  return () => {
    window.removeEventListener(SESSION_EVENT, handler);
    window.removeEventListener('storage', storageHandler);
  };
}
