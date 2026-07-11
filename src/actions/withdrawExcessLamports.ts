import type { ConfirmOptions, Connection, Address, Signer, TransactionSignature } from '@solana/web3.js';
import { sendAndConfirmTransaction, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '../constants.js';
import { getSigners } from './internal.js';
import { createWithdrawExcessLamportsInstruction } from '../instructions/withdrawExcessLamports.js';

/**
 * Withdraw excess lamports from a mint or multisig account
 *
 * @param connection     Connection to use
 * @param payer          Payer of the transaction fees
 * @param source         Source account holding excess lamports
 * @param destination    Account receiving lamports
 * @param authority      Owner of the source account
 * @param multiSigners   Signing accounts if `authority` is a multisig
 * @param confirmOptions Options for confirming the transaction
 * @param programId      SPL Token program account
 *
 * @return Signature of the confirmed transaction
 */
export async function withdrawExcessLamports(
    connection: Connection,
    payer: Signer,
    source: Address,
    destination: Address,
    authority: Signer | Address,
    multiSigners: Signer[] = [],
    confirmOptions?: ConfirmOptions,
    programId = TOKEN_PROGRAM_ID,
): Promise<TransactionSignature> {
    const [authorityPublicKey, signers] = getSigners(authority, multiSigners);

    const transaction = new Transaction().add(
        createWithdrawExcessLamportsInstruction(source, destination, authorityPublicKey, multiSigners, programId),
    );

    return await sendAndConfirmTransaction(connection, transaction, [payer, ...signers], confirmOptions);
}
