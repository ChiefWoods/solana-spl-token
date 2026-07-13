import { AeKey, ElGamalKeypair } from '@solana/zk-sdk/bundler';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Connection, Signer } from '@solana/web3.js';
import { Address, Keypair, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { createMintToInstruction, getAccount, getMint } from '../../src';
import {
    createApplyConfidentialPendingBalanceInstruction,
    createApproveConfidentialTransferAccountInstruction,
    createConfigureConfidentialTransferAccountInstruction,
    createConfidentialDepositInstruction,
    createDisableConfidentialCreditsInstruction,
    createDisableNonConfidentialCreditsInstruction,
    createEnableConfidentialCreditsInstruction,
    createEnableNonConfidentialCreditsInstruction,
    createUpdateConfidentialTransferMintInstruction,
    getConfidentialTransferAccount,
    getConfidentialTransferMint,
} from '../../src/extensions/confidentialTransfer/index';
import {
    TEST_PROGRAM_ID,
    createConfidentialTransferMint,
    createConfidentialTransferTokenAccount,
    createConfiguredConfidentialTransferTokenAccount,
    createPubkeyValidityProofInstruction,
    getConnection,
    newAccountWithLamports,
} from '../common';

const SYSVAR_INSTRUCTIONS_PUBKEY = new Address('Sysvar1nstructions1111111111111111111111111');

describe('confidentialTransfer', () => {
    let connection: Connection;
    let payer: Signer;

    beforeAll(async () => {
        connection = await getConnection();
        payer = await newAccountWithLamports(connection, 1000000000);
    });

    it('can initialize and fetch mint config', async () => {
        const { mint, confidentialTransferAuthority } = await createConfidentialTransferMint(connection, payer);

        const mintInfo = await getMint(connection, mint, undefined, TEST_PROGRAM_ID);
        const config = getConfidentialTransferMint(mintInfo);

        expect(config).not.toBeNull();
        expect(config?.authority?.toBase58()).toEqual(confidentialTransferAuthority.publicKey.toBase58());
        expect(config?.autoApproveNewAccounts).toEqual(true);
        expect(config?.auditorElgamalPubkey).toBeNull();

        const auditorElgamalPubkey = new Address(new Uint8Array(32).fill(7));
        const custom = await createConfidentialTransferMint(connection, payer, {
            autoApproveNewAccounts: false,
            auditorElgamalPubkey,
        });
        const customConfig = getConfidentialTransferMint(
            await getMint(connection, custom.mint, undefined, TEST_PROGRAM_ID),
        );

        expect(customConfig?.autoApproveNewAccounts).toEqual(false);
        expect(customConfig?.auditorElgamalPubkey?.toBase58()).toEqual(auditorElgamalPubkey.toBase58());
    });

    it('can update mint config', async () => {
        const { mint, confidentialTransferAuthority } = await createConfidentialTransferMint(connection, payer);
        const auditorElgamalPubkey = new Address(new Uint8Array(32).fill(9));

        await sendAndConfirmTransaction(
            connection,
            new Transaction().add(
                createUpdateConfidentialTransferMintInstruction(
                    mint,
                    confidentialTransferAuthority.publicKey,
                    [],
                    false,
                    auditorElgamalPubkey,
                    TEST_PROGRAM_ID,
                ),
            ),
            [payer, confidentialTransferAuthority],
            undefined,
        );

        const config = getConfidentialTransferMint(await getMint(connection, mint, undefined, TEST_PROGRAM_ID));
        expect(config?.autoApproveNewAccounts).toEqual(false);
        expect(config?.auditorElgamalPubkey?.toBase58()).toEqual(auditorElgamalPubkey.toBase58());
    });

    it('rejects mint config updates from the wrong authority', async () => {
        const { mint } = await createConfidentialTransferMint(connection, payer);
        const wrongAuthority = await Keypair.generate();
        const auditorElgamalPubkey = new Address(new Uint8Array(32).fill(9));

        await expect(
            sendAndConfirmTransaction(
                connection,
                new Transaction().add(
                    createUpdateConfidentialTransferMintInstruction(
                        mint,
                        wrongAuthority.publicKey,
                        [],
                        false,
                        auditorElgamalPubkey,
                        TEST_PROGRAM_ID,
                    ),
                ),
                [payer, wrongAuthority],
                undefined,
            ),
        ).rejects.toThrow();

        const config = getConfidentialTransferMint(await getMint(connection, mint, undefined, TEST_PROGRAM_ID));
        expect(config?.autoApproveNewAccounts).toEqual(true);
        expect(config?.auditorElgamalPubkey).toBeNull();
    });

    it('can configure a confidential transfer account with the public SDK builder and pubkey validity proof fixture', async () => {
        const { mint } = await createConfidentialTransferMint(connection, payer);
        const owner = await Keypair.generate();
        const elgamalKeypair = new ElGamalKeypair();
        const aesKey = new AeKey();
        const { tokenAccount } = await createConfidentialTransferTokenAccount(connection, payer, mint, owner.publicKey);

        await sendAndConfirmTransaction(
            connection,
            new Transaction().add(
                createConfigureConfidentialTransferAccountInstruction(
                    tokenAccount,
                    mint,
                    SYSVAR_INSTRUCTIONS_PUBKEY,
                    owner.publicKey,
                    [],
                    aesKey.encrypt(0n).toBytes(),
                    1n << 16n,
                    1,
                    TEST_PROGRAM_ID,
                ),
                createPubkeyValidityProofInstruction(elgamalKeypair),
            ),
            [payer, owner],
            undefined,
        );

        const state = getConfidentialTransferAccount(
            await getAccount(connection, tokenAccount, undefined, TEST_PROGRAM_ID),
        );
        expect(state?.approved).toEqual(true);
        expect(state?.elgamalPubkey.toBase58()).toEqual(new Address(elgamalKeypair.pubkey().toBytes()).toBase58());
        expect(state?.decryptableAvailableBalance).toEqual(aesKey.encrypt(0n).toBytes());
        expect(state?.maximumPendingBalanceCreditCounter).toEqual(1n << 16n);
    });

    it('can approve an account when auto-approve is disabled', async () => {
        const { mint, confidentialTransferAuthority } = await createConfidentialTransferMint(connection, payer, {
            autoApproveNewAccounts: false,
        });
        const owner = await Keypair.generate();
        const { tokenAccount } = await createConfiguredConfidentialTransferTokenAccount(connection, payer, mint, owner);

        let state = getConfidentialTransferAccount(
            await getAccount(connection, tokenAccount, undefined, TEST_PROGRAM_ID),
        );
        expect(state?.approved).toEqual(false);

        await sendAndConfirmTransaction(
            connection,
            new Transaction().add(
                createApproveConfidentialTransferAccountInstruction(
                    tokenAccount,
                    mint,
                    confidentialTransferAuthority.publicKey,
                    [],
                    TEST_PROGRAM_ID,
                ),
            ),
            [payer, confidentialTransferAuthority],
            undefined,
        );

        state = getConfidentialTransferAccount(await getAccount(connection, tokenAccount, undefined, TEST_PROGRAM_ID));
        expect(state?.approved).toEqual(true);
    });

    it('can toggle confidential and non-confidential credits after account configuration', async () => {
        const { mint } = await createConfidentialTransferMint(connection, payer);
        const owner = await Keypair.generate();
        const { tokenAccount } = await createConfiguredConfidentialTransferTokenAccount(connection, payer, mint, owner);

        let state = getConfidentialTransferAccount(
            await getAccount(connection, tokenAccount, undefined, TEST_PROGRAM_ID),
        );
        expect(state?.allowConfidentialCredits).toEqual(true);
        expect(state?.allowNonConfidentialCredits).toEqual(true);

        await sendAndConfirmTransaction(
            connection,
            new Transaction().add(
                createDisableConfidentialCreditsInstruction(tokenAccount, owner.publicKey, [], TEST_PROGRAM_ID),
                createDisableNonConfidentialCreditsInstruction(tokenAccount, owner.publicKey, [], TEST_PROGRAM_ID),
            ),
            [payer, owner],
            undefined,
        );
        state = getConfidentialTransferAccount(await getAccount(connection, tokenAccount, undefined, TEST_PROGRAM_ID));
        expect(state?.allowConfidentialCredits).toEqual(false);
        expect(state?.allowNonConfidentialCredits).toEqual(false);

        await sendAndConfirmTransaction(
            connection,
            new Transaction().add(
                createEnableConfidentialCreditsInstruction(tokenAccount, owner.publicKey, [], TEST_PROGRAM_ID),
                createEnableNonConfidentialCreditsInstruction(tokenAccount, owner.publicKey, [], TEST_PROGRAM_ID),
            ),
            [payer, owner],
            undefined,
        );
        state = getConfidentialTransferAccount(await getAccount(connection, tokenAccount, undefined, TEST_PROGRAM_ID));
        expect(state?.allowConfidentialCredits).toEqual(true);
        expect(state?.allowNonConfidentialCredits).toEqual(true);
    });

    it('can deposit and apply pending balance', async () => {
        const { mint, mintAuthority } = await createConfidentialTransferMint(connection, payer);
        const owner = await Keypair.generate();
        const { tokenAccount, aesKey } = await createConfiguredConfidentialTransferTokenAccount(
            connection,
            payer,
            mint,
            owner,
        );
        const amount = 10n;

        await sendAndConfirmTransaction(
            connection,
            new Transaction().add(
                createMintToInstruction(mint, tokenAccount, mintAuthority.publicKey, amount, [], TEST_PROGRAM_ID),
            ),
            [payer, mintAuthority],
            undefined,
        );

        await sendAndConfirmTransaction(
            connection,
            new Transaction().add(
                createConfidentialDepositInstruction(
                    tokenAccount,
                    mint,
                    owner.publicKey,
                    [],
                    amount,
                    2,
                    TEST_PROGRAM_ID,
                ),
            ),
            [payer, owner],
            undefined,
        );

        let tokenInfo = await getAccount(connection, tokenAccount, undefined, TEST_PROGRAM_ID);
        let state = getConfidentialTransferAccount(tokenInfo);
        expect(tokenInfo.amount).toEqual(0n);
        expect(state?.pendingBalanceCreditCounter).toEqual(1n);
        expect(state?.pendingBalanceLow).not.toEqual(new Uint8Array(64));

        const newDecryptableAvailableBalance = aesKey.encrypt(amount).toBytes();
        await sendAndConfirmTransaction(
            connection,
            new Transaction().add(
                createApplyConfidentialPendingBalanceInstruction(
                    tokenAccount,
                    owner.publicKey,
                    [],
                    1n,
                    newDecryptableAvailableBalance,
                    TEST_PROGRAM_ID,
                ),
            ),
            [payer, owner],
            undefined,
        );

        tokenInfo = await getAccount(connection, tokenAccount, undefined, TEST_PROGRAM_ID);
        state = getConfidentialTransferAccount(tokenInfo);
        expect(state?.decryptableAvailableBalance).toEqual(newDecryptableAvailableBalance);
        expect(state?.expectedPendingBalanceCreditCounter).toEqual(1n);
        expect(state?.actualPendingBalanceCreditCounter).toEqual(1n);
        expect(state?.availableBalance).not.toEqual(new Uint8Array(64));
    });

    it.todo('can withdraw with equality and range proof fixtures');
    it.todo('can transfer with equality, ciphertext validity, and range proof fixtures');
    it.todo('can empty a confidential transfer account with a zero-balance proof fixture');
    it.todo('can transfer with fee using a multi-proof fixture');
    it.todo('can configure a confidential transfer account with the ElGamal registry');
});
