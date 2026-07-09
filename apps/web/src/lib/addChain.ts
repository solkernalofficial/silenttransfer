/**
 * Help wallets add / switch to the app chain (Robinhood Chain Testnet by default).
 * Used when user is on Ethereum mainnet, Sepolia, etc.
 */

import { appChain } from '@/lib/wagmi';
import { getAppChain, robinhoodTestnet } from '@/lib/chains';

export type NetworkDetails = {
  chainId: number;
  chainIdHex: string;
  name: string;
  rpcUrl: string;
  explorerUrl: string;
  currencySymbol: string;
  currencyName: string;
  currencyDecimals: number;
};

/** Human-readable network card for UI + copy. */
export function getNetworkDetails(): NetworkDetails {
  const chain = getAppChain();
  const rpc = chain.rpcUrls.default.http[0] || '';
  const explorer =
    chain.blockExplorers?.default?.url ||
    robinhoodTestnet.blockExplorers?.default.url ||
    '';
  return {
    chainId: chain.id,
    chainIdHex: `0x${chain.id.toString(16)}`,
    name: chain.name,
    rpcUrl: rpc,
    explorerUrl: explorer,
    currencySymbol: chain.nativeCurrency.symbol,
    currencyName: chain.nativeCurrency.name,
    currencyDecimals: chain.nativeCurrency.decimals,
  };
}

/** EIP-3085 wallet_addEthereumChain params. */
export function getAddEthereumChainParams() {
  const d = getNetworkDetails();
  return {
    chainId: d.chainIdHex,
    chainName: d.name,
    nativeCurrency: {
      name: d.currencyName,
      symbol: d.currencySymbol,
      decimals: d.currencyDecimals,
    },
    rpcUrls: [d.rpcUrl],
    blockExplorerUrls: d.explorerUrl ? [d.explorerUrl] : [],
  };
}

export function formatNetworkDetailsForCopy(): string {
  const d = getNetworkDetails();
  const lines = [
    `Network name: ${d.name}`,
    `Chain ID: ${d.chainId} (${d.chainIdHex})`,
    `Currency: ${d.currencySymbol}`,
    `RPC URL: ${d.rpcUrl}`,
    d.explorerUrl ? `Block explorer: ${d.explorerUrl}` : null,
  ];
  if (d.chainId === 46630) {
    lines.push(
      '',
      'Testnet faucets:',
      'https://faucet.testnet.chain.robinhood.com/',
      'https://faucet.zalalena.com/robinhood'
    );
  }
  return lines.filter((x) => x !== null).join('\n');
}

function isUnrecognizedChainError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: number | string; message?: string; name?: string; cause?: unknown };
  const code = e.code;
  if (code === 4902 || code === '4902' || code === -32603) return true;
  const msg = `${e.message || ''} ${e.name || ''}`.toLowerCase();
  if (
    /unrecognized chain|unknown chain|chain not (found|configured|added)|does not exist|invalid chain|4902|add ethereum chain/i.test(
      msg
    )
  ) {
    return true;
  }
  // Nested cause (wagmi wraps)
  if (e.cause) return isUnrecognizedChainError(e.cause);
  return false;
}

type RequestFn = (args: {
  method: string;
  params?: unknown[];
}) => Promise<unknown>;

/**
 * Switch to app chain; if missing in wallet, prompt wallet_addEthereumChain first.
 */
export async function switchOrAddAppChain(opts: {
  currentChainId?: number;
  switchChain: (args: { chainId: number }) => Promise<unknown>;
  /** Optional: wallet_client.request or window.ethereum.request */
  request?: RequestFn;
}): Promise<'switched' | 'added' | 'already'> {
  const target = appChain.id;
  if (opts.currentChainId === target) return 'already';

  try {
    await opts.switchChain({ chainId: target });
    return 'switched';
  } catch (switchErr) {
    // Try EIP-3085 add when chain is unknown to the wallet
    const request =
      opts.request ||
      (typeof window !== 'undefined'
        ? ((window as unknown as { ethereum?: { request?: RequestFn } }).ethereum
            ?.request?.bind(
              (window as unknown as { ethereum: { request: RequestFn } }).ethereum
            ) as RequestFn | undefined)
        : undefined);

    if (!request) {
      throw enhanceChainError(switchErr);
    }

    // Always attempt add when switch fails — some wallets use odd error codes
    try {
      await request({
        method: 'wallet_addEthereumChain',
        params: [getAddEthereumChainParams()],
      });
      // After add, some wallets auto-switch; force switch if still needed
      try {
        await opts.switchChain({ chainId: target });
      } catch {
        /* add alone may have switched */
      }
      return 'added';
    } catch (addErr) {
      // User rejected add
      if (isUserRejected(addErr) || isUserRejected(switchErr)) {
        throw new Error('Network switch cancelled in wallet');
      }
      if (isUnrecognizedChainError(switchErr) || isUnrecognizedChainError(addErr)) {
        throw enhanceChainError(addErr || switchErr);
      }
      throw enhanceChainError(addErr || switchErr);
    }
  }
}

function isUserRejected(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: number | string; message?: string; cause?: unknown };
  if (e.code === 4001 || e.code === 'ACTION_REJECTED') return true;
  if (/user rejected|denied|cancel/i.test(e.message || '')) return true;
  if (e.cause) return isUserRejected(e.cause);
  return false;
}

function enhanceChainError(err: unknown): Error {
  const d = getNetworkDetails();
  const base = err instanceof Error ? err.message : String(err || 'Switch failed');
  return new Error(
    `${base}\n\nAdd network manually:\n` +
      `Name: ${d.name}\n` +
      `Chain ID: ${d.chainId}\n` +
      `RPC: ${d.rpcUrl}\n` +
      (d.explorerUrl ? `Explorer: ${d.explorerUrl}` : '')
  );
}
