import {
    getInitializeDefaultAccountStateInstructionDataEncoder,
    getUpdateDefaultAccountStateInstructionDataEncoder,
} from '@solana-program/token-2022';
import type { Address, Signer } from '@solana/web3.js';
import { TransactionInstruction } from '@solana/web3.js';
import { programSupportsExtensions, TOKEN_2022_PROGRAM_ID } from '../../constants.js';
import { TokenUnsupportedInstructionError } from '../../errors.js';
import { addSigners } from '../../instructions/internal.js';
import type { TokenInstruction } from '../../instructions/types.js';
import type { AccountState } from '../../state/account.js';

export enum DefaultAccountStateInstruction {
    Initialize = 0,
    Update = 1,
}

/** TODO: docs */
export interface DefaultAccountStateInstructionData {
    instruction: TokenInstruction.DefaultAccountStateExtension;
    defaultAccountStateInstruction: DefaultAccountStateInstruction;
    accountState: AccountState;
}

/**
 * Construct an InitializeDefaultAccountState instruction
 *
 * @param mint         Mint to initialize
 * @param accountState Default account state to set on all new accounts
 * @param programId    SPL Token program account
 *
 * @return Instruction to add to a transaction
 */
export function createInitializeDefaultAccountStateInstruction(
    mint: Address,
    accountState: AccountState,
    programId = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }
    const keys = [{ pubkey: mint, isSigner: false, isWritable: true }];
    const data = Buffer.from(getInitializeDefaultAccountStateInstructionDataEncoder().encode({ state: accountState }));

    return new TransactionInstruction({ keys, programId, data });
}

/**
 * Construct an UpdateDefaultAccountState instruction
 *
 * @param mint         Mint to update
 * @param accountState    Default account state to set on all accounts
 * @param freezeAuthority       The mint's freeze authority
 * @param signers         The signer account(s) for a multisig
 * @param programId       SPL Token program account
 *
 * @return Instruction to add to a transaction
 */
export function createUpdateDefaultAccountStateInstruction(
    mint: Address,
    accountState: AccountState,
    freezeAuthority: Address,
    multiSigners: (Signer | Address)[] = [],
    programId = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }

    const keys = addSigners([{ pubkey: mint, isSigner: false, isWritable: true }], freezeAuthority, multiSigners);
    const data = Buffer.from(getUpdateDefaultAccountStateInstructionDataEncoder().encode({ state: accountState }));

    return new TransactionInstruction({ keys, programId, data });
}
