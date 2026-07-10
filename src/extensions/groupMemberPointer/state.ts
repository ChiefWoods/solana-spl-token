import { getAddressCodec, getStructCodec } from '@solana/kit';
import type { Address as KitAddress, FixedSizeCodec } from '@solana/kit';
import { Address } from '@solana/web3.js';
import type { Mint } from '../../state/mint.js';
import { ExtensionType, getExtensionData } from '../extensionType.js';

/** GroupMemberPointer as stored by the program */
export interface GroupMemberPointer {
    /** Optional authority that can set the member address */
    authority: Address | null;
    /** Optional account address that holds the member */
    memberAddress: Address | null;
}

type GroupMemberPointerCodecData = {
    authority: KitAddress;
    memberAddress: KitAddress;
};

/** Codec for de/serializing a GroupMemberPointer extension */
export const GroupMemberPointerCodec: FixedSizeCodec<GroupMemberPointerCodecData, GroupMemberPointerCodecData> =
    getStructCodec([
        ['authority', getAddressCodec()],
        ['memberAddress', getAddressCodec()],
    ]);

/** @deprecated Use {@link GroupMemberPointerCodec} */
export const GroupMemberPointerLayout: typeof GroupMemberPointerCodec = GroupMemberPointerCodec;

export const GROUP_MEMBER_POINTER_SIZE = GroupMemberPointerCodec.fixedSize;

export function getGroupMemberPointerState(mint: Mint): Partial<GroupMemberPointer> | null {
    const extensionData = getExtensionData(ExtensionType.GroupMemberPointer, mint.tlvData);
    if (extensionData === null) return null;

    const decoded = GroupMemberPointerCodec.decode(extensionData);
    const authority = new Address(decoded.authority);
    const memberAddress = new Address(decoded.memberAddress);
    return {
        authority: authority.equals(Address.default) ? null : authority,
        memberAddress: memberAddress.equals(Address.default) ? null : memberAddress,
    };
}
