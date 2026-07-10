import { getBooleanCodec, getStructCodec } from '@solana/kit';
import type { Account } from '../../state/account.js';
import { ExtensionType, getExtensionData } from '../extensionType.js';

/** CpiGuard as stored by the program */
export interface CpiGuard {
    /** Lock certain token operations from taking place within CPI for this account */
    lockCpi: boolean;
}

/** Codec for de/serializing a CPI Guard extension */
export const CpiGuardCodec = getStructCodec([['lockCpi', getBooleanCodec()]]);

/** @deprecated Use {@link CpiGuardCodec} */
export const CpiGuardLayout = CpiGuardCodec;

export const CPI_GUARD_SIZE = CpiGuardCodec.fixedSize;

export function getCpiGuard(account: Account): CpiGuard | null {
    const extensionData = getExtensionData(ExtensionType.CpiGuard, account.tlvData);
    return extensionData !== null ? CpiGuardCodec.decode(extensionData) : null;
}
