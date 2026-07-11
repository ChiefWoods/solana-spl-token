import {
    getWithdrawExcessLamportsInstructionDataDecoder,
    getWithdrawExcessLamportsInstructionDataEncoder,
} from '@solana-program/token';
import type { AccountMeta, Address, Signer } from '@solana/web3.js';
import { TransactionInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '../constants.js';
import {
    TokenInvalidInstructionDataError,
    TokenInvalidInstructionKeysError,
    TokenInvalidInstructionProgramError,
    TokenInvalidInstructionTypeError,
} from '../errors.js';
import { addSigners } from './internal.js';
import { TokenInstruction } from './types.js';
import { createInstructionDataCodec } from './codec.js';

/** Instruction data for a WithdrawExcessLamports instruction. */
export interface WithdrawExcessLamportsInstructionData {
    instruction: TokenInstruction.WithdrawExcessLamports;
}

/** Codec for encoding and decoding WithdrawExcessLamports instruction data. */
export const withdrawExcessLamportsInstructionData = createInstructionDataCodec({
    encoder: getWithdrawExcessLamportsInstructionDataEncoder(),
    decoder: getWithdrawExcessLamportsInstructionDataDecoder(),
    fromPublic: (_value: WithdrawExcessLamportsInstructionData) => ({}),
    toPublic: ({ discriminator }) => ({ instruction: discriminator }),
});

/**
 * Construct a WithdrawExcessLamports instruction
 *
 * @param source       Source account holding excess lamports
 * @param destination  Account receiving lamports
 * @param authority    Owner of the source account
 * @param multiSigners Signing accounts if `authority` is a multisig
 * @param programId    SPL Token program account
 *
 * @return Instruction to add to a transaction
 */
export function createWithdrawExcessLamportsInstruction(
    source: Address,
    destination: Address,
    authority: Address,
    multiSigners: (Signer | Address)[] = [],
    programId = TOKEN_PROGRAM_ID,
): TransactionInstruction {
    const keys = addSigners(
        [
            { pubkey: source, isSigner: false, isWritable: true },
            { pubkey: destination, isSigner: false, isWritable: true },
        ],
        authority,
        multiSigners,
    );

    const data = Buffer.from(
        withdrawExcessLamportsInstructionData.encode({
            instruction: TokenInstruction.WithdrawExcessLamports,
        }) as Uint8Array,
    );

    return new TransactionInstruction({ keys, programId, data });
}

/** A decoded, valid WithdrawExcessLamports instruction */
export interface DecodedWithdrawExcessLamportsInstruction {
    programId: Address;
    keys: {
        source: AccountMeta;
        destination: AccountMeta;
        authority: AccountMeta;
        multiSigners: AccountMeta[];
    };
    data: {
        instruction: TokenInstruction.WithdrawExcessLamports;
    };
}

/**
 * Decode a WithdrawExcessLamports instruction and validate it
 *
 * @param instruction Transaction instruction to decode
 * @param programId   SPL Token program account
 *
 * @return Decoded, valid instruction
 */
export function decodeWithdrawExcessLamportsInstruction(
    instruction: TransactionInstruction,
    programId = TOKEN_PROGRAM_ID,
): DecodedWithdrawExcessLamportsInstruction {
    if (!instruction.programId.equals(programId)) throw new TokenInvalidInstructionProgramError();
    if (instruction.data.length !== withdrawExcessLamportsInstructionData.span)
        throw new TokenInvalidInstructionDataError();

    const {
        keys: { source, destination, authority, multiSigners },
        data,
    } = decodeWithdrawExcessLamportsInstructionUnchecked(instruction);
    if (data.instruction !== TokenInstruction.WithdrawExcessLamports) throw new TokenInvalidInstructionTypeError();
    if (!source || !destination || !authority) throw new TokenInvalidInstructionKeysError();

    return {
        programId,
        keys: {
            source,
            destination,
            authority,
            multiSigners,
        },
        data,
    };
}

/** A decoded, non-validated WithdrawExcessLamports instruction */
export interface DecodedWithdrawExcessLamportsInstructionUnchecked {
    programId: Address;
    keys: {
        source: AccountMeta | undefined;
        destination: AccountMeta | undefined;
        authority: AccountMeta | undefined;
        multiSigners: AccountMeta[];
    };
    data: {
        instruction: number;
    };
}

/**
 * Decode a WithdrawExcessLamports instruction without validating it
 *
 * @param instruction Transaction instruction to decode
 *
 * @return Decoded, non-validated instruction
 */
export function decodeWithdrawExcessLamportsInstructionUnchecked({
    programId,
    keys: [source, destination, authority, ...multiSigners],
    data,
}: TransactionInstruction): DecodedWithdrawExcessLamportsInstructionUnchecked {
    return {
        programId,
        keys: {
            source,
            destination,
            authority,
            multiSigners,
        },
        data: withdrawExcessLamportsInstructionData.decode(data),
    };
}
