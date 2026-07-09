/**
 * SIWE helpers — real wallet sign-in against SilentTransfer API.
 */

import { API_BASE, setAuthSession, getStoredToken, getStoredWallet } from '@/lib/api';

export type SignMessageFn = (args: { message: string }) => Promise<`0x${string}` | string>;

export async function fetchSiweMessage(wallet: string): Promise<{ nonce: string; message: string }> {
  const addr = wallet.toLowerCase();
  // Prefer POST (always supported); fall back to GET query if needed
  let res = await fetch(
    `${API_BASE}/api/auth/siwe/nonce?wallet_address=${encodeURIComponent(addr)}`,
    { method: 'POST' }
  );
  if (res.status === 405) {
    res = await fetch(
      `${API_BASE}/api/auth/siwe/nonce?wallet_address=${encodeURIComponent(addr)}`
    );
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(
      typeof err.detail === 'string' ? err.detail : 'Failed to fetch SIWE nonce'
    );
  }
  return res.json();
}

export async function verifySiwe(
  message: string,
  signature: string
): Promise<{ token: string; wallet_address: string }> {
  const res = await fetch(`${API_BASE}/api/auth/siwe/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, signature }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = err.detail;
    const msg =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: { msg?: string }) => d.msg).join(', ')
          : 'SIWE verification failed';
    throw new Error(msg);
  }
  const data = (await res.json()) as {
    success: boolean;
    token: string;
    wallet_address: string;
  };
  setAuthSession(data.token, data.wallet_address, 'siwe');
  return data;
}

/** Sign EIP-4361 message with the connected wallet and mint API JWT. */
export async function loginWithSiwe(
  wallet: string,
  signMessage: SignMessageFn
): Promise<string> {
  const addr = wallet.toLowerCase();
  const existingToken = getStoredToken();
  const existingWallet = getStoredWallet();
  if (existingToken && existingWallet === addr) {
    return existingToken;
  }

  const { message } = await fetchSiweMessage(addr);
  const signature = await signMessage({ message });
  const { token } = await verifySiwe(message, signature);
  return token;
}
