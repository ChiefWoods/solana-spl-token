import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Connection, Signer } from '@solana/web3.js';
import { Address } from '@solana/web3.js';
import { Keypair, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';

import {
    ExtensionType,
    createInitializeMintInstruction,
    getTransferFeeAmount,
    getTransferFeeConfig,
    mintTo,
    transferChecked,
    createAccount,
    getAccount,
    getMint,
    getMintLen,
    setAuthority,
    AuthorityType,
} from '../../src';

import {
    createInitializeTransferFeeConfigInstruction,
    harvestWithheldTokensToMint,
    transferCheckedWithFee,
    withdrawWithheldTokensFromAccounts,
    withdrawWithheldTokensFromMint,
    setTransferFee,
} from '../../src/extensions/transferFee/index';

import { TEST_PROGRAM_ID, newAccountWithLamports, getConnection } from '../common';
const TEST_TOKEN_DECIMALS = 2;
const MINT_EXTENSIONS = [ExtensionType.TransferFeeConfig];
const MINT_AMOUNT = BigInt(1_000_000_000);
const TRANSFER_AMOUNT = BigInt(1_000_000);
const FEE_BASIS_POINTS = 100;
const MAX_FEE = BigInt(100_000);
const FEE = (TRANSFER_AMOUNT * BigInt(FEE_BASIS_POINTS)) / BigInt(10_000);
describe('transferFee', () => {
    let connection: Connection;
    let payer: Signer;
    let owner: Keypair;
    let sourceAccount: Address;
    let destinationAccount: Address;
    let mint: Address;
    let mintAuthority: Keypair;
    beforeAll(async () => {
        connection = await getConnection();
        payer = await newAccountWithLamports(connection, 1000000000);
    });

    async function setupTransferFeeMint(
        transferFeeConfigAuthority: Address | null,
        withdrawWithheldAuthority: Address | null,
    ) {
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
            createInitializeTransferFeeConfigInstruction(
                mint,
                transferFeeConfigAuthority,
                withdrawWithheldAuthority,
                FEE_BASIS_POINTS,
                MAX_FEE,
                TEST_PROGRAM_ID,
            ),
            createInitializeMintInstruction(mint, TEST_TOKEN_DECIMALS, mintAuthority.publicKey, null, TEST_PROGRAM_ID),
        );
        await sendAndConfirmTransaction(connection, mintTransaction, [payer, mintKeypair], undefined);
    }

    describe('with authorities set', () => {
        let transferFeeConfigAuthority: Keypair;
        let withdrawWithheldAuthority: Keypair;
        beforeEach(async () => {
            transferFeeConfigAuthority = await Keypair.generate();
            withdrawWithheldAuthority = await Keypair.generate();

            await setupTransferFeeMint(transferFeeConfigAuthority.publicKey, withdrawWithheldAuthority.publicKey);

            owner = await Keypair.generate();
            sourceAccount = await createAccount(
                connection,
                payer,
                mint,
                owner.publicKey,
                undefined,
                undefined,
                TEST_PROGRAM_ID,
            );
            await mintTo(
                connection,
                payer,
                mint,
                sourceAccount,
                mintAuthority,
                MINT_AMOUNT,
                [],
                undefined,
                TEST_PROGRAM_ID,
            );

            const accountKeypair = await Keypair.generate();
            destinationAccount = await createAccount(
                connection,
                payer,
                mint,
                owner.publicKey,
                accountKeypair,
                undefined,
                TEST_PROGRAM_ID,
            );

            await transferChecked(
                connection,
                payer,
                sourceAccount,
                mint,
                destinationAccount,
                owner,
                TRANSFER_AMOUNT,
                TEST_TOKEN_DECIMALS,
                [],
                undefined,
                TEST_PROGRAM_ID,
            );
        });
        it('initializes', async () => {
            const mintInfo = await getMint(connection, mint, undefined, TEST_PROGRAM_ID);
            const transferFeeConfig = getTransferFeeConfig(mintInfo);
            expect(transferFeeConfig).not.toBeNull();
            if (transferFeeConfig !== null) {
                expect(transferFeeConfig.transferFeeConfigAuthority).toEqual(transferFeeConfigAuthority.publicKey);
                expect(transferFeeConfig.withdrawWithheldAuthority).toEqual(withdrawWithheldAuthority.publicKey);
                expect(transferFeeConfig.olderTransferFee.transferFeeBasisPoints).toEqual(FEE_BASIS_POINTS);
                expect(transferFeeConfig.olderTransferFee.maximumFee).toEqual(MAX_FEE);
                expect(transferFeeConfig.newerTransferFee.transferFeeBasisPoints).toEqual(FEE_BASIS_POINTS);
                expect(transferFeeConfig.newerTransferFee.maximumFee).toEqual(MAX_FEE);
                expect(transferFeeConfig.withheldAmount).toEqual(BigInt(0));
            }

            const accountInfo = await getAccount(connection, destinationAccount, undefined, TEST_PROGRAM_ID);
            const transferFeeAmount = getTransferFeeAmount(accountInfo);
            expect(transferFeeAmount).not.toBeNull();
            if (transferFeeAmount !== null) {
                expect(transferFeeAmount.withheldAmount).toEqual(FEE);
            }
        });
        it('transferCheckedWithFee', async () => {
            await transferCheckedWithFee(
                connection,
                payer,
                sourceAccount,
                mint,
                destinationAccount,
                owner,
                TRANSFER_AMOUNT,
                TEST_TOKEN_DECIMALS,
                FEE,
                [],
                undefined,
                TEST_PROGRAM_ID,
            );
            const accountInfo = await getAccount(connection, destinationAccount, undefined, TEST_PROGRAM_ID);
            const transferFeeAmount = getTransferFeeAmount(accountInfo);
            expect(transferFeeAmount).not.toBeNull();
            if (transferFeeAmount !== null) {
                expect(transferFeeAmount.withheldAmount).toEqual(FEE * BigInt(2));
            }
        });
        it('withdrawWithheldTokensFromAccounts', async () => {
            await withdrawWithheldTokensFromAccounts(
                connection,
                payer,
                mint,
                destinationAccount,
                withdrawWithheldAuthority,
                [],
                [destinationAccount],
                undefined,
                TEST_PROGRAM_ID,
            );
            const accountInfo = await getAccount(connection, destinationAccount, undefined, TEST_PROGRAM_ID);
            expect(accountInfo.amount).toEqual(TRANSFER_AMOUNT);
            const transferFeeAmount = getTransferFeeAmount(accountInfo);
            expect(transferFeeAmount).not.toBeNull();
            if (transferFeeAmount !== null) {
                expect(transferFeeAmount.withheldAmount).toEqual(BigInt(0));
            }
        });
        it('harvestWithheldTokensToMint', async () => {
            await harvestWithheldTokensToMint(
                connection,
                payer,
                mint,
                [destinationAccount],
                undefined,
                TEST_PROGRAM_ID,
            );
            const accountInfo = await getAccount(connection, destinationAccount, undefined, TEST_PROGRAM_ID);
            const transferFeeAmount = getTransferFeeAmount(accountInfo);
            expect(transferFeeAmount).not.toBeNull();
            if (transferFeeAmount !== null) {
                expect(transferFeeAmount.withheldAmount).toEqual(BigInt(0));
            }
            const mintInfo = await getMint(connection, mint, undefined, TEST_PROGRAM_ID);
            const transferFeeConfig = getTransferFeeConfig(mintInfo);
            expect(transferFeeConfig).not.toBeNull();
            if (transferFeeConfig !== null) {
                expect(transferFeeConfig.withheldAmount).toEqual(FEE);
            }
        });
        it('withdrawWithheldTokensFromMint', async () => {
            await harvestWithheldTokensToMint(
                connection,
                payer,
                mint,
                [destinationAccount],
                undefined,
                TEST_PROGRAM_ID,
            );
            await withdrawWithheldTokensFromMint(
                connection,
                payer,
                mint,
                destinationAccount,
                withdrawWithheldAuthority,
                [],
                undefined,
                TEST_PROGRAM_ID,
            );
            const accountInfo = await getAccount(connection, destinationAccount, undefined, TEST_PROGRAM_ID);
            expect(accountInfo.amount).toEqual(TRANSFER_AMOUNT);
            const transferFeeAmount = getTransferFeeAmount(accountInfo);
            expect(transferFeeAmount).not.toBeNull();
            if (transferFeeAmount !== null) {
                expect(transferFeeAmount.withheldAmount).toEqual(BigInt(0));
            }
            const mintInfo = await getMint(connection, mint, undefined, TEST_PROGRAM_ID);
            const transferFeeConfig = getTransferFeeConfig(mintInfo);
            expect(transferFeeConfig).not.toBeNull();
            if (transferFeeConfig !== null) {
                expect(transferFeeConfig.withheldAmount).toEqual(BigInt(0));
            }
        });
        it('transferFeeConfigAuthority', async () => {
            await setAuthority(
                connection,
                payer,
                mint,
                transferFeeConfigAuthority,
                AuthorityType.TransferFeeConfig,
                null,
                [],
                undefined,
                TEST_PROGRAM_ID,
            );
            const mintInfo = await getMint(connection, mint, undefined, TEST_PROGRAM_ID);
            const transferFeeConfig = getTransferFeeConfig(mintInfo);
            expect(transferFeeConfig).not.toBeNull();
            if (transferFeeConfig !== null) {
                expect(transferFeeConfig.transferFeeConfigAuthority).toEqual(Address.default);
            }
        });
        it('withdrawWithheldAuthority', async () => {
            await setAuthority(
                connection,
                payer,
                mint,
                withdrawWithheldAuthority,
                AuthorityType.WithheldWithdraw,
                null,
                [],
                undefined,
                TEST_PROGRAM_ID,
            );
            const mintInfo = await getMint(connection, mint, undefined, TEST_PROGRAM_ID);
            const transferFeeConfig = getTransferFeeConfig(mintInfo);
            expect(transferFeeConfig).not.toBeNull();
            if (transferFeeConfig !== null) {
                expect(transferFeeConfig.withdrawWithheldAuthority).toEqual(Address.default);
            }
        });
        it('setTransferFee', async () => {
            const UPDATED_FEE_BASIS_POINTS = 150;
            const UPDATED_MAX_FEE = BigInt(150_000);

            await setTransferFee(
                connection,
                payer,
                mint,
                transferFeeConfigAuthority,
                [],
                UPDATED_FEE_BASIS_POINTS,
                UPDATED_MAX_FEE,
                undefined,
                TEST_PROGRAM_ID,
            );
            const mintInfo = await getMint(connection, mint, undefined, TEST_PROGRAM_ID);
            const transferFeeConfig = getTransferFeeConfig(mintInfo);
            expect(transferFeeConfig).not.toBeNull();
            if (transferFeeConfig !== null) {
                expect(transferFeeConfig.transferFeeConfigAuthority).toEqual(transferFeeConfigAuthority.publicKey);
                expect(transferFeeConfig.olderTransferFee.transferFeeBasisPoints).toEqual(FEE_BASIS_POINTS);
                expect(transferFeeConfig.olderTransferFee.maximumFee).toEqual(MAX_FEE);
                expect(transferFeeConfig.newerTransferFee.transferFeeBasisPoints).toEqual(UPDATED_FEE_BASIS_POINTS);
                expect(transferFeeConfig.newerTransferFee.maximumFee).toEqual(UPDATED_MAX_FEE);
            }
        });
    });

    describe('with null authorities', () => {
        it('initializes with null transfer fee config authority', async () => {
            const withdrawWithheldAuthority = await Keypair.generate();
            await setupTransferFeeMint(null, withdrawWithheldAuthority.publicKey);

            const mintInfo = await getMint(connection, mint, undefined, TEST_PROGRAM_ID);
            const transferFeeConfig = getTransferFeeConfig(mintInfo);
            expect(transferFeeConfig).not.toBeNull();
            if (transferFeeConfig !== null) {
                expect(transferFeeConfig.transferFeeConfigAuthority).toEqual(Address.default);
                expect(transferFeeConfig.withdrawWithheldAuthority).toEqual(withdrawWithheldAuthority.publicKey);
                expect(transferFeeConfig.olderTransferFee.transferFeeBasisPoints).toEqual(FEE_BASIS_POINTS);
                expect(transferFeeConfig.olderTransferFee.maximumFee).toEqual(MAX_FEE);
                expect(transferFeeConfig.newerTransferFee.transferFeeBasisPoints).toEqual(FEE_BASIS_POINTS);
                expect(transferFeeConfig.newerTransferFee.maximumFee).toEqual(MAX_FEE);
                expect(transferFeeConfig.withheldAmount).toEqual(BigInt(0));
            }
        });
        it('initializes with null withdraw withheld authority', async () => {
            const transferFeeConfigAuthority = await Keypair.generate();
            await setupTransferFeeMint(transferFeeConfigAuthority.publicKey, null);

            const mintInfo = await getMint(connection, mint, undefined, TEST_PROGRAM_ID);
            const transferFeeConfig = getTransferFeeConfig(mintInfo);
            expect(transferFeeConfig).not.toBeNull();
            if (transferFeeConfig !== null) {
                expect(transferFeeConfig.transferFeeConfigAuthority).toEqual(transferFeeConfigAuthority.publicKey);
                expect(transferFeeConfig.withdrawWithheldAuthority).toEqual(Address.default);
                expect(transferFeeConfig.olderTransferFee.transferFeeBasisPoints).toEqual(FEE_BASIS_POINTS);
                expect(transferFeeConfig.olderTransferFee.maximumFee).toEqual(MAX_FEE);
                expect(transferFeeConfig.newerTransferFee.transferFeeBasisPoints).toEqual(FEE_BASIS_POINTS);
                expect(transferFeeConfig.newerTransferFee.maximumFee).toEqual(MAX_FEE);
                expect(transferFeeConfig.withheldAmount).toEqual(BigInt(0));
            }
        });
        it('initializes with both authorities null', async () => {
            await setupTransferFeeMint(null, null);

            const mintInfo = await getMint(connection, mint, undefined, TEST_PROGRAM_ID);
            const transferFeeConfig = getTransferFeeConfig(mintInfo);
            expect(transferFeeConfig).not.toBeNull();
            if (transferFeeConfig !== null) {
                expect(transferFeeConfig.transferFeeConfigAuthority).toEqual(Address.default);
                expect(transferFeeConfig.withdrawWithheldAuthority).toEqual(Address.default);
                expect(transferFeeConfig.olderTransferFee.transferFeeBasisPoints).toEqual(FEE_BASIS_POINTS);
                expect(transferFeeConfig.olderTransferFee.maximumFee).toEqual(MAX_FEE);
                expect(transferFeeConfig.newerTransferFee.transferFeeBasisPoints).toEqual(FEE_BASIS_POINTS);
                expect(transferFeeConfig.newerTransferFee.maximumFee).toEqual(MAX_FEE);
                expect(transferFeeConfig.withheldAmount).toEqual(BigInt(0));
            }
        });
    });
});
