/**
 * SilentVault client — one-tx privateSend:
 * A pays amount+fee → vault immediately pays B/C/D (no claim step).
 */

import { isAddress, type Hex, type Address } from 'viem';
import { waitForTransactionReceipt } from 'wagmi/actions';
import { api } from '@/lib/api';
import { wagmiConfig } from '@/lib/wagmi';
import { toWeiString } from '@/lib/tokens';

export const VAULT_ABI = [
  {
    type: 'function',
    name: 'privateSend',
    stateMutability: 'payable',
    inputs: [
      { name: 'batchId', type: 'bytes32' },
      { name: 'recipients', type: 'address[]' },
      { name: 'amounts', type: 'uint256[]' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'payable',
    inputs: [
      { name: 'batchId', type: 'bytes32' },
      { name: 'netAmount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'feeBps',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint16' }],
  },
] as const;

export interface VaultLine {
  address: string;
  amount: string;
}

export interface VaultBatchPlan {
  batch_id: string;
  depositor: string;
  net_wei: string;
  fee_wei: string;
  gross_wei: string;
  fee_bps: number;
  vault_address: string;
  recipients: Array<{
    address: string;
    amount_wei: string;
    payout_id: string;
    status: string;
    tx_hash?: string | null;
  }>;
  status: string;
  message: string;
}

export function getVaultAddress(): `0x${string}` | undefined {
  const a =
    typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_VAULT_ADDRESS
      : undefined;
  return a && /^0x[a-fA-F0-9]{40}$/.test(a) ? (a as `0x${string}`) : undefined;
}

export function parseRecipientLines(raw: string): { lines: VaultLine[]; errors: string[] } {
  const errors: string[] = [];
  const lines: VaultLine[] = [];
  const rows = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  rows.forEach((row, i) => {
    const parts = row.includes(',')
      ? row.split(',').map((p) => p.trim())
      : row.split(/[\s\t]+/).map((p) => p.trim());
    const address = parts[0] || '';
    const amount = parts[1] || '';
    if (!isAddress(address)) {
      errors.push(`Line ${i + 1}: invalid address`);
      return;
    }
    if (!amount || Number(amount) <= 0 || !Number.isFinite(Number(amount))) {
      errors.push(`Line ${i + 1}: invalid amount`);
      return;
    }
    lines.push({ address, amount });
  });
  return { lines, errors };
}

export async function createVaultBatch(
  lines: VaultLine[],
  fromWallet: string
): Promise<VaultBatchPlan> {
  const recipients = lines.map((l) => ({
    address: l.address.toLowerCase(),
    amount_wei: toWeiString(l.amount),
  }));
  const plan = await api<VaultBatchPlan>(
    '/api/vault/batches',
    'POST',
    { recipients },
    { auth: true, wallet: fromWallet }
  );
  if (!plan?.batch_id) throw new Error('Failed to create vault batch');
  return plan;
}

export interface VaultSendDeps {
  fromWallet: string;
  chainId: number;
  lines: VaultLine[];
  writeContractAsync: (args: {
    chainId: number;
    address: `0x${string}`;
    abi: typeof VAULT_ABI;
    functionName: 'privateSend';
    args: [Hex, Address[], bigint[]];
    value: bigint;
  }) => Promise<`0x${string}`>;
  onStatus?: (msg: string) => void;
}

export async function executeVaultPrivateTransfer(deps: VaultSendDeps) {
  const { fromWallet, chainId, lines, writeContractAsync, onStatus } = deps;
  if (!lines.length) throw new Error('Add at least one recipient');

  onStatus?.('Preparing private transfer…');
  const plan = await createVaultBatch(lines, fromWallet);

  const vault =
    (plan.vault_address && isAddress(plan.vault_address)
      ? (plan.vault_address as `0x${string}`)
      : getVaultAddress()) || undefined;

  if (!vault) {
    throw new Error(
      'Vault not configured. Deploy SilentVault and set NEXT_PUBLIC_VAULT_ADDRESS.'
    );
  }

  const net = BigInt(plan.net_wei);
  const gross = BigInt(plan.gross_wei);
  const batchId = plan.batch_id as Hex;
  const recipients = plan.recipients.map((r) => r.address as Address);
  const amounts = plan.recipients.map((r) => BigInt(r.amount_wei));

  onStatus?.('Confirm in wallet — recipients get paid automatically…');
  const hash = await writeContractAsync({
    chainId,
    address: vault,
    abi: VAULT_ABI,
    functionName: 'privateSend',
    args: [batchId, recipients, amounts],
    value: gross,
  });

  onStatus?.('Waiting for confirmation…');
  const receipt = await waitForTransactionReceipt(wagmiConfig, {
    hash,
    chainId,
    confirmations: 1,
  });
  if (receipt.status !== 'success') throw new Error('Private send transaction failed');

  onStatus?.('Recording transfer…');
  const conf = await api<{
    success: boolean;
    status: string;
    recipients: VaultBatchPlan['recipients'];
    message?: string;
  }>(
    '/api/vault/batches/confirm',
    'POST',
    {
      batch_id: plan.batch_id,
      deposit_tx_hash: hash,
      depositor: fromWallet.toLowerCase(),
      auto_paid: true,
    },
    { auth: true, wallet: fromWallet }
  );
  if (!conf?.success) throw new Error('Transfer sent on-chain but API record failed');

  return {
    ...plan,
    path: 'live' as const,
    deposit_tx_hash: hash,
    status: conf.status || 'completed',
    recipients: conf.recipients || plan.recipients.map((r) => ({
      ...r,
      status: 'completed',
      tx_hash: hash,
    })),
    message:
      conf.message ||
      'Done. Recipients received ETH in their wallets automatically — no claim needed.',
  };
}

export function humanEthFromWei(wei: string): string {
  try {
    const n = Number(wei) / 1e18;
    if (!Number.isFinite(n)) return wei;
    return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
  } catch {
    return wei;
  }
}

export function estimateGross(lines: VaultLine[], feeBps: number) {
  let net = 0;
  for (const l of lines) net += Number(l.amount) || 0;
  const fee = (net * feeBps) / 10000;
  return { net, fee, gross: net + fee };
}
