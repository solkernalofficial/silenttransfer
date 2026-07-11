'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useBalance, useWriteContract, useSwitchChain } from 'wagmi';
import { parseEther, formatEther, isAddress, decodeEventLog, type Hex } from 'viem';
import { waitForTransactionReceipt } from 'wagmi/actions';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useSessionWallet } from '@/hooks/useSessionWallet';
import { truncAddr } from '@/lib/tokens';
import { explorerTxUrl } from '@/lib/explorer';
import { wagmiConfig, appChain } from '@/lib/wagmi';
import { switchOrAddAppChain } from '@/lib/addChain';
import NetworkSwitchBanner from '@/components/NetworkSwitchBanner';
import FaucetLinks from '@/components/FaucetLinks';
import {
  createShieldNote,
  saveShieldNote,
  listShieldNotes,
  updateShieldNote,
  removeShieldNote,
  exportNotesJson,
  importNotesJson,
  buildMerkleTree,
  encodeWithdrawWitness,
  publicSignals,
  getShieldPoolAddress,
  SHIELD_POOL_ABI,
  SHIELD_LEVELS,
  DEFAULT_DENOMINATION_ETH,
  type ShieldNote,
} from '@/lib/shield/notes';
import {
  Shield,
  Loader2,
  Upload,
  Lock,
  Unlock,
  CheckCircle,
  Copy,
  Trash2,
  ExternalLink,
  EyeOff,
} from 'lucide-react';

const ZERO = '0x0000000000000000000000000000000000000000' as const;

