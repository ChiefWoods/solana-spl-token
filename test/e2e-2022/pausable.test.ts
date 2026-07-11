import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Connection, Signer } from '@solana/web3.js';
import { Address } from '@solana/web3.js';
import { Keypair, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { TEST_PROGRAM_ID, newAccountWithLamports, getConnection } from '../common';

import {
    ExtensionType,
    createInitializeMintInstruction,
    createAccount,
    getAccount,
    getMint,
    getMintLen,
    getPausableConfig,
    pause,
    resume,
    setAuthority,
    AuthorityType,
} from '../../src';

import { createInitializePausableConfigInstruction, getPausableAccount } from '../../src/extensions/pausable/index';

const TEST_TOKEN_DECIMALS = 2;
const MINT_EXTENSIONS = [ExtensionType.PausableConfig];

describe('pausable', () => {
    let connection: Connection;
    let payer: Signer;
    let owner: Keypair;
    let mint: Address;
    let mintAuthority: Keypair;
    beforeAll(async () => {
        connection = await getConnection();
        payer = await newAccountWithLamports(connection, 1000000000);
        owner = await Keypair.generate();
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
            createInitializePausableConfigInstruction(mint, owner.publicKey, TEST_PROGRAM_ID),
            createInitializeMintInstruction(mint, TEST_TOKEN_DECIMALS, mintAuthority.publicKey, null, TEST_PROGRAM_ID),
        );
        await sendAndConfirmTransaction(connection, mintTransaction, [payer, mintKeypair], undefined);
    });

    it('pause and resume', async () => {
        await pause(connection, payer, mint, owner, [], undefined, TEST_PROGRAM_ID);
        let mintInfo = await getMint(connection, mint, undefined, TEST_PROGRAM_ID);
        let pausableConfig = getPausableConfig(mintInfo);
        expect(pausableConfig).not.toBeNull();
        if (pausableConfig !== null) {
            expect(pausableConfig.paused).toEqual(true);
        }

        await resume(connection, payer, mint, owner, [], undefined, TEST_PROGRAM_ID);
        mintInfo = await getMint(connection, mint, undefined, TEST_PROGRAM_ID);
        pausableConfig = getPausableConfig(mintInfo);
        expect(pausableConfig).not.toBeNull();
        if (pausableConfig !== null) {
            expect(pausableConfig.paused).toEqual(false);
        }
    });

    it('initialize account', async () => {
        const pausableAccountOwner = (await Keypair.generate()).publicKey;
        const pausableAccount = await createAccount(
            connection,
            payer,
            mint,
            pausableAccountOwner,
            undefined,
            undefined,
            TEST_PROGRAM_ID,
        );

        const accountInfo = await getAccount(connection, pausableAccount, undefined, TEST_PROGRAM_ID);
        const pausableAccountExtension = getPausableAccount(accountInfo);
        expect(pausableAccountExtension).not.toBeNull();
    });

    it('update authority', async () => {
        await setAuthority(
            connection,
            payer,
            mint,
            owner,
            AuthorityType.PausableConfig,
            null,
            [],
            undefined,
            TEST_PROGRAM_ID,
        );
        const mintInfo = await getMint(connection, mint, undefined, TEST_PROGRAM_ID);
        const pausableConfig = getPausableConfig(mintInfo);
        expect(pausableConfig).not.toBeNull();
        if (pausableConfig !== null) {
            expect(pausableConfig.authority).toEqual(Address.default);
        }
    });
});
