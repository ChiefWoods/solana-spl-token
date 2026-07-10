import {
    getInitializeNonTransferableMintInstructionDataDecoder,
    getInitializeNonTransferableMintInstructionDataEncoder,
} from '@solana-program/token-2022';
import type { Address } from '@solana/web3.js';
import { TransactionInstruction } from '@solana/web3.js';
import { programSupportsExtensions } from '../constants.js';
import { TokenUnsupportedInstructionError } from '../errors.js';
import { TokenInstruction } from './types.js';
import { createInstructionDataCodec } from './codec.js';

/** Deserialized instruction for the initiation of an immutable owner account */
export interface InitializeNonTransferableMintInstructionData {
    instruction: TokenInstruction.InitializeNonTransferableMint;
}

/** The struct that represents the instruction data as it is read by the program */
export const initializeNonTransferableMintInstructionData = createInstructionDataCodec({
    encoder: getInitializeNonTransferableMintInstructionDataEncoder(),
    decoder: getInitializeNonTransferableMintInstructionDataDecoder(),
    fromPublic: (_value: InitializeNonTransferableMintInstructionData) => ({}),
    toPublic: ({ discriminator }) => ({ instruction: discriminator }),
});

/**
 * Construct an InitializeNonTransferableMint instruction
 *
 * @param mint           Mint Account to make non-transferable
 * @param programId         SPL Token program account
 *
 * @return Instruction to add to a transaction
 */
export function createInitializeNonTransferableMintInstruction(
    mint: Address,
    programId: Address,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }
    const keys = [{ pubkey: mint, isSigner: false, isWritable: true }];

    const data = Buffer.alloc(initializeNonTransferableMintInstructionData.span);
    initializeNonTransferableMintInstructionData.encode(
        {
            instruction: TokenInstruction.InitializeNonTransferableMint,
        },
        data,
    );

    return new TransactionInstruction({ keys, programId, data });
}
