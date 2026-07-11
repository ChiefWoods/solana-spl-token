import type { Commitment, Connection } from '@solana/web3.js';
import { Address } from '@solana/web3.js';
import { extension, getExtensionDecoder, getExtensionEncoder } from '@solana-program/token-2022';
import { address, type ReadonlyUint8Array } from '@solana/kit';

import { TOKEN_2022_PROGRAM_ID } from '../../constants.js';
import { getMint } from '../../state/mint.js';
import { ExtensionType, getExtensionData, LENGTH_SIZE, TYPE_SIZE } from '../extensionType.js';
import { Field } from './field.js';

export interface TokenMetadata {
    /** The authority that can sign to update the metadata */
    updateAuthority?: Address;
    /** The associated mint, used to counter spoofing */
    mint: Address;
    /** The longer name of the token */
    name: string;
    /** The shortened symbol for the token */
    symbol: string;
    /** The URI pointing to richer metadata */
    uri: string;
    /** Any additional metadata about the token as key-value pairs */
    additionalMetadata: (readonly [string, string])[];
}

const TLV_HEADER_SIZE = TYPE_SIZE + LENGTH_SIZE;

function optionToAddress(option: { __option: 'None' } | { __option: 'Some'; value: string }): Address | undefined {
    if (option.__option === 'None') return undefined;
    const value = new Address(option.value);
    return value.equals(Address.default) ? undefined : value;
}

/** Pack TokenMetadata into the extension payload byte slab (no TLV type/length header) */
export function pack(meta: TokenMetadata): ReadonlyUint8Array {
    const encoded = getExtensionEncoder().encode(
        extension('TokenMetadata', {
            updateAuthority: meta.updateAuthority ? address(meta.updateAuthority.toBase58()) : null,
            mint: address(meta.mint.toBase58()),
            name: meta.name,
            symbol: meta.symbol,
            uri: meta.uri,
            additionalMetadata: new Map(meta.additionalMetadata),
        }),
    );
    return encoded.slice(TLV_HEADER_SIZE);
}

/** Unpack a TokenMetadata extension payload (no TLV type/length header) */
export function unpack(buffer: Buffer | Uint8Array | ReadonlyUint8Array): TokenMetadata {
    const payload = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const withHeader = new Uint8Array(TLV_HEADER_SIZE + payload.length);
    const view = new DataView(withHeader.buffer, withHeader.byteOffset, withHeader.byteLength);
    view.setUint16(0, ExtensionType.TokenMetadata, true);
    view.setUint16(TYPE_SIZE, payload.length, true);
    withHeader.set(payload, TLV_HEADER_SIZE);

    const decoded = getExtensionDecoder().decode(withHeader);
    if (decoded.__kind !== 'TokenMetadata') {
        throw new Error(`Expected TokenMetadata extension, got ${decoded.__kind}`);
    }

    return {
        updateAuthority: optionToAddress(decoded.updateAuthority),
        mint: new Address(decoded.mint),
        name: decoded.name,
        symbol: decoded.symbol,
        uri: decoded.uri,
        additionalMetadata: [...decoded.additionalMetadata.entries()],
    };
}

const getNormalizedTokenMetadataField = (field: Field | string): string => {
    if (field === Field.Name || field === 'Name' || field === 'name') {
        return 'name';
    }

    if (field === Field.Symbol || field === 'Symbol' || field === 'symbol') {
        return 'symbol';
    }

    if (field === Field.Uri || field === 'Uri' || field === 'uri') {
        return 'uri';
    }

    return field;
};

export function updateTokenMetadata(current: TokenMetadata, key: Field | string, value: string): TokenMetadata {
    const field = getNormalizedTokenMetadataField(key);

    if (field === 'mint' || field === 'updateAuthority') {
        throw new Error(`Cannot update ${field} via this instruction`);
    }

    // Handle updates to default keys
    if (['name', 'symbol', 'uri'].includes(field)) {
        return {
            ...current,
            [field]: value,
        };
    }

    // Avoid mutating input, make a shallow copy
    const additionalMetadata = [...current.additionalMetadata];

    const i = current.additionalMetadata.findIndex(x => x[0] === field);

    if (i === -1) {
        // Key was not found, add it
        additionalMetadata.push([field, value]);
    } else {
        // Key was found, change value
        additionalMetadata[i] = [field, value];
    }

    return {
        ...current,
        additionalMetadata,
    };
}

/**
 * Retrieve Token Metadata Information
 *
 * @param connection Connection to use
 * @param mintAddress Mint account
 * @param commitment Desired level of commitment for querying the state
 * @param programId  SPL Token program account
 *
 * @return Token Metadata information
 */
export async function getTokenMetadata(
    connection: Connection,
    mintAddress: Address,
    commitment?: Commitment,
    programId = TOKEN_2022_PROGRAM_ID,
): Promise<TokenMetadata | null> {
    const mintInfo = await getMint(connection, mintAddress, commitment, programId);
    const data = getExtensionData(ExtensionType.TokenMetadata, mintInfo.tlvData);

    if (data === null) {
        return null;
    }

    return unpack(data);
}
