import {
    getApplyConfidentialPendingBalanceInstructionDataEncoder,
    getApproveConfidentialTransferAccountInstructionDataEncoder,
    getConfidentialDepositInstructionDataEncoder,
    getConfidentialTransferInstructionDataEncoder,
    getConfidentialTransferWithFeeInstructionDataEncoder,
    getConfidentialWithdrawInstructionDataEncoder,
    getConfigureConfidentialTransferAccountInstructionDataEncoder,
    getConfigureConfidentialTransferAccountWithRegistryInstructionDataEncoder,
    getDisableConfidentialCreditsInstructionDataEncoder,
    getDisableNonConfidentialCreditsInstructionDataEncoder,
    getEmptyConfidentialTransferAccountInstructionDataEncoder,
    getEnableConfidentialCreditsInstructionDataEncoder,
    getEnableNonConfidentialCreditsInstructionDataEncoder,
    getInitializeConfidentialTransferMintInstructionDataEncoder,
    getUpdateConfidentialTransferMintInstructionDataEncoder,
} from '@solana-program/token-2022';
import type { FixedSizeEncoder, ReadonlyUint8Array } from '@solana/kit';
import type { Address, Signer } from '@solana/web3.js';
import { SystemProgram, TransactionInstruction } from '@solana/web3.js';
import { programSupportsExtensions, TOKEN_2022_PROGRAM_ID } from '../../constants.js';
import { TokenUnsupportedInstructionError } from '../../errors.js';
import { addSigners } from '../../instructions/internal.js';
import type { TokenInstruction } from '../../instructions/types.js';

export enum ConfidentialTransferInstruction {
    InitializeMint = 0,
    UpdateMint = 1,
    ConfigureAccount = 2,
    ApproveAccount = 3,
    EmptyAccount = 4,
    Deposit = 5,
    Withdraw = 6,
    Transfer = 7,
    ApplyPendingBalance = 8,
    EnableConfidentialCredits = 9,
    DisableConfidentialCredits = 10,
    EnableNonConfidentialCredits = 11,
    DisableNonConfidentialCredits = 12,
    TransferWithFee = 13,
    ConfigureAccountWithRegistry = 14,
}

export type ConfidentialTransferProofAccounts = {
    instructionsSysvar?: Address;
    equalityRecord?: Address;
    ciphertextValidityRecord?: Address;
    transferAmountCiphertextValidityRecord?: Address;
    feeSigmaRecord?: Address;
    feeCiphertextValidityRecord?: Address;
    rangeRecord?: Address;
};

export interface InitializeConfidentialTransferMintInstructionData {
    instruction: TokenInstruction.ConfidentialTransferExtension;
    confidentialTransferInstruction: ConfidentialTransferInstruction.InitializeMint;
    authority: Address | null;
    autoApproveNewAccounts: boolean;
    auditorElgamalPubkey: Address | null;
}

export function createInitializeConfidentialTransferMintInstruction(
    mint: Address,
    authority: Address | null,
    autoApproveNewAccounts: boolean,
    auditorElgamalPubkey: Address | null,
    programId = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }
    const keys = [{ pubkey: mint, isSigner: false, isWritable: true }];
    const data = Buffer.from(
        getInitializeConfidentialTransferMintInstructionDataEncoder().encode({
            authority: authority?.toBase58() ?? null,
            autoApproveNewAccounts,
            auditorElgamalPubkey: auditorElgamalPubkey?.toBase58() ?? null,
        }),
    );
    return new TransactionInstruction({ keys, programId, data });
}

export interface UpdateConfidentialTransferMintInstructionData {
    instruction: TokenInstruction.ConfidentialTransferExtension;
    confidentialTransferInstruction: ConfidentialTransferInstruction.UpdateMint;
    autoApproveNewAccounts: boolean;
    auditorElgamalPubkey: Address | null;
}

export function createUpdateConfidentialTransferMintInstruction(
    mint: Address,
    authority: Address,
    multiSigners: (Signer | Address)[],
    autoApproveNewAccounts: boolean,
    auditorElgamalPubkey: Address | null,
    programId = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }
    const keys = addSigners([{ pubkey: mint, isSigner: false, isWritable: true }], authority, multiSigners);
    const data = Buffer.from(
        getUpdateConfidentialTransferMintInstructionDataEncoder().encode({
            autoApproveNewAccounts,
            auditorElgamalPubkey: auditorElgamalPubkey?.toBase58() ?? null,
        }),
    );
    return new TransactionInstruction({ keys, programId, data });
}

