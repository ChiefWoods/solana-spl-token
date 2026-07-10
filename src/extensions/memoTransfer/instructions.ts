import {
    getDisableMemoTransfersInstructionDataEncoder,
    getEnableMemoTransfersInstructionDataEncoder,
} from '@solana-program/token-2022';
import type { Address, Signer } from '@solana/web3.js';
import { TransactionInstruction } from '@solana/web3.js';
import { programSupportsExtensions, TOKEN_2022_PROGRAM_ID } from '../../constants.js';
import { TokenUnsupportedInstructionError } from '../../errors.js';
import { addSigners } from '../../instructions/internal.js';
import type { TokenInstruction } from '../../instructions/types.js';

export enum MemoTransferInstruction {
    Enable = 0,
    Disable = 1,
}

/** TODO: docs */
export interface MemoTransferInstructionData {
    instruction: TokenInstruction.MemoTransferExtension;
    memoTransferInstruction: MemoTransferInstruction;
}

/**
 * Construct an EnableRequiredMemoTransfers instruction
 *
 * @param account         Token account to update
 * @param authority       The account's owner/delegate
 * @param signers         The signer account(s)
 * @param programId       SPL Token program account
 *
 * @return Instruction to add to a transaction
 */
export function createEnableRequiredMemoTransfersInstruction(
    account: Address,
    authority: Address,
    multiSigners: (Signer | Address)[] = [],
    programId = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    return createMemoTransferInstruction(MemoTransferInstruction.Enable, account, authority, multiSigners, programId);
}

/**
 * Construct a DisableMemoTransfer instruction
 *
 * @param account         Token account to update
 * @param authority       The account's owner/delegate
 * @param signers         The signer account(s)
 * @param programId       SPL Token program account
 *
 * @return Instruction to add to a transaction
 */
export function createDisableRequiredMemoTransfersInstruction(
    account: Address,
    authority: Address,
    multiSigners: (Signer | Address)[] = [],
    programId = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    return createMemoTransferInstruction(MemoTransferInstruction.Disable, account, authority, multiSigners, programId);
}

function createMemoTransferInstruction(
    memoTransferInstruction: MemoTransferInstruction,
    account: Address,
    authority: Address,
    multiSigners: (Signer | Address)[],
    programId: Address,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }

    const keys = addSigners([{ pubkey: account, isSigner: false, isWritable: true }], authority, multiSigners);
    const data = Buffer.from(
        (memoTransferInstruction === MemoTransferInstruction.Enable
            ? getEnableMemoTransfersInstructionDataEncoder()
            : getDisableMemoTransfersInstructionDataEncoder()
        ).encode({}),
    );

    return new TransactionInstruction({ keys, programId, data });
}
