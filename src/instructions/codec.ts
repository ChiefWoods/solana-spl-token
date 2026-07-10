import type { Address as KitAddress, ReadonlyUint8Array } from '@solana/kit';
import { Address } from '@solana/web3.js';

type Encoder<TValue> = {
    fixedSize?: number;
    encode(value: TValue): ReadonlyUint8Array;
};

type Decoder<TValue> = {
    decode(bytes: ReadonlyUint8Array): TValue;
};

type Option<TValue> = { __option: 'None' } | { __option: 'Some'; value: TValue };

export function addressToString(address: Address): KitAddress {
    return address.toBase58();
}

export function addressFromString(address: string): Address {
    return new Address(address);
}

export function nullableAddressToOption(address: Address | null): KitAddress | null {
    return address?.toBase58() ?? null;
}

export function optionToNullableAddress(option: Option<string>): Address | null {
    return option.__option === 'Some' ? new Address(option.value) : null;
}

export function optionToNullableBigInt(option: Option<bigint>): bigint | null {
    return option.__option === 'Some' ? option.value : null;
}

export function createInstructionDataCodec<TPublic, TArgs, TDecoded>(config: {
    encoder: Encoder<TArgs>;
    decoder: Decoder<TDecoded>;
    fromPublic: (value: TPublic) => unknown;
    toPublic: (value: TDecoded) => TPublic;
}): {
    span: number;
    encode(value: TPublic, buffer?: Uint8Array, offset?: number): number | Uint8Array;
    decode(buffer: Uint8Array, offset?: number): TPublic;
    getSpan(buffer: Uint8Array | TPublic): number;
} {
    const encodeValue = (value: TPublic) => new Uint8Array(config.encoder.encode(config.fromPublic(value) as TArgs));

    return {
        span: config.encoder.fixedSize ?? 0,
        encode(value, buffer, offset = 0) {
            const encoded = encodeValue(value);
            if (!buffer) return encoded;
            buffer.set(encoded, offset);
            return encoded.length;
        },
        decode(buffer, offset = 0) {
            return config.toPublic(config.decoder.decode(buffer.subarray(offset)));
        },
        getSpan(buffer) {
            if (!(buffer instanceof Uint8Array)) return encodeValue(buffer).length;
            try {
                return encodeValue(config.toPublic(config.decoder.decode(buffer))).length;
            } catch {
                return Number.POSITIVE_INFINITY;
            }
        },
    };
}
