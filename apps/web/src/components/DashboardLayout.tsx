'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  Send,
  Download,
  ScanSearch,
  Repeat2,
  History,
  FileCode,
  BarChart3,
  Settings,
  Menu,
  X,
  RefreshCw,
  Plug,
  Wallet,
  Check,
  BookOpen,
  Coins,
} from 'lucide-react';
import { useSessionWallet } from '@/hooks/useSessionWallet';
import { DEMO_WALLETS, truncAddr } from '@/lib/tokens';
import { isValidAddress } from '@/lib/session';
import { BrandMark, DOCS_URL, SILENT_PAGE_URL } from '@/components/BrandLogo';

type Tab =
  | 'dashboard'
  | 'send'
  | 'receive'
  | 'scanner'
  | 'relayer'
  | 'transactions'
  | 'contracts'
  | 'analytics'
  | 'settings';

interface DashboardLayoutProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  children: ReactNode;
}

const navItems: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'send', label: 'Send', icon: Send },
  { id: 'receive', label: 'Receive', icon: Download },
  { id: 'scanner', label: 'Scanner', icon: ScanSearch },
  { id: 'relayer', label: 'Relayer', icon: Repeat2 },
  { id: 'transactions', label: 'Transactions', icon: History },
  { id: 'contracts', label: 'Contracts', icon: FileCode },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function DashboardLayout({
  activeTab,
  onTabChange,
  children,
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [manualAddr, setManualAddr] = useState('');
  const [connectError, setConnectError] = useState('');
  const { wallet, isConnected, connect, disconnect } = useSessionWallet();
  const envLabel =
    typeof process !== 'undefined' && process.env.NEXT_PUBLIC_ENVIRONMENT
      ? String(process.env.NEXT_PUBLIC_ENVIRONMENT).toUpperCase()
      : process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
        ? 'DEMO'
        : 'TESTNET';
  const networkName =
    typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_NETWORK_NAME || 'Robinhood Chain Testnet'
      : 'Robinhood Chain Testnet';

  const pageTitle = navItems.find((n) => n.id === activeTab)?.label || 'Dashboard';

  const handleConnect = async (addr: string) => {
    if (!isValidAddress(addr)) {
      setConnectError('Enter a valid 0x address');
      return;
    }
    setConnectError('');
    await connect(addr);
    setConnectOpen(false);
    setManualAddr('');
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
        className={`fixed lg:static inset-y-0 left-0 z-30 w-64 rh-sidebar flex flex-col transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <Link
          href="/"
          className="h-16 flex items-center gap-3 px-5 border-b border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors group"
          title="Back to home"
        >
          <span className="group-hover:scale-[1.03] transition-transform shrink-0">
            <BrandMark size={36} />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-bold text-[var(--accent)] tracking-tight">
              SilentTransfer
            </div>
            <div className="text-[10px] text-[var(--text-faint)] tracking-[0.12em] uppercase font-medium">
              Privacy
            </div>
          </div>
        </Link>

        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5">
          {navItems.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => {
                  onTabChange(id);
                  setSidebarOpen(false);
                }}
                className={`rh-nav-item ${active ? 'rh-nav-item-active' : ''}`}
              >
                <Icon className="w-4 h-4 shrink-0 opacity-90" />
                <span>{label}</span>
                {active && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--accent)] shadow-sm shadow-green-600/40" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-[var(--border)] p-4 space-y-3 bg-[var(--bg-muted)]/50">
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <div className="w-2 h-2 rounded-full bg-[var(--accent)] shadow-[0_0_0_3px_var(--accent-ring)]" />
            <span className="font-medium truncate" title={networkName}>
              {networkName}
            </span>
            <span
              className={`ml-auto text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${
                envLabel === 'TESTNET'
                  ? 'bg-sky-50 text-sky-800 border-sky-200'
                  : envLabel === 'MAINNET'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-900 border-amber-200'
              }`}
            >
              {envLabel}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <a
              href={DOCS_URL}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--accent)]"
              {...(DOCS_URL.startsWith('http')
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : {})}
            >
              <BookOpen className="w-3 h-3" /> Docs
            </a>
            <Link
              href={SILENT_PAGE_URL}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--accent)]"
            >
              <Coins className="w-3 h-3" /> $SILENT
            </Link>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 rh-header flex items-center px-4 lg:px-6 gap-4 shrink-0 z-10">
          <button
            className="lg:hidden p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>

          <h1 className="text-lg font-semibold tracking-tight text-[var(--text)] flex-1 truncate">
            {pageTitle}
          </h1>

          <div className="flex items-center gap-2.5 relative">
            <button
              onClick={() => window.location.reload()}
              className="p-2 rounded-lg text-[var(--text-faint)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {isConnected && wallet ? (
              <div className="flex items-center gap-1.5">
                {/* Quick switch Alice / Bob for demo walkthrough */}
                <div className="hidden sm:flex items-center gap-1 mr-0.5">
                  <button
                    type="button"
                    onClick={() => handleConnect(DEMO_WALLETS.alice)}
                    className={`text-[10px] font-bold px-2 py-1 rounded-md border transition-colors ${
                      wallet === DEMO_WALLETS.alice
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                    }`}
                    title="Switch to Alice (sender)"
                  >
                    Alice
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConnect(DEMO_WALLETS.bob)}
                    className={`text-[10px] font-bold px-2 py-1 rounded-md border transition-colors ${
                      wallet === DEMO_WALLETS.bob
                        ? 'bg-sky-100 text-sky-800 border-sky-300'
                        : 'bg-white text-sky-700 border-sky-200 hover:bg-sky-50'
                    }`}
                    title="Switch to Bob (receiver)"
                  >
                    Bob
                  </button>
                </div>
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono font-medium shadow-sm ${
                    wallet === DEMO_WALLETS.bob
                      ? 'bg-sky-50 border-sky-200 text-sky-800'
                      : 'bg-[var(--accent-soft)] border-[#bbf7d0] text-[var(--accent)]'
                  }`}
                >
                  <Wallet className="w-3.5 h-3.5" />
                  <span>
                    {wallet === DEMO_WALLETS.alice
                      ? 'Alice '
                      : wallet === DEMO_WALLETS.bob
                        ? 'Bob '
                        : ''}
                    {truncAddr(wallet)}
                  </span>
                  <button
                    onClick={() => disconnect()}
                    className="ml-0.5 text-[var(--text-faint)] hover:text-red-600 transition-colors"
                    title="Disconnect"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConnectOpen((v) => !v)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold shadow-sm transition-colors"
              >
                <Plug className="w-3.5 h-3.5" />
                Connect wallet
              </button>
            )}

            {connectOpen && !isConnected && (
              <div className="absolute right-0 top-full mt-2 w-80 rh-card p-4 shadow-xl z-50 border border-[var(--border)]">
                <p className="text-xs font-semibold text-[var(--text)] mb-2">Connect wallet</p>
                <p className="text-[11px] text-[var(--text-muted)] mb-3 leading-relaxed">
                  Testnet operator login: enter any valid 0x address or select a reference profile
                  (Alice / Bob). Chain {typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_CHAIN_ID || '46630' : '46630'}.
                </p>
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => handleConnect(DEMO_WALLETS.alice)}
                    className="flex-1 text-xs font-semibold py-2 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
                  >
                    Alice
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConnect(DEMO_WALLETS.bob)}
                    className="flex-1 text-xs font-semibold py-2 rounded-lg bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100"
                  >
                    Bob
                  </button>
                </div>
                <input
                  type="text"
                  value={manualAddr}
                  onChange={(e) => {
                    setManualAddr(e.target.value);
                    setConnectError('');
                  }}
                  placeholder="0x… your address"
                  className="rh-input font-mono text-xs mb-2"
                />
                {connectError && (
                  <p className="text-red-600 text-[11px] mb-2">{connectError}</p>
                )}
                <button
                  type="button"
                  onClick={() => handleConnect(manualAddr)}
                  className="w-full flex items-center justify-center gap-1.5 rh-btn-primary text-xs py-2"
                >
                  <Check className="w-3.5 h-3.5" />
                  Continue with address
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
