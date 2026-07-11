import { beforeAll, describe, expect, it } from 'vitest';
import type { Connection, Signer } from '@solana/web3.js';
import { Address, Keypair, sendAndConfirmTransaction, SystemProgram, Transaction } from '@solana/web3.js';
import { createAccount, createMint, getAccount, getMint, withdrawExcessLamports } from '../../src';
import { TEST_PROGRAM_ID, getConnection, newAccountWithLamports } from '../common';

const TEST_TOKEN_DECIMALS = 2;

describe('withdrawExcessLamports', () => {
    let connection: Connection;
    let payer: Signer;

    beforeAll(async () => {
        connection = await getConnection();
        payer = await newAccountWithLamports(connection, 100_000_000_000);
    });

    it('withdraws excess lamports from a mint account', async () => {
        const mintAuthority = await Keypair.generate();
        const mint = await createMint(
            connection,
            payer,
            mintAuthority.publicKey,
            null,
            TEST_TOKEN_DECIMALS,
            undefined,
            undefined,
            TEST_PROGRAM_ID,
        );
        const mintRent = await connection.getBalance(mint);
        const excessLamports = 12345n;
        const destination = await newAccountWithLamports(connection);
        const destinationAddress = new Address(destination.address);
        const destinationBalance = await connection.getBalance(destinationAddress);

        await sendAndConfirmTransaction(
            connection,
            new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: new Address(payer.address),
                    toPubkey: mint,
                    lamports: excessLamports,
                }),
            ),
            [payer],
        );

        expect(await connection.getBalance(mint)).toEqual(mintRent + excessLamports);

        await withdrawExcessLamports(
            connection,
            payer,
            mint,
            destinationAddress,
            mintAuthority,
            [],
            undefined,
            TEST_PROGRAM_ID,
        );

        expect(await connection.getBalance(mint)).toEqual(mintRent);
        expect(await connection.getBalance(destinationAddress)).toEqual(destinationBalance + excessLamports);
        await expect(getMint(connection, mint, undefined, TEST_PROGRAM_ID)).resolves.toBeDefined();
    });

    it('withdraws excess lamports from a token account', async () => {
        const mintAuthority = await Keypair.generate();
        const mint = await createMint(
            connection,
            payer,
            mintAuthority.publicKey,
            null,
            TEST_TOKEN_DECIMALS,
            undefined,
            undefined,
            TEST_PROGRAM_ID,
        );
        const owner = await Keypair.generate();
        const source = await createAccount(
            connection,
            payer,
            mint,
            owner.publicKey,
            undefined,
            undefined,
            TEST_PROGRAM_ID,
        );
        const sourceRent = await connection.getBalance(source);
        const excessLamports = 12345n;
        const destination = await newAccountWithLamports(connection);
        const destinationAddress = new Address(destination.address);
        const destinationBalance = await connection.getBalance(destinationAddress);

        await sendAndConfirmTransaction(
            connection,
            new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: new Address(payer.address),
                    toPubkey: source,
                    lamports: excessLamports,
                }),
            ),
            [payer],
        );

        expect(await connection.getBalance(source)).toEqual(sourceRent + excessLamports);

        await withdrawExcessLamports(
            connection,
            payer,
            source,
            destinationAddress,
            owner,
            [],
            undefined,
            TEST_PROGRAM_ID,
        );

        expect(await connection.getBalance(source)).toEqual(sourceRent);
        expect(await connection.getBalance(destinationAddress)).toEqual(destinationBalance + excessLamports);
        await expect(getAccount(connection, source, undefined, TEST_PROGRAM_ID)).resolves.toBeDefined();
    });
});
