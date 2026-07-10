import {
    getApproveCheckedInstructionDataDecoder,
    getApproveCheckedInstructionDataEncoder,
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

/** Instruction data for an ApproveChecked instruction. */
export interface ApproveCheckedInstructionData {
    instruction: TokenInstruction.ApproveChecked;
    amount: bigint;
    decimals: number;
}

/** Codec for encoding and decoding ApproveChecked instruction data. */
export const approveCheckedInstructionData = createInstructionDataCodec({
    encoder: getApproveCheckedInstructionDataEncoder(),
    decoder: getApproveCheckedInstructionDataDecoder(),
    fromPublic: ({ amount, decimals }: ApproveCheckedInstructionData) => ({ amount, decimals }),
    toPublic: ({ discriminator, amount, decimals }) => ({ instruction: discriminator, amount, decimals }),
});

/**
 * Construct an ApproveChecked instruction
 *
 * @param account      Account to set the delegate for
 * @param mint         Mint account
 * @param delegate     Account authorized to transfer of tokens from the account
 * @param owner        Owner of the account
 * @param amount       Maximum number of tokens the delegate may transfer
 * @param decimals     Number of decimals in approve amount
 * @param multiSigners Signing accounts if `owner` is a multisig
 * @param programId    SPL Token program account
 *
 * @return Instruction to add to a transaction
 */
export function createApproveCheckedInstruction(
    account: Address,
    mint: Address,
    delegate: Address,
    owner: Address,
    amount: number | bigint,
    decimals: number,
    multiSigners: (Signer | Address)[] = [],
    programId = TOKEN_PROGRAM_ID,
): TransactionInstruction {
    const keys = addSigners(
        [
            { pubkey: account, isSigner: false, isWritable: true },
            { pubkey: mint, isSigner: false, isWritable: false },
            { pubkey: delegate, isSigner: false, isWritable: false },
        ],
        owner,
        multiSigners,
    );

    const data = Buffer.alloc(approveCheckedInstructionData.span);
    approveCheckedInstructionData.encode(
        {
            instruction: TokenInstruction.ApproveChecked,
            amount: BigInt(amount),
            decimals,
        },
        data,
    );

    return new TransactionInstruction({ keys, programId, data });
}

/** A decoded, valid ApproveChecked instruction */
export interface DecodedApproveCheckedInstruction {
    programId: Address;
    keys: {
        account: AccountMeta;
        mint: AccountMeta;
        delegate: AccountMeta;
        owner: AccountMeta;
        multiSigners: AccountMeta[];
    };
    data: {
        instruction: TokenInstruction.ApproveChecked;
        amount: bigint;
        decimals: number;
    };
}

/**
 * Decode an ApproveChecked instruction and validate it
 *
 * @param instruction Transaction instruction to decode
 * @param programId   SPL Token program account
 *
 * @return Decoded, valid instruction
 */
export function decodeApproveCheckedInstruction(
    instruction: TransactionInstruction,
    programId = TOKEN_PROGRAM_ID,
): DecodedApproveCheckedInstruction {
    if (!instruction.programId.equals(programId)) throw new TokenInvalidInstructionProgramError();
    if (instruction.data.length !== approveCheckedInstructionData.span) throw new TokenInvalidInstructionDataError();

    const {
        keys: { account, mint, delegate, owner, multiSigners },
        data,
    } = decodeApproveCheckedInstructionUnchecked(instruction);
    if (data.instruction !== TokenInstruction.ApproveChecked) throw new TokenInvalidInstructionTypeError();
    if (!account || !mint || !delegate || !owner) throw new TokenInvalidInstructionKeysError();

    // TODO: key checks?

    return {
        programId,
        keys: {
            account,
            mint,
            delegate,
            owner,
            multiSigners,
        },
        data,
    };
}

/** A decoded, non-validated ApproveChecked instruction */
export interface DecodedApproveCheckedInstructionUnchecked {
    programId: Address;
    keys: {
        account: AccountMeta | undefined;
        mint: AccountMeta | undefined;
        delegate: AccountMeta | undefined;
        owner: AccountMeta | undefined;
        multiSigners: AccountMeta[];
    };
    data: {
        instruction: number;
        amount: bigint;
        decimals: number;
    };
}

/**
 * Decode an ApproveChecked instruction without validating it
 *
 * @param instruction Transaction instruction to decode
 *
 * @return Decoded, non-validated instruction
 */
export function decodeApproveCheckedInstructionUnchecked({
    programId,
    keys: [account, mint, delegate, owner, ...multiSigners],
    data,
}: TransactionInstruction): DecodedApproveCheckedInstructionUnchecked {
    return {
        programId,
        keys: {
            account,
            mint,
            delegate,
            owner,
            multiSigners,
        },
        data: approveCheckedInstructionData.decode(data),
    };
}
