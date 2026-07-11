import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Connection, Signer } from '@solana/web3.js';
import { Address, sendAndConfirmTransaction, Keypair, SystemProgram, Transaction } from '@solana/web3.js';
import {
    createAccount,
    createMint,
    createEnableCpiGuardInstruction,
    createDisableCpiGuardInstruction,
    createInitializeAccountInstruction,
    getAccount,
    getCpiGuard,
    enableCpiGuard,
    disableCpiGuard,
    getAccountLen,
    ExtensionType,
} from '../../src';
import { TEST_PROGRAM_ID, newAccountWithLamports, getConnection } from '../common';

const TEST_TOKEN_DECIMALS = 2;
const TRANSFER_AMOUNT = 1_000;
const EXTENSIONS = [ExtensionType.CpiGuard];
describe('cpiGuard', () => {
    let connection: Connection;
    let payer: Signer;
    let owner: Keypair;
    let account: Address;

    beforeAll(async () => {
        connection = await getConnection();
        payer = await newAccountWithLamports(connection, 1000000000);
        owner = await Keypair.generate();
    });

    beforeEach(async () => {
        const mintKeypair = await Keypair.generate();
        const mintAuthority = await Keypair.generate();
        const accountKeypair = await Keypair.generate();
        account = accountKeypair.publicKey;
        const accountLen = getAccountLen(EXTENSIONS);
        const lamports = await connection.getMinimumBalanceForRentExemption(accountLen);

        const mint = await createMint(
            connection,
            payer,
            mintAuthority.publicKey,
            mintAuthority.publicKey,
            TEST_TOKEN_DECIMALS,
            mintKeypair,
            undefined,
            TEST_PROGRAM_ID,
        );

        const transaction = new Transaction().add(
            SystemProgram.createAccount({
                fromPubkey: new Address(payer.address),
                newAccountPubkey: account,
                space: accountLen,
                lamports,
                programId: TEST_PROGRAM_ID,
            }),
            createInitializeAccountInstruction(account, mint, owner.publicKey, TEST_PROGRAM_ID),
        );

        await sendAndConfirmTransaction(connection, transaction, [payer, accountKeypair], undefined);
    });

    it('enable/disable via instruction', async () => {
        let accountInfo = await getAccount(connection, account, undefined, TEST_PROGRAM_ID);
        let cpiGuard = getCpiGuard(accountInfo);

        expect(cpiGuard).toBeNull();

        let transaction = new Transaction().add(
            createEnableCpiGuardInstruction(account, owner.publicKey, [], TEST_PROGRAM_ID),
        );
        await sendAndConfirmTransaction(connection, transaction, [payer, owner], undefined);

        accountInfo = await getAccount(connection, account, undefined, TEST_PROGRAM_ID);
        cpiGuard = getCpiGuard(accountInfo);

        expect(cpiGuard).not.toBeNull();
        if (cpiGuard !== null) {
            expect(cpiGuard.lockCpi).toBe(true);
        }

        transaction = new Transaction().add(
            createDisableCpiGuardInstruction(account, owner.publicKey, [], TEST_PROGRAM_ID),
        );
        await sendAndConfirmTransaction(connection, transaction, [payer, owner], undefined);

        accountInfo = await getAccount(connection, account, undefined, TEST_PROGRAM_ID);
        cpiGuard = getCpiGuard(accountInfo);

        expect(cpiGuard).not.toBeNull();
        if (cpiGuard !== null) {
            expect(cpiGuard.lockCpi).toBe(false);
        }
    });

    it('enable/disable via command', async () => {
        let accountInfo = await getAccount(connection, account, undefined, TEST_PROGRAM_ID);
        let cpiGuard = getCpiGuard(accountInfo);

        expect(cpiGuard).toBeNull();

        await enableCpiGuard(connection, payer, account, owner, [], undefined, TEST_PROGRAM_ID);

        accountInfo = await getAccount(connection, account, undefined, TEST_PROGRAM_ID);
        cpiGuard = getCpiGuard(accountInfo);

        expect(cpiGuard).not.toBeNull();
        if (cpiGuard !== null) {
            expect(cpiGuard.lockCpi).toBe(true);
        }

        await disableCpiGuard(connection, payer, account, owner, [], undefined, TEST_PROGRAM_ID);

        accountInfo = await getAccount(connection, account, undefined, TEST_PROGRAM_ID);
        cpiGuard = getCpiGuard(accountInfo);

        expect(cpiGuard).not.toBeNull();
        if (cpiGuard !== null) {
            expect(cpiGuard.lockCpi).toBe(false);
        }
    });
});
