import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Connection, Address, Signer } from '@solana/web3.js';
import { Keypair } from '@solana/web3.js';

import {
    createMint,
    createAccount,
    getAccount,
    mintTo,
    transfer,
    transferChecked,
    approve,
    approveChecked,
    revoke,
} from '../../src';

import { TEST_PROGRAM_ID, newAccountWithLamports, getConnection } from '../common';

const TEST_TOKEN_DECIMALS = 2;
describe('transfer', () => {
    let connection: Connection;
    let payer: Signer;
    let mint: Address;
    let mintAuthority: Keypair;
    let owner1: Keypair;
    let account1: Address;
    let owner2: Keypair;
    let account2: Address;
    let amount: bigint;
    beforeAll(async () => {
        connection = await getConnection();
        payer = await newAccountWithLamports(connection, 1000000000);
        mintAuthority = await Keypair.generate();
        const mintKeypair = await Keypair.generate();
        mint = await createMint(
            connection,
            payer,
            mintAuthority.publicKey,
            mintAuthority.publicKey,
            TEST_TOKEN_DECIMALS,
            mintKeypair,
            undefined,
            TEST_PROGRAM_ID,
        );
    });
    beforeEach(async () => {
        owner1 = await Keypair.generate();
        account1 = await createAccount(
            connection,
            payer,
            mint,
            owner1.publicKey,
            undefined,
            undefined,
            TEST_PROGRAM_ID,
        );
        owner2 = await Keypair.generate();
        account2 = await createAccount(
            connection,
            payer,
            mint,
            owner2.publicKey,
            undefined,
            undefined,
            TEST_PROGRAM_ID,
        );
        amount = BigInt(1000);
        await mintTo(connection, payer, mint, account1, mintAuthority, amount, [], undefined, TEST_PROGRAM_ID);
    });
    it('transfer', async () => {
        await transfer(connection, payer, account1, account2, owner1, amount, [], undefined, TEST_PROGRAM_ID);

        const destAccountInfo = await getAccount(connection, account2, undefined, TEST_PROGRAM_ID);
        expect(destAccountInfo.amount).toEqual(amount);

        const sourceAccountInfo = await getAccount(connection, account1, undefined, TEST_PROGRAM_ID);
        expect(sourceAccountInfo.amount).toEqual(BigInt(0));
    });
    it('transferChecked', async () => {
        const transferAmount = amount / BigInt(2);
        await transferChecked(
            connection,
            payer,
            account1,
            mint,
            account2,
            owner1,
            transferAmount,
            TEST_TOKEN_DECIMALS,
            [],
            undefined,
            TEST_PROGRAM_ID,
        );

        const destAccountInfo = await getAccount(connection, account2, undefined, TEST_PROGRAM_ID);
        expect(destAccountInfo.amount).toEqual(transferAmount);

        const sourceAccountInfo = await getAccount(connection, account1, undefined, TEST_PROGRAM_ID);
        expect(sourceAccountInfo.amount).toEqual(transferAmount);
        await expect(
            transferChecked(
                connection,
                payer,
                account1,
                mint,
                account2,
                owner1,
                transferAmount,
                TEST_TOKEN_DECIMALS - 1,
                [],
                undefined,
                TEST_PROGRAM_ID,
            ),
        ).rejects.toThrow(Error);
    });
    it('approveRevoke', async () => {
        const delegate = await Keypair.generate();
        const delegatedAmount = amount / BigInt(2);
        await approve(
            connection,
            payer,
            account1,
            delegate.publicKey,
            owner1,
            delegatedAmount,
            [],
            undefined,
            TEST_PROGRAM_ID,
        );
        const approvedAccountInfo = await getAccount(connection, account1, undefined, TEST_PROGRAM_ID);
        expect(approvedAccountInfo.delegatedAmount).toEqual(delegatedAmount);
        expect(approvedAccountInfo.delegate).toEqual(delegate.publicKey);
        await revoke(connection, payer, account1, owner1, [], undefined, TEST_PROGRAM_ID);
        const revokedAccountInfo = await getAccount(connection, account1, undefined, TEST_PROGRAM_ID);
        expect(revokedAccountInfo.delegatedAmount).toEqual(BigInt(0));
        expect(revokedAccountInfo.delegate).toBeNull();
    });
    it('delegateTransfer', async () => {
        const delegate = await Keypair.generate();
        const delegatedAmount = amount / BigInt(2);
        await approveChecked(
            connection,
            payer,
            mint,
            account1,
            delegate.publicKey,
            owner1,
            delegatedAmount,
            TEST_TOKEN_DECIMALS,
            [],
            undefined,
            TEST_PROGRAM_ID,
        );
        const transferAmount = delegatedAmount - BigInt(1);
        await transfer(connection, payer, account1, account2, delegate, transferAmount, [], undefined, TEST_PROGRAM_ID);
        const accountInfo = await getAccount(connection, account1, undefined, TEST_PROGRAM_ID);
        expect(accountInfo.delegatedAmount).toEqual(delegatedAmount - transferAmount);
        expect(accountInfo.delegate).toEqual(delegate.publicKey);
        await expect(
            transfer(connection, payer, account1, account2, delegate, BigInt(2), [], undefined, TEST_PROGRAM_ID),
        ).rejects.toThrow(Error);
    });
});
