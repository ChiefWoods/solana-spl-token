import {
    getUiAmountToAmountInstructionDataDecoder,
    getUiAmountToAmountInstructionDataEncoder,
} from '@solana-program/token';
import type { AccountMeta, Address } from '@solana/web3.js';
import { TransactionInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '../constants.js';
import {
    TokenInvalidInstructionDataError,
    TokenInvalidInstructionKeysError,
    TokenInvalidInstructionProgramError,
    TokenInvalidInstructionTypeError,
} from '../errors.js';
import { TokenInstruction } from './types.js';
import { createInstructionDataCodec } from './codec.js';

/** Instruction data for a UiAmountToAmount instruction. */
export interface UiAmountToAmountInstructionData {
    instruction: TokenInstruction.UiAmountToAmount;
    amount: Uint8Array;
}

/** Codec for encoding and decoding UiAmountToAmount instruction data. */
export const uiAmountToAmountInstructionData = createInstructionDataCodec({
    encoder: getUiAmountToAmountInstructionDataEncoder(),
    decoder: getUiAmountToAmountInstructionDataDecoder(),
    fromPublic: ({ amount }: UiAmountToAmountInstructionData) => ({
        uiAmount: Buffer.from(amount).toString('utf8'),
    }),
    toPublic: ({ discriminator, uiAmount }) => ({
        instruction: discriminator,
        amount: Buffer.from(uiAmount, 'utf8'),
    }),
});

/**
 * Construct a UiAmountToAmount instruction
 *
 * @param mint         Public key of the mint
 * @param amount       UiAmount of tokens to be converted to Amount
 * @param programId    SPL Token program account
 *
 * @return Instruction to add to a transaction
 */
export function createUiAmountToAmountInstruction(
    mint: Address,
    amount: string,
    programId = TOKEN_PROGRAM_ID,
): TransactionInstruction {
    const keys = [{ pubkey: mint, isSigner: false, isWritable: false }];
    const buf = Buffer.from(amount, 'utf8');
    const data = Buffer.alloc(
        uiAmountToAmountInstructionData.getSpan({ instruction: TokenInstruction.UiAmountToAmount, amount: buf }),
    );
    uiAmountToAmountInstructionData.encode(
        {
            instruction: TokenInstruction.UiAmountToAmount,
            amount: buf,
        },
        data,
    );

    return new TransactionInstruction({ keys, programId, data });
}

/** A decoded, valid UiAmountToAmount instruction */
export interface DecodedUiAmountToAmountInstruction {
    programId: Address;
    keys: {
        mint: AccountMeta;
    };
    data: {
        instruction: TokenInstruction.UiAmountToAmount;
        amount: Uint8Array;
    };
}

/**
 * Decode a UiAmountToAmount instruction and validate it
 *
 * @param instruction Transaction instruction to decode
 * @param programId   SPL Token program account
 *
 * @return Decoded, valid instruction
 */
export function decodeUiAmountToAmountInstruction(
    instruction: TransactionInstruction,
    programId = TOKEN_PROGRAM_ID,
): DecodedUiAmountToAmountInstruction {
    if (!instruction.programId.equals(programId)) throw new TokenInvalidInstructionProgramError();
    if (instruction.data.length < uiAmountToAmountInstructionData.getSpan(instruction.data))
        throw new TokenInvalidInstructionDataError();

    const {
        keys: { mint },
        data,
    } = decodeUiAmountToAmountInstructionUnchecked(instruction);
    if (data.instruction !== TokenInstruction.UiAmountToAmount) throw new TokenInvalidInstructionTypeError();
    if (!mint) throw new TokenInvalidInstructionKeysError();

    return {
        programId,
        keys: {
            mint,
        },
        data,
    };
}

/** A decoded, non-validated UiAmountToAmount instruction */
export interface DecodedUiAmountToAmountInstructionUnchecked {
    programId: Address;
    keys: {
        mint: AccountMeta | undefined;
    };
    data: {
        instruction: number;
        amount: Uint8Array;
    };
}

/**
 * Decode a UiAmountToAmount instruction without validating it
 *
 * @param instruction Transaction instruction to decode
 *
 * @return Decoded, non-validated instruction
 */
export function decodeUiAmountToAmountInstructionUnchecked({
    programId,
    keys: [mint],
    data,
}: TransactionInstruction): DecodedUiAmountToAmountInstructionUnchecked {
    return {
        programId,
        keys: {
            mint,
        },
        data: uiAmountToAmountInstructionData.decode(data),
    };
}
