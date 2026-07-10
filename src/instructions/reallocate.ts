import { getReallocateInstructionDataEncoder } from '@solana-program/token-2022';
import type { Address, Signer } from '@solana/web3.js';
import { SystemProgram, TransactionInstruction } from '@solana/web3.js';
import { programSupportsExtensions, TOKEN_2022_PROGRAM_ID } from '../constants.js';
import { TokenUnsupportedInstructionError } from '../errors.js';
import type { ExtensionType } from '../extensions/extensionType.js';
import { addSigners } from './internal.js';
import type { TokenInstruction } from './types.js';

/** Instruction data for a Reallocate instruction. */
export interface ReallocateInstructionData {
    instruction: TokenInstruction.Reallocate;
    extensionTypes: ExtensionType[];
}

/**
 * Construct a Reallocate instruction
 *
 * @param account        Address of the token account
 * @param payer          Address paying for the reallocation
 * @param extensionTypes Extensions to reallocate for
 * @param owner          Owner of the account
 * @param multiSigners   Signing accounts if `owner` is a multisig
 * @param programId      SPL Token program account
 *
 * @return Instruction to add to a transaction
 */
export function createReallocateInstruction(
    account: Address,
    payer: Address,
    extensionTypes: ExtensionType[],
    owner: Address,
    multiSigners: (Signer | Address)[] = [],
    programId = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }
    const baseKeys = [
        { pubkey: account, isSigner: false, isWritable: true },
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];
    const keys = addSigners(baseKeys, owner, multiSigners);

    const data = Buffer.from(
        getReallocateInstructionDataEncoder().encode({
            newExtensionTypes: extensionTypes,
        }),
    );

    return new TransactionInstruction({ keys, programId, data });
}
