import {
    getInitializeInterestBearingMintInstructionDataEncoder,
    getUpdateRateInterestBearingMintInstructionDataEncoder,
} from '@solana-program/token-2022';
import type { Address, Signer } from '@solana/web3.js';
import { TransactionInstruction } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID } from '../../constants.js';
import { addSigners } from '../../instructions/internal.js';
import type { TokenInstruction } from '../../instructions/types.js';

export enum InterestBearingMintInstruction {
    Initialize = 0,
    UpdateRate = 1,
}

export interface InterestBearingMintInitializeInstructionData {
    instruction: TokenInstruction.InterestBearingMintExtension;
    interestBearingMintInstruction: InterestBearingMintInstruction.Initialize;
    rateAuthority: Address;
    rate: number;
}

export interface InterestBearingMintUpdateRateInstructionData {
    instruction: TokenInstruction.InterestBearingMintExtension;
    interestBearingMintInstruction: InterestBearingMintInstruction.UpdateRate;
    rate: number;
}

/**
 * Construct an InitializeInterestBearingMint instruction
 *
 * @param mint           Mint to initialize
 * @param rateAuthority  The public key for the account that can update the rate
 * @param rate           The initial interest rate
 * @param programId      SPL Token program account
 *
 * @return Instruction to add to a transaction
 */
export function createInitializeInterestBearingMintInstruction(
    mint: Address,
    rateAuthority: Address,
    rate: number,
    programId = TOKEN_2022_PROGRAM_ID,
) {
    const keys = [{ pubkey: mint, isSigner: false, isWritable: true }];
    const data = Buffer.from(
        getInitializeInterestBearingMintInstructionDataEncoder().encode({
            rateAuthority: rateAuthority.toBase58(),
            rate,
        }),
    );
    return new TransactionInstruction({ keys, programId, data });
}

/**
 * Construct an UpdateRateInterestBearingMint instruction
 *
 * @param mint           Mint to initialize
 * @param rateAuthority  The public key for the account that can update the rate
 * @param rate           The updated interest rate
 * @param multiSigners   Signing accounts if `rateAuthority` is a multisig
 * @param programId      SPL Token program account
 *
 * @return Instruction to add to a transaction
 */
export function createUpdateRateInterestBearingMintInstruction(
    mint: Address,
    rateAuthority: Address,
    rate: number,
    multiSigners: (Signer | Address)[] = [],
    programId = TOKEN_2022_PROGRAM_ID,
) {
    const keys = addSigners(
        [
            { pubkey: mint, isSigner: false, isWritable: true },
            { pubkey: rateAuthority, isSigner: !multiSigners.length, isWritable: false },
        ],
        rateAuthority,
        multiSigners,
    );
    const data = Buffer.from(getUpdateRateInterestBearingMintInstructionDataEncoder().encode({ rate }));
    return new TransactionInstruction({ keys, programId, data });
}
