export const REGISTRY_ABI = [
  {
    type: 'function',
    name: 'registerKeys',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spendingPubKey', type: 'bytes' },
      { name: 'viewingPubKey', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getStealthMetaAddress',
    stateMutability: 'view',
    inputs: [{ name: 'registrant', type: 'address' }],
    outputs: [
      { name: 'spendingPubKey', type: 'bytes' },
      { name: 'viewingPubKey', type: 'bytes' },
    ],
  },
  {
    type: 'function',
    name: 'isRegistered',
    stateMutability: 'view',
    inputs: [{ name: 'registrant', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

export const MESSENGER_ABI = [
  {
    type: 'function',
    name: 'announce',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'schemeId', type: 'uint256' },
      { name: 'stealthAddress', type: 'address' },
      { name: 'ephemeralPubKey', type: 'bytes' },
      { name: 'metadata', type: 'bytes' },
    ],
    outputs: [],
  },
] as const;

export const PRIVATE_SEND_ABI = [
  {
    type: 'function',
    name: 'sendEth',
    stateMutability: 'payable',
    inputs: [
      { name: 'stealthAddress', type: 'address' },
      { name: 'ephemeralPubKey', type: 'bytes' },
      { name: 'metadata', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'messenger',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

export function getRegistryAddress(): `0x${string}` | undefined {
  const a = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS;
  return a && /^0x[a-fA-F0-9]{40}$/.test(a) ? (a as `0x${string}`) : undefined;
}

export function getMessengerAddress(): `0x${string}` | undefined {
  const a = process.env.NEXT_PUBLIC_MESSENGER_ADDRESS;
  return a && /^0x[a-fA-F0-9]{40}$/.test(a) ? (a as `0x${string}`) : undefined;
}

export function getPrivateSendAddress(): `0x${string}` | undefined {
  const a = process.env.NEXT_PUBLIC_PRIVATE_SEND_ADDRESS;
  return a && /^0x[a-fA-F0-9]{40}$/.test(a) ? (a as `0x${string}`) : undefined;
}
