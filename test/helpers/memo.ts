import { Address, TransactionInstruction } from '@solana/web3.js';

const MEMO_PROGRAM_ID = new Address('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

/**
 * Creates a Memo program instruction compatible with `@solana/spl-memo`'s
 * former `createMemoInstruction` helper. Replace this when web3.js exposes
 * its native Memo instruction builder.
 */
export function createMemoInstruction(memo: string, signerPubkeys: readonly Address[] = []): TransactionInstruction {
    return new TransactionInstruction({
        programId: MEMO_PROGRAM_ID,
        keys: signerPubkeys.map(pubkey => ({ pubkey, isSigner: true, isWritable: false })),
        data: Buffer.from(memo),
    });
}
