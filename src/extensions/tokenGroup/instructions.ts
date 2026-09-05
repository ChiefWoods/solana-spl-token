import {
    getInitializeTokenGroupInstructionDataEncoder,
    getInitializeTokenGroupMemberInstructionDataEncoder,
    getUpdateTokenGroupMaxSizeInstructionDataEncoder,
    getUpdateTokenGroupUpdateAuthorityInstructionDataEncoder,
} from '@solana-program/token-2022';
import type { PublicKey } from '@solana/web3.js';
import { TransactionInstruction } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID } from '../../constants.js';

export interface InitializeGroupInstructionArgs {
    programId?: PublicKey;
    group: PublicKey;
    mint: PublicKey;
    mintAuthority: PublicKey;
    updateAuthority: PublicKey | null;
    maxSize: bigint;
}

/**
 * Construct an Initialize Token Group instruction
 *
 * @param args.group            Group account
 * @param args.mint             Mint account
 * @param args.mintAuthority    Mint authority
 * @param args.updateAuthority  Authority that can update the group
 * @param args.maxSize          Maximum number of members in the group
 * @param args.programId        SPL Token program account
 *
 * @return Instruction to add to a transaction
 */
export function createInitializeGroupInstruction(args: InitializeGroupInstructionArgs): TransactionInstruction {
    const { programId = TOKEN_2022_PROGRAM_ID, group, mint, mintAuthority, updateAuthority, maxSize } = args;

    return new TransactionInstruction({
        programId,
        keys: [
            { pubkey: group, isSigner: false, isWritable: true },
            { pubkey: mint, isSigner: false, isWritable: false },
            { pubkey: mintAuthority, isSigner: true, isWritable: false },
        ],
        data: Buffer.from(
            getInitializeTokenGroupInstructionDataEncoder().encode({
                updateAuthority: updateAuthority?.toBase58() ?? null,
                maxSize,
            }),
        ),
    });
}

export interface UpdateGroupMaxSizeInstructionArgs {
    programId?: PublicKey;
    group: PublicKey;
    updateAuthority: PublicKey;
    maxSize: bigint;
}

/**
 * Construct an UpdateGroupMaxSize instruction
 *
 * @param args.group            Group account
 * @param args.updateAuthority  Authority that can update the group
 * @param args.maxSize          Maximum number of members in the group
 * @param args.programId        SPL Token program account
 *
 * @return Instruction to add to a transaction
 */
export function createUpdateGroupMaxSizeInstruction(args: UpdateGroupMaxSizeInstructionArgs): TransactionInstruction {
    const { programId = TOKEN_2022_PROGRAM_ID, group, updateAuthority, maxSize } = args;

    return new TransactionInstruction({
        programId,
        keys: [
            { pubkey: group, isSigner: false, isWritable: true },
            { pubkey: updateAuthority, isSigner: true, isWritable: false },
        ],
        data: Buffer.from(getUpdateTokenGroupMaxSizeInstructionDataEncoder().encode({ maxSize })),
    });
}

export interface UpdateGroupAuthorityInstructionArgs {
    programId?: PublicKey;
    group: PublicKey;
    currentAuthority: PublicKey;
    newAuthority: PublicKey | null;
}

/**
 * Construct an UpdateGroupAuthority instruction
 *
 * @param args.group              Group account
 * @param args.currentAuthority   Current update authority
 * @param args.newAuthority       New update authority, or unset
 * @param args.programId          SPL Token program account
 *
 * @return Instruction to add to a transaction
 */
export function createUpdateGroupAuthorityInstruction(
    args: UpdateGroupAuthorityInstructionArgs,
): TransactionInstruction {
    const { programId = TOKEN_2022_PROGRAM_ID, group, currentAuthority, newAuthority } = args;

    return new TransactionInstruction({
        programId,
        keys: [
            { pubkey: group, isSigner: false, isWritable: true },
            { pubkey: currentAuthority, isSigner: true, isWritable: false },
        ],
        data: Buffer.from(
            getUpdateTokenGroupUpdateAuthorityInstructionDataEncoder().encode({
                newUpdateAuthority: newAuthority?.toBase58() ?? null,
            }),
        ),
    });
}

export interface InitializeMemberInstructionArgs {
    programId?: PublicKey;
    member: PublicKey;
    memberMint: PublicKey;
    memberMintAuthority: PublicKey;
    group: PublicKey;
    groupUpdateAuthority: PublicKey;
}

/**
 * Construct an Initialize Token Group Member instruction
 *
 * @param args.member                 Member account
 * @param args.memberMint             Member mint account
 * @param args.memberMintAuthority    Member mint authority
 * @param args.group                  Group account
 * @param args.groupUpdateAuthority   Group update authority
 * @param args.programId              SPL Token program account
 *
 * @return Instruction to add to a transaction
 */
export function createInitializeMemberInstruction(args: InitializeMemberInstructionArgs): TransactionInstruction {
    const {
        programId = TOKEN_2022_PROGRAM_ID,
        member,
        memberMint,
        memberMintAuthority,
        group,
        groupUpdateAuthority,
    } = args;

    return new TransactionInstruction({
        programId,
        keys: [
            { pubkey: member, isSigner: false, isWritable: true },
            { pubkey: memberMint, isSigner: false, isWritable: false },
            { pubkey: memberMintAuthority, isSigner: true, isWritable: false },
            { pubkey: group, isSigner: false, isWritable: true },
            { pubkey: groupUpdateAuthority, isSigner: true, isWritable: false },
        ],
        data: Buffer.from(getInitializeTokenGroupMemberInstructionDataEncoder().encode({})),
    });
}
