import { beforeAll, describe, expect, it } from 'vitest';
import type { Connection, Signer } from '@solana/web3.js';
import { Address } from '@solana/web3.js';
import { Keypair } from '@solana/web3.js';
import {
    AuthorityType,
    createInterestBearingMint,
    getInterestBearingMintConfigState,
    getMint,
    setAuthority,
    updateRateInterestBearingMint,
} from '../../src';
import { getConnection, newAccountWithLamports, TEST_PROGRAM_ID } from '../common';

const TEST_TOKEN_DECIMALS = 2;
const TEST_RATE = 10;
const TEST_UPDATE_RATE = 50;

describe('interestBearingMint', () => {
    let connection: Connection;
    let payer: Signer;
    let mint: Address;
    let rateAuthority: Keypair;
    let mintAuthority: Keypair;
    let freezeAuthority: Keypair;
    let mintKeypair: Keypair;

    beforeAll(async () => {
        connection = await getConnection();
        payer = await newAccountWithLamports(connection, 1000000000);
        rateAuthority = await Keypair.generate();
        mintAuthority = await Keypair.generate();
        freezeAuthority = await Keypair.generate();
    });

    it('initialize and update rate', async () => {
        mintKeypair = await Keypair.generate();
        mint = mintKeypair.publicKey;
        await createInterestBearingMint(
            connection,
            payer,
            mintAuthority.publicKey,
            freezeAuthority.publicKey,
            rateAuthority.publicKey,
            TEST_RATE,
            TEST_TOKEN_DECIMALS,
            mintKeypair,
            undefined,
            TEST_PROGRAM_ID,
        );
        const mintInfo = await getMint(connection, mint, undefined, TEST_PROGRAM_ID);
        const interestBearingMintConfigState = getInterestBearingMintConfigState(mintInfo);
        expect(interestBearingMintConfigState).not.toBeNull();
        if (interestBearingMintConfigState !== null) {
            expect(interestBearingMintConfigState.rateAuthority).toEqual(rateAuthority.publicKey);
            expect(interestBearingMintConfigState.preUpdateAverageRate).toEqual(TEST_RATE);
            expect(interestBearingMintConfigState.currentRate).toEqual(TEST_RATE);
            expect(interestBearingMintConfigState.lastUpdateTimestamp).toBeGreaterThan(0);
            expect(interestBearingMintConfigState.initializationTimestamp).toBeGreaterThan(0);
        }

        await updateRateInterestBearingMint(
            connection,
            payer,
            mint,
            rateAuthority,
            TEST_UPDATE_RATE,
            [],
            undefined,
            TEST_PROGRAM_ID,
        );
        const mintInfoUpdatedRate = await getMint(connection, mint, undefined, TEST_PROGRAM_ID);
        const updatedRateConfigState = getInterestBearingMintConfigState(mintInfoUpdatedRate);

        expect(updatedRateConfigState).not.toBeNull();
        if (updatedRateConfigState !== null) {
            expect(updatedRateConfigState.rateAuthority).toEqual(rateAuthority.publicKey);
            expect(updatedRateConfigState.currentRate).toEqual(TEST_UPDATE_RATE);
            expect(updatedRateConfigState.preUpdateAverageRate).toEqual(TEST_RATE);
            expect(updatedRateConfigState.lastUpdateTimestamp).toBeGreaterThan(0);
            expect(updatedRateConfigState.initializationTimestamp).toBeGreaterThan(0);
        }
    });
    it('authority', async () => {
        await setAuthority(
            connection,
            payer,
            mint,
            rateAuthority,
            AuthorityType.InterestRate,
            null,
            [],
            undefined,
            TEST_PROGRAM_ID,
        );
        const mintInfo = await getMint(connection, mint, undefined, TEST_PROGRAM_ID);
        const rateConfigState = getInterestBearingMintConfigState(mintInfo);
        expect(rateConfigState).not.toBeNull();
        if (rateConfigState !== null) {
            expect(rateConfigState.rateAuthority).toEqual(Address.default);
        }
    });
});
