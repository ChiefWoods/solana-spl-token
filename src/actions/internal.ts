import type { Signer } from '@solana/web3.js';
import { Address } from '@solana/web3.js';

/** @internal */
export function getSigners(signerOrMultisig: Signer | Address, multiSigners: Signer[]): [Address, Signer[]] {
    return signerOrMultisig instanceof Address
        ? [signerOrMultisig, multiSigners]
        : [new Address(signerOrMultisig.address), [signerOrMultisig]];
}
