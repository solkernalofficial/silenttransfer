'use client';

import { Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import WalletGate from '@/components/WalletGate';
import { ToastProvider } from '@/components/Toast';
import DashboardTab from '@/components/tabs/DashboardTab';
import SendTab from '@/components/tabs/SendTab';
import VaultSendTab from '@/components/tabs/VaultSendTab';
import VaultInboxTab from '@/components/tabs/VaultInboxTab';
import ShieldPoolTab from '@/components/tabs/ShieldPoolTab';
import BatchSendTab from '@/components/tabs/BatchSendTab';
import ReceiveTab from '@/components/tabs/ReceiveTab';
import ScannerTab from '@/components/tabs/ScannerTab';
import RelayerTab from '@/components/tabs/RelayerTab';
import TransactionsTab from '@/components/tabs/TransactionsTab';
import ContractsTab from '@/components/tabs/ContractsTab';
import AnalyticsTab from '@/components/tabs/AnalyticsTab';
import SettingsTab from '@/components/tabs/SettingsTab';

type Tab =
  | 'dashboard'
  | 'vault'
  | 'inbox'
  | 'shield'
  | 'send'
  | 'batch'
  | 'receive'
  | 'scanner'
  | 'relayer'
  | 'transactions'
  | 'contracts'
  | 'analytics'
  | 'settings';

const validTabs: Set<string> = new Set([
  'dashboard',
  'vault',
  'inbox',
  'shield',
  'send',
  'batch',
  'receive',
  'scanner',
  'relayer',
  'transactions',
  'contracts',
  'analytics',
  'settings',
]);

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = searchParams.get('tab');
  const activeTab: Tab = tab && validTabs.has(tab) ? (tab as Tab) : 'vault';

  const onTabChange = useCallback(
    (t: Tab) => {
      router.push(`/dashboard?tab=${t}`, { scroll: false });
    },
    [router]
  );

  const renderTab = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardTab />;
      case 'vault':
        return <VaultSendTab />;
      case 'inbox':
        return <VaultInboxTab />;
      case 'shield':
        return <ShieldPoolTab />;
      case 'send':
        return <SendTab />;
      case 'batch':
        return <BatchSendTab />;
      case 'receive':
        return <ReceiveTab />;
      case 'scanner':
        return <ScannerTab />;
      case 'relayer':
        return <RelayerTab />;
      case 'transactions':
        return <TransactionsTab />;
      case 'contracts':
        return <ContractsTab />;
      case 'analytics':
        return <AnalyticsTab />;
      case 'settings':
        return <SettingsTab />;
    }
  };

  return (
    <WalletGate>
      <DashboardLayout activeTab={activeTab} onTabChange={onTabChange}>
        {renderTab()}
      </DashboardLayout>
    </WalletGate>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg-canvas)] text-[var(--text-muted)] text-sm">
          Loading console…
        </div>
      }
    >
      <ToastProvider>
        <DashboardContent />
      </ToastProvider>
    </Suspense>
  );
}
