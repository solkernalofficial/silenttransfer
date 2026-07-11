'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Menu,
  X,
  Plug,
  Loader2,
  BookOpen,
  ChevronDown,
  Vault,
  Sparkles,
  Settings,
} from 'lucide-react';
import { useSessionWallet } from '@/hooks/useSessionWallet';
import { truncAddr } from '@/lib/tokens';
import { BrandMark, DOCS_URL } from '@/components/BrandLogo';
import NetworkSwitchBanner from '@/components/NetworkSwitchBanner';

export type Tab = 'vault' | 'shield' | 'settings';

interface DashboardLayoutProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  children: ReactNode;
}

const primaryNav: { id: Tab; label: string; hint: string; icon: typeof Vault }[] = [
  {
    id: 'vault',
    label: 'Private vault',
    hint: 'Deposit · send anytime',
    icon: Vault,
  },
];

const moreNav: { id: Tab; label: string; icon: typeof Vault }[] = [
  { id: 'shield', label: 'Shield pool (advanced)', icon: Sparkles },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function DashboardLayout({
  activeTab,
  onTabChange,
  children,
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [connectError, setConnectError] = useState('');
  const {
    wallet,
    isConnected,
    connectWallet,
    signInWithEthereum,
    disconnect,
    authBusy,
    wrongChain,
    needsSiwe,
  } = useSessionWallet();

  const pageTitle =
    activeTab === 'vault'
      ? 'Private vault'
      : activeTab === 'shield'
        ? 'Shield pool'
        : 'Settings';

  const moreActive = moreNav.some((n) => n.id === activeTab);

  const handleWalletConnect = async () => {
    setConnectError('');
    try {
      await connectWallet();
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : 'Wallet connection failed');
    }
  };

  const go = (id: Tab) => {
    onTabChange(id);
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen rh-page overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 w-[15rem] rh-sidebar flex flex-col transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <Link
          href="/"
          className="h-16 flex items-center gap-3 px-5 border-b border-[var(--border)] hover:bg-[var(--bg-hover)]"
        >
          <BrandMark size={36} />
          <div className="leading-tight">
            <div className="text-sm font-bold text-[var(--accent)]">SilentTransfer</div>
            <div className="text-[10px] text-[var(--text-faint)] uppercase tracking-wider">
              Private vault
            </div>
          </div>
        </Link>

        <nav className="flex-1 py-4 px-2.5 space-y-1">
          {primaryNav.map(({ id, label, hint, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => go(id)}
                className={`w-full text-left rounded-xl px-3 py-3 transition-colors ${
                  active
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                    : 'border border-transparent hover:bg-[var(--bg-hover)]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-semibold">{label}</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5 pl-6">{hint}</p>
              </button>
            );
          })}

          <div className="pt-4 mt-2 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-[var(--text-muted)]"
            >
              More
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${moreOpen || moreActive ? 'rotate-180' : ''}`}
              />
            </button>
            {(moreOpen || moreActive) &&
              moreNav.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => go(id)}
                  className={`rh-nav-item w-full text-xs ${activeTab === id ? 'rh-nav-item-active' : ''}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
          </div>
        </nav>

        <div className="p-4 border-t border-[var(--border)] text-xs text-[var(--text-muted)] space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Testnet
          </div>
          <Link href={DOCS_URL} className="flex items-center gap-1.5 hover:text-[var(--accent)]">
            <BookOpen className="w-3.5 h-3.5" /> Docs
          </Link>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 shrink-0 border-b border-[var(--border)] bg-[var(--bg-elevated)] flex items-center gap-3 px-4 lg:px-6">
          <button
            type="button"
            className="lg:hidden p-2 rounded-lg hover:bg-[var(--bg-hover)]"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-sm font-semibold truncate">{pageTitle}</h1>
          <div className="ml-auto flex items-center gap-2">
            {isConnected && wallet ? (
              <>
                {needsSiwe && (
                  <button
                    type="button"
                    onClick={() => signInWithEthereum().catch(() => {})}
                    disabled={authBusy}
                    className="text-xs font-semibold text-sky-800 bg-sky-50 border border-sky-200 rounded-lg px-2.5 py-1.5"
                  >
                    {authBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Sign in'}
                  </button>
                )}
                <span className="text-xs font-mono px-2.5 py-1.5 rounded-full bg-[var(--bg-muted)] border">
                  {truncAddr(wallet, 4, 4)}
                </span>
                <button type="button" onClick={() => disconnect()} className="p-1.5 text-[var(--text-muted)]">
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleWalletConnect}
                disabled={authBusy}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg px-3 py-2"
              >
                {authBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plug className="w-3.5 h-3.5" />}
                Connect
              </button>
            )}
          </div>
        </header>

        {wrongChain && (
          <div className="px-4 pt-3">
            <NetworkSwitchBanner variant="full" />
          </div>
        )}
        {connectError && <div className="px-4 pt-2 text-xs text-red-600">{connectError}</div>}

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-md mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
