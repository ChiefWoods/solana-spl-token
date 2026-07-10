import { getUnitCodec } from '@solana/kit';
import type { Account } from '../state/account.js';
import type { Mint } from '../state/mint.js';
import { ExtensionType, getExtensionData } from './extensionType.js';

/** Non-transferable mint state as stored by the program */
export interface NonTransferable {} // eslint-disable-line

/** Non-transferable token account state as stored by the program */
export interface NonTransferableAccount {} // eslint-disable-line

/** Codec for de/serializing a non-transferable extension */
export const NonTransferableCodec = getUnitCodec();

/** @deprecated Use {@link NonTransferableCodec} */
export const NonTransferableLayout = NonTransferableCodec;

export const NON_TRANSFERABLE_SIZE = NonTransferableCodec.fixedSize;
export const NON_TRANSFERABLE_ACCOUNT_SIZE = NonTransferableCodec.fixedSize;

export function getNonTransferable(mint: Mint): NonTransferable | null {
    const extensionData = getExtensionData(ExtensionType.NonTransferable, mint.tlvData);
    return extensionData !== null ? {} : null;
}

export function getNonTransferableAccount(account: Account): NonTransferableAccount | null {
    const extensionData = getExtensionData(ExtensionType.NonTransferableAccount, account.tlvData);
    return extensionData !== null ? {} : null;
}
