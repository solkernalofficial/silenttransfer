import { robinhoodTestnet } from '@/lib/chains';
import { getChainId } from '@/lib/network';

export function getExplorerBaseUrl(): string {
  if (getChainId() === 46630) {
    return robinhoodTestnet.blockExplorers?.default.url || '';
  }
  return robinhoodTestnet.blockExplorers?.default.url || '';
}

export function explorerTxUrl(txHash: string): string | null {
  const base = getExplorerBaseUrl();
  if (!base || !txHash || !txHash.startsWith('0x')) return null;
  return `${base.replace(/\/$/, '')}/tx/${txHash}`;
}

export function explorerAddressUrl(address: string): string | null {
  const base = getExplorerBaseUrl();
  if (!base || !address) return null;
  return `${base.replace(/\/$/, '')}/address/${address}`;
}
