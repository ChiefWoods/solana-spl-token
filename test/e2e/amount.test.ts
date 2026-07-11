import { beforeAll, describe, expect, it } from 'vitest';
import type { Connection, Address, Signer } from '@solana/web3.js';
import { Keypair } from '@solana/web3.js';
import { createMint, amountToUiAmount, uiAmountToAmount } from '../../src';
import { TEST_PROGRAM_ID, newAccountWithLamports, getConnection } from '../common';

const TEST_TOKEN_DECIMALS = 2;
describe('Amount', () => {
    let connection: Connection;
    let payer: Signer;
    let mint: Address;
    let mintAuthority: Keypair;
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
    it('amountToUiAmount', async () => {
        const amount = BigInt(5245);
        const uiAmount = await amountToUiAmount(connection, payer, mint, amount, TEST_PROGRAM_ID);
        expect(uiAmount).toEqual('52.45');
    });
    it('uiAmountToAmount', async () => {
        const uiAmount = await uiAmountToAmount(connection, payer, mint, '52.45', TEST_PROGRAM_ID);
        expect(uiAmount).toEqual(BigInt(5245));
    });
});
