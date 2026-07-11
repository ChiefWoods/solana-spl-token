import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Connection, Signer } from '@solana/web3.js';
import { Address } from '@solana/web3.js';
import { sendAndConfirmTransaction, Keypair, SystemProgram, Transaction } from '@solana/web3.js';
import {
    createAccount,
    createInitializeMintInstruction,
    createInitializeMintCloseAuthorityInstruction,
    closeAccount,
    mintTo,
    getMintLen,
    ExtensionType,
    AuthorityType,
    getMint,
    setAuthority,
    getMintCloseAuthority,
} from '../../src';
import { TEST_PROGRAM_ID, newAccountWithLamports, getConnection } from '../common';

const TEST_TOKEN_DECIMALS = 2;
const EXTENSIONS = [ExtensionType.MintCloseAuthority];
describe('closeMint', () => {
    let connection: Connection;
    let payer: Signer;
    let mint: Address;
    let mintAuthority: Keypair;
    let closeAuthority: Keypair;
    let account: Address;
    let destination: Address;
    beforeAll(async () => {
        connection = await getConnection();
        payer = await newAccountWithLamports(connection, 1000000000);
        mintAuthority = await Keypair.generate();
        closeAuthority = await Keypair.generate();
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
            createInitializeMintCloseAuthorityInstruction(mint, closeAuthority.publicKey, TEST_PROGRAM_ID),
            createInitializeMintInstruction(mint, TEST_TOKEN_DECIMALS, mintAuthority.publicKey, null, TEST_PROGRAM_ID),
        );

        await sendAndConfirmTransaction(connection, transaction, [payer, mintKeypair], undefined);
    });
    it('failsWithNonZeroAmount', async () => {
        const owner = await Keypair.generate();
        destination = (await Keypair.generate()).publicKey;
        account = await createAccount(connection, payer, mint, owner.publicKey, undefined, undefined, TEST_PROGRAM_ID);
        const amount = BigInt(1000);
        await mintTo(connection, payer, mint, account, mintAuthority, amount, [], undefined, TEST_PROGRAM_ID);
        await expect(
            closeAccount(connection, payer, mint, destination, closeAuthority, [], undefined, TEST_PROGRAM_ID),
        ).rejects.toThrow(Error);
    });
    it('works', async () => {
        destination = (await Keypair.generate()).publicKey;
        const accountInfo = await connection.getAccountInfo(mint);
        let rentExemptAmount;
        expect(accountInfo).not.toBeNull();
        if (accountInfo !== null) {
            rentExemptAmount = accountInfo.lamports;
        }

        await closeAccount(connection, payer, mint, destination, closeAuthority, [], undefined, TEST_PROGRAM_ID);

        const closedInfo = await connection.getAccountInfo(mint);
        expect(closedInfo).toBeNull();

        const destinationInfo = await connection.getAccountInfo(destination);
        expect(destinationInfo).not.toBeNull();
        if (destinationInfo !== null) {
            expect(destinationInfo.lamports).toEqual(rentExemptAmount);
        }
    });
    it('authority', async () => {
        await setAuthority(
            connection,
            payer,
            mint,
            closeAuthority,
            AuthorityType.CloseMint,
            null,
            [],
            undefined,
            TEST_PROGRAM_ID,
        );
        const mintInfo = await getMint(connection, mint, undefined, TEST_PROGRAM_ID);
        const mintCloseAuthority = getMintCloseAuthority(mintInfo);
        expect(mintCloseAuthority).not.toBeNull();
        if (mintCloseAuthority !== null) {
            expect(mintCloseAuthority.closeAuthority).toEqual(Address.default);
        }
    });
});
