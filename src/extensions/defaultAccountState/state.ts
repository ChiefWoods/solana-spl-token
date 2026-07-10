import { getStructCodec, getU8Codec } from '@solana/kit';
import type { AccountState } from '../../state/account.js';
import type { Mint } from '../../state/mint.js';
import { ExtensionType, getExtensionData } from '../extensionType.js';

/** DefaultAccountState as stored by the program */
export interface DefaultAccountState {
    /** Default AccountState in which new accounts are initialized */
    state: AccountState;
}

/** Codec for de/serializing a default account state extension */
export const DefaultAccountStateCodec = getStructCodec([['state', getU8Codec()]]);

/** @deprecated Use {@link DefaultAccountStateCodec} */
export const DefaultAccountStateLayout = DefaultAccountStateCodec;

export const DEFAULT_ACCOUNT_STATE_SIZE = DefaultAccountStateCodec.fixedSize;

export function getDefaultAccountState(mint: Mint): DefaultAccountState | null {
    const extensionData = getExtensionData(ExtensionType.DefaultAccountState, mint.tlvData);
    return extensionData !== null
        ? { state: DefaultAccountStateCodec.decode(extensionData).state as AccountState }
        : null;
}
