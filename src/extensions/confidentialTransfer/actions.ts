import type { Address, ConfirmOptions, Connection, Signer, TransactionSignature } from '@solana/web3.js';
import { sendAndConfirmTransaction, Transaction } from '@solana/web3.js';
import { getSigners } from '../../actions/internal.js';
import { TOKEN_2022_PROGRAM_ID } from '../../constants.js';
import {
    createApplyConfidentialPendingBalanceInstruction,
    createApproveConfidentialTransferAccountInstruction,
    createConfidentialDepositInstruction,
    createConfidentialTransferInstruction,
    createConfidentialTransferWithFeeInstruction,
    createConfidentialWithdrawInstruction,
    createConfigureConfidentialTransferAccountInstruction,
    createDisableConfidentialCreditsInstruction,
    createDisableNonConfidentialCreditsInstruction,
    createEmptyConfidentialTransferAccountInstruction,
    createEnableConfidentialCreditsInstruction,
    createEnableNonConfidentialCreditsInstruction,
    createInitializeConfidentialTransferMintInstruction,
    createUpdateConfidentialTransferMintInstruction,
} from './instructions.js';
import type { ConfidentialTransferProofAccounts } from './instructions.js';

export async function initializeConfidentialTransferMint(
    connection: Connection,
    payer: Signer,
    mint: Address,
    authority: Address | null,
    autoApproveNewAccounts: boolean,
    auditorElgamalPubkey: Address | null,
    confirmOptions?: ConfirmOptions,
    programId = TOKEN_2022_PROGRAM_ID,
): Promise<TransactionSignature> {
    const transaction = new Transaction().add(
        createInitializeConfidentialTransferMintInstruction(
            mint,
            authority,
            autoApproveNewAccounts,
            auditorElgamalPubkey,
            programId,
        ),
    );
    return await sendAndConfirmTransaction(connection, transaction, [payer], confirmOptions);
}

export async function updateConfidentialTransferMint(
    connection: Connection,
    payer: Signer,
    mint: Address,
    authority: Signer | Address,
    autoApproveNewAccounts: boolean,
    auditorElgamalPubkey: Address | null,
    multiSigners: Signer[] = [],
    confirmOptions?: ConfirmOptions,
    programId = TOKEN_2022_PROGRAM_ID,
): Promise<TransactionSignature> {
    const [authorityPublicKey, signers] = getSigners(authority, multiSigners);
    const transaction = new Transaction().add(
        createUpdateConfidentialTransferMintInstruction(
            mint,
            authorityPublicKey,
            signers,
            autoApproveNewAccounts,
            auditorElgamalPubkey,
            programId,
        ),
    );
    return await sendAndConfirmTransaction(connection, transaction, [payer, ...signers], confirmOptions);
}

export async function configureConfidentialTransferAccount(
    connection: Connection,
    payer: Signer,
    token: Address,
    mint: Address,
    instructionsSysvarOrContextState: Address,
    authority: Signer | Address,
    decryptableZeroBalance: Uint8Array,
    maximumPendingBalanceCreditCounter: number | bigint,
    proofInstructionOffset: number,
    multiSigners: Signer[] = [],
    confirmOptions?: ConfirmOptions,
    programId = TOKEN_2022_PROGRAM_ID,
): Promise<TransactionSignature> {
    const [authorityPublicKey, signers] = getSigners(authority, multiSigners);
    const transaction = new Transaction().add(
        createConfigureConfidentialTransferAccountInstruction(
            token,
            mint,
            instructionsSysvarOrContextState,
            authorityPublicKey,
            signers,
            decryptableZeroBalance,
            maximumPendingBalanceCreditCounter,
            proofInstructionOffset,
            programId,
        ),
    );
    return await sendAndConfirmTransaction(connection, transaction, [payer, ...signers], confirmOptions);
}

export async function approveConfidentialTransferAccount(
    connection: Connection,
    payer: Signer,
    token: Address,
    mint: Address,
    authority: Signer | Address,
    multiSigners: Signer[] = [],
    confirmOptions?: ConfirmOptions,
    programId = TOKEN_2022_PROGRAM_ID,
): Promise<TransactionSignature> {
    const [authorityPublicKey, signers] = getSigners(authority, multiSigners);
    const transaction = new Transaction().add(
        createApproveConfidentialTransferAccountInstruction(token, mint, authorityPublicKey, signers, programId),
    );
    return await sendAndConfirmTransaction(connection, transaction, [payer, ...signers], confirmOptions);
}

