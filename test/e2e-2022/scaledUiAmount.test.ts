import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Connection, Signer } from '@solana/web3.js';
import { Address } from '@solana/web3.js';
import { Keypair, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { TEST_PROGRAM_ID, newAccountWithLamports, getConnection } from '../common';

import {
    ExtensionType,
    createInitializeMintInstruction,
    createInitializeScaledUiAmountConfigInstruction,
    getMint,
    getMintLen,
    getScaledUiAmountConfig,
    updateMultiplier,
    setAuthority,
    AuthorityType,
} from '../../src';

const TEST_TOKEN_DECIMALS = 2;
const MINT_EXTENSIONS = [ExtensionType.ScaledUiAmountConfig];

describe('scaledUiAmount', () => {
    let connection: Connection;
    let payer: Signer;
    let owner: Keypair;
    let mint: Address;
    let mintAuthority: Keypair;
    let multiplier: number;
    beforeAll(async () => {
        connection = await getConnection();
        payer = await newAccountWithLamports(connection, 1000000000);
        owner = await Keypair.generate();
        multiplier = 5.0;
    });

    beforeEach(async () => {
        const mintKeypair = await Keypair.generate();
        mint = mintKeypair.publicKey;
        mintAuthority = await Keypair.generate();
        const mintLen = getMintLen(MINT_EXTENSIONS);
        const mintLamports = await connection.getMinimumBalanceForRentExemption(mintLen);
        const mintTransaction = new Transaction().add(
            SystemProgram.createAccount({
                fromPubkey: new Address(payer.address),
                newAccountPubkey: mint,
                space: mintLen,
                lamports: mintLamports,
                programId: TEST_PROGRAM_ID,
            }),
            createInitializeScaledUiAmountConfigInstruction(mint, owner.publicKey, multiplier, TEST_PROGRAM_ID),
            createInitializeMintInstruction(mint, TEST_TOKEN_DECIMALS, mintAuthority.publicKey, null, TEST_PROGRAM_ID),
        );
        await sendAndConfirmTransaction(connection, mintTransaction, [payer, mintKeypair], undefined);
    });

    it('initialize mint', async () => {
        const mintInfo = await getMint(connection, mint, undefined, TEST_PROGRAM_ID);
        const scaledUiAmountConfig = getScaledUiAmountConfig(mintInfo);
        expect(scaledUiAmountConfig).not.toBeNull();
        if (scaledUiAmountConfig !== null) {
            expect(scaledUiAmountConfig.authority).toEqual(owner.publicKey);
            expect(scaledUiAmountConfig.multiplier).toEqual(multiplier);
        }
    });

    it('update authority', async () => {
        await setAuthority(
            connection,
            payer,
            mint,
            owner,
            AuthorityType.ScaledUiAmountConfig,
            null,
            [],
            undefined,
            TEST_PROGRAM_ID,
        );
        const mintInfo = await getMint(connection, mint, undefined, TEST_PROGRAM_ID);
        const scaledUiAmountConfig = getScaledUiAmountConfig(mintInfo);
        expect(scaledUiAmountConfig).not.toBeNull();
        if (scaledUiAmountConfig !== null) {
            expect(scaledUiAmountConfig.authority).toEqual(Address.default);
        }
    });

    it('update multiplier', async () => {
        const newMultiplier = 10.0;
        const effectiveTimestamp = BigInt(1000);

        await updateMultiplier(
            connection,
            payer,
            mint,
            owner,
            newMultiplier,
            effectiveTimestamp,
            [],
            undefined,
            TEST_PROGRAM_ID,
        );
        const mintInfo = await getMint(connection, mint, undefined, TEST_PROGRAM_ID);
        const scaledUiAmountConfig = getScaledUiAmountConfig(mintInfo);
        expect(scaledUiAmountConfig).not.toBeNull();
        if (scaledUiAmountConfig !== null) {
            expect(scaledUiAmountConfig.multiplier).toEqual(newMultiplier);
            expect(scaledUiAmountConfig.newMultiplierEffectiveTimestamp).toEqual(effectiveTimestamp);
            expect(scaledUiAmountConfig.newMultiplier).toEqual(newMultiplier);
        }
    });
});
