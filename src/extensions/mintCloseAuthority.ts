import { getAddressCodec, getStructCodec } from '@solana/kit';
import type { Address as KitAddress, FixedSizeCodec } from '@solana/kit';
import { Address } from '@solana/web3.js';
import type { Mint } from '../state/mint.js';
import { ExtensionType, getExtensionData } from './extensionType.js';

/** MintCloseAuthority as stored by the program */
export interface MintCloseAuthority {
    closeAuthority: Address;
}

type MintCloseAuthorityCodecData = {
    closeAuthority: KitAddress;
};

/** Codec for de/serializing a mint close authority extension */
export const MintCloseAuthorityCodec: FixedSizeCodec<MintCloseAuthorityCodecData, MintCloseAuthorityCodecData> =
    getStructCodec([['closeAuthority', getAddressCodec()]]);

/** @deprecated Use {@link MintCloseAuthorityCodec} */
export const MintCloseAuthorityLayout: typeof MintCloseAuthorityCodec = MintCloseAuthorityCodec;

export const MINT_CLOSE_AUTHORITY_SIZE = MintCloseAuthorityCodec.fixedSize;

export function getMintCloseAuthority(mint: Mint): MintCloseAuthority | null {
    const extensionData = getExtensionData(ExtensionType.MintCloseAuthority, mint.tlvData);
    if (extensionData === null) return null;
    const { closeAuthority } = MintCloseAuthorityCodec.decode(extensionData);
    return { closeAuthority: new Address(closeAuthority) };
}