export async function emptyConfidentialTransferAccount(
    connection: Connection,
    payer: Signer,
    token: Address,
    instructionsSysvarOrContextState: Address,
    authority: Signer | Address,
    proofInstructionOffset: number,
    multiSigners: Signer[] = [],
    confirmOptions?: ConfirmOptions,
    programId = TOKEN_2022_PROGRAM_ID,
): Promise<TransactionSignature> {
    const [authorityPublicKey, signers] = getSigners(authority, multiSigners);
    const transaction = new Transaction().add(
        createEmptyConfidentialTransferAccountInstruction(
            token,
            instructionsSysvarOrContextState,
            authorityPublicKey,
            signers,
            proofInstructionOffset,
            programId,
        ),
    );
    return await sendAndConfirmTransaction(connection, transaction, [payer, ...signers], confirmOptions);
}

export async function confidentialDeposit(
    connection: Connection,
    payer: Signer,
    token: Address,
    mint: Address,
    authority: Signer | Address,
    amount: number | bigint,
    decimals: number,
    multiSigners: Signer[] = [],
    confirmOptions?: ConfirmOptions,
    programId = TOKEN_2022_PROGRAM_ID,
): Promise<TransactionSignature> {
    const [authorityPublicKey, signers] = getSigners(authority, multiSigners);
    const transaction = new Transaction().add(
        createConfidentialDepositInstruction(token, mint, authorityPublicKey, signers, amount, decimals, programId),
    );
    return await sendAndConfirmTransaction(connection, transaction, [payer, ...signers], confirmOptions);
}

export async function confidentialWithdraw(
    connection: Connection,
    payer: Signer,
    token: Address,
    mint: Address,
    authority: Signer | Address,
    proofAccounts: ConfidentialTransferProofAccounts,
    amount: number | bigint,
    decimals: number,
    newDecryptableAvailableBalance: Uint8Array,
    equalityProofInstructionOffset: number,
    rangeProofInstructionOffset: number,
    multiSigners: Signer[] = [],
    confirmOptions?: ConfirmOptions,
    programId = TOKEN_2022_PROGRAM_ID,
): Promise<TransactionSignature> {
    const [authorityPublicKey, signers] = getSigners(authority, multiSigners);
    const transaction = new Transaction().add(
        createConfidentialWithdrawInstruction(
            token,
            mint,
            authorityPublicKey,
            signers,
            proofAccounts,
            amount,
            decimals,
            newDecryptableAvailableBalance,
            equalityProofInstructionOffset,
            rangeProofInstructionOffset,
            programId,
        ),
    );
    return await sendAndConfirmTransaction(connection, transaction, [payer, ...signers], confirmOptions);
}

export async function confidentialTransfer(
    connection: Connection,
    payer: Signer,
    sourceToken: Address,
    mint: Address,
    destinationToken: Address,
    authority: Signer | Address,
    proofAccounts: ConfidentialTransferProofAccounts,
    newSourceDecryptableAvailableBalance: Uint8Array,
    transferAmountAuditorCiphertextLo: Uint8Array,
    transferAmountAuditorCiphertextHi: Uint8Array,
    equalityProofInstructionOffset: number,
    ciphertextValidityProofInstructionOffset: number,
    rangeProofInstructionOffset: number,
    multiSigners: Signer[] = [],
    confirmOptions?: ConfirmOptions,
    programId = TOKEN_2022_PROGRAM_ID,
): Promise<TransactionSignature> {
    const [authorityPublicKey, signers] = getSigners(authority, multiSigners);
    const transaction = new Transaction().add(
        createConfidentialTransferInstruction(
            sourceToken,
            mint,
            destinationToken,
            authorityPublicKey,
            signers,
            proofAccounts,
            newSourceDecryptableAvailableBalance,
            transferAmountAuditorCiphertextLo,
            transferAmountAuditorCiphertextHi,
            equalityProofInstructionOffset,
            ciphertextValidityProofInstructionOffset,
            rangeProofInstructionOffset,
            programId,
        ),
    );
    return await sendAndConfirmTransaction(connection, transaction, [payer, ...signers], confirmOptions);
}

export async function applyConfidentialPendingBalance(
    connection: Connection,
    payer: Signer,
    token: Address,
    authority: Signer | Address,
    expectedPendingBalanceCreditCounter: number | bigint,
    newDecryptableAvailableBalance: Uint8Array,
    multiSigners: Signer[] = [],
    confirmOptions?: ConfirmOptions,
    programId = TOKEN_2022_PROGRAM_ID,
): Promise<TransactionSignature> {
    const [authorityPublicKey, signers] = getSigners(authority, multiSigners);
    const transaction = new Transaction().add(
        createApplyConfidentialPendingBalanceInstruction(
            token,
            authorityPublicKey,
            signers,
            expectedPendingBalanceCreditCounter,
            newDecryptableAvailableBalance,
            programId,
        ),
    );
    return await sendAndConfirmTransaction(connection, transaction, [payer, ...signers], confirmOptions);
}

