import type { Address, ConfirmOptions, Connection, Signer, TransactionSignature } from '@solana/web3.js';
import { sendAndConfirmTransaction, Transaction } from '@solana/web3.js';
import { getSigners } from '../../actions/internal.js';
import { TOKEN_2022_PROGRAM_ID } from '../../constants.js';
import {
    createDisableHarvestToMintInstruction,
    createEnableHarvestToMintInstruction,
    createHarvestWithheldTokensToMintForConfidentialTransferFeeInstruction,
    createInitializeConfidentialTransferFeeConfigInstruction,
    createWithdrawWithheldTokensFromAccountsForConfidentialTransferFeeInstruction,
    createWithdrawWithheldTokensFromMintForConfidentialTransferFeeInstruction,
} from './instructions.js';

export async function initializeConfidentialTransferFeeConfig(
    connection: Connection,
    payer: Signer,
    mint: Address,
    authority: Address | null,
    withdrawWithheldAuthorityElGamalPubkey: Address,
    confirmOptions?: ConfirmOptions,
    programId = TOKEN_2022_PROGRAM_ID,
): Promise<TransactionSignature> {
    const transaction = new Transaction().add(
        createInitializeConfidentialTransferFeeConfigInstruction(
            mint,
            authority,
            withdrawWithheldAuthorityElGamalPubkey,
            programId,
        ),
    );
    return await sendAndConfirmTransaction(connection, transaction, [payer], confirmOptions);
}

export async function withdrawWithheldTokensFromMintForConfidentialTransferFee(
    connection: Connection,
    payer: Signer,
    mint: Address,
    destination: Address,
    authority: Signer | Address,
    instructionsSysvarOrContextState: Address,
    proofInstructionOffset: number,
    newDecryptableAvailableBalance: Uint8Array,
    multiSigners: Signer[] = [],
    confirmOptions?: ConfirmOptions,
    programId = TOKEN_2022_PROGRAM_ID,
): Promise<TransactionSignature> {
    const [authorityPublicKey, signers] = getSigners(authority, multiSigners);
    const transaction = new Transaction().add(
        createWithdrawWithheldTokensFromMintForConfidentialTransferFeeInstruction(
            mint,
            destination,
            authorityPublicKey,
            instructionsSysvarOrContextState,
            proofInstructionOffset,
            newDecryptableAvailableBalance,
            signers,
            programId,
        ),
    );
    return await sendAndConfirmTransaction(connection, transaction, [payer, ...signers], confirmOptions);
}

export async function withdrawWithheldTokensFromAccountsForConfidentialTransferFee(
    connection: Connection,
    payer: Signer,
    mint: Address,
    destination: Address,
    authority: Signer | Address,
    instructionsSysvarOrContextState: Address,
    proofInstructionOffset: number,
    newDecryptableAvailableBalance: Uint8Array,
    sources: Address[],
    multiSigners: Signer[] = [],
    confirmOptions?: ConfirmOptions,
    programId = TOKEN_2022_PROGRAM_ID,
): Promise<TransactionSignature> {
    const [authorityPublicKey, signers] = getSigners(authority, multiSigners);
    const transaction = new Transaction().add(
        createWithdrawWithheldTokensFromAccountsForConfidentialTransferFeeInstruction(
            mint,
            destination,
            authorityPublicKey,
            instructionsSysvarOrContextState,
            proofInstructionOffset,
            newDecryptableAvailableBalance,
            sources,
            signers,
            programId,
        ),
    );
    return await sendAndConfirmTransaction(connection, transaction, [payer, ...signers], confirmOptions);
}

export async function harvestWithheldTokensToMintForConfidentialTransferFee(
    connection: Connection,
    payer: Signer,
    mint: Address,
    sources: Address[],
    confirmOptions?: ConfirmOptions,
    programId = TOKEN_2022_PROGRAM_ID,
): Promise<TransactionSignature> {
    const transaction = new Transaction().add(
        createHarvestWithheldTokensToMintForConfidentialTransferFeeInstruction(mint, sources, programId),
    );
    return await sendAndConfirmTransaction(connection, transaction, [payer], confirmOptions);
}

export async function enableHarvestToMint(
    connection: Connection,
    payer: Signer,
    mint: Address,
    authority: Signer | Address,
    multiSigners: Signer[] = [],
    confirmOptions?: ConfirmOptions,
    programId = TOKEN_2022_PROGRAM_ID,
): Promise<TransactionSignature> {
    const [authorityPublicKey, signers] = getSigners(authority, multiSigners);
    const transaction = new Transaction().add(
        createEnableHarvestToMintInstruction(mint, authorityPublicKey, signers, programId),
    );
    return await sendAndConfirmTransaction(connection, transaction, [payer, ...signers], confirmOptions);
}

export async function disableHarvestToMint(
    connection: Connection,
    payer: Signer,
    mint: Address,
    authority: Signer | Address,
    multiSigners: Signer[] = [],
    confirmOptions?: ConfirmOptions,
    programId = TOKEN_2022_PROGRAM_ID,
): Promise<TransactionSignature> {
    const [authorityPublicKey, signers] = getSigners(authority, multiSigners);
    const transaction = new Transaction().add(
        createDisableHarvestToMintInstruction(mint, authorityPublicKey, signers, programId),
    );
    return await sendAndConfirmTransaction(connection, transaction, [payer, ...signers], confirmOptions);
}
