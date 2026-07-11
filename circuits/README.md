# SilentTransfer shielded pool circuits

## Current (testnet)

`SilentShieldPool` uses **TestnetShieldVerifier**:

- Commitment = `keccak256(secret || nullifier)`
- Nullifier hash = `keccak256(nullifier)`
- Withdraw checks a **Merkle membership witness** + nullifier uniqueness
- Fixed denomination (default 0.1 ETH)

This is the same **note / nullifier / Merkle** model as Tornado-style pools.  
The testnet verifier does **not** hide the Merkle path on-chain (not full SNARK ZK).

## Production upgrade (true Groth16 ZK)

1. Write `withdraw.circom` (Poseidon preferred) with public signals:
   - `root`, `nullifierHash`, `recipient`, `relayer`, `fee`
2. Trusted setup (Powers of Tau + circuit-specific phase 2).
3. Generate `Verifier.sol` via `snarkjs zkey export solidityverifier`.
4. Deploy Verifier; call `SilentShieldPool.setVerifier(verifier, false)`.
5. Client proves with `snarkjs.groth16.fullProve` instead of `withdrawWithWitness`.

Until then, product copy must say **testnet shielded pool (Merkle note proofs)**, not “ceremony Groth16”.

## Layout (future)

```
circuits/
  shield/
    withdraw.circom
    pot...
    withdraw_js/
    withdraw.zkey
```
