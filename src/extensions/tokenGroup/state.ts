import { extension, getExtensionDecoder, getExtensionEncoder } from '@solana-program/token-2022';
import { address, type ReadonlyUint8Array } from '@solana/kit';
import { Address } from '@solana/web3.js';
import type { Mint } from '../../state/mint.js';
import { ExtensionType, getExtensionData } from '../extensionType.js';

export interface TokenGroup {
    /** The authority that can sign to update the group */
    updateAuthority?: Address;
    /** The associated mint, used to counter spoofing */
    mint: Address;
    /** The current number of group members */
    size: bigint;
    /** The maximum number of group members */
    maxSize: bigint;
}

export interface TokenGroupMember {
    /** The associated mint, used to counter spoofing */
    mint: Address;
    /** The pubkey of the `TokenGroup` */
    group: Address;
    /** The member number */
    memberNumber: bigint;
}

// Local copies avoid a circular init with extensionType.ts (which imports TOKEN_GROUP_SIZE).
const TYPE_SIZE = 2;
const LENGTH_SIZE = 2;
const TLV_HEADER_SIZE = TYPE_SIZE + LENGTH_SIZE;
const SYSTEM_ADDRESS = address('11111111111111111111111111111111');

/** Size of a TokenGroup extension payload */
export const TOKEN_GROUP_SIZE =
    getExtensionEncoder().encode(
        extension('TokenGroup', {
            updateAuthority: null,
            mint: SYSTEM_ADDRESS,
            size: BigInt(0),
            maxSize: BigInt(0),
        }),
    ).length - TLV_HEADER_SIZE;

/** Size of a TokenGroupMember extension payload */
export const TOKEN_GROUP_MEMBER_SIZE =
    getExtensionEncoder().encode(
        extension('TokenGroupMember', {
            mint: SYSTEM_ADDRESS,
            group: SYSTEM_ADDRESS,
            memberNumber: BigInt(0),
        }),
    ).length - TLV_HEADER_SIZE;

function optionToAddress(option: { __option: 'None' } | { __option: 'Some'; value: string }): Address | undefined {
    if (option.__option === 'None') return undefined;
    const value = new Address(option.value);
    return value.equals(Address.default) ? undefined : value;
}

function decodeExtensionPayload(extensionType: ExtensionType, payload: Uint8Array) {
    const withHeader = new Uint8Array(TLV_HEADER_SIZE + payload.length);
    const view = new DataView(withHeader.buffer, withHeader.byteOffset, withHeader.byteLength);
    view.setUint16(0, extensionType, true);
    view.setUint16(TYPE_SIZE, payload.length, true);
    withHeader.set(payload, TLV_HEADER_SIZE);
    return getExtensionDecoder().decode(withHeader);
}

/** Pack TokenGroup into the extension payload byte slab (no TLV type/length header) */
export function packTokenGroup(group: TokenGroup): ReadonlyUint8Array {
    return getExtensionEncoder()
        .encode(
            extension('TokenGroup', {
                updateAuthority: group.updateAuthority ? address(group.updateAuthority.toBase58()) : null,
                mint: address(group.mint.toBase58()),
                size: group.size,
                maxSize: group.maxSize,
            }),
        )
        .slice(TLV_HEADER_SIZE);
}

/** Unpack a TokenGroup extension payload (no TLV type/length header) */
export function unpackTokenGroup(buffer: Buffer | Uint8Array | ReadonlyUint8Array): TokenGroup {
    const payload = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const decoded = decodeExtensionPayload(ExtensionType.TokenGroup, payload);
    if (decoded.__kind !== 'TokenGroup') {
        throw new Error(`Expected TokenGroup extension, got ${decoded.__kind}`);
    }

    return {
        updateAuthority: optionToAddress(decoded.updateAuthority),
        mint: new Address(decoded.mint),
        size: decoded.size,
        maxSize: decoded.maxSize,
    };
}

/** Pack TokenGroupMember into the extension payload byte slab (no TLV type/length header) */
export function packTokenGroupMember(member: TokenGroupMember): ReadonlyUint8Array {
    return getExtensionEncoder()
        .encode(
            extension('TokenGroupMember', {
                mint: address(member.mint.toBase58()),
                group: address(member.group.toBase58()),
                memberNumber: member.memberNumber,
            }),
        )
        .slice(TLV_HEADER_SIZE);
}

/** Unpack a TokenGroupMember extension payload (no TLV type/length header) */
export function unpackTokenGroupMember(buffer: Buffer | Uint8Array | ReadonlyUint8Array): TokenGroupMember {
    const payload = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const decoded = decodeExtensionPayload(ExtensionType.TokenGroupMember, payload);
    if (decoded.__kind !== 'TokenGroupMember') {
        throw new Error(`Expected TokenGroupMember extension, got ${decoded.__kind}`);
    }

    return {
        mint: new Address(decoded.mint),
        group: new Address(decoded.group),
        memberNumber: decoded.memberNumber,
    };
}

export function getTokenGroupState(mint: Mint): Partial<TokenGroup> | null {
    const extensionData = getExtensionData(ExtensionType.TokenGroup, mint.tlvData);
    if (extensionData !== null) {
        const { updateAuthority, mint: groupMint, size, maxSize } = unpackTokenGroup(extensionData);

        return {
            updateAuthority,
            mint: groupMint,
            size,
            maxSize,
        };
    } else {
        return null;
    }
}

export function getTokenGroupMemberState(mint: Mint): Partial<TokenGroupMember> | null {
    const extensionData = getExtensionData(ExtensionType.TokenGroupMember, mint.tlvData);
    if (extensionData !== null) {
        const { mint: memberMint, group, memberNumber } = unpackTokenGroupMember(extensionData);

        return {
            mint: memberMint,
            group,
            memberNumber,
        };
    } else {
        return null;
    }
}
