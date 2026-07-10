import {
    getInitializePausableConfigInstructionDataEncoder,
    getPauseInstructionDataEncoder,
    getResumeInstructionDataEncoder,
} from '@solana-program/token-2022';
import type { Signer, Address } from '@solana/web3.js';
import { TransactionInstruction } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID, programSupportsExtensions } from '../../constants.js';
import { TokenUnsupportedInstructionError } from '../../errors.js';
import type { TokenInstruction } from '../../instructions/types.js';
import { addSigners } from '../../instructions/internal.js';

export enum PausableInstruction {
    Initialize = 0,
    Pause = 1,
    Resume = 2,
}

export interface InitializePausableConfigInstructionData {
    instruction: TokenInstruction.PausableExtension;
    pausableInstruction: PausableInstruction.Initialize;
    authority: Address;
}

/**
 * Construct a InitializePausableConfig instruction
 *
 * @param mint          Token mint account
 * @param authority     Optional authority that can pause or resume mint
 * @param programId     SPL Token program account
 */
export function createInitializePausableConfigInstruction(
    mint: Address,
    authority: Address | null,
    programId: Address = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }
    const keys = [{ pubkey: mint, isSigner: false, isWritable: true }];
    const data = Buffer.from(
        getInitializePausableConfigInstructionDataEncoder().encode({ authority: authority?.toBase58() ?? null }),
    );

    return new TransactionInstruction({ keys, programId, data: data });
}

export interface PauseInstructionData {
    instruction: TokenInstruction.PausableExtension;
    pausableInstruction: PausableInstruction.Pause;
}

/**
 * Construct a Pause instruction
 *
 * @param mint          Token mint account
 * @param authority     The pausable mint's authority
 * @param multiSigners  Signing accounts if authority is a multisig
 * @param programId     SPL Token program account
 */
export function createPauseInstruction(
    mint: Address,
    authority: Address,
    multiSigners: (Signer | Address)[] = [],
    programId: Address = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }
    const keys = addSigners([{ pubkey: mint, isSigner: false, isWritable: true }], authority, multiSigners);
    const data = Buffer.from(getPauseInstructionDataEncoder().encode({}));

    return new TransactionInstruction({ keys, programId, data: data });
}

export interface ResumeInstructionData {
    instruction: TokenInstruction.PausableExtension;
    pausableInstruction: PausableInstruction.Resume;
}

/**
 * Construct a Resume instruction
 *
 * @param mint          Token mint account
 * @param authority     The pausable mint's authority
 * @param multiSigners  Signing accounts if authority is a multisig
 * @param programId     SPL Token program account
 */
export function createResumeInstruction(
    mint: Address,
    authority: Address,
    multiSigners: (Signer | Address)[] = [],
    programId: Address = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }
    const keys = addSigners([{ pubkey: mint, isSigner: false, isWritable: true }], authority, multiSigners);
    const data = Buffer.from(getResumeInstructionDataEncoder().encode({}));

    return new TransactionInstruction({ keys, programId, data: data });
}