export interface ConfigureConfidentialTransferAccountInstructionData {
    instruction: TokenInstruction.ConfidentialTransferExtension;
    confidentialTransferInstruction: ConfidentialTransferInstruction.ConfigureAccount;
    decryptableZeroBalance: Uint8Array;
    maximumPendingBalanceCreditCounter: bigint;
    proofInstructionOffset: number;
}

export function createConfigureConfidentialTransferAccountInstruction(
    token: Address,
    mint: Address,
    instructionsSysvarOrContextState: Address,
    authority: Address,
    multiSigners: (Signer | Address)[],
    decryptableZeroBalance: Uint8Array,
    maximumPendingBalanceCreditCounter: number | bigint,
    proofInstructionOffset: number,
    programId = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }
    const baseKeys = [
        { pubkey: token, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: instructionsSysvarOrContextState, isSigner: false, isWritable: false },
    ];
    const keys = addSigners(baseKeys, authority, multiSigners);
    const data = Buffer.from(
        getConfigureConfidentialTransferAccountInstructionDataEncoder().encode({
            decryptableZeroBalance,
            maximumPendingBalanceCreditCounter,
            proofInstructionOffset,
        }),
    );
    return new TransactionInstruction({ keys, programId, data });
}

export interface ApproveConfidentialTransferAccountInstructionData {
    instruction: TokenInstruction.ConfidentialTransferExtension;
    confidentialTransferInstruction: ConfidentialTransferInstruction.ApproveAccount;
}

export function createApproveConfidentialTransferAccountInstruction(
    token: Address,
    mint: Address,
    authority: Address,
    multiSigners: (Signer | Address)[] = [],
    programId = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }
    const keys = addSigners(
        [
            { pubkey: token, isSigner: false, isWritable: true },
            { pubkey: mint, isSigner: false, isWritable: false },
        ],
        authority,
        multiSigners,
    );
    const data = Buffer.from(getApproveConfidentialTransferAccountInstructionDataEncoder().encode({}));
    return new TransactionInstruction({ keys, programId, data });
}

export interface EmptyConfidentialTransferAccountInstructionData {
    instruction: TokenInstruction.ConfidentialTransferExtension;
    confidentialTransferInstruction: ConfidentialTransferInstruction.EmptyAccount;
    proofInstructionOffset: number;
}

export function createEmptyConfidentialTransferAccountInstruction(
    token: Address,
    instructionsSysvarOrContextState: Address,
    authority: Address,
    multiSigners: (Signer | Address)[],
    proofInstructionOffset: number,
    programId = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }
    const baseKeys = [
        { pubkey: token, isSigner: false, isWritable: true },
        { pubkey: instructionsSysvarOrContextState, isSigner: false, isWritable: false },
    ];
    const keys = addSigners(baseKeys, authority, multiSigners);
    const data = Buffer.from(
        getEmptyConfidentialTransferAccountInstructionDataEncoder().encode({ proofInstructionOffset }),
    );
    return new TransactionInstruction({ keys, programId, data });
}

export interface ConfidentialDepositInstructionData {
    instruction: TokenInstruction.ConfidentialTransferExtension;
    confidentialTransferInstruction: ConfidentialTransferInstruction.Deposit;
    amount: bigint;
    decimals: number;
}

export function createConfidentialDepositInstruction(
    token: Address,
    mint: Address,
    authority: Address,
    multiSigners: (Signer | Address)[],
    amount: number | bigint,
    decimals: number,
    programId = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }
    const keys = addSigners(
        [
            { pubkey: token, isSigner: false, isWritable: true },
            { pubkey: mint, isSigner: false, isWritable: false },
        ],
        authority,
        multiSigners,
    );
    const data = Buffer.from(getConfidentialDepositInstructionDataEncoder().encode({ amount, decimals }));
    return new TransactionInstruction({ keys, programId, data });
}