export async function enableConfidentialCredits(
    connection: Connection,
    payer: Signer,
    token: Address,
    authority: Signer | Address,
    multiSigners: Signer[] = [],
    confirmOptions?: ConfirmOptions,
    programId = TOKEN_2022_PROGRAM_ID,
): Promise<TransactionSignature> {
    const [authorityPublicKey, signers] = getSigners(authority, multiSigners);
    const transaction = new Transaction().add(
        createEnableConfidentialCreditsInstruction(token, authorityPublicKey, signers, programId),
    );
    return await sendAndConfirmTransaction(connection, transaction, [payer, ...signers], confirmOptions);
}

export async function disableConfidentialCredits(
    connection: Connection,
    payer: Signer,
    token: Address,
    authority: Signer | Address,
    multiSigners: Signer[] = [],
    confirmOptions?: ConfirmOptions,
    programId = TOKEN_2022_PROGRAM_ID,
): Promise<TransactionSignature> {
    const [authorityPublicKey, signers] = getSigners(authority, multiSigners);
    const transaction = new Transaction().add(
        createDisableConfidentialCreditsInstruction(token, authorityPublicKey, signers, programId),
    );
    return await sendAndConfirmTransaction(connection, transaction, [payer, ...signers], confirmOptions);
}

export async function enableNonConfidentialCredits(
    connection: Connection,
    payer: Signer,
    token: Address,
    authority: Signer | Address,
    multiSigners: Signer[] = [],
    confirmOptions?: ConfirmOptions,
    programId = TOKEN_2022_PROGRAM_ID,
): Promise<TransactionSignature> {
    const [authorityPublicKey, signers] = getSigners(authority, multiSigners);
    const transaction = new Transaction().add(
        createEnableNonConfidentialCreditsInstruction(token, authorityPublicKey, signers, programId),
    );
    return await sendAndConfirmTransaction(connection, transaction, [payer, ...signers], confirmOptions);
}

export async function disableNonConfidentialCredits(
    connection: Connection,
    payer: Signer,
    token: Address,
    authority: Signer | Address,
    multiSigners: Signer[] = [],
    confirmOptions?: ConfirmOptions,
    programId = TOKEN_2022_PROGRAM_ID,
): Promise<TransactionSignature> {
    const [authorityPublicKey, signers] = getSigners(authority, multiSigners);
    const transaction = new Transaction().add(
        createDisableNonConfidentialCreditsInstruction(token, authorityPublicKey, signers, programId),
    );
    return await sendAndConfirmTransaction(connection, transaction, [payer, ...signers], confirmOptions);
}

export async function confidentialTransferWithFee(
    connection: Connection,
    payer: Signer,
    sourceToken: Address,
    mint: Address,
    destinationToken: Address,
    authority: Signer | Address,
    proofAccounts: ConfidentialTransferProofAccounts,
    newSourceDecryptableAvailableBalance: Uint8Array,
    transferAmountAuditorCiphertextLo: Uint8Array,
    transferAmountAuditorCiphertextHi: Uint8Array,
    equalityProofInstructionOffset: number,
    transferAmountCiphertextValidityProofInstructionOffset: number,
    feeSigmaProofInstructionOffset: number,
    feeCiphertextValidityProofInstructionOffset: number,
    rangeProofInstructionOffset: number,
    multiSigners: Signer[] = [],
    confirmOptions?: ConfirmOptions,
    programId = TOKEN_2022_PROGRAM_ID,
): Promise<TransactionSignature> {
    const [authorityPublicKey, signers] = getSigners(authority, multiSigners);
    const transaction = new Transaction().add(
        createConfidentialTransferWithFeeInstruction(
            sourceToken,
            mint,
            destinationToken,
            authorityPublicKey,
            signers,
            proofAccounts,
            newSourceDecryptableAvailableBalance,
            transferAmountAuditorCiphertextLo,
            transferAmountAuditorCiphertextHi,
            equalityProofInstructionOffset,
            transferAmountCiphertextValidityProofInstructionOffset,
            feeSigmaProofInstructionOffset,
            feeCiphertextValidityProofInstructionOffset,
            rangeProofInstructionOffset,
            programId,
        ),
    );
    return await sendAndConfirmTransaction(connection, transaction, [payer, ...signers], confirmOptions);
}
