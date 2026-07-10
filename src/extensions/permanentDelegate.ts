import { getAddressCodec, getStructCodec } from '@solana/kit';
import type { Address as KitAddress, FixedSizeCodec } from '@solana/kit';
import { Address } from '@solana/web3.js';
import type { Mint } from '../state/mint.js';
import { ExtensionType, getExtensionData } from './extensionType.js';

/** PermanentDelegate as stored by the program */
export interface PermanentDelegate {
    delegate: Address;
}

type PermanentDelegateCodecData = {
    delegate: KitAddress;
};

/** Codec for de/serializing a permanent delegate extension */
export const PermanentDelegateCodec: FixedSizeCodec<PermanentDelegateCodecData, PermanentDelegateCodecData> =
    getStructCodec([['delegate', getAddressCodec()]]);

/** @deprecated Use {@link PermanentDelegateCodec} */
export const PermanentDelegateLayout: typeof PermanentDelegateCodec = PermanentDelegateCodec;

export const PERMANENT_DELEGATE_SIZE = PermanentDelegateCodec.fixedSize;

export function getPermanentDelegate(mint: Mint): PermanentDelegate | null {
    const extensionData = getExtensionData(ExtensionType.PermanentDelegate, mint.tlvData);
    if (extensionData === null) return null;
    const { delegate } = PermanentDelegateCodec.decode(extensionData);
    return { delegate: new Address(delegate) };
}
