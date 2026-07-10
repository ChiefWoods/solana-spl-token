import { getMintToInstructionDataDecoder, getMintToInstructionDataEncoder } from '@solana-program/token';
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

/** Instruction data for a MintTo instruction. */
export interface MintToInstructionData {
    instruction: TokenInstruction.MintTo;
    amount: bigint;
}

/** Codec for encoding and decoding MintTo instruction data. */
export const mintToInstructionData = createInstructionDataCodec({
    encoder: getMintToInstructionDataEncoder(),
    decoder: getMintToInstructionDataDecoder(),
    fromPublic: ({ amount }: MintToInstructionData) => ({ amount }),
    toPublic: ({ discriminator, amount }) => ({ instruction: discriminator, amount }),
});

/**
 * Construct a MintTo instruction
 *
 * @param mint         Public key of the mint
 * @param destination  Address of the token account to mint to
 * @param authority    The mint authority
 * @param amount       Amount to mint
 * @param multiSigners Signing accounts if `authority` is a multisig
 * @param programId    SPL Token program account
 *
 * @return Instruction to add to a transaction
 */
export function createMintToInstruction(
    mint: Address,
    destination: Address,
    authority: Address,
    amount: number | bigint,
    multiSigners: (Signer | Address)[] = [],
    programId = TOKEN_PROGRAM_ID,
): TransactionInstruction {
    const keys = addSigners(
        [
            { pubkey: mint, isSigner: false, isWritable: true },
            { pubkey: destination, isSigner: false, isWritable: true },
        ],
        authority,
        multiSigners,
    );

    const data = Buffer.alloc(mintToInstructionData.span);
    mintToInstructionData.encode(
        {
            instruction: TokenInstruction.MintTo,
            amount: BigInt(amount),
        },
        data,
    );

    return new TransactionInstruction({ keys, programId, data });
}

/** A decoded, valid MintTo instruction */
export interface DecodedMintToInstruction {
    programId: Address;
    keys: {
        mint: AccountMeta;
        destination: AccountMeta;
        authority: AccountMeta;
        multiSigners: AccountMeta[];
    };
    data: {
        instruction: TokenInstruction.MintTo;
        amount: bigint;
    };
}

/**
 * Decode a MintTo instruction and validate it
 *
 * @param instruction Transaction instruction to decode
 * @param programId   SPL Token program account
 *
 * @return Decoded, valid instruction
 */
export function decodeMintToInstruction(
    instruction: TransactionInstruction,
    programId = TOKEN_PROGRAM_ID,
): DecodedMintToInstruction {
    if (!instruction.programId.equals(programId)) throw new TokenInvalidInstructionProgramError();
    if (instruction.data.length !== mintToInstructionData.span) throw new TokenInvalidInstructionDataError();

    const {
        keys: { mint, destination, authority, multiSigners },
        data,
    } = decodeMintToInstructionUnchecked(instruction);
    if (data.instruction !== TokenInstruction.MintTo) throw new TokenInvalidInstructionTypeError();
    if (!mint || !destination || !authority) throw new TokenInvalidInstructionKeysError();

    // TODO: key checks?

    return {
        programId,
        keys: {
            mint,
            destination,
            authority,
            multiSigners,
        },
        data,
    };
}

/** A decoded, non-validated MintTo instruction */
export interface DecodedMintToInstructionUnchecked {
    programId: Address;
    keys: {
        mint: AccountMeta | undefined;
        destination: AccountMeta | undefined;
        authority: AccountMeta | undefined;
        multiSigners: AccountMeta[];
    };
    data: {
        instruction: number;
        amount: bigint;
    };
}

/**
 * Decode a MintTo instruction without validating it
 *
 * @param instruction Transaction instruction to decode
 *
 * @return Decoded, non-validated instruction
 */
export function decodeMintToInstructionUnchecked({
    programId,
    keys: [mint, destination, authority, ...multiSigners],
    data,
}: TransactionInstruction): DecodedMintToInstructionUnchecked {
    return {
        programId,
        keys: {
            mint,
            destination,
            authority,
            multiSigners,
        },
        data: mintToInstructionData.decode(data),
    };
}
