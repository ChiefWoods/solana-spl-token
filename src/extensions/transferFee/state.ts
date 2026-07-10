import { getAddressCodec, getStructCodec, getU16Codec, getU64Codec } from '@solana/kit';
import type { Address as KitAddress, FixedSizeCodec } from '@solana/kit';
import { Address } from '@solana/web3.js';
import type { Account } from '../../state/account.js';
import type { Mint } from '../../state/mint.js';
import { ExtensionType, getExtensionData } from '../extensionType.js';

export const MAX_FEE_BASIS_POINTS = 10000;
export const ONE_IN_BASIS_POINTS = BigInt(MAX_FEE_BASIS_POINTS);

/** TransferFeeConfig as stored by the program */
export interface TransferFee {
    /** First epoch where the transfer fee takes effect */
    epoch: bigint;
    /** Maximum fee assessed on transfers, expressed as an amount of tokens */
    maximumFee: bigint;
    /**
     * Amount of transfer collected as fees, expressed as basis points of the
     * transfer amount, ie. increments of 0.01%
     */
    transferFeeBasisPoints: number;
}

/** Transfer fee extension data for mints. */
export interface TransferFeeConfig {
    /** Optional authority to set the fee */
    transferFeeConfigAuthority: Address;
    /** Withdraw from mint instructions must be signed by this key */
    withdrawWithheldAuthority: Address;
    /** Withheld transfer fee tokens that have been moved to the mint for withdrawal */
    withheldAmount: bigint;
    /** Older transfer fee, used if the current epoch < newerTransferFee.epoch */
    olderTransferFee: TransferFee;
    /** Newer transfer fee, used if the current epoch >= newerTransferFee.epoch */
    newerTransferFee: TransferFee;
}

/** Codec for de/serializing a transfer fee */
export const TransferFeeCodec = getStructCodec([
    ['epoch', getU64Codec()],
    ['maximumFee', getU64Codec()],
    ['transferFeeBasisPoints', getU16Codec()],
]);

type TransferFeeCodecData = {
    epoch: bigint | number;
    maximumFee: bigint | number;
    transferFeeBasisPoints: bigint | number;
};

type TransferFeeCodecDecodedData = {
    epoch: bigint;
    maximumFee: bigint;
    transferFeeBasisPoints: number;
};

type TransferFeeConfigCodecData = {
    transferFeeConfigAuthority: KitAddress;
    withdrawWithheldAuthority: KitAddress;
    withheldAmount: bigint | number;
    olderTransferFee: TransferFeeCodecData;
    newerTransferFee: TransferFeeCodecData;
};

type TransferFeeConfigCodecDecodedData = {
    transferFeeConfigAuthority: KitAddress;
    withdrawWithheldAuthority: KitAddress;
    withheldAmount: bigint;
    olderTransferFee: TransferFeeCodecDecodedData;
    newerTransferFee: TransferFeeCodecDecodedData;
};

/** Calculate the transfer fee */
export function calculateFee(transferFee: TransferFee, preFeeAmount: bigint): bigint {
    const transferFeeBasisPoints = transferFee.transferFeeBasisPoints;
    if (transferFeeBasisPoints === 0 || preFeeAmount === BigInt(0)) {
        return BigInt(0);
    } else {
        const numerator = preFeeAmount * BigInt(transferFeeBasisPoints);
        const rawFee = (numerator + ONE_IN_BASIS_POINTS - BigInt(1)) / ONE_IN_BASIS_POINTS;
        const fee = rawFee > transferFee.maximumFee ? transferFee.maximumFee : rawFee;
        return BigInt(fee);
    }
}

/** Codec for de/serializing a transfer fee config extension */
export const TransferFeeConfigCodec: FixedSizeCodec<TransferFeeConfigCodecData, TransferFeeConfigCodecDecodedData> =
    getStructCodec([
        ['transferFeeConfigAuthority', getAddressCodec()],
        ['withdrawWithheldAuthority', getAddressCodec()],
        ['withheldAmount', getU64Codec()],
        ['olderTransferFee', TransferFeeCodec],
        ['newerTransferFee', TransferFeeCodec],
    ]);

/** @deprecated Use {@link TransferFeeConfigCodec} */
export const TransferFeeConfigLayout: typeof TransferFeeConfigCodec = TransferFeeConfigCodec;

export const TRANSFER_FEE_CONFIG_SIZE = TransferFeeConfigCodec.fixedSize;

/** Get the fee for given epoch */
export function getEpochFee(transferFeeConfig: TransferFeeConfig, epoch: bigint): TransferFee {
    if (epoch >= transferFeeConfig.newerTransferFee.epoch) {
        return transferFeeConfig.newerTransferFee;
    } else {
        return transferFeeConfig.olderTransferFee;
    }
}

/** Calculate the fee for the given epoch and input amount */
export function calculateEpochFee(transferFeeConfig: TransferFeeConfig, epoch: bigint, preFeeAmount: bigint): bigint {
    const transferFee = getEpochFee(transferFeeConfig, epoch);
    return calculateFee(transferFee, preFeeAmount);
}

/** Transfer fee amount data for accounts. */
export interface TransferFeeAmount {
    /** Withheld transfer fee tokens that can be claimed by the fee authority */
    withheldAmount: bigint;
}

/** Codec for de/serializing */
export const TransferFeeAmountCodec = getStructCodec([['withheldAmount', getU64Codec()]]);

/** @deprecated Use {@link TransferFeeAmountCodec} */
export const TransferFeeAmountLayout = TransferFeeAmountCodec;

export const TRANSFER_FEE_AMOUNT_SIZE = TransferFeeAmountCodec.fixedSize;

export function getTransferFeeConfig(mint: Mint): TransferFeeConfig | null {
    const extensionData = getExtensionData(ExtensionType.TransferFeeConfig, mint.tlvData);
    if (extensionData === null) return null;
    const decoded = TransferFeeConfigCodec.decode(extensionData);
    return {
        ...decoded,
        transferFeeConfigAuthority: new Address(decoded.transferFeeConfigAuthority),
        withdrawWithheldAuthority: new Address(decoded.withdrawWithheldAuthority),
    };
}

export function getTransferFeeAmount(account: Account): TransferFeeAmount | null {
    const extensionData = getExtensionData(ExtensionType.TransferFeeAmount, account.tlvData);
    return extensionData !== null ? TransferFeeAmountCodec.decode(extensionData) : null;
}
