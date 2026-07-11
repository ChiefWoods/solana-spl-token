import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Connection, Signer } from '@solana/web3.js';
import { Address, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';

import {
    AuthorityType,
    setAuthority,
    ExtensionType,
    createInitializeImmutableOwnerInstruction,
    createInitializeAccountInstruction,
    createMint,
    getAccountLen,
} from '../../src';

import { TEST_PROGRAM_ID, newAccountWithLamports, getConnection } from '../common';
const TEST_TOKEN_DECIMALS = 2;
const EXTENSIONS = [ExtensionType.ImmutableOwner];
describe('immutableOwner', () => {
    let connection: Connection;
    let payer: Signer;
    let owner: Keypair;
    let account: Address;
    let mint: Address;
    beforeAll(async () => {
        connection = await getConnection();
        payer = await newAccountWithLamports(connection, 1000000000);
    });
    beforeEach(async () => {
        const mintAuthority = await Keypair.generate();
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
        owner = await Keypair.generate();
        const accountLen = getAccountLen(EXTENSIONS);
        const lamports = await connection.getMinimumBalanceForRentExemption(accountLen);
        const accountKeypair = await Keypair.generate();
        account = accountKeypair.publicKey;
        const transaction = new Transaction().add(
            SystemProgram.createAccount({
                fromPubkey: new Address(payer.address),
                newAccountPubkey: account,
                space: accountLen,
                lamports,
                programId: TEST_PROGRAM_ID,
            }),
            createInitializeImmutableOwnerInstruction(account, TEST_PROGRAM_ID),
            createInitializeAccountInstruction(account, mint, owner.publicKey, TEST_PROGRAM_ID),
        );
        await sendAndConfirmTransaction(connection, transaction, [payer, accountKeypair], undefined);
    });
    it('AccountOwner', async () => {
        const newOwner = await Keypair.generate();
        await expect(
            setAuthority(
                connection,
                payer,
                account,
                newOwner,
                AuthorityType.AccountOwner,
                owner.publicKey,
                [],
                undefined,
                TEST_PROGRAM_ID,
            ),
        ).rejects.toThrow(Error);
    });
});
