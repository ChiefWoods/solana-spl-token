import { getAddressCodec, getStructCodec } from '@solana/kit';
import { Address } from '@solana/web3.js';
import type { Mint } from '../../state/mint.js';
import { ExtensionType, getExtensionData } from '../extensionType.js';

/** MetadataPointer as stored by the program */
export interface MetadataPointer {
    /** Optional authority that can set the metadata address */
    authority: Address | null;
    /** Optional Account Address that holds the metadata */
    metadataAddress: Address | null;
}

/** Codec for de/serializing a Metadata Pointer extension */
export const MetadataPointerCodec = getStructCodec([
    ['authority', getAddressCodec()],
    ['metadataAddress', getAddressCodec()],
]);

/** @deprecated Use {@link MetadataPointerCodec} */
export const MetadataPointerLayout = MetadataPointerCodec;

export const METADATA_POINTER_SIZE = MetadataPointerCodec.fixedSize;

export function getMetadataPointerState(mint: Mint): Partial<MetadataPointer> | null {
    const extensionData = getExtensionData(ExtensionType.MetadataPointer, mint.tlvData);
    if (extensionData === null) return null;

    const decoded = MetadataPointerCodec.decode(extensionData);
    const authority = new Address(decoded.authority);
    const metadataAddress = new Address(decoded.metadataAddress);
    return {
        authority: authority.equals(Address.default) ? null : authority,
        metadataAddress: metadataAddress.equals(Address.default) ? null : metadataAddress,
    };
}
