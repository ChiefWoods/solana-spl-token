import {
    getInitializeScaledUiAmountMintInstructionDataEncoder,
    getUpdateMultiplierScaledUiMintInstructionDataEncoder,
} from '@solana-program/token-2022';
import type { TokenInstruction } from '../../instructions/types.js';
import type { Signer, Address } from '@solana/web3.js';
import { TransactionInstruction } from '@solana/web3.js';
import { programSupportsExtensions, TOKEN_2022_PROGRAM_ID } from '../../constants.js';
import { TokenUnsupportedInstructionError } from '../../errors.js';
import { addSigners } from '../../instructions/internal.js';

export enum ScaledUiAmountInstruction {
    Initialize = 0,
    UpdateMultiplier = 1,
}

export interface InitializeScaledUiAmountConfigData {
    instruction: TokenInstruction.ScaledUiAmountExtension;
    scaledUiAmountInstruction: ScaledUiAmountInstruction.Initialize;
    authority: Address | null;
    multiplier: number;
}

/**
 * Construct an InitializeScaledUiAmountConfig instruction
 *
 * @param mint         Token mint account
 * @param authority    Optional authority that can update the multipliers
 * @param signers      The signer account(s)
 * @param programId    SPL Token program account
 *
 * @return Instruction to add to a transaction
 */
export function createInitializeScaledUiAmountConfigInstruction(
    mint: Address,
    authority: Address | null,
    multiplier: number,
    programId: Address = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }
    const keys = [{ pubkey: mint, isSigner: false, isWritable: true }];
    const data = Buffer.from(
        getInitializeScaledUiAmountMintInstructionDataEncoder().encode({
            authority: authority?.toBase58() ?? null,
            multiplier: multiplier,
        }),
    );

    return new TransactionInstruction({ keys, programId, data });
}

export interface UpdateMultiplierData {
    instruction: TokenInstruction.ScaledUiAmountExtension;
    scaledUiAmountInstruction: ScaledUiAmountInstruction.UpdateMultiplier;
    multiplier: number;
    effectiveTimestamp: bigint;
}

/**
 * Construct an UpdateMultiplierData instruction
 *
 * @param mint                  Token mint account
 * @param authority             Optional authority that can update the multipliers
 * @param multiplier            New multiplier
 * @param effectiveTimestamp    Effective time stamp for the new multiplier
 * @param multiSigners          Signing accounts if `owner` is a multisig
 * @param programId             SPL Token program account
 *
 * @return Instruction to add to a transaction
 */
export function createUpdateMultiplierDataInstruction(
    mint: Address,
    authority: Address,
    multiplier: number,
    effectiveTimestamp: bigint,
    multiSigners: (Signer | Address)[] = [],
    programId: Address = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }
    const keys = addSigners([{ pubkey: mint, isSigner: false, isWritable: true }], authority, multiSigners);
    const data = Buffer.from(
        getUpdateMultiplierScaledUiMintInstructionDataEncoder().encode({
            multiplier,
            effectiveTimestamp,
        }),
    );

    return new TransactionInstruction({ keys, programId, data });
}
