import type { Signer } from '@solana/web3.js';
import { Address, Connection, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { createSolanaRpc } from '@solana/kit';
import { TOKEN_PROGRAM_ID, createInitializeAccountInstruction, getAccountLen } from '../src';
import type { ExtensionType } from '../src';

export const LOCAL_VALIDATOR_URL = 'http://127.0.0.1:8899';

export async function newAccountWithLamports(connection: Connection, lamports = 1000000): Promise<Keypair> {
    const account = await Keypair.generate();
    const signature = await connection.requestAirdrop(account.publicKey, lamports);
    await connection.confirmTransaction(signature);
    return account;
}

export async function getConnection(): Promise<Connection> {
    return new Connection(LOCAL_VALIDATOR_URL, 'confirmed');
}

export function getSolanaRpc() {
    return createSolanaRpc(LOCAL_VALIDATOR_URL);
}

export const TEST_PROGRAM_ID = process.env.TEST_PROGRAM_ID
    ? new Address(process.env.TEST_PROGRAM_ID)
    : TOKEN_PROGRAM_ID;

export const TRANSFER_HOOK_TEST_PROGRAM_ID = new Address('TokenHookExampLe8smaVNrxTBezWTRbEwxwb1Zykrb');

export const ELGAMAL_REGISTRY_PROGRAM_ID = new Address('regVYJW7tcT8zipN5YiBvHsvR5jXW1uLFxaHSbugABg');

export const ELGAMAL_REGISTRY_ACCOUNT_SIZE = 64;

export const SYSVAR_INSTRUCTIONS_PUBKEY = new Address('Sysvar1nstructions1111111111111111111111111');

export async function createTokenAccount(
    connection: Connection,
    payer: Signer,
    mint: Address,
    owner: Address,
    extensions: ExtensionType[] = [],
    programId = TEST_PROGRAM_ID,
): Promise<{ tokenAccount: Address; tokenAccountKeypair: Keypair }> {
    const tokenAccountKeypair = await Keypair.generate();
    const tokenAccount = tokenAccountKeypair.publicKey;
    const accountLen = getAccountLen(extensions);
    const accountLamports = await connection.getMinimumBalanceForRentExemption(accountLen);

    const transaction = new Transaction().add(
        SystemProgram.createAccount({
            fromPubkey: new Address(payer.address),
            newAccountPubkey: tokenAccount,
            space: accountLen,
            lamports: accountLamports,
            programId,
        }),
        createInitializeAccountInstruction(tokenAccount, mint, owner, programId),
    );
    await sendAndConfirmTransaction(connection, transaction, [payer, tokenAccountKeypair], undefined);

    return { tokenAccount, tokenAccountKeypair };
}
