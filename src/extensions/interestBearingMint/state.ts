import { getAddressCodec, getI16Codec, getI64Codec, getStructCodec } from '@solana/kit';
import { Address } from '@solana/web3.js';
import type { Mint } from '../../state/mint.js';
import { ExtensionType, getExtensionData } from '../extensionType.js';

export interface InterestBearingMintConfigState {
    rateAuthority: Address;
    initializationTimestamp: bigint;
    preUpdateAverageRate: number;
    lastUpdateTimestamp: bigint;
    currentRate: number;
}

export const InterestBearingMintConfigStateCodec = getStructCodec([
    ['rateAuthority', getAddressCodec()],
    ['initializationTimestamp', getI64Codec()],
    ['preUpdateAverageRate', getI16Codec()],
    ['lastUpdateTimestamp', getI64Codec()],
    ['currentRate', getI16Codec()],
]);

/** @deprecated Use {@link InterestBearingMintConfigStateCodec} */
export const InterestBearingMintConfigStateLayout = InterestBearingMintConfigStateCodec;

export const INTEREST_BEARING_MINT_CONFIG_STATE_SIZE = InterestBearingMintConfigStateCodec.fixedSize;

export function getInterestBearingMintConfigState(mint: Mint): InterestBearingMintConfigState | null {
    const extensionData = getExtensionData(ExtensionType.InterestBearingConfig, mint.tlvData);
    if (extensionData === null) return null;
    const decoded = InterestBearingMintConfigStateCodec.decode(extensionData);
    return { ...decoded, rateAuthority: new Address(decoded.rateAuthority) };
}
