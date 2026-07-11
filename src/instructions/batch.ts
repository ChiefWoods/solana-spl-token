import {
    addDecoderSizePrefix,
    addEncoderSizePrefix,
    getArrayDecoder,
    getArrayEncoder,
    getBytesDecoder,
    getBytesEncoder,
    getStructDecoder,
    getStructEncoder,
    getU8Decoder,
    getU8Encoder,
    type ReadonlyUint8Array,
} from '@solana/kit';
import type { AccountMeta, Address } from '@solana/web3.js';
import { TransactionInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '../constants.js';
import {
    TokenInvalidInstructionKeysError,
    TokenInvalidInstructionProgramError,
    TokenInvalidInstructionTypeError,
} from '../errors.js';
import type { DecodedInstruction } from './decode.js';
import { decodeInstruction } from './decode.js';
import { createInstructionDataCodec } from './codec.js';
import { TokenInstruction } from './types.js';

type BatchInstructionDataEntry = {
    numberOfAccounts: number;
    instructionData: Uint8Array;
};

/** Instruction data for a Batch instruction. */
export interface BatchInstructionData {
    instruction: number;
    entries: BatchInstructionDataEntry[];
}

type BatchInstructionCodecData = {
    discriminator: number;
    entries: { numberOfAccounts: number; instructionData: ReadonlyUint8Array }[];
};

const batchInstructionDataEncoder = getStructEncoder([
    ['discriminator', getU8Encoder()],
    [
        'entries',
        getArrayEncoder(
            getStructEncoder([
                ['numberOfAccounts', getU8Encoder()],
                ['instructionData', addEncoderSizePrefix(getBytesEncoder(), getU8Encoder())],
            ]),
            { size: 'remainder' },
        ),
    ],
]);

const batchInstructionDataDecoder = getStructDecoder([
    ['discriminator', getU8Decoder()],
    [
        'entries',
        getArrayDecoder(
            getStructDecoder([
                ['numberOfAccounts', getU8Decoder()],
                ['instructionData', addDecoderSizePrefix(getBytesDecoder(), getU8Decoder())],
            ]),
            { size: 'remainder' },
        ),
    ],
]);

/** Codec for encoding and decoding Batch instruction data. */
export const batchInstructionData = createInstructionDataCodec<
    BatchInstructionData,
    BatchInstructionCodecData,
    BatchInstructionCodecData
>({
    encoder: batchInstructionDataEncoder,
    decoder: batchInstructionDataDecoder,
    fromPublic: ({ entries }) => ({
        discriminator: TokenInstruction.Batch,
        entries,
    }),
    toPublic: ({ discriminator, entries }) => {
        return {
            instruction: discriminator,
            entries: entries.map(entry => ({
                numberOfAccounts: entry.numberOfAccounts,
                instructionData: Buffer.from(entry.instructionData),
            })),
        };
    },
});

/**
 * Construct a Batch instruction
 *
 * @param instructions Token instructions to execute in order
 * @param programId    SPL Token program account
 *
 * @return Instruction to add to a transaction
 */
export function createBatchInstruction(
    instructions: TransactionInstruction[],
    programId = TOKEN_PROGRAM_ID,
): TransactionInstruction {
    const keys: AccountMeta[] = [];
    const entries: BatchInstructionDataEntry[] = [];

    for (const instruction of instructions) {
        if (!instruction.programId.equals(programId)) {
            throw new Error('Batch child instructions must use the same programId as the batch instruction');
        }
        if (instruction.data[0] === TokenInstruction.Batch) {
            throw new Error('Batch instructions cannot be nested');
        }
        if (instruction.keys.length > 255) throw new Error('Batch child instructions can use at most 255 accounts');
        if (instruction.data.length > 255) throw new Error('Batch child instruction data can be at most 255 bytes');

        keys.push(...instruction.keys);
        entries.push({
            numberOfAccounts: instruction.keys.length,
            instructionData: instruction.data,
        });
    }

    const data = Buffer.from(
        batchInstructionData.encode({
            instruction: TokenInstruction.Batch,
            entries,
        }) as Uint8Array,
    );

    return new TransactionInstruction({ keys, programId, data });
}

/** A decoded child instruction in a Batch instruction. */
export interface DecodedBatchEntry {
    numberOfAccounts: number;
    keys: AccountMeta[];
    instructionData: Uint8Array;
    decodedInstruction: DecodedInstruction | null;
}

/** A decoded, valid Batch instruction */
export interface DecodedBatchInstruction {
    programId: Address;
    keys: {
        accounts: AccountMeta[];
    };
    data: {
        instruction: TokenInstruction.Batch;
        entries: DecodedBatchEntry[];
    };
}

/**
 * Decode a Batch instruction and validate it
 *
 * @param instruction Transaction instruction to decode
 * @param programId   SPL Token program account
 *
 * @return Decoded, valid instruction
 */
export function decodeBatchInstruction(
    instruction: TransactionInstruction,
    programId = TOKEN_PROGRAM_ID,
): DecodedBatchInstruction {
    if (!instruction.programId.equals(programId)) throw new TokenInvalidInstructionProgramError();

    const decoded = decodeBatchInstructionUnchecked(instruction);
    if (decoded.data.instruction !== TokenInstruction.Batch) throw new TokenInvalidInstructionTypeError();

    let accountCount = 0;
    for (const entry of decoded.data.entries) {
        if (entry.keys.length !== entry.numberOfAccounts) throw new TokenInvalidInstructionKeysError();
        if (entry.instructionData[0] === TokenInstruction.Batch) {
            throw new Error('Batch instructions cannot be nested');
        }
        accountCount += entry.keys.length;
    }
    if (accountCount !== instruction.keys.length) throw new TokenInvalidInstructionKeysError();

    return {
        programId,
        keys: decoded.keys,
        data: {
            instruction: TokenInstruction.Batch,
            entries: decoded.data.entries,
        },
    };
}

/** A decoded, non-validated Batch instruction */
export interface DecodedBatchInstructionUnchecked {
    programId: Address;
    keys: {
        accounts: AccountMeta[];
    };
    data: {
        instruction: number;
        entries: DecodedBatchEntry[];
    };
}

/**
 * Decode a Batch instruction without validating it
 *
 * @param instruction Transaction instruction to decode
 *
 * @return Decoded, non-validated instruction
 */
export function decodeBatchInstructionUnchecked({
    programId,
    keys,
    data,
}: TransactionInstruction): DecodedBatchInstructionUnchecked {
    const decodedData = batchInstructionData.decode(data);
    const entries: DecodedBatchEntry[] = [];
    let accountOffset = 0;

    for (const entry of decodedData.entries) {
        const entryKeys = keys.slice(accountOffset, accountOffset + entry.numberOfAccounts);
        accountOffset += entry.numberOfAccounts;

        const childInstruction = new TransactionInstruction({
            keys: entryKeys,
            programId,
            data: Buffer.from(entry.instructionData),
        });
        let decodedInstruction: DecodedInstruction | null = null;
        try {
            decodedInstruction = decodeInstruction(childInstruction, programId);
        } catch {
            decodedInstruction = null;
        }

        entries.push({
            numberOfAccounts: entry.numberOfAccounts,
            keys: entryKeys,
            instructionData: entry.instructionData,
            decodedInstruction,
        });
    }

    return {
        programId,
        keys: {
            accounts: keys,
        },
        data: {
            instruction: decodedData.instruction,
            entries,
        },
    };
}
