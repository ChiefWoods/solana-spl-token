import { getAddressCodec, getF64Codec, getStructCodec, getU64Codec } from '@solana/kit';
import type { Address as KitAddress, FixedSizeCodec } from '@solana/kit';
import { Address } from '@solana/web3.js';
import type { Mint } from '../../state/mint.js';
import { ExtensionType, getExtensionData } from '../extensionType.js';

export interface ScaledUiAmountConfig {
    authority: Address;
    multiplier: number;
    newMultiplierEffectiveTimestamp: bigint;
    newMultiplier: number;
}

type ScaledUiAmountConfigCodecData = {
    authority: KitAddress;
    multiplier: number;
    newMultiplierEffectiveTimestamp: bigint | number;
    newMultiplier: number;
};

type ScaledUiAmountConfigCodecDecodedData = {
    authority: KitAddress;
    multiplier: number;
    newMultiplierEffectiveTimestamp: bigint;
    newMultiplier: number;
};

export const ScaledUiAmountConfigCodec: FixedSizeCodec<
    ScaledUiAmountConfigCodecData,
    ScaledUiAmountConfigCodecDecodedData
> = getStructCodec([
    ['authority', getAddressCodec()],
    ['multiplier', getF64Codec()],
    ['newMultiplierEffectiveTimestamp', getU64Codec()],
    ['newMultiplier', getF64Codec()],
]);

/** @deprecated Use {@link ScaledUiAmountConfigCodec} */
export const ScaledUiAmountConfigLayout: typeof ScaledUiAmountConfigCodec = ScaledUiAmountConfigCodec;

export const SCALED_UI_AMOUNT_CONFIG_SIZE = ScaledUiAmountConfigCodec.fixedSize;

export function getScaledUiAmountConfig(mint: Mint): ScaledUiAmountConfig | null {
    const extensionData = getExtensionData(ExtensionType.ScaledUiAmountConfig, mint.tlvData);
    if (extensionData === null) return null;
    const decoded = ScaledUiAmountConfigCodec.decode(extensionData);
    return { ...decoded, authority: new Address(decoded.authority) };
}
