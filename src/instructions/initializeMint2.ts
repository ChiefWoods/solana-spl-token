import {
    getInitializeMint2InstructionDataDecoder,
    getInitializeMint2InstructionDataEncoder,
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
import {
    addressFromString,
    addressToString,
    createInstructionDataCodec,
    nullableAddressToOption,
    optionToNullableAddress,
} from './codec.js';

/** TODO: docs */
export interface InitializeMint2InstructionData {
    instruction: TokenInstruction.InitializeMint2;
    decimals: number;
    mintAuthority: Address;
    freezeAuthority: Address | null;
}

/** TODO: docs */
export const initializeMint2InstructionData = createInstructionDataCodec({
    encoder: getInitializeMint2InstructionDataEncoder(),
    decoder: getInitializeMint2InstructionDataDecoder(),
    fromPublic: ({ decimals, mintAuthority, freezeAuthority }: InitializeMint2InstructionData) => ({
        decimals,
        mintAuthority: addressToString(mintAuthority),
        freezeAuthority: nullableAddressToOption(freezeAuthority),
    }),
    toPublic: ({ discriminator, decimals, mintAuthority, freezeAuthority }) => ({
        instruction: discriminator,
        decimals,
        mintAuthority: addressFromString(mintAuthority),
        freezeAuthority: optionToNullableAddress(freezeAuthority),
    }),
});

/**
 * Construct an InitializeMint2 instruction
 *
 * @param mint            Token mint account
 * @param decimals        Number of decimals in token account amounts
 * @param mintAuthority   Minting authority
 * @param freezeAuthority Optional authority that can freeze token accounts
 * @param programId       SPL Token program account
 *
 * @return Instruction to add to a transaction
 */
export function createInitializeMint2Instruction(
    mint: Address,
    decimals: number,
    mintAuthority: Address,
    freezeAuthority: Address | null,
    programId = TOKEN_PROGRAM_ID,
): TransactionInstruction {
    const keys = [{ pubkey: mint, isSigner: false, isWritable: true }];

    const data = Buffer.alloc(67); // worst-case size
    initializeMint2InstructionData.encode(
        {
            instruction: TokenInstruction.InitializeMint2,
            decimals,
            mintAuthority,
            freezeAuthority,
        },
        data,
    );

    return new TransactionInstruction({
        keys,
        programId,
        data: data.subarray(0, initializeMint2InstructionData.getSpan(data)),
    });
}

/** A decoded, valid InitializeMint2 instruction */
export interface DecodedInitializeMint2Instruction {
    programId: Address;
    keys: {
        mint: AccountMeta;
    };
    data: {
        instruction: TokenInstruction.InitializeMint2;
        decimals: number;
        mintAuthority: Address;
        freezeAuthority: Address | null;
    };
}

/**
 * Decode an InitializeMint2 instruction and validate it
 *
 * @param instruction Transaction instruction to decode
 * @param programId   SPL Token program account
 *
 * @return Decoded, valid instruction
 */
export function decodeInitializeMint2Instruction(
    instruction: TransactionInstruction,
    programId = TOKEN_PROGRAM_ID,
): DecodedInitializeMint2Instruction {
    if (!instruction.programId.equals(programId)) throw new TokenInvalidInstructionProgramError();
    if (instruction.data.length < initializeMint2InstructionData.getSpan(instruction.data))
        throw new TokenInvalidInstructionDataError();

    const {
        keys: { mint },
        data,
    } = decodeInitializeMint2InstructionUnchecked(instruction);
    if (data.instruction !== TokenInstruction.InitializeMint2) throw new TokenInvalidInstructionTypeError();
    if (!mint) throw new TokenInvalidInstructionKeysError();

    return {
        programId,
        keys: {
            mint,
        },
        data,
    };
}

/** A decoded, non-validated InitializeMint2 instruction */
export interface DecodedInitializeMint2InstructionUnchecked {
    programId: Address;
    keys: {
        mint: AccountMeta | undefined;
    };
    data: {
        instruction: number;
        decimals: number;
        mintAuthority: Address;
        freezeAuthority: Address | null;
    };
}

/**
 * Decode an InitializeMint2 instruction without validating it
 *
 * @param instruction Transaction instruction to decode
 *
 * @return Decoded, non-validated instruction
 */
export function decodeInitializeMint2InstructionUnchecked({
    programId,
    keys: [mint],
    data,
}: TransactionInstruction): DecodedInitializeMint2InstructionUnchecked {
    const { instruction, decimals, mintAuthority, freezeAuthority } = initializeMint2InstructionData.decode(data);

    return {
        programId,
        keys: {
            mint,
        },
        data: {
            instruction,
            decimals,
            mintAuthority,
            freezeAuthority,
        },
    };
}
