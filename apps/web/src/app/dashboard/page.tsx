'use client';

import { Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import DashboardLayout, { type Tab } from '@/components/DashboardLayout';
import WalletGate from '@/components/WalletGate';
import { ToastProvider } from '@/components/Toast';
import PrivateVaultTab from '@/components/tabs/PrivateVaultTab';
import ShieldPoolTab from '@/components/tabs/ShieldPoolTab';
import SettingsTab from '@/components/tabs/SettingsTab';

const valid = new Set(['vault', 'shield', 'settings', 'send', 'receive', 'dashboard']);

function normalize(raw: string | null): Tab {
  if (!raw || !valid.has(raw)) return 'vault';
  if (raw === 'send' || raw === 'receive' || raw === 'dashboard') return 'vault';
  if (raw === 'shield' || raw === 'settings') return raw;
  return 'vault';
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = normalize(searchParams.get('tab'));

  const onTabChange = useCallback(
    (t: Tab) => {
      router.push(`/dashboard?tab=${t}`, { scroll: false });
    },
    [router]
  );

  const body =
    activeTab === 'shield' ? (
      <ShieldPoolTab />
    ) : activeTab === 'settings' ? (
      <SettingsTab />
    ) : (
      <PrivateVaultTab />
    );

  return (
    <WalletGate>
      <DashboardLayout activeTab={activeTab} onTabChange={onTabChange}>
        {body}
      </DashboardLayout>
    </WalletGate>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm text-[var(--text-muted)]">
          Loading…
        </div>
      }
    >
      <ToastProvider>
        <DashboardContent />
      </ToastProvider>
    </Suspense>
  );
}
