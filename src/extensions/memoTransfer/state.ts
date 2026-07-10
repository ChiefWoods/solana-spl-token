import { getBooleanCodec, getStructCodec } from '@solana/kit';
import type { Account } from '../../state/account.js';
import { ExtensionType, getExtensionData } from '../extensionType.js';

/** MemoTransfer as stored by the program */
export interface MemoTransfer {
    /** Require transfers into this account to be accompanied by a memo */
    requireIncomingTransferMemos: boolean;
}

/** Codec for de/serializing a memo transfer extension */
export const MemoTransferCodec = getStructCodec([['requireIncomingTransferMemos', getBooleanCodec()]]);

/** @deprecated Use {@link MemoTransferCodec} */
export const MemoTransferLayout = MemoTransferCodec;

export const MEMO_TRANSFER_SIZE = MemoTransferCodec.fixedSize;

export function getMemoTransfer(account: Account): MemoTransfer | null {
    const extensionData = getExtensionData(ExtensionType.MemoTransfer, account.tlvData);
    return extensionData !== null ? MemoTransferCodec.decode(extensionData) : null;
}
