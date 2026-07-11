/**
 * ERC-5564-style secp256k1 stealth addresses (scheme id 1).
 *
 * Recipient privacy for A→B:
 * - B publishes (spendingPub, viewingPub)
 * - A derives one-time stealth address only B can detect/spend
 * - No shared claim code; no long-lived server spend key
 *
 * Honest limits (public chain): sender + amount still visible on funding tx.
 */

import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

const N = secp256k1.CURVE.n;

export const STEALTH_SCHEME_ID = 1;
export const STEALTH_SCHEME_NAME = 'erc5564-secp256k1-v1';

export type Hex = `0x${string}`;

export interface StealthMetaKeys {
  spendingPrivateKey: Hex;
  viewingPrivateKey: Hex;
  spendingPublicKey: Hex; // uncompressed 0x04||x||y
  viewingPublicKey: Hex;
}

export interface StealthSendMaterial {
  stealthAddress: Hex;
  ephemeralPublicKey: Hex;
  viewTag: number;
  scheme: typeof STEALTH_SCHEME_NAME;
}

function toHex(b: Uint8Array): Hex {
  return `0x${bytesToHex(b)}` as Hex;
}

function strip0x(h: string): string {
  return h.startsWith('0x') || h.startsWith('0X') ? h.slice(2) : h;
}

function ensureBytes(hex: string): Uint8Array {
  const body = strip0x(hex);
  if (body.length % 2 !== 0) throw new Error('Invalid hex length');
  return hexToBytes(body);
}

function numberTo32Bytes(n: bigint): Uint8Array {
  let hex = n.toString(16);
  if (hex.length > 64) hex = hex.slice(-64);
  return hexToBytes(hex.padStart(64, '0'));
}

function bytesToBigInt(b: Uint8Array): bigint {
  return BigInt('0x' + bytesToHex(b));
}

/** Normalize pubkeys to uncompressed 65-byte (0x04||x||y). Accepts 64 or 65 body. */
export function normalizeUncompressedPub(pubHex: string): Uint8Array {
  const raw = ensureBytes(pubHex);
  if (raw.length === 65 && raw[0] === 0x04) return raw;
  if (raw.length === 64) {
    const out = new Uint8Array(65);
    out[0] = 0x04;
    out.set(raw, 1);
    return out;
  }
  if (raw.length === 33 && (raw[0] === 0x02 || raw[0] === 0x03)) {
    return secp256k1.ProjectivePoint.fromHex(raw).toRawBytes(false);
  }
  // try parse as-is
  return secp256k1.ProjectivePoint.fromHex(raw).toRawBytes(false);
}

export function pubKeyToAddress(pubUncompressed: Uint8Array): Hex {
  // Ethereum: keccak256(x||y) last 20 bytes — drop 0x04 prefix
  const body = pubUncompressed.length === 65 ? pubUncompressed.slice(1) : pubUncompressed;
  const hash = keccak_256(body);
  return toHex(hash.slice(12));
}

export function privateKeyToAddress(privHex: Hex): Hex {
  const pub = secp256k1.getPublicKey(ensureBytes(privHex), false);
  return pubKeyToAddress(pub);
}

export function generateStealthMetaKeys(): StealthMetaKeys {
  const spendingPrivateKey = toHex(secp256k1.utils.randomPrivateKey());
  const viewingPrivateKey = toHex(secp256k1.utils.randomPrivateKey());
  const spendingPublicKey = toHex(
    secp256k1.getPublicKey(ensureBytes(spendingPrivateKey), false)
  );
  const viewingPublicKey = toHex(
    secp256k1.getPublicKey(ensureBytes(viewingPrivateKey), false)
  );
  return {
    spendingPrivateKey,
    viewingPrivateKey,
    spendingPublicKey,
    viewingPublicKey,
  };
}

/** Hash ECDH shared secret → scalar in [1, n-1]. */
export function hashSharedSecretToScalar(sharedSecret: Uint8Array): bigint {
  const h = keccak_256(sharedSecret);
  let x = bytesToBigInt(h) % N;
  if (x === BigInt(0)) x = BigInt(1);
  return x;
}

