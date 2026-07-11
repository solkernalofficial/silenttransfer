/**
 * Simple private send to any address.
 *
 * - If B has Receive enabled → ERC-5564 stealth (stronger; only B's keys can claim)
 * - Else → one-time address + server-assisted claim (B just connects wallet & claims)
 *
 * User never needs to pre-setup the recipient for the simple path.
 */

import { isAddress } from 'viem';
import { api } from '@/lib/api';
import { executePrivateSend, type PrivateSendResult } from '@/lib/privateSend';
import {
  executeStealthSend,
  type StealthSendDeps,
  type StealthSendResult,
  type RecipientMeta,
} from '@/lib/stealth/sendStealth';
import { encodeClaimCode, type ClaimPackage } from '@/lib/claimVault';
import { STEALTH_SCHEME_NAME } from '@/lib/stealth/crypto';

export type UnifiedSendResult =
  | (StealthSendResult & { path: 'stealth' })
  | (PrivateSendResult & {
      path: 'simple';
      scheme: 'one-time-eoa';
      announce_tx_hash?: string;
      ephemeral_public_key?: string;
    });

async function tryFetchRecipientMeta(toWallet: string): Promise<RecipientMeta | null> {
  try {
    const reg = await api<RecipientMeta>(
      `/api/registrations/${toWallet.toLowerCase()}`
    );
    if (reg?.spending_pubkey && reg?.viewing_pubkey) return reg;
  } catch {
    /* 404 = not registered */
  }
  return null;
}

export type SendAnyDeps = StealthSendDeps & {
  writeContractAsync?: StealthSendDeps['writeContractAsync'] &
    Parameters<typeof executePrivateSend>[1]['writeContractAsync'];
};

/**
 * Private send to any 0x address. No recipient setup required.
 */
export async function executeSendAny(deps: SendAnyDeps): Promise<UnifiedSendResult> {
  const { fromWallet, toWallet, amount, onStatus } = deps;

  if (!isAddress(fromWallet) || !isAddress(toWallet)) {
    throw new Error('Invalid addresses');
  }

  onStatus?.('Checking recipient…');
  const meta = await tryFetchRecipientMeta(toWallet);

  if (meta) {
    onStatus?.('Recipient has private receive — using stealth (ERC-5564)…');
    const r = await executeStealthSend(deps);
    return { ...r, path: 'stealth' };
  }

  // Simple path: any address, B claims with their wallet only (server holds claim key until claim)
  onStatus?.('Sending privately (one-time address — recipient just claims)…');
  const r = await executePrivateSend(
    { toWallet, amount, token: 'ETH' },
    {
      fromWallet,
      chainId: deps.chainId,
      // Server-assisted so B needs no setup and no claim code from A
      claimMode: 'server',
      sendTransactionAsync: deps.sendTransactionAsync,
      writeContractAsync: deps.writeContractAsync as never,
      onStatus,
    }
  );

  // Override: for server mode we still pass claim key at announce for verification+storage
  // executePrivateSend already sends claim_mode; ensure server stores it
  return {
    ...r,
    path: 'simple',
    scheme: 'one-time-eoa',
    message:
      r.message ||
      'Private send complete. Recipient opens Scanner with their wallet and claims — no setup needed.',
  };
}

export function resultLabel(r: UnifiedSendResult): string {
  if (r.path === 'stealth') {
    return 'Stealth (recipient keys) — strongest private A→B';
  }
  return 'Simple private send — recipient just connects & claims';
}

export function emptyClaimPackage(): Partial<ClaimPackage> {
  return {};
}

export { encodeClaimCode, STEALTH_SCHEME_NAME };
