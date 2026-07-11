import {
    getEmitTokenMetadataInstructionDataEncoder,
    getInitializeTokenMetadataInstructionDataEncoder,
    getRemoveTokenMetadataKeyInstructionDataEncoder,
    getUpdateTokenMetadataFieldInstructionDataEncoder,
    getUpdateTokenMetadataUpdateAuthorityInstructionDataEncoder,
} from '@solana-program/token-2022';
import type { Address } from '@solana/web3.js';
import { TransactionInstruction } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID } from '../../constants.js';
import type { Field } from './field.js';
import { toTokenMetadataField } from './field.js';

export interface InitializeInstructionArgs {
    programId?: Address;
    metadata: Address;
    updateAuthority: Address;
    mint: Address;
    mintAuthority: Address;
    name: string;
    symbol: string;
    uri: string;
}

/**
 * Construct an Initialize Token Metadata instruction
 *
 * @param args.metadata         Metadata account
 * @param args.updateAuthority  Authority that can update the metadata
 * @param args.mint             Mint account
 * @param args.mintAuthority    Mint authority
 * @param args.name             Longer name of the token
 * @param args.symbol           Shortened symbol of the token
 * @param args.uri              URI pointing to more metadata
 * @param args.programId        SPL Token program account
 *
 * @return Instruction to add to a transaction
 */
export function createInitializeInstruction(args: InitializeInstructionArgs): TransactionInstruction {
    const {
        programId = TOKEN_2022_PROGRAM_ID,
        metadata,
        updateAuthority,
        mint,
        mintAuthority,
        name,
        symbol,
        uri,
    } = args;

    return new TransactionInstruction({
        programId,
        keys: [
            { pubkey: metadata, isSigner: false, isWritable: true },
            { pubkey: updateAuthority, isSigner: false, isWritable: false },
            { pubkey: mint, isSigner: false, isWritable: false },
            { pubkey: mintAuthority, isSigner: true, isWritable: false },
        ],
        data: Buffer.from(getInitializeTokenMetadataInstructionDataEncoder().encode({ name, symbol, uri })),
    });
}

export interface UpdateFieldInstructionArgs {
    programId?: Address;
    metadata: Address;
    updateAuthority: Address;
    field: Field | string;
    value: string;
}

/**
 * Construct an UpdateField Token Metadata instruction
 *
 * @param args.metadata         Metadata account
 * @param args.updateAuthority  Authority that can update the metadata
 * @param args.field            Field to update in the metadata
 * @param args.value            Value to write for the field
 * @param args.programId        SPL Token program account
 *
 * @return Instruction to add to a transaction
 */
export function createUpdateFieldInstruction(args: UpdateFieldInstructionArgs): TransactionInstruction {
    const { programId = TOKEN_2022_PROGRAM_ID, metadata, updateAuthority, field, value } = args;

    return new TransactionInstruction({
        programId,
        keys: [
            { pubkey: metadata, isSigner: false, isWritable: true },
            { pubkey: updateAuthority, isSigner: true, isWritable: false },
        ],
        data: Buffer.from(
            getUpdateTokenMetadataFieldInstructionDataEncoder().encode({
                field: toTokenMetadataField(field),
                value,
            }),
        ),
    });
}

export interface RemoveKeyInstructionArgs {
    programId?: Address;
    metadata: Address;
    updateAuthority: Address;
    key: string;
    idempotent: boolean;
}

/**
 * Construct a RemoveKey Token Metadata instruction
 *
 * @param args.metadata         Metadata account
 * @param args.updateAuthority  Authority that can update the metadata
 * @param args.key              Key to remove from additional metadata
 * @param args.idempotent       When true, do not error if the key does not exist
 * @param args.programId        SPL Token program account
 *
 * @return Instruction to add to a transaction
 */
export function createRemoveKeyInstruction(args: RemoveKeyInstructionArgs): TransactionInstruction {
    const { programId = TOKEN_2022_PROGRAM_ID, metadata, updateAuthority, key, idempotent } = args;

    return new TransactionInstruction({
        programId,
        keys: [
            { pubkey: metadata, isSigner: false, isWritable: true },
            { pubkey: updateAuthority, isSigner: true, isWritable: false },
        ],
        data: Buffer.from(getRemoveTokenMetadataKeyInstructionDataEncoder().encode({ idempotent, key })),
    });
}

export interface UpdateAuthorityInstructionArgs {
    programId?: Address;
    metadata: Address;
    oldAuthority: Address;
    newAuthority: Address | null;
}

/**
 * Construct an UpdateAuthority Token Metadata instruction
 *
 * @param args.metadata       Metadata account
 * @param args.oldAuthority   Current update authority
 * @param args.newAuthority   New update authority, or unset
 * @param args.programId      SPL Token program account
 *
 * @return Instruction to add to a transaction
 */
export function createUpdateAuthorityInstruction(args: UpdateAuthorityInstructionArgs): TransactionInstruction {
    const { programId = TOKEN_2022_PROGRAM_ID, metadata, oldAuthority, newAuthority } = args;

    return new TransactionInstruction({
        programId,
        keys: [
            { pubkey: metadata, isSigner: false, isWritable: true },
            { pubkey: oldAuthority, isSigner: true, isWritable: false },
        ],
        data: Buffer.from(
            getUpdateTokenMetadataUpdateAuthorityInstructionDataEncoder().encode({
                newUpdateAuthority: newAuthority?.toBase58() ?? null,
            }),
        ),
    });
}

export interface EmitInstructionArgs {
    programId?: Address;
    metadata: Address;
    start?: bigint;
    end?: bigint;
}

/**
 * Construct an Emit Token Metadata instruction
 *
 * @param args.metadata   Metadata account
 * @param args.start      Start of range of data to emit
 * @param args.end        End of range of data to emit
 * @param args.programId  SPL Token program account
 *
 * @return Instruction to add to a transaction
 */
export function createEmitInstruction(args: EmitInstructionArgs): TransactionInstruction {
    const { programId = TOKEN_2022_PROGRAM_ID, metadata, start, end } = args;

    return new TransactionInstruction({
        programId,
        keys: [{ pubkey: metadata, isSigner: false, isWritable: false }],
        data: Buffer.from(
            getEmitTokenMetadataInstructionDataEncoder().encode({
                start: start ?? null,
                end: end ?? null,
            }),
        ),
    });
}
