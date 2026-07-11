/**
 * Shielded pool notes (Tornado-style).
 * commitment = keccak256(secret || nullifier)
 * nullifierHash = keccak256(nullifier)
 *
 * Notes are stored only in the browser. Losing them loses funds.
 */

import { keccak256, concat, toBytes, type Hex, encodeAbiParameters, parseAbiParameters } from 'viem';

export const SHIELD_LEVELS = 20;
export const DEFAULT_DENOMINATION_ETH = '0.1';

export interface ShieldNote {
  version: 1;
  secret: Hex;
  nullifier: Hex;
  commitment: Hex;
  nullifierHash: Hex;
  denomination: string;
  leafIndex?: number;
  poolAddress?: string;
  depositTxHash?: string;
  createdAt: string;
}

const NOTES_KEY = 'silenttransfer_shield_notes_v1';

function randomBytes32(): Hex {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return (`0x${Array.from(a)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')}`) as Hex;
}

export function createShieldNote(denomination: string = DEFAULT_DENOMINATION_ETH): ShieldNote {
  const secret = randomBytes32();
  const nullifier = randomBytes32();
  const commitment = keccak256(concat([toBytes(secret), toBytes(nullifier)]));
  const nullifierHash = keccak256(toBytes(nullifier));
  return {
    version: 1,
    secret,
    nullifier,
    commitment,
    nullifierHash,
    denomination,
    createdAt: new Date().toISOString(),
  };
}

export function hashLeftRight(left: Hex, right: Hex): Hex {
  return keccak256(concat([toBytes(left), toBytes(right)]));
}

export function zeroHashes(levels: number): Hex[] {
  const z: Hex[] = ['0x' + '00'.repeat(32) as Hex];
  for (let i = 0; i < levels; i++) {
    z.push(hashLeftRight(z[i], z[i]));
  }
  return z;
}

export function buildMerkleTree(levels: number, leaves: Hex[]) {
  const z = zeroHashes(levels);
  const size = 2 ** levels;
  const layer0: Hex[] = Array(size).fill(z[0]);
  for (let i = 0; i < leaves.length; i++) layer0[i] = leaves[i];

  function path(index: number) {
    const pathElements: Hex[] = [];
    const pathIndices: number[] = [];
    let idx = index;
    let layer = layer0.slice();
    for (let lvl = 0; lvl < levels; lvl++) {
      const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
      pathElements.push(layer[siblingIdx] ?? z[lvl]);
      pathIndices.push(idx % 2);
      const next: Hex[] = [];
      for (let i = 0; i < layer.length; i += 2) {
        next.push(hashLeftRight(layer[i] ?? z[lvl], layer[i + 1] ?? z[lvl]));
      }
      layer = next;
      idx = Math.floor(idx / 2);
    }
    return { pathElements, pathIndices, root: layer[0] };
  }

  let layer = layer0.slice();
  for (let lvl = 0; lvl < levels; lvl++) {
    const next: Hex[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      next.push(hashLeftRight(layer[i], layer[i + 1]));
    }
    layer = next;
  }

  return { root: layer[0] as Hex, path };
}

export function encodeWithdrawWitness(
  secret: Hex,
  nullifier: Hex,
  pathElements: Hex[],
  pathIndices: number[]
): Hex {
  return encodeAbiParameters(
    parseAbiParameters('bytes32 secret, bytes32 nullifier, bytes32[] pathElements, uint8[] pathIndices'),
    [secret, nullifier, pathElements, pathIndices.map((x) => x)]
  );
}

export function publicSignals(params: {
  root: Hex;
  nullifierHash: Hex;
  recipient: string;
  relayer: string;
  fee: bigint;
}): readonly [bigint, bigint, bigint, bigint, bigint] {
  return [
    BigInt(params.root),
    BigInt(params.nullifierHash),
    BigInt(params.recipient),
    BigInt(params.relayer),
    params.fee,
  ] as const;
}

function readNotes(): ShieldNote[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ShieldNote[];
  } catch {
    return [];
  }
}

function writeNotes(notes: ShieldNote[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

export function listShieldNotes(): ShieldNote[] {
  return readNotes();
}

export function saveShieldNote(note: ShieldNote) {
  const all = readNotes().filter((n) => n.commitment !== note.commitment);
  all.unshift(note);
  writeNotes(all);
}

export function updateShieldNote(commitment: string, patch: Partial<ShieldNote>) {
  const all = readNotes().map((n) =>
    n.commitment.toLowerCase() === commitment.toLowerCase() ? { ...n, ...patch } : n
  );
  writeNotes(all);
}

export function removeShieldNote(commitment: string) {
  writeNotes(readNotes().filter((n) => n.commitment.toLowerCase() !== commitment.toLowerCase()));
}

export function exportNotesJson(): string {
  return JSON.stringify(readNotes(), null, 2);
}

export function importNotesJson(json: string): number {
  const arr = JSON.parse(json) as ShieldNote[];
  if (!Array.isArray(arr)) throw new Error('Invalid notes file');
  let n = 0;
  for (const note of arr) {
    if (note?.secret && note?.nullifier && note?.commitment) {
      saveShieldNote(note);
      n++;
    }
  }
  return n;
}

export function getShieldPoolAddress(): `0x${string}` | undefined {
  const a = process.env.NEXT_PUBLIC_SHIELD_POOL_ADDRESS;
  return a && /^0x[a-fA-F0-9]{40}$/.test(a) ? (a as `0x${string}`) : undefined;
}

export const SHIELD_POOL_ABI = [
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'payable',
    inputs: [{ name: 'commitment', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'withdrawWithWitness',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'input', type: 'uint256[5]' },
      { name: 'recipient', type: 'address' },
      { name: 'relayer', type: 'address' },
      { name: 'fee', type: 'uint256' },
      { name: 'witness', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'denomination',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'nextIndex',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint32' }],
  },
  {
    type: 'function',
    name: 'currentRoot',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'isKnownRoot',
    stateMutability: 'view',
    inputs: [{ name: 'root', type: 'bytes32' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'nullifierHashes',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'bytes32' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'event',
    name: 'Deposit',
    inputs: [
      { name: 'commitment', type: 'bytes32', indexed: true },
      { name: 'leafIndex', type: 'uint32', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
] as const;