export interface ConfidentialWithdrawInstructionData {
    instruction: TokenInstruction.ConfidentialTransferExtension;
    confidentialTransferInstruction: ConfidentialTransferInstruction.Withdraw;
    amount: bigint;
    decimals: number;
    newDecryptableAvailableBalance: Uint8Array;
    equalityProofInstructionOffset: number;
    rangeProofInstructionOffset: number;
}

function addWithdrawProofAccounts(
    keys: { pubkey: Address; isSigner: boolean; isWritable: boolean }[],
    proofAccounts: ConfidentialTransferProofAccounts,
) {
    if (proofAccounts.instructionsSysvar) {
        keys.push({ pubkey: proofAccounts.instructionsSysvar, isSigner: false, isWritable: false });
    }
    if (proofAccounts.equalityRecord) {
        keys.push({ pubkey: proofAccounts.equalityRecord, isSigner: false, isWritable: false });
    }
    if (proofAccounts.rangeRecord) {
        keys.push({ pubkey: proofAccounts.rangeRecord, isSigner: false, isWritable: false });
    }
}

function addTransferProofAccounts(
    keys: { pubkey: Address; isSigner: boolean; isWritable: boolean }[],
    proofAccounts: ConfidentialTransferProofAccounts,
) {
    if (proofAccounts.instructionsSysvar) {
        keys.push({ pubkey: proofAccounts.instructionsSysvar, isSigner: false, isWritable: false });
    }
    if (proofAccounts.equalityRecord) {
        keys.push({ pubkey: proofAccounts.equalityRecord, isSigner: false, isWritable: false });
    }
    if (proofAccounts.ciphertextValidityRecord ?? proofAccounts.transferAmountCiphertextValidityRecord) {
        keys.push({
            pubkey: proofAccounts.ciphertextValidityRecord ?? proofAccounts.transferAmountCiphertextValidityRecord!,
            isSigner: false,
            isWritable: false,
        });
    }
    if (proofAccounts.rangeRecord) {
        keys.push({ pubkey: proofAccounts.rangeRecord, isSigner: false, isWritable: false });
    }
}

function addTransferWithFeeProofAccounts(
    keys: { pubkey: Address; isSigner: boolean; isWritable: boolean }[],
    proofAccounts: ConfidentialTransferProofAccounts,
) {
    if (proofAccounts.instructionsSysvar) {
        keys.push({ pubkey: proofAccounts.instructionsSysvar, isSigner: false, isWritable: false });
    }
    if (proofAccounts.equalityRecord) {
        keys.push({ pubkey: proofAccounts.equalityRecord, isSigner: false, isWritable: false });
    }
    if (proofAccounts.transferAmountCiphertextValidityRecord ?? proofAccounts.ciphertextValidityRecord) {
        keys.push({
            pubkey: proofAccounts.transferAmountCiphertextValidityRecord ?? proofAccounts.ciphertextValidityRecord!,
            isSigner: false,
            isWritable: false,
        });
    }
    if (proofAccounts.feeSigmaRecord) {
        keys.push({ pubkey: proofAccounts.feeSigmaRecord, isSigner: false, isWritable: false });
    }
    if (proofAccounts.feeCiphertextValidityRecord) {
        keys.push({ pubkey: proofAccounts.feeCiphertextValidityRecord, isSigner: false, isWritable: false });
    }
    if (proofAccounts.rangeRecord) {
        keys.push({ pubkey: proofAccounts.rangeRecord, isSigner: false, isWritable: false });
    }
}

/**
 * Creates a withdraw instruction only. Current full flows with proof verification usually need
 * separate proof-context transactions before this token instruction.
 */
export function createConfidentialWithdrawInstruction(
    token: Address,
    mint: Address,
    authority: Address,
    multiSigners: (Signer | Address)[],
    proofAccounts: ConfidentialTransferProofAccounts,
    amount: number | bigint,
    decimals: number,
    newDecryptableAvailableBalance: Uint8Array,
    equalityProofInstructionOffset: number,
    rangeProofInstructionOffset: number,
    programId = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }
    const baseKeys = [
        { pubkey: token, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
    ];
    addWithdrawProofAccounts(baseKeys, proofAccounts);
    const keys = addSigners(baseKeys, authority, multiSigners);
    const data = Buffer.from(
        getConfidentialWithdrawInstructionDataEncoder().encode({
            amount,
            decimals,
            newDecryptableAvailableBalance,
            equalityProofInstructionOffset,
            rangeProofInstructionOffset,
        }),
    );
    return new TransactionInstruction({ keys, programId, data });
}

