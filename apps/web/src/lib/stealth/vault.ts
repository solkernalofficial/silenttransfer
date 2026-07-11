/**
 * Client-only stealth meta-key vault (spending + viewing private keys).
 * Never send private keys to the API.
 */

import {
  generateStealthMetaKeys,
  type Hex,
  type StealthMetaKeys,
} from '@/lib/stealth/crypto';

const VAULT_KEY = 'silenttransfer_stealth_meta_v1';

export interface StealthVaultEntry {
  wallet: string;
  spendingPrivateKey: Hex;
  viewingPrivateKey: Hex;
  spendingPublicKey: Hex;
  viewingPublicKey: Hex;
  created_at: string;
}

type VaultMap = Record<string, StealthVaultEntry>;

function readMap(): VaultMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(VAULT_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as VaultMap;
    return p && typeof p === 'object' ? p : {};
  } catch {
    return {};
  }
}

function writeMap(m: VaultMap) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(VAULT_KEY, JSON.stringify(m));
}

export function getStealthVault(wallet: string): StealthVaultEntry | null {
  if (!wallet) return null;
  return readMap()[wallet.toLowerCase()] || null;
}

export function listStealthVaults(): StealthVaultEntry[] {
  return Object.values(readMap());
}

export function saveStealthVault(entry: StealthVaultEntry): void {
  const m = readMap();
  m[entry.wallet.toLowerCase()] = {
    ...entry,
    wallet: entry.wallet.toLowerCase(),
  };
  writeMap(m);
}

export function ensureStealthVault(wallet: string): StealthVaultEntry {
  const existing = getStealthVault(wallet);
  if (existing) return existing;
  const keys: StealthMetaKeys = generateStealthMetaKeys();
  const entry: StealthVaultEntry = {
    wallet: wallet.toLowerCase(),
    spendingPrivateKey: keys.spendingPrivateKey,
    viewingPrivateKey: keys.viewingPrivateKey,
    spendingPublicKey: keys.spendingPublicKey,
    viewingPublicKey: keys.viewingPublicKey,
    created_at: new Date().toISOString(),
  };
  saveStealthVault(entry);
  return entry;
}

export function clearStealthVault(wallet: string): void {
  const m = readMap();
  delete m[wallet.toLowerCase()];
  writeMap(m);
}

export function exportStealthVaultJson(wallet: string): string | null {
  const e = getStealthVault(wallet);
  if (!e) return null;
  return JSON.stringify(e, null, 2);
}

export function importStealthVaultJson(json: string): StealthVaultEntry {
  const e = JSON.parse(json) as StealthVaultEntry;
  if (!e.wallet || !e.spendingPrivateKey || !e.viewingPrivateKey) {
    throw new Error('Invalid stealth vault JSON');
  }
  saveStealthVault(e);
  return e;
}
