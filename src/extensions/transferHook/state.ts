import {
    fixCodecSize,
    getAddressCodec,
    getArrayCodec,
    getBooleanCodec,
    getBytesCodec,
    getStructCodec,
    getU32Codec,
    getU64Codec,
    getU8Codec,
} from '@solana/kit';
import type { Address as KitAddress, FixedSizeCodec } from '@solana/kit';
import type { Mint } from '../../state/mint.js';
import { ExtensionType, getExtensionData } from '../extensionType.js';
import type { AccountInfo, AccountMeta, Connection } from '@solana/web3.js';
import { Address } from '@solana/web3.js';
import type { Account } from '../../state/account.js';
import { TokenTransferHookAccountNotFound } from '../../errors.js';
import { unpackSeeds } from './seeds.js';
import { unpackPubkeyData } from './pubkeyData.js';

/** TransferHook as stored by the program */
export interface TransferHook {
    /** The transfer hook update authority */
    authority: Address;
    /** The transfer hook program account */
    programId: Address;
}

type TransferHookCodecData = {
    authority: KitAddress;
    programId: KitAddress;
};

/** Codec for de/serializing a transfer hook extension */
export const TransferHookCodec: FixedSizeCodec<TransferHookCodecData, TransferHookCodecData> = getStructCodec([
    ['authority', getAddressCodec()],
    ['programId', getAddressCodec()],
]);

/** @deprecated Use {@link TransferHookCodec} */
export const TransferHookLayout: typeof TransferHookCodec = TransferHookCodec;

export const TRANSFER_HOOK_SIZE = TransferHookCodec.fixedSize;

export function getTransferHook(mint: Mint): TransferHook | null {
    const extensionData = getExtensionData(ExtensionType.TransferHook, mint.tlvData);
    if (extensionData === null) return null;
    const { authority, programId } = TransferHookCodec.decode(extensionData);
    return { authority: new Address(authority), programId: new Address(programId) };
}

/** TransferHookAccount as stored by the program */
export interface TransferHookAccount {
    /**
     * Whether or not this account is currently transferring tokens
     * True during the transfer hook cpi, otherwise false
     */
    transferring: boolean;
}

/** Codec for de/serializing a transfer hook account extension */
export const TransferHookAccountCodec = getStructCodec([['transferring', getBooleanCodec()]]);

/** @deprecated Use {@link TransferHookAccountCodec} */
export const TransferHookAccountLayout = TransferHookAccountCodec;

export const TRANSFER_HOOK_ACCOUNT_SIZE = TransferHookAccountCodec.fixedSize;

export function getTransferHookAccount(account: Account): TransferHookAccount | null {
    const extensionData = getExtensionData(ExtensionType.TransferHookAccount, account.tlvData);
    return extensionData !== null ? TransferHookAccountCodec.decode(extensionData) : null;
}

export async function getExtraAccountMetaAddress(mint: Address, programId: Address): Promise<Address> {
    const seeds = [Buffer.from('extra-account-metas'), mint.toBytes()];
    return (await Address.findProgramAddress(seeds, programId))[0];
}

/** ExtraAccountMeta as stored by the transfer hook program */
export interface ExtraAccountMeta {
    discriminator: number;
    addressConfig: Uint8Array;
    isSigner: boolean;
    isWritable: boolean;
}

/** Codec for de/serializing an ExtraAccountMeta */
export const ExtraAccountMetaCodec = getStructCodec([
    ['discriminator', getU8Codec()],
    ['addressConfig', fixCodecSize(getBytesCodec(), 32)],
    ['isSigner', getBooleanCodec()],
    ['isWritable', getBooleanCodec()],
]);

/** @deprecated Use {@link ExtraAccountMetaCodec} */
export const ExtraAccountMetaLayout = ExtraAccountMetaCodec;

export interface ExtraAccountMetaList {
    count: number;
    extraAccounts: ExtraAccountMeta[];
}

/** Codec for de/serializing a list of ExtraAccountMeta prefixed by a u32 count */
export const ExtraAccountMetaListCodec = getStructCodec([
    ['count', getU32Codec()],
    ['extraAccounts', getArrayCodec(ExtraAccountMetaCodec, { size: 'remainder' })],
]);

/** @deprecated Use {@link ExtraAccountMetaListCodec} */
export const ExtraAccountMetaListLayout = ExtraAccountMetaListCodec;

export interface ExtraAccountMetaAccountData {
    instructionDiscriminator: bigint;
    length: number;
    extraAccountsList: ExtraAccountMetaList;
}

/** Codec for de/serializing ExtraAccountMetaAccountData */
export const ExtraAccountMetaAccountDataCodec = getStructCodec([
    ['instructionDiscriminator', getU64Codec()],
    ['length', getU32Codec()],
    ['extraAccountsList', ExtraAccountMetaListCodec],
]);

/** @deprecated Use {@link ExtraAccountMetaAccountDataCodec} */
export const ExtraAccountMetaAccountDataLayout = ExtraAccountMetaAccountDataCodec;

/** Unpack an extra account metas account and parse the data into a list of ExtraAccountMetas */
export function getExtraAccountMetas(account: AccountInfo<Uint8Array>): ExtraAccountMeta[] {
    const { extraAccountsList } = ExtraAccountMetaAccountDataCodec.decode(account.data);
    return extraAccountsList.extraAccounts.slice(0, extraAccountsList.count).map(meta => ({
        discriminator: meta.discriminator,
        addressConfig: Uint8Array.from(meta.addressConfig),
        isSigner: meta.isSigner,
        isWritable: meta.isWritable,
    }));
}

/** Take an ExtraAccountMeta and construct that into an actual AccountMeta */
export async function resolveExtraAccountMeta(
    connection: Connection,
    extraMeta: ExtraAccountMeta,
    previousMetas: AccountMeta[],
    instructionData: Buffer,
    transferHookProgramId: Address,
): Promise<AccountMeta> {
    if (extraMeta.discriminator === 0) {
        return {
            pubkey: new Address(extraMeta.addressConfig),
            isSigner: extraMeta.isSigner,
            isWritable: extraMeta.isWritable,
        };
    } else if (extraMeta.discriminator === 2) {
        const pubkey = await unpackPubkeyData(extraMeta.addressConfig, previousMetas, instructionData, connection);
        return {
            pubkey,
            isSigner: extraMeta.isSigner,
            isWritable: extraMeta.isWritable,
        };
    }

    let programId = Address.default;

    if (extraMeta.discriminator === 1) {
        programId = transferHookProgramId;
    } else {
        const accountIndex = extraMeta.discriminator - (1 << 7);
        if (previousMetas.length <= accountIndex) {
            throw new TokenTransferHookAccountNotFound();
        }
        programId = previousMetas[accountIndex].pubkey;
    }

    const seeds = await unpackSeeds(extraMeta.addressConfig, previousMetas, instructionData, connection);
    const pubkey = (await Address.findProgramAddress(seeds, programId))[0];

    return { pubkey, isSigner: extraMeta.isSigner, isWritable: extraMeta.isWritable };
}
