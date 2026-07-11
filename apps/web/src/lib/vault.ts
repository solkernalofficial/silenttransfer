/**
 * SilentVault client — A deposits once; B/C/D receive from vault (not from A).
 */

import { isAddress, type Hex } from 'viem';
import { waitForTransactionReceipt } from 'wagmi/actions';
import { api } from '@/lib/api';
import { wagmiConfig } from '@/lib/wagmi';
import { toWeiString } from '@/lib/tokens';

export const VAULT_ABI = [
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
  amount: string; // human ETH
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
    functionName: 'deposit';
    args: [Hex, bigint];
    value: bigint;
  }) => Promise<`0x${string}`>;
  onStatus?: (msg: string) => void;
}

export async function executeVaultPrivateTransfer(deps: VaultSendDeps) {
  const { fromWallet, chainId, lines, writeContractAsync, onStatus } = deps;
  if (!lines.length) throw new Error('Add at least one recipient');

  onStatus?.('Creating private vault batch…');
  const plan = await createVaultBatch(lines, fromWallet);

  const vault =
    (plan.vault_address && isAddress(plan.vault_address)
      ? (plan.vault_address as `0x${string}`)
      : getVaultAddress()) || undefined;

  // Off-chain / simulated vault when contract not deployed yet
  if (!vault) {
    onStatus?.('Vault contract not on-chain yet — recording batch (simulated payout)…');
    const fakeTx = ('0x' +
      Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(
        ''
      )) as `0x${string}`;
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
        deposit_tx_hash: fakeTx,
        depositor: fromWallet.toLowerCase(),
      },
      { auth: true, wallet: fromWallet }
    );
    if (!conf?.success) throw new Error('Vault confirm failed');
    return {
      ...plan,
      path: 'simulated' as const,
      deposit_tx_hash: fakeTx,
      status: conf.status,
      recipients: conf.recipients || plan.recipients,
      message:
        conf.message ||
        'Batch recorded. Deploy SilentVault for full on-chain A→Vault→B privacy.',
    };
  }

  onStatus?.('Confirm deposit in wallet (amount + protocol fee)…');
  const net = BigInt(plan.net_wei);
  const gross = BigInt(plan.gross_wei);
  const batchId = plan.batch_id as Hex;

  const hash = await writeContractAsync({
    chainId,
    address: vault,
    abi: VAULT_ABI,
    functionName: 'deposit',
    args: [batchId, net],
    value: gross,
  });

  onStatus?.('Waiting for deposit confirmation…');
  const receipt = await waitForTransactionReceipt(wagmiConfig, {
    hash,
    chainId,
    confirmations: 1,
  });
  if (receipt.status !== 'success') throw new Error('Vault deposit failed');

  onStatus?.('Paying recipients from vault (they will not see your wallet)…');
  const conf = await api<{
    success: boolean;
    status: string;
    recipients: VaultBatchPlan['recipients'];
    message?: string;
    deposit_tx_hash?: string;
  }>(
    '/api/vault/batches/confirm',
    'POST',
    {
      batch_id: plan.batch_id,
      deposit_tx_hash: hash,
      depositor: fromWallet.toLowerCase(),
    },
    { auth: true, wallet: fromWallet }
  );
  if (!conf?.success) throw new Error('Vault confirm failed after deposit');

  return {
    ...plan,
    path: 'live' as const,
    deposit_tx_hash: hash,
    status: conf.status,
    recipients: conf.recipients || plan.recipients,
    message: conf.message,
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

/** Estimate gross from human amounts + bps */
export function estimateGross(lines: VaultLine[], feeBps: number) {
  let net = 0;
  for (const l of lines) net += Number(l.amount) || 0;
  const fee = (net * feeBps) / 10000;
  return { net, fee, gross: net + fee };
}
