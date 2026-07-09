/**
 * Testnet faucets for the app chain (Robinhood Chain Testnet).
 * Official + community — both may rate-limit; try either if one fails.
 */

export type FaucetLink = {
  name: string;
  url: string;
  note?: string;
};

/** Only shown when running on Robinhood testnet (46630). */
export const ROBINHOOD_TESTNET_FAUCETS: FaucetLink[] = [
  {
    name: 'Official Robinhood faucet',
    url: 'https://faucet.testnet.chain.robinhood.com/',
    note: 'Primary testnet ETH faucet',
  },
  {
    name: 'Zalalena faucet',
    url: 'https://faucet.zalalena.com/robinhood',
    note: 'Alternate testnet faucet',
  },
];

export function getAppFaucets(chainId?: number): FaucetLink[] {
  const id =
    chainId ??
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_CHAIN_ID
      ? Number(process.env.NEXT_PUBLIC_CHAIN_ID)
      : 46630);
  if (id === 46630) return ROBINHOOD_TESTNET_FAUCETS;
  return [];
}
