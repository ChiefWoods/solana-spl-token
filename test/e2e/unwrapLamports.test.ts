import { beforeAll, describe, expect, it } from 'vitest';
import type { Address, Connection, Signer } from '@solana/web3.js';
import { Keypair } from '@solana/web3.js';
import {
    NATIVE_MINT,
    NATIVE_MINT_2022,
    TOKEN_PROGRAM_ID,
    createNativeMint,
    createWrappedNativeAccount,
    getAccount,
    unwrapLamports,
} from '../../src';
import { TEST_PROGRAM_ID, getConnection, newAccountWithLamports } from '../common';

describe('unwrapLamports', () => {
    let connection: Connection;
    let payer: Signer;
    let nativeMint: Address;

    beforeAll(async () => {
        connection = await getConnection();
        payer = await newAccountWithLamports(connection, 100_000_000_000);
        if (TEST_PROGRAM_ID.equals(TOKEN_PROGRAM_ID)) {
            nativeMint = NATIVE_MINT;
        } else {
            nativeMint = NATIVE_MINT_2022;
            if (!(await connection.getAccountInfo(nativeMint))) {
                await createNativeMint(connection, payer, undefined, nativeMint, TEST_PROGRAM_ID);
            }
        }
    });

    it('unwraps all excess lamports from a native token account', async () => {
        const owner = await Keypair.generate();
        const amount = 500_000_000;
        const source = await createWrappedNativeAccount(
            connection,
            payer,
            owner.publicKey,
            amount,
            undefined,
            undefined,
            TEST_PROGRAM_ID,
            nativeMint,
        );
        const destination = (await Keypair.generate()).publicKey;

        await unwrapLamports(connection, payer, source, destination, owner, null, [], undefined, TEST_PROGRAM_ID);

        expect(await connection.getBalance(destination)).toEqual(BigInt(amount));
        const sourceInfo = await getAccount(connection, source, undefined, TEST_PROGRAM_ID);
        expect(sourceInfo.amount).toEqual(0n);
        expect(await connection.getBalance(source)).toEqual(sourceInfo.rentExemptReserve);
    });
});
