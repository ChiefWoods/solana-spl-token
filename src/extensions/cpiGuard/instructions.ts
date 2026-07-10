import {
    getDisableCpiGuardInstructionDataEncoder,
    getEnableCpiGuardInstructionDataEncoder,
} from '@solana-program/token-2022';
import type { Address, Signer } from '@solana/web3.js';
import { TransactionInstruction } from '@solana/web3.js';
import { programSupportsExtensions, TOKEN_2022_PROGRAM_ID } from '../../constants.js';
import { TokenUnsupportedInstructionError } from '../../errors.js';
import { addSigners } from '../../instructions/internal.js';
import type { TokenInstruction } from '../../instructions/types.js';

export enum CpiGuardInstruction {
    Enable = 0,
    Disable = 1,
}

/** TODO: docs */
export interface CpiGuardInstructionData {
    instruction: TokenInstruction.CpiGuardExtension;
    cpiGuardInstruction: CpiGuardInstruction;
}

/**
 * Construct an EnableCpiGuard instruction
 *
 * @param account         Token account to update
 * @param authority       The account's owner/delegate
 * @param signers         The signer account(s)
 * @param programId       SPL Token program account
 *
 * @return Instruction to add to a transaction
 */
export function createEnableCpiGuardInstruction(
    account: Address,
    authority: Address,
    multiSigners: (Signer | Address)[] = [],
    programId = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    return createCpiGuardInstruction(CpiGuardInstruction.Enable, account, authority, multiSigners, programId);
}

/**
 * Construct a DisableCpiGuard instruction
 *
 * @param account         Token account to update
 * @param authority       The account's owner/delegate
 * @param signers         The signer account(s)
 * @param programId       SPL Token program account
 *
 * @return Instruction to add to a transaction
 */
export function createDisableCpiGuardInstruction(
    account: Address,
    authority: Address,
    multiSigners: (Signer | Address)[] = [],
    programId = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    return createCpiGuardInstruction(CpiGuardInstruction.Disable, account, authority, multiSigners, programId);
}

function createCpiGuardInstruction(
    cpiGuardInstruction: CpiGuardInstruction,
    account: Address,
    authority: Address,
    multiSigners: (Signer | Address)[],
    programId: Address,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }
    const keys = addSigners([{ pubkey: account, isSigner: false, isWritable: true }], authority, multiSigners);
    const data = Buffer.from(
        (cpiGuardInstruction === CpiGuardInstruction.Enable
            ? getEnableCpiGuardInstructionDataEncoder()
            : getDisableCpiGuardInstructionDataEncoder()
        ).encode({}),
    );

    return new TransactionInstruction({ keys, programId, data });
}