/**
 * ECDH shared secret bytes (compressed point from noble getSharedSecret).
 * Sender: r * V; Recipient: v * R.
 */
export function ecdhSharedSecret(privateKey: Uint8Array, publicKey: Uint8Array): Uint8Array {
  const pub = normalizeUncompressedPub(toHex(publicKey));
  return secp256k1.getSharedSecret(privateKey, pub, true);
}

/**
 * Sender: derive one-time stealth address for recipient meta-address.
 */
export function generateStealthAddressForRecipient(
  spendingPublicKey: string,
  viewingPublicKey: string
): StealthSendMaterial {
  const P = normalizeUncompressedPub(spendingPublicKey);
  const V = normalizeUncompressedPub(viewingPublicKey);

  const r = secp256k1.utils.randomPrivateKey();
  const R = secp256k1.getPublicKey(r, false);
  const ss = ecdhSharedSecret(r, V);
  const h = hashSharedSecretToScalar(ss);

  const stealthPoint = secp256k1.ProjectivePoint.fromHex(P).add(
    secp256k1.ProjectivePoint.BASE.multiply(h)
  );
  const stealthPub = stealthPoint.toRawBytes(false);
  const stealthAddress = pubKeyToAddress(stealthPub);
  const viewTag = ss[0] ?? 0;

  return {
    stealthAddress,
    ephemeralPublicKey: toHex(R),
    viewTag,
    scheme: STEALTH_SCHEME_NAME,
  };
}

/**
 * Recipient: derive spend key for an announcement if it belongs to them.
 * Returns null when the stealth address does not match.
 */
export function tryDeriveStealthPrivateKey(params: {
  spendingPrivateKey: string;
  viewingPrivateKey: string;
  ephemeralPublicKey: string;
  stealthAddress: string;
}): Hex | null {
  const p = ensureBytes(params.spendingPrivateKey);
  const v = ensureBytes(params.viewingPrivateKey);
  const R = normalizeUncompressedPub(params.ephemeralPublicKey);

  const ss = ecdhSharedSecret(v, R);
  const h = hashSharedSecretToScalar(ss);
  const stealthPriv = (bytesToBigInt(p) + h) % N;
  const stealthPrivBytes = numberTo32Bytes(stealthPriv);
  const stealthPrivHex = toHex(stealthPrivBytes);
  const derivedAddr = privateKeyToAddress(stealthPrivHex);

  if (derivedAddr.toLowerCase() !== params.stealthAddress.toLowerCase()) {
    return null;
  }
  return stealthPrivHex;
}

/** Scan a list of announcements client-side with viewing+spending keys. */
export function scanAnnouncementsForKeys<
  T extends { stealth_address: string; ephemeral_pubkey: string },
>(
  announcements: T[],
  keys: { spendingPrivateKey: string; viewingPrivateKey: string }
): Array<T & { claim_private_key: Hex }> {
  const out: Array<T & { claim_private_key: Hex }> = [];
  for (const a of announcements) {
    if (!a.ephemeral_pubkey || !a.stealth_address) continue;
    try {
      const claim = tryDeriveStealthPrivateKey({
        spendingPrivateKey: keys.spendingPrivateKey,
        viewingPrivateKey: keys.viewingPrivateKey,
        ephemeralPublicKey: a.ephemeral_pubkey,
        stealthAddress: a.stealth_address,
      });
      if (claim) out.push({ ...a, claim_private_key: claim });
    } catch {
      /* skip malformed */
    }
  }
  return out;
}

/** Round-trip self-test helper. */
export function selfTestStealthRoundTrip(): boolean {
  const meta = generateStealthMetaKeys();
  const send = generateStealthAddressForRecipient(
    meta.spendingPublicKey,
    meta.viewingPublicKey
  );
  const claim = tryDeriveStealthPrivateKey({
    spendingPrivateKey: meta.spendingPrivateKey,
    viewingPrivateKey: meta.viewingPrivateKey,
    ephemeralPublicKey: send.ephemeralPublicKey,
    stealthAddress: send.stealthAddress,
  });
  return Boolean(claim && privateKeyToAddress(claim) === send.stealthAddress);
}
