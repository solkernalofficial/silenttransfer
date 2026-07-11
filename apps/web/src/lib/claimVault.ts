/**
 * Client-held claim material for private sends.
 * Spend keys never leave the browser unless the recipient pastes/shares a claim code.
 */

const VAULT_KEY = 'silenttransfer_claim_vault_v1';

export type ClaimMode = 'client' | 'server';

export interface ClaimPackage {
  version: 1;
  stealth_address: string;
  claim_private_key: `0x${string}`;
  to_address: string;
  from_address?: string;
  amount?: string;
  token_symbol?: string;
  funding_tx_hash?: string;
  created_at: string;
  claim_mode: ClaimMode;
}

type VaultMap = Record<string, ClaimPackage>;

function readVault(): VaultMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(VAULT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as VaultMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeVault(map: VaultMap) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(VAULT_KEY, JSON.stringify(map));
}

export function vaultKey(stealth: string): string {
  return stealth.toLowerCase();
}

export function saveClaimPackage(pkg: ClaimPackage): void {
  const map = readVault();
  map[vaultKey(pkg.stealth_address)] = {
    ...pkg,
    stealth_address: pkg.stealth_address.toLowerCase(),
    to_address: pkg.to_address.toLowerCase(),
    from_address: pkg.from_address?.toLowerCase(),
  };
  writeVault(map);
}

export function getClaimPackage(stealth: string): ClaimPackage | null {
  const map = readVault();
  return map[vaultKey(stealth)] || null;
}

export function getClaimKeyForStealth(stealth: string): `0x${string}` | null {
  const pkg = getClaimPackage(stealth);
  return pkg?.claim_private_key || null;
}

export function listClaimPackagesForRecipient(to: string): ClaimPackage[] {
  const target = to.toLowerCase();
  return Object.values(readVault()).filter((p) => p.to_address === target);
}

export function removeClaimPackage(stealth: string): void {
  const map = readVault();
  delete map[vaultKey(stealth)];
  writeVault(map);
}

/** Compact share string: claim:v1:<stealth>:<key> */
export function encodeClaimCode(pkg: Pick<ClaimPackage, 'stealth_address' | 'claim_private_key'>): string {
  const stealth = pkg.stealth_address.toLowerCase().replace(/^0x/, '');
  const key = pkg.claim_private_key.toLowerCase().replace(/^0x/, '');
  return `claim:v1:0x${stealth}:0x${key}`;
}

export function parseClaimCode(raw: string): {
  stealth_address: string;
  claim_private_key: `0x${string}`;
} | null {
  const s = (raw || '').trim();
  if (!s) return null;

  // claim:v1:0x…:0x…
  const m = s.match(
    /^claim:v1:(0x[a-fA-F0-9]{40}):(0x[a-fA-F0-9]{64})$/i
  );
  if (m) {
    return {
      stealth_address: m[1].toLowerCase(),
      claim_private_key: m[2].toLowerCase() as `0x${string}`,
    };
  }

  // Raw private key only
  if (/^0x[a-fA-F0-9]{64}$/i.test(s)) {
    return null; // needs stealth separately
  }

  // JSON package
  try {
    const j = JSON.parse(s) as Partial<ClaimPackage>;
    if (
      j.stealth_address &&
      j.claim_private_key &&
      /^0x[a-fA-F0-9]{40}$/i.test(j.stealth_address) &&
      /^0x[a-fA-F0-9]{64}$/i.test(j.claim_private_key)
    ) {
      return {
        stealth_address: j.stealth_address.toLowerCase(),
        claim_private_key: j.claim_private_key.toLowerCase() as `0x${string}`,
      };
    }
  } catch {
    /* not JSON */
  }

  return null;
}

export function downloadClaimPackage(pkg: ClaimPackage): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `silent-claim-${pkg.stealth_address.slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