export interface ConfidentialTransferInstructionData {
    instruction: TokenInstruction.ConfidentialTransferExtension;
    confidentialTransferInstruction: ConfidentialTransferInstruction.Transfer;
    newSourceDecryptableAvailableBalance: Uint8Array;
    transferAmountAuditorCiphertextLo: Uint8Array;
    transferAmountAuditorCiphertextHi: Uint8Array;
    equalityProofInstructionOffset: number;
    ciphertextValidityProofInstructionOffset: number;
    rangeProofInstructionOffset: number;
}

/**
 * Creates a transfer instruction only. Current full flows with equality, validity, and range
 * proof verification normally span multiple transactions until the network tx-size increase lands.
 */
export function createConfidentialTransferInstruction(
    sourceToken: Address,
    mint: Address,
    destinationToken: Address,
    authority: Address,
    multiSigners: (Signer | Address)[],
    proofAccounts: ConfidentialTransferProofAccounts,
    newSourceDecryptableAvailableBalance: Uint8Array,
    transferAmountAuditorCiphertextLo: Uint8Array,
    transferAmountAuditorCiphertextHi: Uint8Array,
    equalityProofInstructionOffset: number,
    ciphertextValidityProofInstructionOffset: number,
    rangeProofInstructionOffset: number,
    programId = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }
    const baseKeys = [
        { pubkey: sourceToken, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: destinationToken, isSigner: false, isWritable: true },
    ];
    addTransferProofAccounts(baseKeys, proofAccounts);
    const keys = addSigners(baseKeys, authority, multiSigners);
    const data = Buffer.from(
        getConfidentialTransferInstructionDataEncoder().encode({
            newSourceDecryptableAvailableBalance,
            transferAmountAuditorCiphertextLo,
            transferAmountAuditorCiphertextHi,
            equalityProofInstructionOffset,
            ciphertextValidityProofInstructionOffset,
            rangeProofInstructionOffset,
        }),
    );
    return new TransactionInstruction({ keys, programId, data });
}

export interface ApplyConfidentialPendingBalanceInstructionData {
    instruction: TokenInstruction.ConfidentialTransferExtension;
    confidentialTransferInstruction: ConfidentialTransferInstruction.ApplyPendingBalance;
    expectedPendingBalanceCreditCounter: bigint;
    newDecryptableAvailableBalance: Uint8Array;
}

export function createApplyConfidentialPendingBalanceInstruction(
    token: Address,
    authority: Address,
    multiSigners: (Signer | Address)[],
    expectedPendingBalanceCreditCounter: number | bigint,
    newDecryptableAvailableBalance: Uint8Array,
    programId = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }
    const keys = addSigners([{ pubkey: token, isSigner: false, isWritable: true }], authority, multiSigners);
    const data = Buffer.from(
        getApplyConfidentialPendingBalanceInstructionDataEncoder().encode({
            expectedPendingBalanceCreditCounter,
            newDecryptableAvailableBalance,
        }),
    );
    return new TransactionInstruction({ keys, programId, data });
}

function createCreditToggleInstruction(
    token: Address,
    authority: Address,
    multiSigners: (Signer | Address)[],
    encoder: FixedSizeEncoder<Record<string, never>>,
    programId: Address,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }
    const keys = addSigners([{ pubkey: token, isSigner: false, isWritable: true }], authority, multiSigners);
    const data = Buffer.from(encoder.encode({}) as ReadonlyUint8Array);
    return new TransactionInstruction({ keys, programId, data });
}

export function createEnableConfidentialCreditsInstruction(
    token: Address,
    authority: Address,
    multiSigners: (Signer | Address)[] = [],
    programId = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    return createCreditToggleInstruction(
        token,
        authority,
        multiSigners,
        getEnableConfidentialCreditsInstructionDataEncoder(),
        programId,
    );
}

export function createDisableConfidentialCreditsInstruction(
    token: Address,
    authority: Address,
    multiSigners: (Signer | Address)[] = [],
    programId = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    return createCreditToggleInstruction(
        token,
        authority,
        multiSigners,
        getDisableConfidentialCreditsInstructionDataEncoder(),
        programId,
    );
}

