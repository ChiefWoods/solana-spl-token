import { getUnitCodec } from '@solana/kit';
import type { Account } from '../state/account.js';
import { ExtensionType, getExtensionData } from './extensionType.js';

/** ImmutableOwner as stored by the program */
export interface ImmutableOwner {} // eslint-disable-line

/** Codec for de/serializing an immutable owner extension */
export const ImmutableOwnerCodec = getUnitCodec();

/** @deprecated Use {@link ImmutableOwnerCodec} */
export const ImmutableOwnerLayout = ImmutableOwnerCodec;

export const IMMUTABLE_OWNER_SIZE = ImmutableOwnerCodec.fixedSize;

export function getImmutableOwner(account: Account): ImmutableOwner | null {
    const extensionData = getExtensionData(ExtensionType.ImmutableOwner, account.tlvData);
    return extensionData !== null ? {} : null;
}
