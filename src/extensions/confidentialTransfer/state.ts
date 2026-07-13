import {
    combineCodec,
    fixDecoderSize,
    fixEncoderSize,
    getAddressCodec,
    getBooleanCodec,
    getBytesDecoder,
    getBytesEncoder,
    getStructCodec,
    getU64Codec,
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

const ENCRYPTED_BALANCE_SIZE = 64;
const DECRYPTABLE_BALANCE_SIZE = 36;
export const CONFIDENTIAL_TRANSFER_ENCRYPTED_BALANCE_SIZE = ENCRYPTED_BALANCE_SIZE;
export const CONFIDENTIAL_TRANSFER_DECRYPTABLE_BALANCE_SIZE = DECRYPTABLE_BALANCE_SIZE;

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

/** Confidential transfer mint configuration as stored by the program */
export interface ConfidentialTransferMint {
    /** Optional authority to modify mint confidential transfer settings and approve accounts */
    authority: Address | null;
    /** Whether newly configured accounts may be used without mint-authority approval */
    autoApproveNewAccounts: boolean;
    /** Optional auditor ElGamal public key that can decrypt confidential transfer amounts */
    auditorElgamalPubkey: Address | null;
}

type ConfidentialTransferMintCodecData = {
    authority: KitAddress;
    autoApproveNewAccounts: boolean;
    auditorElgamalPubkey: KitAddress;
};

/** Codec for de/serializing confidential transfer mint configuration */
export const ConfidentialTransferMintCodec: FixedSizeCodec<
    ConfidentialTransferMintCodecData,
    ConfidentialTransferMintCodecData
> = getStructCodec([
    ['authority', getAddressCodec()],
    ['autoApproveNewAccounts', getBooleanCodec()],
    ['auditorElgamalPubkey', getAddressCodec()],
]);

/** @deprecated Use {@link ConfidentialTransferMintCodec} */
export const ConfidentialTransferMintLayout: typeof ConfidentialTransferMintCodec = ConfidentialTransferMintCodec;

export const CONFIDENTIAL_TRANSFER_MINT_SIZE = ConfidentialTransferMintCodec.fixedSize;

/** Confidential transfer token account state as stored by the program */
export interface ConfidentialTransferAccount {
    /** Whether the account has been approved for confidential transfers */
    approved: boolean;
    /** ElGamal public key for encrypted balances */
    elgamalPubkey: Address;
    /** Low 16 bits of pending balance encrypted by `elgamalPubkey` */
    pendingBalanceLow: Uint8Array;
    /** High 32 bits of pending balance encrypted by `elgamalPubkey` */
    pendingBalanceHigh: Uint8Array;
    /** Spendable confidential balance encrypted by `elgamalPubkey` */
    availableBalance: Uint8Array;
    /** AES-encrypted available balance. Use this field for fast owner display. */
    decryptableAvailableBalance: Uint8Array;
    /** Whether this account accepts incoming confidential transfers */
    allowConfidentialCredits: boolean;
    /** Whether this account accepts incoming public transfers */
    allowNonConfidentialCredits: boolean;
    /** Number of deposits/transfers that have credited pending balance */
    pendingBalanceCreditCounter: bigint;
    /** Maximum pending credits before apply is required */
    maximumPendingBalanceCreditCounter: bigint;
    /** Expected counter supplied in the last apply-pending instruction */
    expectedPendingBalanceCreditCounter: bigint;
    /** Actual counter when the last apply-pending instruction executed */
    actualPendingBalanceCreditCounter: bigint;
}

type ConfidentialTransferAccountCodecData = {
    approved: boolean;
    elgamalPubkey: KitAddress;
    pendingBalanceLow: ReadonlyUint8Array;
    pendingBalanceHigh: ReadonlyUint8Array;
    availableBalance: ReadonlyUint8Array;
    decryptableAvailableBalance: ReadonlyUint8Array;
    allowConfidentialCredits: boolean;
    allowNonConfidentialCredits: boolean;
    pendingBalanceCreditCounter: bigint;
    maximumPendingBalanceCreditCounter: bigint;
    expectedPendingBalanceCreditCounter: bigint;
    actualPendingBalanceCreditCounter: bigint;
};

/** Codec for de/serializing confidential transfer account state */
export const ConfidentialTransferAccountCodec: FixedSizeCodec<
    ConfidentialTransferAccountCodecData,
    ConfidentialTransferAccountCodecData
> = getStructCodec([
    ['approved', getBooleanCodec()],
    ['elgamalPubkey', getAddressCodec()],
    ['pendingBalanceLow', getEncryptedBalanceCodec()],
    ['pendingBalanceHigh', getEncryptedBalanceCodec()],
    ['availableBalance', getEncryptedBalanceCodec()],
    ['decryptableAvailableBalance', getDecryptableBalanceCodec()],
    ['allowConfidentialCredits', getBooleanCodec()],
    ['allowNonConfidentialCredits', getBooleanCodec()],
    ['pendingBalanceCreditCounter', getU64Codec()],
    ['maximumPendingBalanceCreditCounter', getU64Codec()],
    ['expectedPendingBalanceCreditCounter', getU64Codec()],
    ['actualPendingBalanceCreditCounter', getU64Codec()],
]);

/** @deprecated Use {@link ConfidentialTransferAccountCodec} */
export const ConfidentialTransferAccountLayout: typeof ConfidentialTransferAccountCodec =
    ConfidentialTransferAccountCodec;

export const CONFIDENTIAL_TRANSFER_ACCOUNT_SIZE = ConfidentialTransferAccountCodec.fixedSize;

function addressOrNull(address: KitAddress): Address | null {
    const value = new Address(address);
    return value.equals(Address.default) ? null : value;
}

export function getConfidentialTransferMint(mint: Mint): ConfidentialTransferMint | null {
    const extensionData = getExtensionData(ExtensionType.ConfidentialTransferMint, mint.tlvData);
    if (extensionData === null) return null;

    const { authority, autoApproveNewAccounts, auditorElgamalPubkey } =
        ConfidentialTransferMintCodec.decode(extensionData);
    return {
        authority: addressOrNull(authority),
        autoApproveNewAccounts,
        auditorElgamalPubkey: addressOrNull(auditorElgamalPubkey),
    };
}

export function getConfidentialTransferAccount(account: Account): ConfidentialTransferAccount | null {
    const extensionData = getExtensionData(ExtensionType.ConfidentialTransferAccount, account.tlvData);
    if (extensionData === null) return null;

    const state = ConfidentialTransferAccountCodec.decode(extensionData);
    return {
        approved: state.approved,
        elgamalPubkey: new Address(state.elgamalPubkey),
        pendingBalanceLow: new Uint8Array(state.pendingBalanceLow),
        pendingBalanceHigh: new Uint8Array(state.pendingBalanceHigh),
        availableBalance: new Uint8Array(state.availableBalance),
        decryptableAvailableBalance: new Uint8Array(state.decryptableAvailableBalance),
        allowConfidentialCredits: state.allowConfidentialCredits,
        allowNonConfidentialCredits: state.allowNonConfidentialCredits,
        pendingBalanceCreditCounter: state.pendingBalanceCreditCounter,
        maximumPendingBalanceCreditCounter: state.maximumPendingBalanceCreditCounter,
        expectedPendingBalanceCreditCounter: state.expectedPendingBalanceCreditCounter,
        actualPendingBalanceCreditCounter: state.actualPendingBalanceCreditCounter,
    };
}
