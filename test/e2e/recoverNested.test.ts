import type { Connection, Signer } from '@solana/web3.js';

import { Address, Keypair, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { expect } from 'chai';

import {
    ASSOCIATED_TOKEN_PROGRAM_ID,
    createMint,
    getAccount,
    createAssociatedTokenAccount,
    createAssociatedTokenAccountInstruction,
    getAssociatedTokenAddress,
    mintTo,
    recoverNested,
} from '../../src';

import { TEST_PROGRAM_ID, newAccountWithLamports, getConnection } from '../common';

describe('recoverNested', () => {
    let connection: Connection;
    let payer: Signer;
    let owner: Signer;
    let mint: Address;
    let associatedToken: Address;
    let nestedMint: Address;
    const nestedMintAmount = 1;
    let nestedAssociatedToken: Address;
    before(async () => {
        connection = await getConnection();
        payer = await newAccountWithLamports(connection, 10000000000);
        owner = await Keypair.generate();

        // mint
        const mintAuthority = await Keypair.generate();
        const mintKeypair = await Keypair.generate();
        mint = await createMint(
            connection,
            payer,
            mintAuthority.publicKey,
            mintAuthority.publicKey,
            0,
            mintKeypair,
            undefined,
            TEST_PROGRAM_ID,
        );

        associatedToken = await createAssociatedTokenAccount(
            connection,
            payer,
            mint,
            new Address(owner.address),
            undefined,
            TEST_PROGRAM_ID,
        );

        // nested mint
        const nestedMintAuthority = await Keypair.generate();
        const nestedMintKeypair = await Keypair.generate();
        nestedMint = await createMint(
            connection,
            payer,
            nestedMintAuthority.publicKey,
            nestedMintAuthority.publicKey,
            0,
            nestedMintKeypair,
            undefined,
            TEST_PROGRAM_ID,
        );

        nestedAssociatedToken = await getAssociatedTokenAddress(
            nestedMint,
            associatedToken,
            true,
            TEST_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID,
        );
        const transaction = new Transaction().add(
            createAssociatedTokenAccountInstruction(
                new Address(payer.address),
                nestedAssociatedToken,
                associatedToken,
                nestedMint,
                TEST_PROGRAM_ID,
                ASSOCIATED_TOKEN_PROGRAM_ID,
            ),
        );
        await sendAndConfirmTransaction(connection, transaction, [payer], undefined);

        // use mintTo to make nestedAssociatedToken have some tokens
        await mintTo(
            connection,
            payer,
            nestedMint,
            nestedAssociatedToken,
            nestedMintAuthority,
            nestedMintAmount,
            undefined,
            undefined,
            TEST_PROGRAM_ID,
        );
    });
    it('success', async () => {
        // create destination associated token
        const destinationAssociatedToken = await createAssociatedTokenAccount(
            connection,
            payer,
            nestedMint,
            new Address(owner.address),
            undefined,
            TEST_PROGRAM_ID,
        );

        await recoverNested(connection, payer, owner, mint, nestedMint, undefined, TEST_PROGRAM_ID);

        expect(await connection.getAccountInfo(nestedAssociatedToken)).to.equal(null);

        const accountInfo = await getAccount(connection, destinationAssociatedToken, undefined, TEST_PROGRAM_ID);
        expect(accountInfo).to.not.equal(null);
        expect(accountInfo.mint).to.eql(nestedMint);
        expect(accountInfo.owner).to.eql(new Address(owner.address));
        expect(accountInfo.amount).to.eql(BigInt(nestedMintAmount));
    });
});
