'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Loader2, AlertCircle, ArrowLeftRight } from 'lucide-react';
import EmptyState from '@/components/EmptyState';

interface Announcement {
  stealth_address: string;
  caller: string;
  token: string;
  amount: string;
  block_number: number;
  status: string;
  timestamp?: string;
}

function truncAddr(a: string) {
  if (!a || a.length < 10) return a;
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

export default function TransactionsTab() {
  const { data, isLoading, error } = useQuery<Announcement[]>({
    queryKey: ['announcements-tx'],
    queryFn: async () => (await api<Announcement[]>('/api/announcements')) || [],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 text-[var(--text-muted)] text-sm py-20">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading transactions...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-[var(--text-muted)]">
        <AlertCircle className="w-10 h-10 text-red-600" />
        <span className="text-sm text-red-600">Failed to load transactions</span>
        <button
          onClick={() => window.location.reload()}
          className="text-xs text-[var(--accent)] hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rh-card">
        <EmptyState
          title="No transactions found"
          description="Private transfers appear here after Send (demo log)."
          imageSrc="/brand/feature-stealth.jpg"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] mb-4">
        <ArrowLeftRight className="w-4 h-4 text-[var(--accent)]" />
        <span>{data.length} transaction{data.length !== 1 ? 's' : ''} found</span>
      </div>

      <div className="rh-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="bg-[var(--bg-muted)] text-[var(--text-muted)] border-b border-[var(--border)]">
                <th className="text-left py-3 px-4 font-medium">Stealth Address</th>
                <th className="text-left py-3 px-4 font-medium">Caller</th>
                <th className="text-left py-3 px-4 font-medium">Token</th>
                <th className="text-right py-3 px-4 font-medium">Amount</th>
                <th className="text-right py-3 px-4 font-medium">Block</th>
                <th className="text-center py-3 px-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((tx, i) => (
                <tr
                  key={i}
                  className="border-b border-[var(--border)]/70 hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <td className="py-3 px-4 text-[var(--accent)]">{truncAddr(tx.stealth_address)}</td>
                  <td className="py-3 px-4 text-[var(--text-muted)]">{truncAddr(tx.caller)}</td>
                  <td className="py-3 px-4 text-[var(--text-muted)]">{tx.token}</td>
                  <td className="py-3 px-4 text-right text-[var(--text)]">{Number(tx.amount).toFixed(4)}</td>
                  <td className="py-3 px-4 text-right text-[var(--text-muted)]">#{tx.block_number}</td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-sans ${
                        tx.status === 'confirmed'
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : tx.status === 'pending'
                            ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                            : 'bg-[var(--bg-muted)] text-[var(--text-muted)] border border-[var(--border)]'
                      }`}
                    >
                      {tx.status || 'unknown'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
