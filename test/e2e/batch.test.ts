import { beforeAll, describe, expect, it } from 'vitest';
import type { Connection, Signer } from '@solana/web3.js';
import { Keypair } from '@solana/web3.js';
import { batch, createAccount, createMint, createTransferInstruction, getAccount, mintTo } from '../../src';
import { TEST_PROGRAM_ID, getConnection, newAccountWithLamports } from '../common';

const TEST_TOKEN_DECIMALS = 2;

describe('batch', () => {
    let connection: Connection;
    let payer: Signer;

    beforeAll(async () => {
        connection = await getConnection();
        payer = await newAccountWithLamports(connection, 100_000_000_000);
    });

    it('executes multiple token transfers', async () => {
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
        const destinationA = await createAccount(
            connection,
            payer,
            mint,
            (await Keypair.generate()).publicKey,
            undefined,
            undefined,
            TEST_PROGRAM_ID,
        );
        const destinationB = await createAccount(
            connection,
            payer,
            mint,
            (await Keypair.generate()).publicKey,
            undefined,
            undefined,
            TEST_PROGRAM_ID,
        );
        const amount = 1_000n;
        const transferA = 123n;
        const transferB = 456n;

        await mintTo(connection, payer, mint, source, mintAuthority, amount, [], undefined, TEST_PROGRAM_ID);

        await batch(
            connection,
            payer,
            [
                createTransferInstruction(source, destinationA, owner.publicKey, transferA, [], TEST_PROGRAM_ID),
                createTransferInstruction(source, destinationB, owner.publicKey, transferB, [], TEST_PROGRAM_ID),
            ],
            [owner],
            undefined,
            TEST_PROGRAM_ID,
        );

        expect((await getAccount(connection, source, undefined, TEST_PROGRAM_ID)).amount).toEqual(
            amount - transferA - transferB,
        );
        expect((await getAccount(connection, destinationA, undefined, TEST_PROGRAM_ID)).amount).toEqual(transferA);
        expect((await getAccount(connection, destinationB, undefined, TEST_PROGRAM_ID)).amount).toEqual(transferB);
    });
});