export function createEnableNonConfidentialCreditsInstruction(
    token: Address,
    authority: Address,
    multiSigners: (Signer | Address)[] = [],
    programId = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    return createCreditToggleInstruction(
        token,
        authority,
        multiSigners,
        getEnableNonConfidentialCreditsInstructionDataEncoder(),
        programId,
    );
}

export function createDisableNonConfidentialCreditsInstruction(
    token: Address,
    authority: Address,
    multiSigners: (Signer | Address)[] = [],
    programId = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    return createCreditToggleInstruction(
        token,
        authority,
        multiSigners,
        getDisableNonConfidentialCreditsInstructionDataEncoder(),
        programId,
    );
}

export interface ConfidentialTransferWithFeeInstructionData {
    instruction: TokenInstruction.ConfidentialTransferExtension;
    confidentialTransferInstruction: ConfidentialTransferInstruction.TransferWithFee;
    newSourceDecryptableAvailableBalance: Uint8Array;
    transferAmountAuditorCiphertextLo: Uint8Array;
    transferAmountAuditorCiphertextHi: Uint8Array;
    equalityProofInstructionOffset: number;
    transferAmountCiphertextValidityProofInstructionOffset: number;
    feeSigmaProofInstructionOffset: number;
    feeCiphertextValidityProofInstructionOffset: number;
    rangeProofInstructionOffset: number;
}

/**
 * Creates a transfer-with-fee instruction only. This is the largest confidential transfer path
 * and should be treated as a multi-transaction full flow on current networks.
 */
export function createConfidentialTransferWithFeeInstruction(
    sourceToken: Address,
    mint: Address,
    destinationToken: Address,
    authority: Address,
    multiSigners: (Signer | Address)[],
    proofAccounts: ConfidentialTransferProofAccounts,
    newSourceDecryptableAvailableBalance: Uint8Array,
    transferAmountAuditorCiphertextLo: Uint8Array,
    transferAmountAuditorCiphertextHi: Uint8Array,
    equalityProofInstructionOffset: number,
    transferAmountCiphertextValidityProofInstructionOffset: number,
    feeSigmaProofInstructionOffset: number,
    feeCiphertextValidityProofInstructionOffset: number,
    rangeProofInstructionOffset: number,
    programId = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }
    const baseKeys = [
        { pubkey: sourceToken, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: destinationToken, isSigner: false, isWritable: true },
    ];
    addTransferWithFeeProofAccounts(baseKeys, proofAccounts);
    const keys = addSigners(baseKeys, authority, multiSigners);
    const data = Buffer.from(
        getConfidentialTransferWithFeeInstructionDataEncoder().encode({
            newSourceDecryptableAvailableBalance,
            transferAmountAuditorCiphertextLo,
            transferAmountAuditorCiphertextHi,
            equalityProofInstructionOffset,
            transferAmountCiphertextValidityProofInstructionOffset,
            feeSigmaProofInstructionOffset,
            feeCiphertextValidityProofInstructionOffset,
            rangeProofInstructionOffset,
        }),
    );
    return new TransactionInstruction({ keys, programId, data });
}

export interface ConfigureConfidentialTransferAccountWithRegistryInstructionData {
    instruction: TokenInstruction.ConfidentialTransferExtension;
    confidentialTransferInstruction: ConfidentialTransferInstruction.ConfigureAccountWithRegistry;
}

export function createConfigureConfidentialTransferAccountWithRegistryInstruction(
    token: Address,
    mint: Address,
    elgamalRegistry: Address,
    payer?: Address,
    systemProgram: Address = SystemProgram.programId,
    programId = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }
    const keys = [
        { pubkey: token, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: elgamalRegistry, isSigner: false, isWritable: false },
    ];
    if (payer) {
        keys.push({ pubkey: payer, isSigner: true, isWritable: true });
        keys.push({ pubkey: systemProgram, isSigner: false, isWritable: false });
    }
    const data = Buffer.from(getConfigureConfidentialTransferAccountWithRegistryInstructionDataEncoder().encode({}));
    return new TransactionInstruction({ keys, programId, data });
}
