/**
 * Wallet-bound private vault (no local notes).
 * Deposit with connected wallet → later withdraw to any B (auto, no claim).
 */

import { parseEther, formatEther, isAddress, type Address, type Hex } from 'viem';
import { waitForTransactionReceipt } from 'wagmi/actions';
import { wagmiConfig } from '@/lib/wagmi';

export const USER_VAULT_ABI = [
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'payable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'withdraw',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'withdrawMany',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'recipients', type: 'address[]' },
      { name: 'amounts', type: 'uint256[]' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'feeBps',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint16' }],
  },
] as const;

export function getUserVaultAddress(): `0x${string}` | undefined {
  const a =
    typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_USER_VAULT_ADDRESS ||
        process.env.NEXT_PUBLIC_VAULT_ADDRESS
      : undefined;
  return a && /^0x[a-fA-F0-9]{40}$/.test(a) ? (a as `0x${string}`) : undefined;
}

export interface VaultLine {
  address: string;
  amount: string;
}

export function parseRecipientLines(raw: string): { lines: VaultLine[]; errors: string[] } {
  const errors: string[] = [];
  const lines: VaultLine[] = [];
  raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .forEach((row, i) => {
      const parts = row.includes(',')
        ? row.split(',').map((p) => p.trim())
        : row.split(/\s+/).map((p) => p.trim());
      const address = parts[0] || '';
      const amount = parts[1] || '';
      if (!isAddress(address)) {
        errors.push(`Line ${i + 1}: invalid address`);
        return;
      }
      if (!amount || !(Number(amount) > 0)) {
        errors.push(`Line ${i + 1}: invalid amount`);
        return;
      }
      lines.push({ address, amount });
    });
  return { lines, errors };
}

export function sumLinesEth(lines: VaultLine[]): number {
  return lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
}

export type WriteContractFn = (args: {
  chainId: number;
  address: `0x${string}`;
  abi: typeof USER_VAULT_ABI;
  functionName: 'deposit' | 'withdraw' | 'withdrawMany';
  args?: readonly unknown[];
  value?: bigint;
}) => Promise<`0x${string}`>;

export async function depositToVault(deps: {
  chainId: number;
  amountEth: string;
  writeContractAsync: WriteContractFn;
  onStatus?: (s: string) => void;
}) {
  const vault = getUserVaultAddress();
  if (!vault) throw new Error('Vault not configured');
  const value = parseEther(deps.amountEth);
  if (value <= BigInt(0)) throw new Error('Enter an amount > 0');

  deps.onStatus?.('Confirm deposit in wallet…');
  const hash = await deps.writeContractAsync({
    chainId: deps.chainId,
    address: vault,
    abi: USER_VAULT_ABI,
    functionName: 'deposit',
    args: [],
    value,
  });
  deps.onStatus?.('Waiting for confirmation…');
  const receipt = await waitForTransactionReceipt(wagmiConfig, {
    hash,
    chainId: deps.chainId,
    confirmations: 1,
  });
  if (receipt.status !== 'success') throw new Error('Deposit failed');
  return hash;
}

export async function withdrawFromVault(deps: {
  chainId: number;
  to: string;
  amountEth: string;
  writeContractAsync: WriteContractFn;
  onStatus?: (s: string) => void;
}) {
  const vault = getUserVaultAddress();
  if (!vault) throw new Error('Vault not configured');
  if (!isAddress(deps.to)) throw new Error('Invalid recipient');
  const amount = parseEther(deps.amountEth);
  if (amount <= BigInt(0)) throw new Error('Enter an amount > 0');

  deps.onStatus?.('Confirm send — they receive in their wallet automatically…');
  const hash = await deps.writeContractAsync({
    chainId: deps.chainId,
    address: vault,
    abi: USER_VAULT_ABI,
    functionName: 'withdraw',
    args: [deps.to as Address, amount],
  });
  deps.onStatus?.('Waiting for confirmation…');
  const receipt = await waitForTransactionReceipt(wagmiConfig, {
    hash,
    chainId: deps.chainId,
    confirmations: 1,
  });
  if (receipt.status !== 'success') throw new Error('Send failed');
  return hash;
}

export async function withdrawManyFromVault(deps: {
  chainId: number;
  lines: VaultLine[];
  writeContractAsync: WriteContractFn;
  onStatus?: (s: string) => void;
}) {
  const vault = getUserVaultAddress();
  if (!vault) throw new Error('Vault not configured');
  if (!deps.lines.length) throw new Error('Add recipients');

  const recipients = deps.lines.map((l) => l.address as Address);
  const amounts = deps.lines.map((l) => parseEther(l.amount));

  deps.onStatus?.('Confirm batch send — all receive automatically…');
  const hash = await deps.writeContractAsync({
    chainId: deps.chainId,
    address: vault,
    abi: USER_VAULT_ABI,
    functionName: 'withdrawMany',
    args: [recipients, amounts],
  });
  deps.onStatus?.('Waiting for confirmation…');
  const receipt = await waitForTransactionReceipt(wagmiConfig, {
    hash,
    chainId: deps.chainId,
    confirmations: 1,
  });
  if (receipt.status !== 'success') throw new Error('Batch send failed');
  return hash;
}

export { formatEther, parseEther };
