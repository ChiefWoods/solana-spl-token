import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Connection, Signer } from '@solana/web3.js';
import { Address, sendAndConfirmTransaction, Keypair, SystemProgram, Transaction } from '@solana/web3.js';
import {
    AccountState,
    createAccount,
    createInitializeMintInstruction,
    createInitializeDefaultAccountStateInstruction,
    getAccount,
    getDefaultAccountState,
    getMint,
    getMintLen,
    updateDefaultAccountState,
    ExtensionType,
} from '../../src';
import { TEST_PROGRAM_ID, newAccountWithLamports, getConnection } from '../common';

const TEST_STATE = AccountState.Frozen;
const TEST_TOKEN_DECIMALS = 2;
const EXTENSIONS = [ExtensionType.DefaultAccountState];
describe('defaultAccountState', () => {
    let connection: Connection;
    let payer: Signer;
    let mint: Address;
    let mintAuthority: Keypair;
    let freezeAuthority: Keypair;
    beforeAll(async () => {
        connection = await getConnection();
        payer = await newAccountWithLamports(connection, 1000000000);
        mintAuthority = await Keypair.generate();
        freezeAuthority = await Keypair.generate();
    });
    beforeEach(async () => {
        const mintKeypair = await Keypair.generate();
        mint = mintKeypair.publicKey;
        const mintLen = getMintLen(EXTENSIONS);
        const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

        const transaction = new Transaction().add(
            SystemProgram.createAccount({
                fromPubkey: new Address(payer.address),
                newAccountPubkey: mint,
                space: mintLen,
                lamports,
                programId: TEST_PROGRAM_ID,
            }),
            createInitializeDefaultAccountStateInstruction(mint, TEST_STATE, TEST_PROGRAM_ID),
            createInitializeMintInstruction(
                mint,
                TEST_TOKEN_DECIMALS,
                mintAuthority.publicKey,
                freezeAuthority.publicKey,
                TEST_PROGRAM_ID,
            ),
        );

        await sendAndConfirmTransaction(connection, transaction, [payer, mintKeypair], undefined);
    });
    it('defaults to frozen', async () => {
        const mintInfo = await getMint(connection, mint, undefined, TEST_PROGRAM_ID);
        const defaultAccountState = getDefaultAccountState(mintInfo);
        expect(defaultAccountState).not.toBeNull();
        if (defaultAccountState !== null) {
            expect(defaultAccountState.state).toEqual(TEST_STATE);
        }
        const owner = await Keypair.generate();
        const account = await createAccount(
            connection,
            payer,
            mint,
            owner.publicKey,
            undefined,
            undefined,
            TEST_PROGRAM_ID,
        );
        const accountInfo = await getAccount(connection, account, undefined, TEST_PROGRAM_ID);
        expect(accountInfo.isFrozen).toBe(true);
        expect(accountInfo.isInitialized).toBe(true);
    });
    it('defaults to initialized after update', async () => {
        await updateDefaultAccountState(
            connection,
            payer,
            mint,
            AccountState.Initialized,
            freezeAuthority,
            [],
            undefined,
            TEST_PROGRAM_ID,
        );
        const owner = await Keypair.generate();
        const account = await createAccount(
            connection,
            payer,
            mint,
            owner.publicKey,
            undefined,
            undefined,
            TEST_PROGRAM_ID,
        );
        const accountInfo = await getAccount(connection, account, undefined, TEST_PROGRAM_ID);
        expect(accountInfo.isFrozen).toBe(false);
        expect(accountInfo.isInitialized).toBe(true);
    });
});
