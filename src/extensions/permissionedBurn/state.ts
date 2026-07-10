import { getAddressCodec, getStructCodec } from '@solana/kit';
import { Address } from '@solana/web3.js';
import type { Mint } from '../../state/mint.js';
import { ExtensionType, getExtensionData } from '../extensionType.js';

/** Permissioned burn configuration as stored by the program */
export interface PermissionedBurn {
    authority: Address | null;
}

/** Codec for de/serializing a permissioned burn config */
export const PermissionedBurnCodec = getStructCodec([['authority', getAddressCodec()]]);

/** @deprecated Use {@link PermissionedBurnCodec} */
export const PermissionedBurnLayout = PermissionedBurnCodec;

export const PERMISSIONED_BURN_SIZE = PermissionedBurnCodec.fixedSize;

export function getPermissionedBurn(mint: Mint): PermissionedBurn | null {
    const extensionData = getExtensionData(ExtensionType.PermissionedBurn, mint.tlvData);
    if (extensionData === null) return null;

    const authority = new Address(PermissionedBurnCodec.decode(extensionData).authority);
    return { authority: authority.equals(Address.default) ? null : authority };
}
