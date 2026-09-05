import {
    getInitializeGroupPointerInstructionDataEncoder,
    getUpdateGroupPointerInstructionDataEncoder,
} from '@solana-program/token-2022';
import type { Signer, PublicKey } from '@solana/web3.js';
import { TransactionInstruction } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID, programSupportsExtensions } from '../../constants.js';
import { TokenUnsupportedInstructionError } from '../../errors.js';
import { addSigners } from '../../instructions/internal.js';
import type { TokenInstruction } from '../../instructions/types.js';

export enum GroupPointerInstruction {
    Initialize = 0,
    Update = 1,
}

export interface InitializeGroupPointerInstructionData {
    instruction: TokenInstruction.GroupPointerExtension;
    groupPointerInstruction: number;
    authority: PublicKey;
    groupAddress: PublicKey;
}

/**
 * Construct an Initialize GroupPointer instruction
 *
 * @param mint            Token mint account
 * @param authority       Optional Authority that can set the group address
 * @param groupAddress    Optional Account address that holds the group
 * @param programId       SPL Token program account
 *
 * @return Instruction to add to a transaction
 */
export function createInitializeGroupPointerInstruction(
    mint: PublicKey,
    authority: PublicKey | null,
    groupAddress: PublicKey | null,
    programId: PublicKey = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }
    const keys = [{ pubkey: mint, isSigner: false, isWritable: true }];
    const data = Buffer.from(
        getInitializeGroupPointerInstructionDataEncoder().encode({
            authority: authority?.toBase58() ?? null,
            groupAddress: groupAddress?.toBase58() ?? null,
        }),
    );

    return new TransactionInstruction({ keys, programId, data: data });
}

export interface UpdateGroupPointerInstructionData {
    instruction: TokenInstruction.GroupPointerExtension;
    groupPointerInstruction: number;
    groupAddress: PublicKey;
}

export function createUpdateGroupPointerInstruction(
    mint: PublicKey,
    authority: PublicKey,
    groupAddress: PublicKey | null,
    multiSigners: (Signer | PublicKey)[] = [],
    programId: PublicKey = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }

    const keys = addSigners([{ pubkey: mint, isSigner: false, isWritable: true }], authority, multiSigners);
    const data = Buffer.from(
        getUpdateGroupPointerInstructionDataEncoder().encode({ groupAddress: groupAddress?.toBase58() ?? null }),
    );

    return new TransactionInstruction({ keys, programId, data: data });
}
