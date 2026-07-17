'use client';

import { useQuery } from '@tanstack/react-query';
import { FileCode, Zap, AlertTriangle, Loader2, EyeOff } from 'lucide-react';
import { api } from '@/lib/api';

interface ApiContract {
  name: string;
  address: string;
  network: string;
  description: string;
}

function truncAddr(a: string) {
  if (!a || a.length < 12) return a;
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

const FALLBACK: ApiContract[] = [
  {
    name: 'ERC6538Registry',
    address: '0x0000000000000000000000000000000000000000',
    network: 'Not configured',
    description: 'Stealth meta-address registry (ERC-6538).',
  },
  {
    name: 'ERC5564Messenger',
    address: '0x0000000000000000000000000000000000000000',
    network: 'Not configured',
    description: 'Stealth announcement emitter (ERC-5564).',
  },
  {
    name: 'SilentPaymaster',
    address: '0x0000000000000000000000000000000000000000',
    network: 'Not configured',
    description: 'Gasless paymaster interface (ERC-4337 path staged; live claim uses EOA sweep).',
  },
  {
    name: 'sthood (SILENT)',
    address: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    network: 'Local Hardhat default',
    description: 'Product ERC-20 — name sthood, ticker SILENT, hard-capped supply.',
  },
];

export default function ContractsTab() {
  const { data, isLoading } = useQuery<{ contracts: ApiContract[] }>({
    queryKey: ['contracts-tab'],
    queryFn: async () =>
      (await api<{ contracts: ApiContract[] }>('/api/contracts')) || { contracts: FALLBACK },
  });

  const contracts = data?.contracts?.length ? data.contracts : FALLBACK;

  const iconFor = (name: string) => {
    if (name.toLowerCase().includes('paymaster')) return Zap;
    if (name.toLowerCase().includes('messenger')) return EyeOff;
    return FileCode;
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="rh-card p-4 border border-sky-100 bg-sky-50/50 text-xs text-sky-900 leading-relaxed">
        Primary product surface is SilentUserVault (deposit and private send). Advanced modules
        (shield, stealth) are optional. Evaluation environments may record transfers off-chain
        even when contracts are deployed on testnet.
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm py-12 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading contract addresses…
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {contracts.map((c) => {
            const Icon = iconFor(c.name);
            const zero = /0x0{40}/i.test(c.address);
            return (
              <div key={c.name} className="rh-card p-5 rh-card-hover">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center">
                      <Icon className="w-4 h-4 text-[var(--accent)]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--text)]">{c.name}</h3>
                      <div className="text-[10px] font-mono text-[var(--text-muted)]">
                        {truncAddr(c.address)}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-sans border ${
                      zero
                        ? 'bg-yellow-50 text-[var(--warn-text)] border-yellow-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    {zero ? 'not set' : 'configured'}
                  </span>
                </div>

                <p className="text-xs text-[var(--text-muted)] leading-relaxed mb-2">
                  {c.description}
                </p>
                <p className="text-[10px] text-[var(--text-faint)] font-mono">{c.network}</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="rh-card p-6">
        <h3 className="text-base font-semibold text-[var(--text)] mb-4">Privacy flow</h3>

        <div className="space-y-4 text-xs text-[var(--text-faint)] leading-relaxed">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded bg-[var(--accent-soft)] flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[10px] text-[var(--accent)] font-bold">1</span>
            </div>
            <div>
              <span className="text-[var(--text-faint)] font-semibold">Key registration</span>
              <br />
              Recipient turns on private receive (spend + view helpers). No identity check.
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded bg-[var(--accent-soft)] flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[10px] text-[var(--accent)] font-bold">2</span>
            </div>
            <div>
              <span className="text-[var(--text-faint)] font-semibold">Private send</span>
              <br />
              Sender creates a one-time private address for the recipient and logs the announcement.
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded bg-[var(--accent-soft)] flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[10px] text-[var(--accent)] font-bold">3</span>
            </div>
            <div>
              <span className="text-[var(--text-faint)] font-semibold">Scan</span>
              <br />
              Recipient scans with their wallet and finds payments meant for them.
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded bg-[var(--accent-soft)] flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[10px] text-[var(--accent)] font-bold">4</span>
            </div>
            <div>
              <span className="text-[var(--text-faint)] font-semibold">Claim settlement</span>
              <br />
              Funded private sends can sweep on-chain on testnet (live settlement). Full ERC-4337
              paymaster gasless UserOps remain staged — not mainnet production.
            </div>
          </div>
        </div>

        <div className="mt-6 p-3 rounded-lg bg-yellow-50 border border-yellow-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-[var(--warn-text)] shrink-0 mt-0.5" />
          <div className="text-[11px] text-yellow-900/80">
            Addresses come from network deployment config. Real ETH private send uses wallet txs to
            one-time addresses; registry/messenger contracts support the longer ERC-5564 roadmap.
            Privacy is partial — see Docs.
          </div>
        </div>
      </div>
    </div>
  );
}
