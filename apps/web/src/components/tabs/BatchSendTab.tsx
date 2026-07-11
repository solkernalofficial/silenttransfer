'use client';

import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  useBalance,
  useSendTransaction,
  useWriteContract,
  useSwitchChain,
} from 'wagmi';
import { isAddress, formatEther, parseEther } from 'viem';
import { getAuthMode, getStoredToken, getStoredWallet } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useSessionWallet } from '@/hooks/useSessionWallet';
import { truncAddr } from '@/lib/tokens';
import { explorerTxUrl } from '@/lib/explorer';
import { appChain } from '@/lib/wagmi';
import { switchOrAddAppChain } from '@/lib/addChain';
import NetworkSwitchBanner from '@/components/NetworkSwitchBanner';
import FaucetLinks from '@/components/FaucetLinks';
import {
  executePrivateSend,
  parseBatchLines,
  type PrivateSendResult,
} from '@/lib/privateSend';
import {
  downloadClaimPackage,
  encodeClaimCode,
} from '@/lib/claimVault';
import {
  Users,
  Loader2,
  AlertCircle,
  CheckCircle,
  Copy,
  Download,
  ExternalLink,
  Wallet,
  Shield,
} from 'lucide-react';

export default function BatchSendTab() {
  const { showToast } = useToast();
  const {
    wallet: sessionWallet,
    source,
    connectWallet,
    signInWithEthereum,
    needsSiwe,
    wrongChain,
    chainName,
    expectedChainId,
  } = useSessionWallet();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync, isPending: isSendingNative } = useSendTransaction();
  const { writeContractAsync, isPending: isSendingToken } = useWriteContract();

  const [raw, setRaw] = useState(
    '# address,amount[,token]\n# 0xRecipient…,0.001,ETH\n'
  );
  const [statusMsg, setStatusMsg] = useState('');
  const [results, setResults] = useState<PrivateSendResult[]>([]);
  const [lineErrors, setLineErrors] = useState<string[]>([]);

  const fromWallet = sessionWallet || '';
  const isRealWallet = source === 'wallet' && Boolean(fromWallet);
  const walletAddr =
    fromWallet && isAddress(fromWallet) ? (fromWallet as `0x${string}`) : undefined;

  const { data: ethBalance, refetch: refetchEth } = useBalance({
    address: walletAddr,
    chainId: expectedChainId,
    query: { enabled: Boolean(walletAddr) },
  });

  const parsed = useMemo(() => parseBatchLines(raw), [raw]);

  const totalEth = useMemo(() => {
    return parsed.lines
      .filter((l) => (l.token || 'ETH') === 'ETH')
      .reduce((s, l) => s + Number(l.amount), 0);
  }, [parsed.lines]);

  const ensureAuth = async (addr: string) => {
    const mode = getAuthMode();
    const stored = getStoredWallet();
    const tokenJwt = getStoredToken();
    if (tokenJwt && stored === addr.toLowerCase() && mode === 'siwe') return;
    if (needsSiwe || mode !== 'siwe' || stored !== addr.toLowerCase()) {
      await signInWithEthereum();
    }
  };

  const batchMutation = useMutation({
    mutationFn: async () => {
      if (!fromWallet || !isAddress(fromWallet)) {
        throw new Error('Connect a wallet first');
      }
      if (source !== 'wallet') {
        throw new Error(
          'Connect a real wallet (MetaMask / WalletConnect) for on-chain batch send.'
        );
      }

      const { lines, errors } = parseBatchLines(raw);
      setLineErrors(errors);
      if (errors.length) throw new Error(errors[0]);
      if (!lines.length) throw new Error('Add at least one recipient line');

      try {
        await switchOrAddAppChain({
          currentChainId: undefined,
          switchChain: (args) => switchChainAsync(args),
        });
      } catch (e) {
        throw new Error(
          e instanceof Error
            ? e.message
            : `Switch wallet to ${chainName} (chain ${expectedChainId})`
        );
      }

      await ensureAuth(fromWallet);

      // Pre-check total ETH vs balance (rough; ignores gas)
      const ethLines = lines.filter((l) => (l.token || 'ETH') === 'ETH');
      if (ethLines.length && ethBalance) {
        let need = BigInt(0);
        for (const l of ethLines) {
          need += parseEther(l.amount);
        }
        const gasReserve = parseEther('0.0002') * BigInt(Math.max(ethLines.length, 1));
        if (need + gasReserve > ethBalance.value) {
          throw new Error(
            `Insufficient ETH for batch (need ~${formatEther(need)} + gas reserve)`
          );
        }
      }

      const out: PrivateSendResult[] = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        setStatusMsg(
          `Sending ${i + 1}/${lines.length} → ${truncAddr(line.toWallet)} (${line.amount} ${line.token || 'ETH'})…`
        );
        const result = await executePrivateSend(line, {
          fromWallet,
          chainId: expectedChainId,
          claimMode: 'client',
          sendTransactionAsync,
          writeContractAsync,
          onStatus: setStatusMsg,
        });
        out.push(result);
        setResults([...out]);
      }
      return out;
    },
    onSuccess: (data) => {
      setStatusMsg('');
      showToast(
        'success',
        `Batch complete: ${data.length} private transfer${data.length === 1 ? '' : 's'}`
      );
      refetchEth();
    },
    onError: (e: Error) => {
      setStatusMsg('');
      const msg = e.message || 'Batch send failed';
      if (/user rejected|denied|reject/i.test(msg)) {
        showToast('error', 'Wallet rejected a transaction');
      } else {
        showToast('error', msg);
      }
    },
  });

  const busy =
    batchMutation.isPending || isSendingNative || isSendingToken;

  const copyAllCodes = async () => {
    if (!results.length) return;
    const text = results.map((r) => r.claim_code).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      showToast('success', 'All claim codes copied — share only with each recipient');
    } catch {
      showToast('error', 'Could not copy');
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="rh-card p-6">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h2 className="text-lg font-semibold text-[var(--text)]">Batch private transfer</h2>
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md bg-violet-50 text-violet-800 border border-violet-200">
            1 → many
          </span>
        </div>
        <p className="text-sm text-[var(--text-muted)] mb-5 leading-relaxed">
          One wallet pays many recipients — each gets a fresh one-time address. Claim material
          stays in your browser (client-held); share claim codes only with the right person.
        </p>

        {!isRealWallet && (
          <div className="mb-4 p-3 rounded-lg rh-alert-info text-xs text-[var(--text-muted)]">
            Connect a <strong className="text-[var(--text)]">real wallet</strong> to fund batch
            sends on-chain.
            <button
              type="button"
              onClick={() => connectWallet().catch(() => {})}
              className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)]"
            >
              <Wallet className="w-3.5 h-3.5" /> Connect wallet
            </button>
          </div>
        )}

        {wrongChain && <NetworkSwitchBanner variant="full" className="mb-4" />}

        {isRealWallet && ethBalance && ethBalance.value === BigInt(0) && (
          <div className="mb-4">
            <FaucetLinks variant="card" title="Wallet balance is 0 — get test ETH" />
          </div>
        )}

        <div className="mb-4 p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] text-[11px] text-[var(--text-muted)] space-y-1">
          <p className="font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" /> Privacy notes
          </p>
          <p>
            Each line is a separate on-chain fund tx to a unique one-time address — not a public
            fan-out to one reused deposit.
          </p>
          <p>
            Server records discovery metadata for recipients but does <strong>not</strong> store
            claim spend keys (client-held path).
          </p>
        </div>

        <label className="rh-label">Recipients (CSV or one per line)</label>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          disabled={busy}
          rows={10}
          spellCheck={false}
          className="rh-input font-mono text-xs min-h-[180px] resize-y"
          placeholder={'0xabc…,0.01,ETH\n0xdef…,0.005,ETH'}
        />
        <p className="text-[11px] text-[var(--text-faint)] mt-1.5 mb-3">
          Format: <code className="text-[var(--text-muted)]">address,amount[,ETH|SILENT]</code>
          {' · '}
          Parsed: <strong className="text-[var(--text)]">{parsed.lines.length}</strong> lines
          {totalEth > 0 && (
            <>
              {' · '}~{totalEth.toLocaleString(undefined, { maximumFractionDigits: 6 })} ETH
            </>
          )}
          {fromWallet && ethBalance && (
            <>
              {' · '}balance {Number(formatEther(ethBalance.value)).toLocaleString(undefined, { maximumFractionDigits: 6 })} ETH
            </>
          )}
        </p>

        {(lineErrors.length > 0 || parsed.errors.length > 0) && !busy && (
          <div className="mb-3 p-2 rounded-lg rh-alert-error text-xs">
            {(lineErrors.length ? lineErrors : parsed.errors).slice(0, 5).map((e) => (
              <div key={e}>{e}</div>
            ))}
          </div>
        )}

        {statusMsg && (
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mb-3">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {statusMsg}
          </div>
        )}

        <button
          type="button"
          disabled={busy || wrongChain || !parsed.lines.length}
          onClick={() => batchMutation.mutate()}
          className="rh-btn-primary"
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Users className="w-4 h-4" />
          )}
          {busy
            ? 'Sending batch…'
            : `Send ${parsed.lines.length || 0} private transfer${parsed.lines.length === 1 ? '' : 's'}`}
        </button>

        {batchMutation.isError && (
          <div className="mt-4 p-3 rounded-lg rh-alert-error flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="text-xs text-[var(--danger-text)]">
              {(batchMutation.error as Error)?.message || 'Batch failed'}
            </div>
          </div>
        )}
      </div>

      {results.length > 0 && (
        <div className="rh-card p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[var(--text)] flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              Completed ({results.length})
            </h3>
            <button
              type="button"
              onClick={copyAllCodes}
              className="text-xs font-semibold text-[var(--accent)] flex items-center gap-1"
            >
              <Copy className="w-3.5 h-3.5" /> Copy all claim codes
            </button>
          </div>
          <div className="space-y-3 max-h-[420px] overflow-y-auto">
            {results.map((r) => {
              const link = explorerTxUrl(r.funding_tx_hash);
              return (
                <div
                  key={r.stealth_address}
                  className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 text-xs space-y-1.5"
                >
                  <div className="font-mono text-emerald-900">
                    To {truncAddr(r.to_address)} · {r.amount} {r.token}
                  </div>
                  <div className="font-mono break-all text-emerald-800/90">
                    One-time: {r.stealth_address}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {link && (
                      <a
                        href={link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-emerald-800 underline"
                      >
                        Explorer <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-semibold text-emerald-800"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(encodeClaimCode(r.claim_package));
                          showToast('success', 'Claim code copied');
                        } catch {
                          showToast('error', 'Copy failed');
                        }
                      }}
                    >
                      <Copy className="w-3 h-3" /> Claim code
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-semibold text-emerald-800"
                      onClick={() => {
                        downloadClaimPackage(r.claim_package);
                        showToast('success', 'Claim package downloaded');
                      }}
                    >
                      <Download className="w-3 h-3" /> JSON
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-[var(--text-faint)]">
            Share each claim code only with that recipient. Network: {appChain.name} ({appChain.id})
          </p>
        </div>
      )}
    </div>
  );
}
