import {
    combineCodec,
    fixDecoderSize,
    fixEncoderSize,
    getAddressCodec,
    getBooleanCodec,
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
import type { Account } from '../../state/account.js';
import type { Mint } from '../../state/mint.js';
import { ExtensionType, getExtensionData } from '../extensionType.js';

export const ENCRYPTED_WITHHELD_AMOUNT_SIZE = 64;

type EncryptedWithheldAmount = ReadonlyUint8Array;

function getEncryptedWithheldAmountEncoder(): FixedSizeEncoder<EncryptedWithheldAmount> {
    return fixEncoderSize(getBytesEncoder(), ENCRYPTED_WITHHELD_AMOUNT_SIZE);
}

function getEncryptedWithheldAmountDecoder(): FixedSizeDecoder<EncryptedWithheldAmount> {
    return fixDecoderSize(getBytesDecoder(), ENCRYPTED_WITHHELD_AMOUNT_SIZE);
}

function getEncryptedWithheldAmountCodec(): FixedSizeCodec<EncryptedWithheldAmount, EncryptedWithheldAmount> {
    return combineCodec(getEncryptedWithheldAmountEncoder(), getEncryptedWithheldAmountDecoder());
}

/** Confidential transfer fee mint configuration as stored by the program */
export interface ConfidentialTransferFeeConfig {
    /** Optional authority to set the withdraw withheld authority ElGamal key */
    authority: Address | null;
    /** ElGamal public key used to encrypt withheld fees */
    withdrawWithheldAuthorityElGamalPubkey: Address;
    /** Whether harvested withheld tokens may be moved to the mint */
    harvestToMintEnabled: boolean;
    /** Withheld confidential transfer fee tokens moved to the mint */
    withheldAmount: Uint8Array;
}

type ConfidentialTransferFeeConfigCodecData = {
    authority: KitAddress;
    withdrawWithheldAuthorityElGamalPubkey: KitAddress;
    harvestToMintEnabled: boolean;
    withheldAmount: ReadonlyUint8Array;
};

/** Codec for de/serializing confidential transfer fee mint configuration */
export const ConfidentialTransferFeeConfigCodec: FixedSizeCodec<
    ConfidentialTransferFeeConfigCodecData,
    ConfidentialTransferFeeConfigCodecData
> = getStructCodec([
    ['authority', getAddressCodec()],
    ['withdrawWithheldAuthorityElGamalPubkey', getAddressCodec()],
    ['harvestToMintEnabled', getBooleanCodec()],
    ['withheldAmount', getEncryptedWithheldAmountCodec()],
]);

/** @deprecated Use {@link ConfidentialTransferFeeConfigCodec} */
export const ConfidentialTransferFeeConfigLayout: typeof ConfidentialTransferFeeConfigCodec =
    ConfidentialTransferFeeConfigCodec;

export const CONFIDENTIAL_TRANSFER_FEE_CONFIG_SIZE = ConfidentialTransferFeeConfigCodec.fixedSize;

/** Confidential transfer fee token account state as stored by the program */
export interface ConfidentialTransferFeeAmount {
    /** Amount withheld during confidential transfers */
    withheldAmount: Uint8Array;
}

type ConfidentialTransferFeeAmountCodecData = {
    withheldAmount: ReadonlyUint8Array;
};

/** Codec for de/serializing confidential transfer fee account state */
export const ConfidentialTransferFeeAmountCodec: FixedSizeCodec<
    ConfidentialTransferFeeAmountCodecData,
    ConfidentialTransferFeeAmountCodecData
> = getStructCodec([['withheldAmount', getEncryptedWithheldAmountCodec()]]);

/** @deprecated Use {@link ConfidentialTransferFeeAmountCodec} */
export const ConfidentialTransferFeeAmountLayout: typeof ConfidentialTransferFeeAmountCodec =
    ConfidentialTransferFeeAmountCodec;

export const CONFIDENTIAL_TRANSFER_FEE_AMOUNT_SIZE = ConfidentialTransferFeeAmountCodec.fixedSize;

function addressOrNull(address: KitAddress): Address | null {
    const value = new Address(address);
    return value.equals(Address.default) ? null : value;
}

export function getConfidentialTransferFeeConfig(mint: Mint): ConfidentialTransferFeeConfig | null {
    const extensionData = getExtensionData(ExtensionType.ConfidentialTransferFee, mint.tlvData);
    if (extensionData === null) return null;

    const { authority, withdrawWithheldAuthorityElGamalPubkey, harvestToMintEnabled, withheldAmount } =
        ConfidentialTransferFeeConfigCodec.decode(extensionData);
    return {
        authority: addressOrNull(authority),
        withdrawWithheldAuthorityElGamalPubkey: new Address(withdrawWithheldAuthorityElGamalPubkey),
        harvestToMintEnabled,
        withheldAmount: new Uint8Array(withheldAmount),
    };
}

export function getConfidentialTransferFeeAmount(account: Account): ConfidentialTransferFeeAmount | null {
    const extensionData = getExtensionData(ExtensionType.ConfidentialTransferFeeAmount, account.tlvData);
    if (extensionData === null) return null;

    const { withheldAmount } = ConfidentialTransferFeeAmountCodec.decode(extensionData);
    return { withheldAmount: new Uint8Array(withheldAmount) };
}
