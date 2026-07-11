import { beforeEach, describe, expect, it } from 'vitest';
import type { Connection, Signer } from '@solana/web3.js';
import { Address, Transaction, SystemProgram, Keypair, sendAndConfirmTransaction } from '@solana/web3.js';
import {
    getMinimumBalanceForRentExemptMint,
    MINT_SIZE,
    createInitializeMint2Instruction,
    getMint,
    createInitializeMintInstruction,
} from '../../src';
import { TEST_PROGRAM_ID, newAccountWithLamports, getConnection } from '../common';

const TEST_TOKEN_DECIMALS = 2;

describe('initialize mint', () => {
    let connection: Connection;
    let payer: Signer;
    let mintKeypair: Keypair;
    let lamports: number;
    beforeEach(async () => {
        connection = await getConnection();
        payer = await newAccountWithLamports(connection, 1000000000);
        mintKeypair = await Keypair.generate();
        lamports = await getMinimumBalanceForRentExemptMint(connection);
    });
    it('works', async () => {
        const mintAuthority = (await Keypair.generate()).publicKey;
        const freezeAuthority = (await Keypair.generate()).publicKey;
        const transaction = new Transaction().add(
            SystemProgram.createAccount({
                fromPubkey: new Address(payer.address),
                newAccountPubkey: mintKeypair.publicKey,
                space: MINT_SIZE,
                lamports,
                programId: TEST_PROGRAM_ID,
            }),
            createInitializeMintInstruction(
                mintKeypair.publicKey,
                TEST_TOKEN_DECIMALS,
                mintAuthority,
                freezeAuthority,
                TEST_PROGRAM_ID,
            ),
        );
        await sendAndConfirmTransaction(connection, transaction, [payer, mintKeypair]);
        const mintInfo = await getMint(connection, mintKeypair.publicKey, undefined, TEST_PROGRAM_ID);
        expect(mintInfo.mintAuthority).toEqual(mintAuthority);
        expect(mintInfo.supply).toEqual(BigInt(0));
        expect(mintInfo.decimals).toEqual(TEST_TOKEN_DECIMALS);
        expect(mintInfo.isInitialized).toBe(true);
        expect(mintInfo.freezeAuthority).toEqual(freezeAuthority);
    });
    it('works with null freeze authority', async () => {
        const mintAuthority = (await Keypair.generate()).publicKey;
        const transaction = new Transaction().add(
            SystemProgram.createAccount({
                fromPubkey: new Address(payer.address),
                newAccountPubkey: mintKeypair.publicKey,
                space: MINT_SIZE,
                lamports,
                programId: TEST_PROGRAM_ID,
            }),
            createInitializeMintInstruction(
                mintKeypair.publicKey,
                TEST_TOKEN_DECIMALS,
                mintAuthority,
                null,
                TEST_PROGRAM_ID,
            ),
        );
        await sendAndConfirmTransaction(connection, transaction, [payer, mintKeypair]);
        const mintInfo = await getMint(connection, mintKeypair.publicKey, undefined, TEST_PROGRAM_ID);
        expect(mintInfo.mintAuthority).toEqual(mintAuthority);
        expect(mintInfo.supply).toEqual(BigInt(0));
        expect(mintInfo.decimals).toEqual(TEST_TOKEN_DECIMALS);
        expect(mintInfo.isInitialized).toBe(true);
        expect(mintInfo.freezeAuthority).toBeNull();
    });
});
describe('initialize mint 2', () => {
    let connection: Connection;
    let payer: Signer;
    let mintKeypair: Keypair;
    let lamports: number;
    beforeEach(async () => {
        connection = await getConnection();
        payer = await newAccountWithLamports(connection, 1000000000);
        mintKeypair = await Keypair.generate();
        lamports = await getMinimumBalanceForRentExemptMint(connection);
    });
    it('works', async () => {
        const mintAuthority = (await Keypair.generate()).publicKey;
        const freezeAuthority = (await Keypair.generate()).publicKey;
        const transaction = new Transaction().add(
            SystemProgram.createAccount({
                fromPubkey: new Address(payer.address),
                newAccountPubkey: mintKeypair.publicKey,
                space: MINT_SIZE,
                lamports,
                programId: TEST_PROGRAM_ID,
            }),
            createInitializeMint2Instruction(
                mintKeypair.publicKey,
                TEST_TOKEN_DECIMALS,
                mintAuthority,
                freezeAuthority,
                TEST_PROGRAM_ID,
            ),
        );
        await sendAndConfirmTransaction(connection, transaction, [payer, mintKeypair]);
        const mintInfo = await getMint(connection, mintKeypair.publicKey, undefined, TEST_PROGRAM_ID);
        expect(mintInfo.mintAuthority).toEqual(mintAuthority);
        expect(mintInfo.supply).toEqual(BigInt(0));
        expect(mintInfo.decimals).toEqual(TEST_TOKEN_DECIMALS);
        expect(mintInfo.isInitialized).toBe(true);
        expect(mintInfo.freezeAuthority).toEqual(freezeAuthority);
    });
    it('works with null freeze authority', async () => {
        const mintAuthority = (await Keypair.generate()).publicKey;
        const transaction = new Transaction().add(
            SystemProgram.createAccount({
                fromPubkey: new Address(payer.address),
                newAccountPubkey: mintKeypair.publicKey,
                space: MINT_SIZE,
                lamports,
                programId: TEST_PROGRAM_ID,
            }),
            createInitializeMint2Instruction(
                mintKeypair.publicKey,
                TEST_TOKEN_DECIMALS,
                mintAuthority,
                null,
                TEST_PROGRAM_ID,
            ),
        );
        await sendAndConfirmTransaction(connection, transaction, [payer, mintKeypair]);
        const mintInfo = await getMint(connection, mintKeypair.publicKey, undefined, TEST_PROGRAM_ID);
        expect(mintInfo.mintAuthority).toEqual(mintAuthority);
        expect(mintInfo.supply).toEqual(BigInt(0));
        expect(mintInfo.decimals).toEqual(TEST_TOKEN_DECIMALS);
        expect(mintInfo.isInitialized).toBe(true);
        expect(mintInfo.freezeAuthority).toBeNull();
    });
});
