import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Connection, Address, Signer } from '@solana/web3.js';
import { Keypair } from '@solana/web3.js';
import { createMint, createAccount, closeAccount, mintTo } from '../../src';
import { TEST_PROGRAM_ID, newAccountWithLamports, getConnection } from '../common';

const TEST_TOKEN_DECIMALS = 2;
describe('close', () => {
    let connection: Connection;
    let payer: Signer;
    let mint: Address;
    let mintAuthority: Keypair;
    let freezeAuthority: Keypair;
    let owner: Keypair;
    let account: Address;
    let destination: Address;
    beforeAll(async () => {
        connection = await getConnection();
        payer = await newAccountWithLamports(connection, 1000000000);
        mintAuthority = await Keypair.generate();
        freezeAuthority = await Keypair.generate();
        const mintKeypair = await Keypair.generate();
        mint = await createMint(
            connection,
            payer,
            mintAuthority.publicKey,
            freezeAuthority.publicKey,
            TEST_TOKEN_DECIMALS,
            mintKeypair,
            undefined,
            TEST_PROGRAM_ID,
        );
    });
    beforeEach(async () => {
        owner = await Keypair.generate();
        destination = (await Keypair.generate()).publicKey;
        account = await createAccount(connection, payer, mint, owner.publicKey, undefined, undefined, TEST_PROGRAM_ID);
    });
    it('failsWithNonZeroAmount', async () => {
        const amount = BigInt(1000);
        await mintTo(connection, payer, mint, account, mintAuthority, amount, [], undefined, TEST_PROGRAM_ID);
        await expect(
            closeAccount(connection, payer, account, destination, owner, [], undefined, TEST_PROGRAM_ID),
        ).rejects.toThrow(Error);
    });
    it('works', async () => {
        const accountInfo = await connection.getAccountInfo(account);
        let tokenRentExemptAmount;
        expect(accountInfo).not.toBeNull();
        if (accountInfo !== null) {
            tokenRentExemptAmount = accountInfo.lamports;
        }

        await closeAccount(connection, payer, account, destination, owner, [], undefined, TEST_PROGRAM_ID);

        const closedInfo = await connection.getAccountInfo(account);
        expect(closedInfo).toBeNull();

        const destinationInfo = await connection.getAccountInfo(destination);
        expect(destinationInfo).not.toBeNull();
        if (destinationInfo !== null) {
            expect(destinationInfo.lamports).toEqual(tokenRentExemptAmount);
        }
    });
});
