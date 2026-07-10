import type { AccountMeta, Signer } from '@solana/web3.js';
import { Address } from '@solana/web3.js';

/** @internal */
export function addSigners(
    keys: AccountMeta[],
    ownerOrAuthority: Address,
    multiSigners: (Signer | Address)[],
): AccountMeta[] {
    if (multiSigners.length) {
        keys.push({ pubkey: ownerOrAuthority, isSigner: false, isWritable: false });
        for (const signer of multiSigners) {
            keys.push({
                pubkey: signer instanceof Address ? signer : new Address(signer.address),
                isSigner: true,
                isWritable: false,
            });
        }
    } else {
        keys.push({ pubkey: ownerOrAuthority, isSigner: true, isWritable: false });
    }
    return keys;
}
