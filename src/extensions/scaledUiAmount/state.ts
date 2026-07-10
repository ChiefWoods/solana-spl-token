import { getAddressCodec, getF64Codec, getStructCodec, getU64Codec } from '@solana/kit';
import { Address } from '@solana/web3.js';
import type { Mint } from '../../state/mint.js';
import { ExtensionType, getExtensionData } from '../extensionType.js';

export interface ScaledUiAmountConfig {
    authority: Address;
    multiplier: number;
    newMultiplierEffectiveTimestamp: bigint;
    newMultiplier: number;
}

export const ScaledUiAmountConfigCodec = getStructCodec([
    ['authority', getAddressCodec()],
    ['multiplier', getF64Codec()],
    ['newMultiplierEffectiveTimestamp', getU64Codec()],
    ['newMultiplier', getF64Codec()],
]);

/** @deprecated Use {@link ScaledUiAmountConfigCodec} */
export const ScaledUiAmountConfigLayout = ScaledUiAmountConfigCodec;

export const SCALED_UI_AMOUNT_CONFIG_SIZE = ScaledUiAmountConfigCodec.fixedSize;

export function getScaledUiAmountConfig(mint: Mint): ScaledUiAmountConfig | null {
    const extensionData = getExtensionData(ExtensionType.ScaledUiAmountConfig, mint.tlvData);
    if (extensionData === null) return null;
    const decoded = ScaledUiAmountConfigCodec.decode(extensionData);
    return { ...decoded, authority: new Address(decoded.authority) };
}
