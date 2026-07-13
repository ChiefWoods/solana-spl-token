import {
    getDisableHarvestToMintInstructionDataEncoder,
    getEnableHarvestToMintInstructionDataEncoder,
    getHarvestWithheldTokensToMintForConfidentialTransferFeeInstructionDataEncoder,
    getInitializeConfidentialTransferFeeInstructionDataEncoder,
    getWithdrawWithheldTokensFromAccountsForConfidentialTransferFeeInstructionDataEncoder,
    getWithdrawWithheldTokensFromMintForConfidentialTransferFeeInstructionDataEncoder,
} from '@solana-program/token-2022';
import type { Address, Signer } from '@solana/web3.js';
import { TransactionInstruction } from '@solana/web3.js';
import { programSupportsExtensions, TOKEN_2022_PROGRAM_ID } from '../../constants.js';
import { TokenUnsupportedInstructionError } from '../../errors.js';
import { addSigners } from '../../instructions/internal.js';
import type { TokenInstruction } from '../../instructions/types.js';

export enum ConfidentialTransferFeeInstruction {
    InitializeConfidentialTransferFeeConfig = 0,
    WithdrawWithheldTokensFromMint = 1,
    WithdrawWithheldTokensFromAccounts = 2,
    HarvestWithheldTokensToMint = 3,
    EnableHarvestToMint = 4,
    DisableHarvestToMint = 5,
}

export interface InitializeConfidentialTransferFeeConfigInstructionData {
    instruction: TokenInstruction.ConfidentialTransferFeeExtension;
    confidentialTransferFeeInstruction: ConfidentialTransferFeeInstruction.InitializeConfidentialTransferFeeConfig;
    authority: Address | null;
    withdrawWithheldAuthorityElGamalPubkey: Address;
}

export function createInitializeConfidentialTransferFeeConfigInstruction(
    mint: Address,
    authority: Address | null,
    withdrawWithheldAuthorityElGamalPubkey: Address,
    programId = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }
    const keys = [{ pubkey: mint, isSigner: false, isWritable: true }];
    const data = Buffer.from(
        getInitializeConfidentialTransferFeeInstructionDataEncoder().encode({
            authority: authority?.toBase58() ?? null,
            withdrawWithheldAuthorityElGamalPubkey: withdrawWithheldAuthorityElGamalPubkey.toBase58(),
        }),
    );
    return new TransactionInstruction({ keys, programId, data });
}

export interface WithdrawWithheldTokensFromMintForConfidentialTransferFeeInstructionData {
    instruction: TokenInstruction.ConfidentialTransferFeeExtension;
    confidentialTransferFeeInstruction: ConfidentialTransferFeeInstruction.WithdrawWithheldTokensFromMint;
    proofInstructionOffset: number;
    newDecryptableAvailableBalance: Uint8Array;
}

export function createWithdrawWithheldTokensFromMintForConfidentialTransferFeeInstruction(
    mint: Address,
    destination: Address,
    authority: Address,
    instructionsSysvarOrContextState: Address,
    proofInstructionOffset: number,
    newDecryptableAvailableBalance: Uint8Array,
    multiSigners: (Signer | Address)[] = [],
    programId = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }
    const keys = addSigners(
        [
            { pubkey: mint, isSigner: false, isWritable: true },
            { pubkey: destination, isSigner: false, isWritable: true },
            { pubkey: instructionsSysvarOrContextState, isSigner: false, isWritable: false },
        ],
        authority,
        multiSigners,
    );
    const data = Buffer.from(
        getWithdrawWithheldTokensFromMintForConfidentialTransferFeeInstructionDataEncoder().encode({
            proofInstructionOffset,
            newDecryptableAvailableBalance,
        }),
    );
    return new TransactionInstruction({ keys, programId, data });
}

export interface WithdrawWithheldTokensFromAccountsForConfidentialTransferFeeInstructionData {
    instruction: TokenInstruction.ConfidentialTransferFeeExtension;
    confidentialTransferFeeInstruction: ConfidentialTransferFeeInstruction.WithdrawWithheldTokensFromAccounts;
    numTokenAccounts: number;
    proofInstructionOffset: number;
    newDecryptableAvailableBalance: Uint8Array;
}

export function createWithdrawWithheldTokensFromAccountsForConfidentialTransferFeeInstruction(
    mint: Address,
    destination: Address,
    authority: Address,
    instructionsSysvarOrContextState: Address,
    proofInstructionOffset: number,
    newDecryptableAvailableBalance: Uint8Array,
    sources: Address[],
    multiSigners: (Signer | Address)[] = [],
    programId = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }
    const keys = addSigners(
        [
            { pubkey: mint, isSigner: false, isWritable: false },
            { pubkey: destination, isSigner: false, isWritable: true },
            { pubkey: instructionsSysvarOrContextState, isSigner: false, isWritable: false },
        ],
        authority,
        multiSigners,
    );
    for (const source of sources) {
        keys.push({ pubkey: source, isSigner: false, isWritable: true });
    }
    const data = Buffer.from(
        getWithdrawWithheldTokensFromAccountsForConfidentialTransferFeeInstructionDataEncoder().encode({
            numTokenAccounts: sources.length,
            proofInstructionOffset,
            newDecryptableAvailableBalance,
        }),
    );
    return new TransactionInstruction({ keys, programId, data });
}

export interface HarvestWithheldTokensToMintForConfidentialTransferFeeInstructionData {
    instruction: TokenInstruction.ConfidentialTransferFeeExtension;
    confidentialTransferFeeInstruction: ConfidentialTransferFeeInstruction.HarvestWithheldTokensToMint;
}

export function createHarvestWithheldTokensToMintForConfidentialTransferFeeInstruction(
    mint: Address,
    sources: Address[],
    programId = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }
    const keys = [
        { pubkey: mint, isSigner: false, isWritable: true },
        ...sources.map(source => ({ pubkey: source, isSigner: false, isWritable: true })),
    ];
    const data = Buffer.from(
        getHarvestWithheldTokensToMintForConfidentialTransferFeeInstructionDataEncoder().encode({}),
    );
    return new TransactionInstruction({ keys, programId, data });
}

export interface EnableHarvestToMintInstructionData {
    instruction: TokenInstruction.ConfidentialTransferFeeExtension;
    confidentialTransferFeeInstruction: ConfidentialTransferFeeInstruction.EnableHarvestToMint;
}

export function createEnableHarvestToMintInstruction(
    mint: Address,
    authority: Address,
    multiSigners: (Signer | Address)[] = [],
    programId = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }
    const keys = addSigners([{ pubkey: mint, isSigner: false, isWritable: true }], authority, multiSigners);
    const data = Buffer.from(getEnableHarvestToMintInstructionDataEncoder().encode({}));
    return new TransactionInstruction({ keys, programId, data });
}

export interface DisableHarvestToMintInstructionData {
    instruction: TokenInstruction.ConfidentialTransferFeeExtension;
    confidentialTransferFeeInstruction: ConfidentialTransferFeeInstruction.DisableHarvestToMint;
}

export function createDisableHarvestToMintInstruction(
    mint: Address,
    authority: Address,
    multiSigners: (Signer | Address)[] = [],
    programId = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }
    const keys = addSigners([{ pubkey: mint, isSigner: false, isWritable: true }], authority, multiSigners);
    const data = Buffer.from(getDisableHarvestToMintInstructionDataEncoder().encode({}));
    return new TransactionInstruction({ keys, programId, data });
}
