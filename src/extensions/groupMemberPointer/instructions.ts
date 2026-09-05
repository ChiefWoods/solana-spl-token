import {
    getInitializeGroupMemberPointerInstructionDataEncoder,
    getUpdateGroupMemberPointerInstructionDataEncoder,
} from '@solana-program/token-2022';
import type { Signer, PublicKey } from '@solana/web3.js';
import { TransactionInstruction } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID, programSupportsExtensions } from '../../constants.js';
import { TokenUnsupportedInstructionError } from '../../errors.js';
import { addSigners } from '../../instructions/internal.js';
import type { TokenInstruction } from '../../instructions/types.js';

export enum GroupMemberPointerInstruction {
    Initialize = 0,
    Update = 1,
}

export interface InitializeGroupMemberPointerInstructionData {
    instruction: TokenInstruction.GroupMemberPointerExtension;
    groupMemberPointerInstruction: number;
    authority: PublicKey;
    memberAddress: PublicKey;
}

/**
 * Construct an Initialize GroupMemberPointer instruction
 *
 * @param mint            Token mint account
 * @param authority       Optional Authority that can set the member address
 * @param memberAddress   Optional Account address that holds the member
 * @param programId       SPL Token program account
 *
 * @return Instruction to add to a transaction
 */
export function createInitializeGroupMemberPointerInstruction(
    mint: PublicKey,
    authority: PublicKey | null,
    memberAddress: PublicKey | null,
    programId: PublicKey = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }
    const keys = [{ pubkey: mint, isSigner: false, isWritable: true }];
    const data = Buffer.from(
        getInitializeGroupMemberPointerInstructionDataEncoder().encode({
            authority: authority?.toBase58() ?? null,
            memberAddress: memberAddress?.toBase58() ?? null,
        }),
    );

    return new TransactionInstruction({ keys, programId, data });
}

export interface UpdateGroupMemberPointerInstructionData {
    instruction: TokenInstruction.GroupMemberPointerExtension;
    groupMemberPointerInstruction: number;
    memberAddress: PublicKey;
}

export function createUpdateGroupMemberPointerInstruction(
    mint: PublicKey,
    authority: PublicKey,
    memberAddress: PublicKey | null,
    multiSigners: (Signer | PublicKey)[] = [],
    programId: PublicKey = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }

    const keys = addSigners([{ pubkey: mint, isSigner: false, isWritable: true }], authority, multiSigners);
    const data = Buffer.from(
        getUpdateGroupMemberPointerInstructionDataEncoder().encode({
            memberAddress: memberAddress?.toBase58() ?? null,
        }),
    );

    return new TransactionInstruction({ keys, programId, data });
}
