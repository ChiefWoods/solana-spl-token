import {
    getInitializeMultisig2InstructionDataDecoder,
    getInitializeMultisig2InstructionDataEncoder,
} from '@solana-program/token';
import type { AccountMeta, Signer } from '@solana/web3.js';
import { Address, TransactionInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '../constants.js';
import {
    TokenInvalidInstructionDataError,
    TokenInvalidInstructionKeysError,
    TokenInvalidInstructionProgramError,
    TokenInvalidInstructionTypeError,
} from '../errors.js';
import { createInstructionDataCodec } from './codec.js';
import { TokenInstruction } from './types.js';

/** Instruction data for an InitializeMultisig2 instruction. */
export interface InitializeMultisig2InstructionData {
    instruction: TokenInstruction.InitializeMultisig2;
    m: number;
}

/** Codec for encoding and decoding InitializeMultisig2 instruction data. */
export const initializeMultisig2InstructionData = createInstructionDataCodec({
    encoder: getInitializeMultisig2InstructionDataEncoder(),
    decoder: getInitializeMultisig2InstructionDataDecoder(),
    fromPublic: ({ m }: InitializeMultisig2InstructionData) => ({ m }),
    toPublic: ({ discriminator, m }) => ({ instruction: discriminator, m }),
});

/**
 * Construct an InitializeMultisig2 instruction
 *
 * @param account   Multisig account
 * @param signers   Full set of signers
 * @param m         Number of required signatures
 * @param programId SPL Token program account
 *
 * @return Instruction to add to a transaction
 */
export function createInitializeMultisig2Instruction(
    account: Address,
    signers: (Signer | Address)[],
    m: number,
    programId = TOKEN_PROGRAM_ID,
): TransactionInstruction {
    const keys = [{ pubkey: account, isSigner: false, isWritable: true }];
    for (const signer of signers) {
        keys.push({
            pubkey: signer instanceof Address ? signer : new Address(signer.address),
            isSigner: false,
            isWritable: false,
        });
    }

    const data = Buffer.alloc(initializeMultisig2InstructionData.span);
    initializeMultisig2InstructionData.encode(
        {
            instruction: TokenInstruction.InitializeMultisig2,
            m,
        },
        data,
    );

    return new TransactionInstruction({ keys, programId, data });
}

/** A decoded, valid InitializeMultisig2 instruction */
export interface DecodedInitializeMultisig2Instruction {
    programId: Address;
    keys: {
        account: AccountMeta;
        signers: AccountMeta[];
    };
    data: {
        instruction: TokenInstruction.InitializeMultisig2;
        m: number;
    };
}

/**
 * Decode an InitializeMultisig2 instruction and validate it
 *
 * @param instruction Transaction instruction to decode
 * @param programId   SPL Token program account
 *
 * @return Decoded, valid instruction
 */
export function decodeInitializeMultisig2Instruction(
    instruction: TransactionInstruction,
    programId = TOKEN_PROGRAM_ID,
): DecodedInitializeMultisig2Instruction {
    if (!instruction.programId.equals(programId)) throw new TokenInvalidInstructionProgramError();
    if (instruction.data.length !== initializeMultisig2InstructionData.span)
        throw new TokenInvalidInstructionDataError();

    const {
        keys: { account, signers },
        data,
    } = decodeInitializeMultisig2InstructionUnchecked(instruction);
    if (data.instruction !== TokenInstruction.InitializeMultisig2) throw new TokenInvalidInstructionTypeError();
    if (!account || !signers.length) throw new TokenInvalidInstructionKeysError();

    return {
        programId,
        keys: {
            account,
            signers,
        },
        data,
    };
}

/** A decoded, non-validated InitializeMultisig2 instruction */
export interface DecodedInitializeMultisig2InstructionUnchecked {
    programId: Address;
    keys: {
        account: AccountMeta | undefined;
        signers: AccountMeta[];
    };
    data: {
        instruction: number;
        m: number;
    };
}

/**
 * Decode an InitializeMultisig2 instruction without validating it
 *
 * @param instruction Transaction instruction to decode
 *
 * @return Decoded, non-validated instruction
 */
export function decodeInitializeMultisig2InstructionUnchecked({
    programId,
    keys: [account, ...signers],
    data,
}: TransactionInstruction): DecodedInitializeMultisig2InstructionUnchecked {
    return {
        programId,
        keys: {
            account,
            signers,
        },
        data: initializeMultisig2InstructionData.decode(data),
    };
}
