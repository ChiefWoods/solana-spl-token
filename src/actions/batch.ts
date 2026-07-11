import type { ConfirmOptions, Connection, Signer, TransactionInstruction, TransactionSignature } from '@solana/web3.js';
import { sendAndConfirmTransaction, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '../constants.js';
import { createBatchInstruction } from '../instructions/batch.js';

/**
 * Execute multiple token instructions in a single Batch instruction
 *
 * @param connection     Connection to use
 * @param payer          Payer of the transaction fees
 * @param instructions   Token instructions to execute in order
 * @param signers        Signing accounts required by the inner instructions
 * @param confirmOptions Options for confirming the transaction
 * @param programId      SPL Token program account
 *
 * @return Signature of the confirmed transaction
 */
export async function batch(
    connection: Connection,
    payer: Signer,
    instructions: TransactionInstruction[],
    signers: Signer[] = [],
    confirmOptions?: ConfirmOptions,
    programId = TOKEN_PROGRAM_ID,
): Promise<TransactionSignature> {
    const transaction = new Transaction().add(createBatchInstruction(instructions, programId));

    return await sendAndConfirmTransaction(connection, transaction, [payer, ...signers], confirmOptions);
}
