import { getAddressCodec, getBooleanCodec, getStructCodec, getUnitCodec } from '@solana/kit';
import { Address } from '@solana/web3.js';
import type { Account } from '../../state/account.js';
import type { Mint } from '../../state/mint.js';
import { ExtensionType, getExtensionData } from '../extensionType.js';

/** PausableConfig as stored by the program */
export interface PausableConfig {
    /** Authority that can pause or resume activity on the mint */
    authority: Address;
    /** Whether minting / transferring / burning tokens is paused */
    paused: boolean;
}

/** Codec for de/serializing a pausable config */
export const PausableConfigCodec = getStructCodec([
    ['authority', getAddressCodec()],
    ['paused', getBooleanCodec()],
]);

/** @deprecated Use {@link PausableConfigCodec} */
export const PausableConfigLayout = PausableConfigCodec;

export const PAUSABLE_CONFIG_SIZE = PausableConfigCodec.fixedSize;

export function getPausableConfig(mint: Mint): PausableConfig | null {
    const extensionData = getExtensionData(ExtensionType.PausableConfig, mint.tlvData);
    if (extensionData === null) return null;
    const { authority, paused } = PausableConfigCodec.decode(extensionData);
    return { authority: new Address(authority), paused };
}

/** Pausable token account state as stored by the program */
export interface PausableAccount {} // eslint-disable-line

/** Codec for de/serializing a pausable account */
export const PausableAccountCodec = getUnitCodec();

/** @deprecated Use {@link PausableAccountCodec} */
export const PausableAccountLayout = PausableAccountCodec;

export const PAUSABLE_ACCOUNT_SIZE = PausableAccountCodec.fixedSize;

export function getPausableAccount(account: Account): PausableAccount | null {
    const extensionData = getExtensionData(ExtensionType.PausableAccount, account.tlvData);
    return extensionData !== null ? {} : null;
}
