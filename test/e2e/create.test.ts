import { beforeAll, describe, expect, it } from 'vitest';
import type { Connection, Address, Signer } from '@solana/web3.js';
import { Keypair } from '@solana/web3.js';

import {
    ASSOCIATED_TOKEN_PROGRAM_ID,
    createMint,
    getMint,
    createAccount,
    createAssociatedTokenAccountIdempotent,
    getAccount,
    getAssociatedTokenAddress,
    getOrCreateAssociatedTokenAccount,
} from '../../src';

import { TEST_PROGRAM_ID, newAccountWithLamports, getConnection } from '../common';

const TEST_TOKEN_DECIMALS = 2;
describe('createMint', () => {
    it('works', async () => {
        const connection = await getConnection();
        const payer = await newAccountWithLamports(connection, 1000000000);
        const testMintAuthority = await Keypair.generate();
        const mintKeypair = await Keypair.generate();
        const mint = await createMint(
            connection,
            payer,
            testMintAuthority.publicKey,
            testMintAuthority.publicKey,
            TEST_TOKEN_DECIMALS,
            mintKeypair,
            undefined,
            TEST_PROGRAM_ID,
        );

        const mintInfo = await getMint(connection, mint, undefined, TEST_PROGRAM_ID);

        expect(mintInfo.mintAuthority).toEqual(testMintAuthority.publicKey);
        expect(mintInfo.supply).toEqual(BigInt(0));
        expect(mintInfo.decimals).toEqual(TEST_TOKEN_DECIMALS);
        expect(mintInfo.isInitialized).toBe(true);
        expect(mintInfo.freezeAuthority).toEqual(testMintAuthority.publicKey);
    });
});

describe('createAccount', () => {
    let connection: Connection;
    let payer: Signer;
    let mint: Address;
    beforeAll(async () => {
        connection = await getConnection();
        payer = await newAccountWithLamports(connection, 1000000000);
        const mintAuthority = await Keypair.generate();
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
    it('auxiliary token account', async () => {
        const owner = await Keypair.generate();
        const account = await createAccount(
            connection,
            payer,
            mint,
            owner.publicKey,
            await Keypair.generate(),
            undefined,
            TEST_PROGRAM_ID,
        );
        const accountInfo = await getAccount(connection, account, undefined, TEST_PROGRAM_ID);
        expect(accountInfo.mint).toEqual(mint);
        expect(accountInfo.owner).toEqual(owner.publicKey);
        expect(accountInfo.amount).toEqual(BigInt(0));
        expect(accountInfo.delegate).toBeNull();
        expect(accountInfo.delegatedAmount).toEqual(BigInt(0));
        expect(accountInfo.isInitialized).toBe(true);
        expect(accountInfo.isFrozen).toBe(false);
        expect(accountInfo.isNative).toBe(false);
        expect(accountInfo.rentExemptReserve).toBeNull();
        expect(accountInfo.closeAuthority).toBeNull();

        // you can create as many accounts as with same owner
        const account2 = await createAccount(
            connection,
            payer,
            mint,
            owner.publicKey,
            await Keypair.generate(),
            undefined,
            TEST_PROGRAM_ID,
        );
        expect(account2).to.not.eql(account);
    });
    it('creates associated token account if it does not exist', async () => {
        const owner = await Keypair.generate();
        const associatedAddress = await getAssociatedTokenAddress(
            mint,
            owner.publicKey,
            false,
            TEST_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID,
        );

        // associated account shouldn't exist
        const info = await connection.getAccountInfo(associatedAddress);
        expect(info).toBeNull();

        const createdAccountInfo = await getOrCreateAssociatedTokenAccount(
            connection,
            payer,
            mint,
            owner.publicKey,
            false,
            undefined,
            undefined,
            TEST_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID,
        );
        expect(createdAccountInfo.mint).toEqual(mint);
        expect(createdAccountInfo.owner).toEqual(owner.publicKey);
        expect(createdAccountInfo.amount).toEqual(BigInt(0));
        expect(createdAccountInfo.delegate).toBeNull();
        expect(createdAccountInfo.delegatedAmount).toEqual(BigInt(0));
        expect(createdAccountInfo.isInitialized).toBe(true);
        expect(createdAccountInfo.isFrozen).toBe(false);
        expect(createdAccountInfo.isNative).toBe(false);
        expect(createdAccountInfo.rentExemptReserve).toBeNull();
        expect(createdAccountInfo.closeAuthority).toBeNull();

        // do it again, just gives the account info
        const accountInfo = await getOrCreateAssociatedTokenAccount(
            connection,
            payer,
            mint,
            owner.publicKey,
            false,
            undefined,
            undefined,
            TEST_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID,
        );

        expect(createdAccountInfo).toEqual(accountInfo);
    });
    it('associated token account', async () => {
        const owner = await Keypair.generate();
        const associatedAddress = await getAssociatedTokenAddress(
            mint,
            owner.publicKey,
            false,
            TEST_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID,
        );

        // associated account shouldn't exist
        const info = await connection.getAccountInfo(associatedAddress);
        expect(info).toBeNull();

        const createdAddress = await createAccount(
            connection,
            payer,
            mint,
            owner.publicKey,
            undefined, // uses ATA by default
            undefined,
            TEST_PROGRAM_ID,
        );
        expect(createdAddress).toEqual(associatedAddress);

        const accountInfo = await getAccount(connection, associatedAddress, undefined, TEST_PROGRAM_ID);
        expect(accountInfo).not.toBeNull();
        expect(accountInfo.mint).toEqual(mint);
        expect(accountInfo.owner).toEqual(owner.publicKey);
        expect(accountInfo.amount).toEqual(BigInt(0));

        // creating again should cause TX error for the associated token account
        await expect(
            createAccount(
                connection,
                payer,
                mint,
                owner.publicKey,
                undefined, // uses ATA by default
                undefined,
                TEST_PROGRAM_ID,
            ),
        ).rejects.toThrow(Error);

        // when creating again but with idempotent mode, TX should not throw error
        await expect(
            createAssociatedTokenAccountIdempotent(
                connection,
                payer,
                mint,
                owner.publicKey,
                undefined,
                TEST_PROGRAM_ID,
            ),
        ).resolves.toBeDefined();
    });
});
