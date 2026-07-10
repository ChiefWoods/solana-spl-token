import { getAddressCodec, getStructCodec } from '@solana/kit';
import type { Address as KitAddress, FixedSizeCodec } from '@solana/kit';
import { Address } from '@solana/web3.js';
import type { Mint } from '../../state/mint.js';
import { ExtensionType, getExtensionData } from '../extensionType.js';

/** GroupPointer as stored by the program */
export interface GroupPointer {
    /** Optional authority that can set the group address */
    authority: Address | null;
    /** Optional account address that holds the group */
    groupAddress: Address | null;
}

type GroupPointerCodecData = {
    authority: KitAddress;
    groupAddress: KitAddress;
};

/** Codec for de/serializing a GroupPointer extension */
export const GroupPointerCodec: FixedSizeCodec<GroupPointerCodecData, GroupPointerCodecData> = getStructCodec([
    ['authority', getAddressCodec()],
    ['groupAddress', getAddressCodec()],
]);

/** @deprecated Use {@link GroupPointerCodec} */
export const GroupPointerLayout: typeof GroupPointerCodec = GroupPointerCodec;

export const GROUP_POINTER_SIZE = GroupPointerCodec.fixedSize;

export function getGroupPointerState(mint: Mint): Partial<GroupPointer> | null {
    const extensionData = getExtensionData(ExtensionType.GroupPointer, mint.tlvData);
    if (extensionData === null) return null;

    const decoded = GroupPointerCodec.decode(extensionData);
    const authority = new Address(decoded.authority);
    const groupAddress = new Address(decoded.groupAddress);
    return {
        authority: authority.equals(Address.default) ? null : authority,
        groupAddress: groupAddress.equals(Address.default) ? null : groupAddress,
    };
}
