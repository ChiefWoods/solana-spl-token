import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Connection, Signer } from '@solana/web3.js';
import { Address, sendAndConfirmTransaction, Keypair, SystemProgram, Transaction } from '@solana/web3.js';
import {
    createInitializeMintInstruction,
    createInitializeNonTransferableMintInstruction,
    createInitializeImmutableOwnerInstruction,
    createInitializeAccountInstruction,
    mintTo,
    getAccountLen,
    getMint,
    getMintLen,
    getNonTransferable,
    transfer,
    ExtensionType,
} from '../../src';
import { TEST_PROGRAM_ID, newAccountWithLamports, getConnection } from '../common';

const TEST_TOKEN_DECIMALS = 2;
const EXTENSIONS = [ExtensionType.NonTransferable];
describe('nonTransferable', () => {
    let connection: Connection;
    let payer: Signer;
    let mint: Address;
    let mintAuthority: Keypair;
    beforeAll(async () => {
        connection = await getConnection();
        payer = await newAccountWithLamports(connection, 1000000000);
        mintAuthority = await Keypair.generate();
    });
    beforeEach(async () => {
        const mintKeypair = await Keypair.generate();
        mint = mintKeypair.publicKey;
        const mintLen = getMintLen(EXTENSIONS);
        const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

        const transaction = new Transaction().add(
            SystemProgram.createAccount({
                fromPubkey: new Address(payer.address),
                newAccountPubkey: mint,
                space: mintLen,
                lamports,
                programId: TEST_PROGRAM_ID,
            }),
            createInitializeNonTransferableMintInstruction(mint, TEST_PROGRAM_ID),
            createInitializeMintInstruction(mint, TEST_TOKEN_DECIMALS, mintAuthority.publicKey, null, TEST_PROGRAM_ID),
        );

        await sendAndConfirmTransaction(connection, transaction, [payer, mintKeypair], undefined);
    });
    it('fails transfer', async () => {
        const mintInfo = await getMint(connection, mint, undefined, TEST_PROGRAM_ID);
        const nonTransferable = getNonTransferable(mintInfo);
        expect(nonTransferable).not.toBeNull();

        const owner = await Keypair.generate();
        const accountLen = getAccountLen([ExtensionType.ImmutableOwner, ExtensionType.NonTransferableAccount]);
        const lamports = await connection.getMinimumBalanceForRentExemption(accountLen);

        const sourceKeypair = await Keypair.generate();
        const source = sourceKeypair.publicKey;
        let transaction = new Transaction().add(
            SystemProgram.createAccount({
                fromPubkey: new Address(payer.address),
                newAccountPubkey: source,
                space: accountLen,
                lamports,
                programId: TEST_PROGRAM_ID,
            }),
            createInitializeImmutableOwnerInstruction(source, TEST_PROGRAM_ID),
            createInitializeAccountInstruction(source, mint, owner.publicKey, TEST_PROGRAM_ID),
        );
        await sendAndConfirmTransaction(connection, transaction, [payer, sourceKeypair], undefined);

        const destinationKeypair = await Keypair.generate();
        const destination = destinationKeypair.publicKey;
        transaction = new Transaction().add(
            SystemProgram.createAccount({
                fromPubkey: new Address(payer.address),
                newAccountPubkey: destination,
                space: accountLen,
                lamports,
                programId: TEST_PROGRAM_ID,
            }),
            createInitializeImmutableOwnerInstruction(destination, TEST_PROGRAM_ID),
            createInitializeAccountInstruction(destination, mint, owner.publicKey, TEST_PROGRAM_ID),
        );
        await sendAndConfirmTransaction(connection, transaction, [payer, destinationKeypair], undefined);

        const amount = BigInt(1000);
        await mintTo(connection, payer, mint, source, mintAuthority, amount, [], undefined, TEST_PROGRAM_ID);

        await expect(
            transfer(connection, payer, source, destination, owner, amount, [], undefined, TEST_PROGRAM_ID),
        ).rejects.toThrow(Error);
    });
});
