import type { Address, ConfirmOptions, Connection, Signer, TransactionSignature } from '@solana/web3.js';
import { sendAndConfirmTransaction, Transaction } from '@solana/web3.js';
import { getSigners } from '../../actions/internal.js';
import { TOKEN_2022_PROGRAM_ID } from '../../constants.js';
import {
    createApplyConfidentialPendingBurnInstruction,
    createInitializeConfidentialMintBurnInstruction,
    createUpdateConfidentialMintBurnDecryptableSupplyInstruction,
} from './instructions.js';

export async function initializeConfidentialMintBurn(
    connection: Connection,
    payer: Signer,
    mint: Address,
    supplyElGamalPubkey: Address,
    decryptableSupply: Uint8Array,
    confirmOptions?: ConfirmOptions,
    programId = TOKEN_2022_PROGRAM_ID,
): Promise<TransactionSignature> {
    const transaction = new Transaction().add(
        createInitializeConfidentialMintBurnInstruction(mint, supplyElGamalPubkey, decryptableSupply, programId),
    );
    return await sendAndConfirmTransaction(connection, transaction, [payer], confirmOptions);
}

export async function updateConfidentialMintBurnDecryptableSupply(
    connection: Connection,
    payer: Signer,
    mint: Address,
    authority: Signer | Address,
    newDecryptableSupply: Uint8Array,
    multiSigners: Signer[] = [],
    confirmOptions?: ConfirmOptions,
    programId = TOKEN_2022_PROGRAM_ID,
): Promise<TransactionSignature> {
    const [authorityPublicKey, signers] = getSigners(authority, multiSigners);
    const transaction = new Transaction().add(
        createUpdateConfidentialMintBurnDecryptableSupplyInstruction(
            mint,
            authorityPublicKey,
            signers,
            newDecryptableSupply,
            programId,
        ),
    );
    return await sendAndConfirmTransaction(connection, transaction, [payer, ...signers], confirmOptions);
}

export async function applyConfidentialPendingBurn(
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
        createApplyConfidentialPendingBurnInstruction(mint, authorityPublicKey, signers, programId),
    );
    return await sendAndConfirmTransaction(connection, transaction, [payer, ...signers], confirmOptions);
}
