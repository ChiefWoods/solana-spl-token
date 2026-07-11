import { tokenMetadataField, type TokenMetadataFieldArgs } from '@solana-program/token-2022';

/** Default token-metadata fields */
export enum Field {
    Name,
    Symbol,
    Uri,
}

/**
 * Map a public Field or string into a token-metadata field variant
 *
 * @param field  Field enum value, default field name, or custom key string
 *
 * @return Token-metadata field variant
 */
export function toTokenMetadataField(field: Field | string): TokenMetadataFieldArgs {
    if (field === Field.Name || field === 'Name' || field === 'name') {
        return tokenMetadataField('Name');
    }
    if (field === Field.Symbol || field === 'Symbol' || field === 'symbol') {
        return tokenMetadataField('Symbol');
    }
    if (field === Field.Uri || field === 'Uri' || field === 'uri') {
        return tokenMetadataField('Uri');
    }
    return tokenMetadataField('Key', [field]);
}