export default function ShieldPoolTab() {
  const { showToast } = useToast();
  const {
    wallet: sessionWallet,
    source,
    connectWallet,
    ensureLiveWallet,
    signInWithEthereum,
    needsSiwe,
    isWagmiConnected,
    wrongChain,
    expectedChainId,
  } = useSessionWallet();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, isPending } = useWriteContract();

  const [notesVersion, setNotesVersion] = useState(0);
  const [withdrawTo, setWithdrawTo] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [lastTx, setLastTx] = useState<string | null>(null);

  const pool = getShieldPoolAddress();
  const denom = DEFAULT_DENOMINATION_ETH;
  const fromWallet = sessionWallet || '';
  const isReal = isWagmiConnected && Boolean(fromWallet);
  const walletAddr =
    fromWallet && isAddress(fromWallet) ? (fromWallet as `0x${string}`) : undefined;

  const { data: ethBalance, refetch: refetchEth } = useBalance({
    address: walletAddr,
    chainId: expectedChainId,
    query: { enabled: Boolean(walletAddr) },
  });

  const notes = useMemo(() => {
    void notesVersion;
    return listShieldNotes();
  }, [notesVersion]);

  const { data: treeData, refetch: refetchTree } = useQuery({
    queryKey: ['shield-commitments'],
    queryFn: async () =>
      (await api<{
        commitments: { commitment: string; leaf_index: number }[];
        count: number;
      }>('/api/shield/commitments')) || { commitments: [], count: 0 },
  });

  const ensureAuth = async () => {
    if (needsSiwe) await signInWithEthereum();
  };

  const depositMutation = useMutation({
    mutationFn: async () => {
      await ensureLiveWallet();
      if (!pool) {
        throw new Error(
          'Shield pool not deployed yet. Set NEXT_PUBLIC_SHIELD_POOL_ADDRESS after deploy.'
        );
      }
      await switchOrAddAppChain({
        currentChainId: undefined,
        switchChain: (args) => switchChainAsync(args),
      });
      await ensureAuth();

      setStatusMsg('Creating shielded note (secret stays in this browser)…');
      const note = createShieldNote(denom);
      saveShieldNote(note);
      setNotesVersion((v) => v + 1);

      setStatusMsg('Confirm deposit in wallet…');
      const hash = await writeContractAsync({
        chainId: expectedChainId,
        address: pool,
        abi: SHIELD_POOL_ABI,
        functionName: 'deposit',
        args: [note.commitment],
        value: parseEther(denom),
      });

      setStatusMsg('Waiting for confirmation…');
      const receipt = await waitForTransactionReceipt(wagmiConfig, {
        hash,
        chainId: expectedChainId,
      });
      if (receipt.status !== 'success') throw new Error('Deposit failed');

      // leaf index from event
      let leafIndex = 0;
      for (const log of receipt.logs) {
        try {
          const ev = decodeEventLog({
            abi: SHIELD_POOL_ABI,
            data: log.data,
            topics: log.topics,
          });
          if (ev.eventName === 'Deposit') {
            leafIndex = Number((ev.args as { leafIndex: number }).leafIndex);
          }
        } catch {
          /* not our event */
        }
      }

      updateShieldNote(note.commitment, {
        leafIndex,
        depositTxHash: hash,
        poolAddress: pool,
      });
      setNotesVersion((v) => v + 1);

      await api('/api/shield/commitments', 'POST', {
        commitment: note.commitment,
        leaf_index: leafIndex,
        tx_hash: hash,
        pool_address: pool,
      });
      await refetchTree();

      return { hash, note, leafIndex };
    },
    onSuccess: (data) => {
      setStatusMsg('');
      setLastTx(data.hash);
      showToast('success', `Shielded deposit complete — note saved locally (leaf #${data.leafIndex})`);
      refetchEth();
    },
    onError: (e: Error) => {
      setStatusMsg('');
      showToast('error', e.message || 'Deposit failed');
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async (note: ShieldNote) => {
      const live = await ensureLiveWallet();
      if (!pool) throw new Error('Shield pool address not configured');
      const recipient = (withdrawTo || live).toLowerCase();
      if (!isAddress(recipient)) throw new Error('Invalid withdraw address');

      await switchOrAddAppChain({
        currentChainId: undefined,
        switchChain: (args) => switchChainAsync(args),
      });
      await ensureAuth();

      setStatusMsg('Loading commitment tree…');
      const treeRes = await api<{
        commitments: { commitment: string; leaf_index: number }[];
      }>('/api/shield/commitments');
      const leaves = (treeRes?.commitments || [])
        .sort((a, b) => a.leaf_index - b.leaf_index)
        .map((c) => c.commitment as Hex);
      if (!leaves.length) throw new Error('No commitments in tree yet');

      const idx =
        note.leafIndex ??
        leaves.findIndex((c) => c.toLowerCase() === note.commitment.toLowerCase());
      if (idx < 0) throw new Error('Note commitment not found in pool tree');

      setStatusMsg('Building Merkle witness proof…');
      const tree = buildMerkleTree(SHIELD_LEVELS, leaves);
      const { pathElements, pathIndices } = tree.path(idx);
      const input = publicSignals({
        root: tree.root,
        nullifierHash: note.nullifierHash,
        recipient,
        relayer: ZERO,
        fee: BigInt(0),
      });
      const witness = encodeWithdrawWitness(
        note.secret,
        note.nullifier,
        pathElements,
        pathIndices
      );

      setStatusMsg('Confirm withdraw in wallet…');
      const hash = await writeContractAsync({
        chainId: expectedChainId,
        address: pool,
        abi: SHIELD_POOL_ABI,
        functionName: 'withdrawWithWitness',
        args: [input as unknown as readonly [bigint, bigint, bigint, bigint, bigint], recipient as `0x${string}`, ZERO, BigInt(0), witness],
      });

      const receipt = await waitForTransactionReceipt(wagmiConfig, {
        hash,
        chainId: expectedChainId,
      });
      if (receipt.status !== 'success') throw new Error('Withdraw failed');

      removeShieldNote(note.commitment);
      setNotesVersion((v) => v + 1);
      return hash;
    },
    onSuccess: (hash) => {
      setStatusMsg('');
      setLastTx(hash);
      showToast('success', 'Shielded withdraw complete — ETH unshielded to recipient');
      refetchEth();
    },
    onError: (e: Error) => {
      setStatusMsg('');
      showToast('error', e.message || 'Withdraw failed');
    },
  });

  const busy = isPending || depositMutation.isPending || withdrawMutation.isPending;
  const txLink = lastTx ? explorerTxUrl(lastTx) : null;

  return (
    <div className="max-w-xl space-y-6">
      <div className="rh-card p-6">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h2 className="text-lg font-semibold text-[var(--text)] flex items-center gap-2">
            <Shield className="w-5 h-5 text-violet-600" />
            ZK shielded pool
          </h2>
          <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-md bg-violet-50 text-violet-800 border border-violet-200">
            {denom} ETH notes
          </span>
        </div>
        <p className="text-sm text-[var(--text-muted)] mb-4 leading-relaxed">
          Deposit fixed-size notes into the pool. Withdraw to any address with a note proof —
          unlink deposit from withdraw when using production Groth16 (testnet uses Merkle witness).
        </p>

        <div className="mb-4 p-3 rounded-xl border border-violet-200 bg-violet-50/70 text-[11px] text-violet-950 space-y-1">
          <p className="font-semibold flex items-center gap-1.5">
            <EyeOff className="w-3.5 h-3.5" /> How shielding works
          </p>
          <p>
            1) You deposit <strong>{denom} ETH</strong> + a commitment (no recipient yet).
          </p>
          <p>2) Note secrets stay in <strong>this browser only</strong> — back them up.</p>
          <p>
            3) Later, withdraw to any 0x — pool pays from the shield contract (not your deposit
            wallet on the receive leg).
          </p>
          <p className="text-violet-900/70">
            Testnet verifier checks Merkle membership of your note (nullifiers stop double-spend).
            Production swaps in a Groth16 verifier so the leaf path never appears on-chain.
          </p>
        </div>

        {!isReal && (
          <button
            type="button"
            className="rh-btn-primary mb-4"
            onClick={() => connectWallet().catch(() => {})}
          >
            Connect wallet
          </button>
        )}
        {wrongChain && <NetworkSwitchBanner variant="full" className="mb-4" />}
        {isReal && ethBalance && ethBalance.value < parseEther(denom) && (
          <div className="mb-4">
            <FaucetLinks variant="card" title={`Need ≥ ${denom} ETH to shield`} />
          </div>
        )}

        {!pool && (
          <div className="mb-4 p-3 rounded-lg rh-alert-error text-xs">
            Pool address not set. Deploy <code>SilentShieldPool</code> and set{' '}
            <code>NEXT_PUBLIC_SHIELD_POOL_ADDRESS</code>.
          </div>
        )}

        <div className="mb-3 text-xs text-[var(--text-muted)]">
          Tree size: {treeData?.count ?? 0} commitments · Network {appChain.name}
          {ethBalance && (
            <> · Balance {Number(formatEther(ethBalance.value)).toFixed(4)} ETH</>
          )}
        </div>

        {statusMsg && (
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mb-3">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {statusMsg}
          </div>
        )}

        <button
          type="button"
          disabled={busy || !pool || wrongChain}
          className="rh-btn-primary mb-3"
          onClick={() => depositMutation.mutate()}
        >
          {depositMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Lock className="w-4 h-4" />
          )}
          Shield {denom} ETH into pool
        </button>

        {txLink && (
          <a
            href={txLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] underline mb-4"
          >
            Last tx <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      <div className="rh-card p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--text)]">Your notes (local vault)</h3>
          <div className="flex gap-2">
            <button
              type="button"
              className="text-xs font-semibold text-[var(--accent)] flex items-center gap-1"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(exportNotesJson());
                  showToast('success', 'Notes JSON copied — store offline securely');
                } catch {
                  showToast('error', 'Copy failed');
                }
              }}
            >
              <Copy className="w-3 h-3" /> Backup
            </button>
            <button
              type="button"
              className="text-xs font-semibold text-[var(--accent)] flex items-center gap-1"
              onClick={() => {
                const raw = window.prompt('Paste notes JSON');
                if (!raw) return;
                try {
                  const n = importNotesJson(raw);
                  setNotesVersion((v) => v + 1);
                  showToast('success', `Imported ${n} note(s)`);
                } catch {
                  showToast('error', 'Invalid JSON');
                }
              }}
            >
              <Upload className="w-3 h-3" /> Import
            </button>
          </div>
        </div>

        <div>
          <label className="rh-label">Withdraw to (default: your wallet)</label>
          <input
            className="rh-input font-mono text-xs"
            value={withdrawTo}
            onChange={(e) => setWithdrawTo(e.target.value.trim())}
            placeholder={fromWallet || '0x…'}
            disabled={busy}
          />
        </div>

        {!notes.length ? (
          <p className="text-xs text-[var(--text-muted)] py-4 text-center">
            No local notes. Deposit to create one.
          </p>
        ) : (
          notes.map((n) => (
            <div
              key={n.commitment}
              className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] space-y-2 text-xs"
            >
              <div className="flex justify-between gap-2">
                <span className="font-semibold text-[var(--text)]">{n.denomination} ETH note</span>
                <span className="text-[var(--text-faint)]">
                  leaf {n.leafIndex ?? '—'}
                </span>
              </div>
              <div className="font-mono break-all text-[var(--text-muted)]">
                {truncAddr(n.commitment, 10, 10)}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || !pool}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5"
                  onClick={() => withdrawMutation.mutate(n)}
                >
                  {withdrawMutation.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Unlock className="w-3 h-3" />
                  )}
                  Unshield / withdraw
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs text-red-700"
                  onClick={() => {
                    if (confirm('Remove note from this browser? Funds cannot be recovered without the note.')) {
                      removeShieldNote(n.commitment);
                      setNotesVersion((v) => v + 1);
                    }
                  }}
                >
                  <Trash2 className="w-3 h-3" /> Remove local
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="rh-card p-5 text-sm text-[var(--text-muted)] space-y-2">
        <h3 className="font-semibold text-[var(--text)] flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" /> Privacy model
        </h3>
        <ul className="list-disc pl-4 space-y-1 text-xs leading-relaxed">
          <li>Fixed denomination reduces amount fingerprinting.</li>
          <li>Nullifier spent once — no double withdraw.</li>
          <li>Recipient receives from the pool contract, not the depositor wallet.</li>
          <li>
            Production: replace testnet witness verifier with Groth16 (ceremony) for full
            path-hiding ZK.
          </li>
        </ul>
      </div>
    </div>
  );
}
