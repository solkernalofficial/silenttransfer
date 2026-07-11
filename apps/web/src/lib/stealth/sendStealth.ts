/**
 * Fully private A→B send (ERC-5564):
 * look up B's meta-address → ECDH derive stealth → fund → announce (no claim key).
 */

import { waitForTransactionReceipt } from 'wagmi/actions';
import { parseEther, isAddress, type Hex, encodeAbiParameters, parseAbiParameters } from 'viem';
import { api } from '@/lib/api';
import { NATIVE_ETH_ADDRESS, toWeiString } from '@/lib/tokens';
import { wagmiConfig } from '@/lib/wagmi';
import {
  generateStealthAddressForRecipient,
  STEALTH_SCHEME_NAME,
  STEALTH_SCHEME_ID,
} from '@/lib/stealth/crypto';
import { getMessengerAddress, MESSENGER_ABI } from '@/lib/stealth/abis';

export interface RecipientMeta {
  user_address: string;
  spending_pubkey: string;
  viewing_pubkey: string;
}

export interface StealthSendResult {
  success: true;
  scheme: typeof STEALTH_SCHEME_NAME;
  stealth_address: string;
  from_address: string;
  to_address: string;
  amount: string;
  funding_tx_hash: string;
  announce_tx_hash?: string;
  ephemeral_public_key: string;
  funded_on_chain: true;
  claim_mode: 'stealth';
  message: string;
}

export async function fetchRecipientMeta(toWallet: string): Promise<RecipientMeta> {
  const reg = await api<RecipientMeta>(
    `/api/registrations/${toWallet.toLowerCase()}`
  );
  if (!reg?.spending_pubkey || !reg?.viewing_pubkey) {
    throw new Error(
      'Recipient has not enabled private receive. They must open Receive and register stealth keys first.'
    );
  }
  return reg;
}

export interface StealthSendDeps {
  fromWallet: string;
  toWallet: string;
  amount: string;
  chainId: number;
  sendTransactionAsync: (args: {
    chainId: number;
    to: `0x${string}`;
    value: bigint;
  }) => Promise<`0x${string}`>;
  writeContractAsync?: (args: {
    chainId: number;
    address: `0x${string}`;
    abi: typeof MESSENGER_ABI;
    functionName: 'announce';
    args: [bigint, `0x${string}`, `0x${string}`, `0x${string}`];
  }) => Promise<`0x${string}`>;
  onStatus?: (msg: string) => void;
}

export async function executeStealthSend(deps: StealthSendDeps): Promise<StealthSendResult> {
  const {
    fromWallet,
    toWallet,
    amount,
    chainId,
    sendTransactionAsync,
    writeContractAsync,
    onStatus,
  } = deps;

  if (!isAddress(fromWallet) || !isAddress(toWallet)) {
    throw new Error('Invalid addresses');
  }
  if (fromWallet.toLowerCase() === toWallet.toLowerCase()) {
    throw new Error('Sender and recipient must be different');
  }
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    throw new Error('Amount must be greater than 0');
  }

  onStatus?.('Looking up recipient stealth meta-address…');
  const meta = await fetchRecipientMeta(toWallet);

  onStatus?.('Deriving one-time stealth address (ERC-5564 ECDH)…');
  const material = generateStealthAddressForRecipient(
    meta.spending_pubkey,
    meta.viewing_pubkey
  );

  onStatus?.('Confirm funding to stealth address in your wallet…');
  const fundHash = await sendTransactionAsync({
    chainId,
    to: material.stealthAddress,
    value: parseEther(amount),
  });

  onStatus?.('Waiting for funding confirmation…');
  const receipt = await waitForTransactionReceipt(wagmiConfig, {
    hash: fundHash,
    chainId,
    confirmations: 1,
  });
  if (receipt.status !== 'success') {
    throw new Error('Funding transaction failed');
  }

  // Optional on-chain messenger announce
  let announceTx: string | undefined;
  const messenger = getMessengerAddress();
  if (messenger && writeContractAsync) {
    try {
      onStatus?.('On-chain announcement (ERC-5564 messenger)…');
      const metaBytes = encodeAbiParameters(
        parseAbiParameters('uint8 viewTag, string scheme, address hint'),
        [material.viewTag, STEALTH_SCHEME_NAME, toWallet as Hex]
      ) as Hex;
      announceTx = await writeContractAsync({
        chainId,
        address: messenger,
        abi: MESSENGER_ABI,
        functionName: 'announce',
        args: [
          BigInt(STEALTH_SCHEME_ID),
          material.stealthAddress,
          material.ephemeralPublicKey,
          metaBytes,
        ],
      });
      await waitForTransactionReceipt(wagmiConfig, {
        hash: announceTx as `0x${string}`,
        chainId,
        confirmations: 1,
      });
    } catch (e) {
      // Non-fatal: API announce still enables discovery
      console.warn('On-chain messenger announce skipped/failed', e);
    }
  }

  onStatus?.('Recording stealth payment for private scan…');
  const ann = await api<{ success?: boolean; message?: string }>(
    '/api/announce',
    'POST',
    {
      stealth_address: material.stealthAddress.toLowerCase(),
      caller: fromWallet.toLowerCase(),
      // optional UX hint — crypto scan does not require it
      to_address: toWallet.toLowerCase(),
      ephemeral_pubkey: material.ephemeralPublicKey,
      token_address: NATIVE_ETH_ADDRESS,
      amount: toWeiString(amount),
      block_number: Number(receipt.blockNumber),
      funding_tx_hash: fundHash,
      claim_mode: 'stealth',
      scheme: STEALTH_SCHEME_NAME,
      // NO claim_private_key
      metadata: {
        token_symbol: 'ETH',
        private_transfer: true,
        real_transfer: true,
        funded_on_chain: true,
        claim_mode: 'stealth',
        scheme: STEALTH_SCHEME_NAME,
        view_tag: material.viewTag,
        on_chain_announce_tx: announceTx,
      },
    },
    { auth: true, wallet: fromWallet }
  );

  if (!ann?.success) {
    throw new Error(
      'Funded on-chain but announce failed — save funding tx: ' + fundHash
    );
  }

  return {
    success: true,
    scheme: STEALTH_SCHEME_NAME,
    stealth_address: material.stealthAddress.toLowerCase(),
    from_address: fromWallet.toLowerCase(),
    to_address: toWallet.toLowerCase(),
    amount,
    funding_tx_hash: fundHash,
    announce_tx_hash: announceTx,
    ephemeral_public_key: material.ephemeralPublicKey,
    funded_on_chain: true,
    claim_mode: 'stealth',
    message:
      ann.message ||
      'Private A→B stealth send complete. Only recipient meta-keys can claim.',
  };
}
