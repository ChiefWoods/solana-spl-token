import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Connection, Address, Signer } from '@solana/web3.js';
import { Keypair } from '@solana/web3.js';

import { AuthorityType, createMint, createAccount, getAccount, getMint, setAuthority } from '../../src';

import { TEST_PROGRAM_ID, newAccountWithLamports, getConnection } from '../common';

const TEST_TOKEN_DECIMALS = 2;
describe('setAuthority', () => {
    let connection: Connection;
    let payer: Signer;
    let mint: Address;
    let mintAuthority: Keypair;
    let freezeAuthority: Keypair;
    let owner: Keypair;
    let account: Address;
    beforeAll(async () => {
        connection = await getConnection();
        payer = await newAccountWithLamports(connection, 1000000000);
        mintAuthority = await Keypair.generate();
        freezeAuthority = await Keypair.generate();
        const mintKeypair = await Keypair.generate();
        mint = await createMint(
            connection,
            payer,
            mintAuthority.publicKey,
            freezeAuthority.publicKey,
            TEST_TOKEN_DECIMALS,
            mintKeypair,
            undefined,
            TEST_PROGRAM_ID,
        );
    });
    beforeEach(async () => {
        owner = await Keypair.generate();
        account = await createAccount(
            connection,
            payer,
            mint,
            owner.publicKey,
            await Keypair.generate(),
            undefined,
            TEST_PROGRAM_ID,
        );
    });
    it('AccountOwner', async () => {
        const newOwner = await Keypair.generate();
        await setAuthority(
            connection,
            payer,
            account,
            owner,
            AuthorityType.AccountOwner,
            newOwner.publicKey,
            [],
            undefined,
            TEST_PROGRAM_ID,
        );
        const accountInfo = await getAccount(connection, account, undefined, TEST_PROGRAM_ID);
        expect(accountInfo.owner).toEqual(newOwner.publicKey);
        await setAuthority(
            connection,
            payer,
            account,
            newOwner,
            AuthorityType.AccountOwner,
            owner.publicKey,
            [],
            undefined,
            TEST_PROGRAM_ID,
        );
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
    it('MintAuthority', async () => {
        await setAuthority(
            connection,
            payer,
            mint,
            mintAuthority,
            AuthorityType.MintTokens,
            null,
            [],
            undefined,
            TEST_PROGRAM_ID,
        );
        const mintInfo = await getMint(connection, mint, undefined, TEST_PROGRAM_ID);
        expect(mintInfo.mintAuthority).toBeNull();
    });
    it('CloseAuthority', async () => {
        const closeAuthority = await Keypair.generate();
        await setAuthority(
            connection,
            payer,
            account,
            owner,
            AuthorityType.CloseAccount,
            closeAuthority.publicKey,
            [],
            undefined,
            TEST_PROGRAM_ID,
        );
        const accountInfo = await getAccount(connection, account, undefined, TEST_PROGRAM_ID);
        expect(accountInfo.closeAuthority).toEqual(closeAuthority.publicKey);
    });
    it('FreezeAuthority', async () => {
        await setAuthority(
            connection,
            payer,
            mint,
            freezeAuthority,
            AuthorityType.FreezeAccount,
            null,
            [],
            undefined,
            TEST_PROGRAM_ID,
        );
        const mintInfo = await getMint(connection, mint, undefined, TEST_PROGRAM_ID);
        expect(mintInfo.freezeAuthority).toBeNull();
    });
});
