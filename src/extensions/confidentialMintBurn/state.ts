import {
    combineCodec,
    fixDecoderSize,
    fixEncoderSize,
    getAddressCodec,
    getBytesDecoder,
    getBytesEncoder,
    getStructCodec,
} from '@solana/kit';
import type {
    Address as KitAddress,
    FixedSizeCodec,
    FixedSizeDecoder,
    FixedSizeEncoder,
    ReadonlyUint8Array,
} from '@solana/kit';
import { Address } from '@solana/web3.js';
import type { Mint } from '../../state/mint.js';
import { ExtensionType, getExtensionData } from '../extensionType.js';

export const ENCRYPTED_BALANCE_SIZE = 64;
export const DECRYPTABLE_BALANCE_SIZE = 36;

type EncryptedBalance = ReadonlyUint8Array;
type DecryptableBalance = ReadonlyUint8Array;

function getEncryptedBalanceEncoder(): FixedSizeEncoder<EncryptedBalance> {
    return fixEncoderSize(getBytesEncoder(), ENCRYPTED_BALANCE_SIZE);
}

function getEncryptedBalanceDecoder(): FixedSizeDecoder<EncryptedBalance> {
    return fixDecoderSize(getBytesDecoder(), ENCRYPTED_BALANCE_SIZE);
}

function getEncryptedBalanceCodec(): FixedSizeCodec<EncryptedBalance, EncryptedBalance> {
    return combineCodec(getEncryptedBalanceEncoder(), getEncryptedBalanceDecoder());
}

function getDecryptableBalanceEncoder(): FixedSizeEncoder<DecryptableBalance> {
    return fixEncoderSize(getBytesEncoder(), DECRYPTABLE_BALANCE_SIZE);
}

function getDecryptableBalanceDecoder(): FixedSizeDecoder<DecryptableBalance> {
    return fixDecoderSize(getBytesDecoder(), DECRYPTABLE_BALANCE_SIZE);
}

function getDecryptableBalanceCodec(): FixedSizeCodec<DecryptableBalance, DecryptableBalance> {
    return combineCodec(getDecryptableBalanceEncoder(), getDecryptableBalanceDecoder());
}

/** Confidential mint-burn mint configuration as stored by the program */
export interface ConfidentialMintBurn {
    /** Confidential supply encrypted under the supply ElGamal public key */
    confidentialSupply: Uint8Array;
    /** Confidential supply encrypted under the supply AES key */
    decryptableSupply: Uint8Array;
    /** ElGamal public key used to encrypt confidential supply */
    supplyElGamalPubkey: Address;
    /** Burn amounts not yet aggregated into confidential supply */
    pendingBurn: Uint8Array;
}

type ConfidentialMintBurnCodecData = {
    confidentialSupply: ReadonlyUint8Array;
    decryptableSupply: ReadonlyUint8Array;
    supplyElGamalPubkey: KitAddress;
    pendingBurn: ReadonlyUint8Array;
};

/** Codec for de/serializing confidential mint-burn state */
export const ConfidentialMintBurnCodec: FixedSizeCodec<ConfidentialMintBurnCodecData, ConfidentialMintBurnCodecData> =
    getStructCodec([
        ['confidentialSupply', getEncryptedBalanceCodec()],
        ['decryptableSupply', getDecryptableBalanceCodec()],
        ['supplyElGamalPubkey', getAddressCodec()],
        ['pendingBurn', getEncryptedBalanceCodec()],
    ]);

/** @deprecated Use {@link ConfidentialMintBurnCodec} */
export const ConfidentialMintBurnLayout: typeof ConfidentialMintBurnCodec = ConfidentialMintBurnCodec;

export const CONFIDENTIAL_MINT_BURN_SIZE = ConfidentialMintBurnCodec.fixedSize;

export function getConfidentialMintBurn(mint: Mint): ConfidentialMintBurn | null {
    const extensionData = getExtensionData(ExtensionType.ConfidentialMintBurn, mint.tlvData);
    if (extensionData === null) return null;

    const { confidentialSupply, decryptableSupply, supplyElGamalPubkey, pendingBurn } =
        ConfidentialMintBurnCodec.decode(extensionData);
    return {
        confidentialSupply: new Uint8Array(confidentialSupply),
        decryptableSupply: new Uint8Array(decryptableSupply),
        supplyElGamalPubkey: new Address(supplyElGamalPubkey),
        pendingBurn: new Uint8Array(pendingBurn),
    };
}
