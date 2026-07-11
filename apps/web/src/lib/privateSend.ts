/**
 * Shared private-send primitives: one-time address → fund → announce (client-held claim).
 */

import { waitForTransactionReceipt } from 'wagmi/actions';
import {
  parseEther,
  parseUnits,
  isAddress,
  type Hex,
} from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { api } from '@/lib/api';
import { NATIVE_ETH_ADDRESS, TOKENS, toWeiString } from '@/lib/tokens';
import { appChain, wagmiConfig } from '@/lib/wagmi';
import {
  saveClaimPackage,
  encodeClaimCode,
  type ClaimMode,
  type ClaimPackage,
} from '@/lib/claimVault';

const ERC20_ABI = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

export interface PrivateSendLine {
  toWallet: string;
  amount: string;
  token?: string;
}

export interface PrivateSendDeps {
  fromWallet: string;
  chainId: number;
  claimMode?: ClaimMode;
  sendTransactionAsync: (args: {
    chainId: number;
    to: `0x${string}`;
    value: bigint;
  }) => Promise<`0x${string}`>;
  writeContractAsync: (args: {
    chainId: number;
    address: `0x${string}`;
    abi: typeof ERC20_ABI;
    functionName: 'transfer';
    args: [`0x${string}`, bigint];
  }) => Promise<`0x${string}`>;
  onStatus?: (msg: string) => void;
}

export interface PrivateSendResult {
  success: boolean;
  stealth_address: string;
  from_address: string;
  to_address: string;
  amount: string;
  token: string;
  funding_tx_hash: string;
  claim_mode: ClaimMode;
  claim_code: string;
  claim_package: ClaimPackage;
  funded_on_chain: boolean;
  message?: string;
}

export async function executePrivateSend(
  line: PrivateSendLine,
  deps: PrivateSendDeps
): Promise<PrivateSendResult> {
  const { fromWallet, chainId, sendTransactionAsync, writeContractAsync, onStatus } = deps;
  const claimMode: ClaimMode = deps.claimMode || 'client';
  const token = line.token || 'ETH';
  const isEth = token === 'ETH';

  if (!isAddress(fromWallet)) throw new Error('Invalid sender wallet');
  if (!isAddress(line.toWallet)) throw new Error('Invalid recipient address');
  if (fromWallet.toLowerCase() === line.toWallet.toLowerCase()) {
    throw new Error('Sender and recipient must be different');
  }
  const amt = Number(line.amount);
  if (!Number.isFinite(amt) || amt <= 0) throw new Error('Amount must be greater than 0');

  onStatus?.('Preparing one-time private address…');

  const claimPrivateKey = generatePrivateKey();
  const stealthAccount = privateKeyToAccount(claimPrivateKey);
  const stealthAddress = stealthAccount.address;

  onStatus?.('Confirm the transfer in your wallet…');

  let hash: `0x${string}`;
  if (isEth) {
    hash = await sendTransactionAsync({
      chainId,
      to: stealthAddress,
      value: parseEther(line.amount),
    });
  } else {
    const tokenAddr = TOKENS[token] as `0x${string}` | undefined;
    if (!tokenAddr || tokenAddr.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase()) {
      throw new Error(`Unknown token: ${token}`);
    }
    const decimals = 18;
    hash = await writeContractAsync({
      chainId,
      address: tokenAddr,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [stealthAddress, parseUnits(line.amount, decimals)],
    });
  }

  onStatus?.('Waiting for on-chain confirmation…');
  const receipt = await waitForTransactionReceipt(wagmiConfig, {
    hash,
    chainId,
    confirmations: 1,
  });
  if (receipt.status !== 'success') {
    throw new Error('On-chain transfer failed / reverted');
  }

  onStatus?.(
    claimMode === 'server'
      ? 'Recording private payment (recipient can claim with their wallet)…'
      : 'Recording private payment (client-held claim)…'
  );

  const eph = generatePrivateKey() as Hex;
  const body = {
    stealth_address: stealthAddress.toLowerCase(),
    caller: fromWallet.toLowerCase(),
    to_address: line.toWallet.toLowerCase(),
    ephemeral_pubkey: eph,
    token_address: isEth ? NATIVE_ETH_ADDRESS : TOKENS[token],
    amount: toWeiString(line.amount),
    block_number: Number(receipt.blockNumber),
    funding_tx_hash: hash,
    // Always prove key matches address; server mode stores it for easy claim by B
    claim_private_key: claimPrivateKey,
    claim_mode: claimMode,
    metadata: {
      token_symbol: token,
      private_transfer: true,
      real_transfer: true,
      funded_on_chain: true,
      claim_mode: claimMode,
      simple_send: claimMode === 'server',
    },
  };

  const ann = await api<{
    success?: boolean;
    stealth_address?: string;
    message?: string;
  }>('/api/announce', 'POST', body, {
    auth: true,
    wallet: fromWallet,
  });

  if (!ann?.success) {
    throw new Error(
      'On-chain transfer succeeded but announce failed — save this tx hash: ' + hash
    );
  }

  const claimPackage: ClaimPackage = {
    version: 1,
    stealth_address: stealthAddress.toLowerCase(),
    claim_private_key: claimPrivateKey,
    to_address: line.toWallet.toLowerCase(),
    from_address: fromWallet.toLowerCase(),
    amount: line.amount,
    token_symbol: token,
    funding_tx_hash: hash,
    created_at: new Date().toISOString(),
    claim_mode: claimMode,
  };

  if (claimMode === 'client') {
    saveClaimPackage(claimPackage);
  }

  return {
    success: true,
    stealth_address: (ann.stealth_address || stealthAddress).toLowerCase(),
    from_address: fromWallet.toLowerCase(),
    to_address: line.toWallet.toLowerCase(),
    amount: line.amount,
    token,
    funding_tx_hash: hash,
    claim_mode: claimMode,
    claim_code: encodeClaimCode(claimPackage),
    claim_package: claimPackage,
    funded_on_chain: true,
    message: ann.message,
  };
}

export function parseBatchLines(raw: string): { lines: PrivateSendLine[]; errors: string[] } {
  const errors: string[] = [];
  const lines: PrivateSendLine[] = [];
  const rows = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  rows.forEach((row, i) => {
    // address,amount  OR  address amount  OR  address,amount,ETH
    const parts = row.includes(',')
      ? row.split(',').map((p) => p.trim())
      : row.split(/[\s\t]+/).map((p) => p.trim());

    const addr = parts[0] || '';
    const amount = parts[1] || '';
    const token = (parts[2] || 'ETH').toUpperCase();

    if (!isAddress(addr)) {
      errors.push(`Line ${i + 1}: invalid address`);
      return;
    }
    if (!amount || Number(amount) <= 0 || !Number.isFinite(Number(amount))) {
      errors.push(`Line ${i + 1}: invalid amount`);
      return;
    }
    if (token !== 'ETH' && token !== 'SILENT') {
      errors.push(`Line ${i + 1}: token must be ETH or SILENT`);
      return;
    }
    lines.push({ toWallet: addr, amount, token });
  });

  return { lines, errors };
}

export { appChain };
