import type { ConfirmOptions, Connection, Signer, TransactionSignature } from '@solana/web3.js';
import { sendAndConfirmTransaction, Transaction, Address } from '@solana/web3.js';
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '../constants.js';
import { createRecoverNestedInstruction } from '../instructions/associatedTokenAccount.js';
import { getAssociatedTokenAddress } from '../state/mint.js';

/**
 * Recover funds funds in an associated token account which is owned by an associated token account
 *
 * @param connection               Connection to use
 * @param payer                    Payer of the transaction and initialization fees
 * @param owner                    Owner of original ATA
 * @param mint                     Mint for the original ATA
 * @param nestedMint               Mint for the nested ATA
 * @param confirmOptions           Options for confirming the transaction
 * @param programId                SPL Token program account
 * @param associatedTokenProgramId SPL Associated Token program account
 *
 * @return Signature of the confirmed transaction
 */
export async function recoverNested(
    connection: Connection,
    payer: Signer,
    owner: Signer,
    mint: Address,
    nestedMint: Address,
    confirmOptions?: ConfirmOptions,
    programId = TOKEN_PROGRAM_ID,
    associatedTokenProgramId = ASSOCIATED_TOKEN_PROGRAM_ID,
): Promise<TransactionSignature> {
    const ownerPublicKey = new Address(owner.address);
    const ownerAssociatedToken = await getAssociatedTokenAddress(
        mint,
        ownerPublicKey,
        false,
        programId,
        associatedTokenProgramId,
    );

    const destinationAssociatedToken = await getAssociatedTokenAddress(
        nestedMint,
        ownerPublicKey,
        false,
        programId,
        associatedTokenProgramId,
    );

    const nestedAssociatedToken = await getAssociatedTokenAddress(
        nestedMint,
        ownerAssociatedToken,
        true,
        programId,
        associatedTokenProgramId,
    );

    const transaction = new Transaction().add(
        createRecoverNestedInstruction(
            nestedAssociatedToken,
            nestedMint,
            destinationAssociatedToken,
            ownerAssociatedToken,
            mint,
            ownerPublicKey,
            programId,
            associatedTokenProgramId,
        ),
    );

    return await sendAndConfirmTransaction(connection, transaction, [payer, owner], confirmOptions);
}
