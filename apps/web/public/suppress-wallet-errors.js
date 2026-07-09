/**
 * Multi-wallet extensions (Phantom + MetaMask, etc.) race on window.ethereum
 * and throw: TypeError: Cannot redefine property: ethereum
 *
 * 1) Soft-fail Object.defineProperty for known provider keys
 * 2) Swallow those errors so Next.js dev overlay does not brick the app
 *
 * This is NOT used for app wallet logic (demo uses session JWT wallet).
 */
(function () {
  if (typeof window === 'undefined') return;
  if (window.__rhWalletErrGuard) return;
  window.__rhWalletErrGuard = true;

  var PROVIDER_KEYS = {
    ethereum: true,
    solana: true,
    web3: true,
    phantom: true,
  };

  function isProviderKey(prop) {
    return PROVIDER_KEYS[prop] === true || PROVIDER_KEYS[String(prop)] === true;
  }

  function isNoise(msg) {
    if (!msg || typeof msg !== 'string') return false;
    return (
      msg.indexOf('Cannot redefine property: ethereum') !== -1 ||
      msg.indexOf('Cannot redefine property: solana') !== -1 ||
      msg.indexOf('Cannot set property ethereum') !== -1 ||
      msg.indexOf('Cannot redefine property: web3') !== -1 ||
      msg.indexOf('Cannot redefine property: phantom') !== -1
    );
  }

  // Soft-fail redefinition of wallet provider globals
  try {
    var originalDefineProperty = Object.defineProperty;
    Object.defineProperty = function (obj, prop, descriptor) {
      if (obj === window && isProviderKey(prop)) {
        try {
          return originalDefineProperty.call(Object, obj, prop, descriptor);
        } catch (err) {
          // Already defined as non-configurable by another extension — keep first injector
          return obj;
        }
      }
      return originalDefineProperty.call(Object, obj, prop, descriptor);
    };
  } catch (_) {
    /* ignore */
  }

  window.addEventListener(
    'error',
    function (e) {
      var msg = e.message || (e.error && e.error.message) || '';
      // Also match errors from chrome-extension://…/evmAsk.js
      var fromExt =
        (e.filename && e.filename.indexOf('chrome-extension://') === 0) ||
        (e.error && e.error.stack && String(e.error.stack).indexOf('chrome-extension://') !== -1);
      if (isNoise(msg) || (fromExt && isNoise(msg))) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return true;
      }
      if (fromExt && msg.indexOf('ethereum') !== -1) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return true;
      }
    },
    true
  );

  window.addEventListener(
    'unhandledrejection',
    function (e) {
      var r = e.reason;
      var msg = r && (r.message || String(r));
      if (isNoise(msg)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true
  );
})();
