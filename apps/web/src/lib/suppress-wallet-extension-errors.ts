/**
 * Phantom / MetaMask / multi-wallet extensions often throw:
 *   TypeError: Cannot redefine property: ethereum
 * when two injectors race on window.ethereum. That is NOT app code.
 *
 * Call installWalletExtensionErrorSuppressor() as early as possible so the
 * Next.js dev overlay does not brick the UI.
 */

const PATTERNS = [
  'Cannot redefine property: ethereum',
  'Cannot redefine property: solana',
  'Cannot set property ethereum',
  'Cannot redefine property: web3',
  'Cannot redefine property: phantom',
];

export function isWalletExtensionNoise(message: unknown): boolean {
  const msg =
    typeof message === 'string'
      ? message
      : message instanceof Error
        ? message.message
        : message != null
          ? String(message)
          : '';
  if (!msg) return false;
  if (PATTERNS.some((p) => msg.includes(p))) return true;
  // Phantom / MetaMask injectors
  if (msg.includes('ethereum') && msg.includes('redefine')) return true;
  return false;
}

let installed = false;

export function installWalletExtensionErrorSuppressor(): void {
  if (typeof window === 'undefined' || installed) return;
  installed = true;

  // Soft-fail provider redefines (same as public/suppress-wallet-errors.js)
  try {
    const original = Object.defineProperty;
    const keys = new Set(['ethereum', 'solana', 'web3', 'phantom']);
    Object.defineProperty = function (
      obj: object,
      prop: PropertyKey,
      descriptor: PropertyDescriptor
    ) {
      if (obj === window && keys.has(String(prop))) {
        try {
          return original.call(Object, obj, prop, descriptor);
        } catch {
          return obj;
        }
      }
      return original.call(Object, obj, prop, descriptor);
    } as typeof Object.defineProperty;
  } catch {
    /* ignore */
  }

  window.addEventListener(
    'error',
    (event) => {
      const msg = event.message || event.error?.message;
      const stack = event.error?.stack || '';
      const fromExt =
        (typeof event.filename === 'string' &&
          event.filename.startsWith('chrome-extension://')) ||
        String(stack).includes('chrome-extension://') ||
        String(stack).includes('evmAsk.js');
      if (isWalletExtensionNoise(msg) || (fromExt && String(msg).includes('ethereum'))) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );

  window.addEventListener(
    'unhandledrejection',
    (event) => {
      const reason = event.reason;
      const msg =
        reason instanceof Error
          ? reason.message
          : typeof reason === 'string'
            ? reason
            : reason?.message;
      if (isWalletExtensionNoise(msg)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );
}
