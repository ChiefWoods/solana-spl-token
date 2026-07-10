import { getMintToCheckedInstructionDataDecoder, getMintToCheckedInstructionDataEncoder } from '@solana-program/token';
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

/** Instruction data for a MintToChecked instruction. */
export interface MintToCheckedInstructionData {
    instruction: TokenInstruction.MintToChecked;
    amount: bigint;
    decimals: number;
}

/** Codec for encoding and decoding MintToChecked instruction data. */
export const mintToCheckedInstructionData = createInstructionDataCodec({
    encoder: getMintToCheckedInstructionDataEncoder(),
    decoder: getMintToCheckedInstructionDataDecoder(),
    fromPublic: ({ amount, decimals }: MintToCheckedInstructionData) => ({ amount, decimals }),
    toPublic: ({ discriminator, amount, decimals }) => ({ instruction: discriminator, amount, decimals }),
});

/**
 * Construct a MintToChecked instruction
 *
 * @param mint         Public key of the mint
 * @param destination  Address of the token account to mint to
 * @param authority    The mint authority
 * @param amount       Amount to mint
 * @param decimals     Number of decimals in amount to mint
 * @param multiSigners Signing accounts if `authority` is a multisig
 * @param programId    SPL Token program account
 *
 * @return Instruction to add to a transaction
 */
export function createMintToCheckedInstruction(
    mint: Address,
    destination: Address,
    authority: Address,
    amount: number | bigint,
    decimals: number,
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

    const data = Buffer.alloc(mintToCheckedInstructionData.span);
    mintToCheckedInstructionData.encode(
        {
            instruction: TokenInstruction.MintToChecked,
            amount: BigInt(amount),
            decimals,
        },
        data,
    );

    return new TransactionInstruction({ keys, programId, data });
}

/** A decoded, valid MintToChecked instruction */
export interface DecodedMintToCheckedInstruction {
    programId: Address;
    keys: {
        mint: AccountMeta;
        destination: AccountMeta;
        authority: AccountMeta;
        multiSigners: AccountMeta[];
    };
    data: {
        instruction: TokenInstruction.MintToChecked;
        amount: bigint;
        decimals: number;
    };
}

/**
 * Decode a MintToChecked instruction and validate it
 *
 * @param instruction Transaction instruction to decode
 * @param programId   SPL Token program account
 *
 * @return Decoded, valid instruction
 */
export function decodeMintToCheckedInstruction(
    instruction: TransactionInstruction,
    programId = TOKEN_PROGRAM_ID,
): DecodedMintToCheckedInstruction {
    if (!instruction.programId.equals(programId)) throw new TokenInvalidInstructionProgramError();
    if (instruction.data.length !== mintToCheckedInstructionData.span) throw new TokenInvalidInstructionDataError();

    const {
        keys: { mint, destination, authority, multiSigners },
        data,
    } = decodeMintToCheckedInstructionUnchecked(instruction);
    if (data.instruction !== TokenInstruction.MintToChecked) throw new TokenInvalidInstructionTypeError();
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

/** A decoded, non-validated MintToChecked instruction */
export interface DecodedMintToCheckedInstructionUnchecked {
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
        decimals: number;
    };
}

/**
 * Decode a MintToChecked instruction without validating it
 *
 * @param instruction Transaction instruction to decode
 *
 * @return Decoded, non-validated instruction
 */
export function decodeMintToCheckedInstructionUnchecked({
    programId,
    keys: [mint, destination, authority, ...multiSigners],
    data,
}: TransactionInstruction): DecodedMintToCheckedInstructionUnchecked {
    return {
        programId,
        keys: {
            mint,
            destination,
            authority,
            multiSigners,
        },
        data: mintToCheckedInstructionData.decode(data),
    };
}
