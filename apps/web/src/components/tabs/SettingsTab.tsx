'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { ToggleLeft, Globe, Wifi, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export default function SettingsTab() {
  const { showToast } = useToast();
  const [apiUrl, setApiUrl] = useState(
    typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001' : 'http://localhost:8001'
  );
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [privacyMode, setPrivacyMode] = useState(true);
  const [gaslessRelay, setGaslessRelay] = useState(true);
  const [autoScan, setAutoScan] = useState(false);

  const environment =
    typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_ENVIRONMENT ||
        (process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ? 'demo' : 'testnet')
      : 'testnet';
  const demoMode =
    environment === 'demo' ||
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DEMO_MODE === 'true');
  const chainId =
    typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_CHAIN_ID || '46630' : '46630';
  const rpcUrl =
    typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.testnet.chain.robinhood.com'
      : 'https://rpc.testnet.chain.robinhood.com';
  const networkName =
    typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_NETWORK_NAME || 'Robinhood Chain Testnet'
      : 'Robinhood Chain Testnet';
  const silentAddress =
    typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_SILENT_ADDRESS || ''
      : '';

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult('idle');
    try {
      const res = await api('/health');
      if (res !== null) {
        setTestResult('success');
        showToast('success', 'API connection successful');
      } else {
        setTestResult('error');
        showToast('error', 'API connection failed');
      }
    } catch {
      setTestResult('error');
      showToast('error', 'API connection failed');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Wallet extensions tip */}
      <div className="rh-card p-4 border border-amber-200 bg-amber-50/60">
        <p className="text-xs text-amber-900 leading-relaxed">
          <strong>Note:</strong> Browser errors such as{' '}
          <code className="font-mono text-[11px]">Cannot redefine property: ethereum</code> originate
          from wallet extensions, not this application. Operator login uses the header connect flow
          (address or Alice/Bob). Disable conflicting extensions if needed.
        </p>
      </div>

      {/* Network config */}
      <div className="rh-card p-6">
        <h2 className="text-sm font-semibold text-[var(--text)] mb-4 flex items-center gap-2">
          <Globe className="w-4 h-4 text-[var(--accent)]" /> Network configuration
        </h2>
        <div className="space-y-3 text-xs font-mono">
          {[
            { label: 'Environment', value: environment },
            { label: 'Network', value: networkName },
            { label: 'Chain ID', value: chainId },
            { label: 'RPC URL', value: rpcUrl },
            {
              label: 'SILENT',
              value: silentAddress
                ? `${silentAddress.slice(0, 10)}…${silentAddress.slice(-8)}`
                : '—',
            },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="flex items-center justify-between gap-3 py-2 border-b border-[var(--border)]/80"
            >
              <span className="text-[var(--text-muted)] shrink-0">{label}</span>
              <span
                className={`text-right break-all ${
                  value === 'testnet'
                    ? 'text-sky-700 font-semibold'
                    : 'text-[var(--text-faint)]'
                }`}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* API URL */}
      <div className="rh-card p-6">
        <h2 className="text-sm font-semibold text-[var(--text)] mb-4 flex items-center gap-2">
          <Wifi className="w-4 h-4 text-[var(--accent)]" /> API Configuration
        </h2>
        <div className="space-y-4">
          <div>
            <label className="rh-label">API Base URL</label>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="http://localhost:8001"
              className="rh-input font-mono transition-colors"
            />
          </div>
          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="flex items-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white font-semibold text-sm rounded-lg px-4 py-2 transition-colors"
          >
            {testing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Wifi className="w-4 h-4" />
            )}
            {testing ? 'Testing...' : 'Test Connection'}
          </button>

          {testResult === 'success' && (
            <div className="flex items-center gap-2 text-xs text-emerald-700">
              <CheckCircle className="w-3.5 h-3.5" /> Connection successful
            </div>
          )}
          {testResult === 'error' && (
            <div className="flex items-center gap-2 text-xs text-red-600">
              <AlertCircle className="w-3.5 h-3.5" /> Connection failed
            </div>
          )}
        </div>
      </div>

      {/* Privacy toggles */}
      <div className="rh-card p-6">
        <h2 className="text-sm font-semibold text-[var(--text)] mb-4 flex items-center gap-2">
          <ToggleLeft className="w-4 h-4 text-[var(--accent)]" /> Privacy Settings
        </h2>
        <div className="space-y-4">
          {[
            {
              id: 'privacy-mode',
              label: 'Stealth Privacy Mode',
              desc: 'Route all transactions through stealth addresses by default',
              checked: privacyMode,
              onChange: setPrivacyMode,
            },
            {
              id: 'gasless-relay',
              label: 'Gasless Relay',
              desc: 'Use SilentPaymaster to sponsor gas fees automatically',
              checked: gaslessRelay,
              onChange: setGaslessRelay,
            },
            {
              id: 'auto-scan',
              label: 'Auto-Scan for Announcements',
              desc: 'Periodically scan the chain for incoming stealth payments',
              checked: autoScan,
              onChange: setAutoScan,
            },
          ].map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between py-3 border-b border-[var(--border)]/80 last:border-0"
            >
              <div>
                <div className="text-sm text-[var(--text)]">{s.label}</div>
                <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{s.desc}</div>
              </div>
              <button
                onClick={() => s.onChange(!s.checked)}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  s.checked ? 'bg-[var(--accent)] shadow-sm shadow-green-900/20' : 'bg-slate-300'
                }`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    s.checked ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Demo badge */}
      {demoMode && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-xs text-yellow-800">
          <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0" />
          Running in demo mode. Some settings changes will not persist across page reloads.
        </div>
      )}
    </div>
  );
}
