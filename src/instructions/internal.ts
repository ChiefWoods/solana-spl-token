import type { AccountMeta, Signer } from '@solana/web3.js';
import { PublicKey } from '@solana/web3.js';

/** @internal */
export function addSigners(
    keys: AccountMeta[],
    ownerOrAuthority: PublicKey,
    multiSigners: (Signer | PublicKey)[],
): AccountMeta[] {
    if (multiSigners.length) {
        keys.push({ pubkey: ownerOrAuthority, isSigner: false, isWritable: false });
        for (const signer of multiSigners) {
            keys.push({
                pubkey: signer instanceof PublicKey ? signer : new PublicKey(signer.address),
                isSigner: true,
                isWritable: false,
            });
        }
    } else {
        keys.push({ pubkey: ownerOrAuthority, isSigner: true, isWritable: false });
    }
    return keys;
}

/** @internal */
export function hasValidAuthority(authority: AccountMeta, multiSigners: AccountMeta[]): boolean {
    return authority.isSigner || (multiSigners.length > 0 && multiSigners.every((signer) => signer.isSigner));
}
