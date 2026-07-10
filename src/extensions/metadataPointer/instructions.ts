import {
    getInitializeMetadataPointerInstructionDataEncoder,
    getUpdateMetadataPointerInstructionDataEncoder,
} from '@solana-program/token-2022';
import type { Signer, Address } from '@solana/web3.js';
import { TransactionInstruction } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID, programSupportsExtensions } from '../../constants.js';
import { TokenUnsupportedInstructionError } from '../../errors.js';
import { addSigners } from '../../instructions/internal.js';
import type { TokenInstruction } from '../../instructions/types.js';

export enum MetadataPointerInstruction {
    Initialize = 0,
    Update = 1,
}

export interface InitializeMetadataPointerInstructionData {
    instruction: TokenInstruction.MetadataPointerExtension;
    metadataPointerInstruction: number;
    authority: Address;
    metadataAddress: Address;
}

/**
 * Construct an Initialize MetadataPointer instruction
 *
 * @param mint            Token mint account
 * @param authority       Optional Authority that can set the metadata address
 * @param metadataAddress Optional Account address that holds the metadata
 * @param programId       SPL Token program account
 *
 * @return Instruction to add to a transaction
 */
export function createInitializeMetadataPointerInstruction(
    mint: Address,
    authority: Address | null,
    metadataAddress: Address | null,
    programId: Address,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }
    const keys = [{ pubkey: mint, isSigner: false, isWritable: true }];
    const data = Buffer.from(
        getInitializeMetadataPointerInstructionDataEncoder().encode({
            authority: authority?.toBase58() ?? null,
            metadataAddress: metadataAddress?.toBase58() ?? null,
        }),
    );

    return new TransactionInstruction({ keys, programId, data: data });
}

export interface UpdateMetadataPointerInstructionData {
    instruction: TokenInstruction.MetadataPointerExtension;
    metadataPointerInstruction: number;
    metadataAddress: Address;
}

export function createUpdateMetadataPointerInstruction(
    mint: Address,
    authority: Address,
    metadataAddress: Address | null,
    multiSigners: (Signer | Address)[] = [],
    programId: Address = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }

    const keys = addSigners([{ pubkey: mint, isSigner: false, isWritable: true }], authority, multiSigners);
    const data = Buffer.from(
        getUpdateMetadataPointerInstructionDataEncoder().encode({
            metadataAddress: metadataAddress?.toBase58() ?? null,
        }),
    );

    return new TransactionInstruction({ keys, programId, data: data });
}
