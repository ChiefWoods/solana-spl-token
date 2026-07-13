import { AeKey, ElGamalKeypair } from '@solana/zk-sdk/bundler';
import {
    fetchToken,
    getConfidentialTransferInstructionDataDecoder,
    getConfidentialWithdrawInstructionDataDecoder,
} from '@solana-program/token-2022';
import {
    getConfidentialTransferInstructionPlan,
    getConfidentialWithdrawInstructionPlan,
} from '@solana-program/token-2022/confidential';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Connection } from '@solana/web3.js';
import {
    Address,
    Keypair,
    SystemProgram,
    Transaction,
    TransactionInstruction,
    sendAndConfirmTransaction,
} from '@solana/web3.js';
import { createMintToInstruction, getAccount, getMint } from '../../src';
import {
    createApplyConfidentialPendingBalanceInstruction,
    createApproveConfidentialTransferAccountInstruction,
    createConfigureConfidentialTransferAccountInstruction,
    createConfigureConfidentialTransferAccountWithRegistryInstruction,
    createConfidentialDepositInstruction,
    createConfidentialTransferInstruction,
    createConfidentialTransferWithFeeInstruction,
    createConfidentialWithdrawInstruction,
    createDisableConfidentialCreditsInstruction,
    createDisableNonConfidentialCreditsInstruction,
    createEnableConfidentialCreditsInstruction,
    createEnableNonConfidentialCreditsInstruction,
    createEmptyConfidentialTransferAccountInstruction,
    createUpdateConfidentialTransferMintInstruction,
    getConfidentialTransferAccount,
    getConfidentialTransferMint,
} from '../../src/extensions/confidentialTransfer/index';
import { getConfidentialTransferFeeAmount } from '../../src/extensions/confidentialTransferFee/index';
import {
    ELGAMAL_REGISTRY_ACCOUNT_SIZE,
    ELGAMAL_REGISTRY_PROGRAM_ID,
    SYSVAR_INSTRUCTIONS_PUBKEY,
    TEST_PROGRAM_ID,
    createTokenAccount,
    getConnection,
    getSolanaRpc,
    newAccountWithLamports,
} from '../common';
import {
    createConfidentialTransferFeeMint,
    createConfidentialTransferMint,
    createConfidentialTransferTokenAccount,
    createConfidentialTransferWithFeeProofPlan,
    createConfiguredConfidentialTransferTokenAccount,
    createPubkeyValidityProofInstruction,
    createZeroCiphertextProofInstruction,
    executeV1ProofPlan,
} from '../helpers/confidential';

describe('confidentialTransfer', () => {
    let connection: Connection;
    let payer: Keypair;

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
        const { mint, mintAuthority } = await createConfidentialTransferMint(connection, payer);
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
        const decryptableZeroBalance = aesKey.encrypt(0n).toBytes();
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
                    decryptableZeroBalance,
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
        expect(state?.decryptableAvailableBalance).toEqual(decryptableZeroBalance);
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

    it('can withdraw with equality and range proof fixtures', async () => {
        const { mint, mintAuthority } = await createConfidentialTransferMint(connection, payer);
        const owner = await Keypair.generate();
        const { tokenAccount, elgamalKeypair, aesKey } = await createConfiguredConfidentialTransferTokenAccount(
            connection,
            payer,
            mint,
            owner,
        );
        await sendAndConfirmTransaction(
            connection,
            new Transaction().add(
                createMintToInstruction(mint, tokenAccount, mintAuthority.publicKey, 1, [], TEST_PROGRAM_ID),
            ),
            [payer, mintAuthority],
        );
        await sendAndConfirmTransaction(
            connection,
            new Transaction().add(
                createConfidentialDepositInstruction(tokenAccount, mint, owner.publicKey, [], 1, 2, TEST_PROGRAM_ID),
                createApplyConfidentialPendingBalanceInstruction(
                    tokenAccount,
                    owner.publicKey,
                    [],
                    1,
                    aesKey.encrypt(1n).toBytes(),
                    TEST_PROGRAM_ID,
                ),
            ),
            [payer, owner],
        );
        const rpc = getSolanaRpc();
        const payerSigner = payer;
        const ownerSigner = owner;
        const tokenAccountState = await fetchToken(rpc, tokenAccount.toBase58());
        const plan = await getConfidentialWithdrawInstructionPlan({
            rpc,
            payer: payerSigner,
            token: tokenAccount.toBase58(),
            mint: mint.toBase58(),
            tokenAccount: tokenAccountState.data,
            authority: ownerSigner,
            amount: 1,
            decimals: 2,
            elgamalKeypair,
            aesKey,
            programAddress: TEST_PROGRAM_ID.toBase58(),
        });

        const execution = await executeV1ProofPlan(
            connection,
            payer,
            plan,
            instruction => {
                const data = getConfidentialWithdrawInstructionDataDecoder().decode(instruction.data!);
                const accounts = instruction.accounts!;
                return createConfidentialWithdrawInstruction(
                    tokenAccount,
                    mint,
                    owner.publicKey,
                    [],
                    {
                        equalityRecord: new Address(accounts[2].address),
                        rangeRecord: new Address(accounts[3].address),
                    },
                    data.amount,
                    data.decimals,
                    new Uint8Array(data.newDecryptableAvailableBalance),
                    data.equalityProofInstructionOffset,
                    data.rangeProofInstructionOffset,
                    TEST_PROGRAM_ID,
                );
            },
            [owner],
        );
        expect(execution.coreInstructionCount).toEqual(3);
        expect(execution.coreTransactionSize).toBeLessThanOrEqual(4096);

        const state = getConfidentialTransferAccount(
            await getAccount(connection, tokenAccount, undefined, TEST_PROGRAM_ID),
        );
        expect(state?.decryptableAvailableBalance).toHaveLength(36);
    });
    it('can transfer with equality, ciphertext validity, and range proof fixtures', async () => {
        const { mint, mintAuthority } = await createConfidentialTransferMint(connection, payer);
        const sourceOwner = await Keypair.generate();
        const destinationOwner = await Keypair.generate();
        const source = await createConfiguredConfidentialTransferTokenAccount(connection, payer, mint, sourceOwner);
        const destination = await createConfiguredConfidentialTransferTokenAccount(
            connection,
            payer,
            mint,
            destinationOwner,
        );
        await sendAndConfirmTransaction(
            connection,
            new Transaction().add(
                createMintToInstruction(mint, source.tokenAccount, mintAuthority.publicKey, 1, [], TEST_PROGRAM_ID),
            ),
            [payer, mintAuthority],
        );
        await sendAndConfirmTransaction(
            connection,
            new Transaction().add(
                createConfidentialDepositInstruction(
                    source.tokenAccount,
                    mint,
                    sourceOwner.publicKey,
                    [],
                    1,
                    2,
                    TEST_PROGRAM_ID,
                ),
                createApplyConfidentialPendingBalanceInstruction(
                    source.tokenAccount,
                    sourceOwner.publicKey,
                    [],
                    1,
                    source.aesKey.encrypt(1n).toBytes(),
                    TEST_PROGRAM_ID,
                ),
            ),
            [payer, sourceOwner],
        );

        const rpc = getSolanaRpc();
        const payerSigner = payer;
        const sourceOwnerSigner = sourceOwner;
        const [sourceTokenAccount, destinationTokenAccount] = await Promise.all([
            fetchToken(rpc, source.tokenAccount.toBase58()),
            fetchToken(rpc, destination.tokenAccount.toBase58()),
        ]);
        const plan = await getConfidentialTransferInstructionPlan({
            rpc,
            payer: payerSigner,
            sourceToken: source.tokenAccount.toBase58(),
            mint: mint.toBase58(),
            destinationToken: destination.tokenAccount.toBase58(),
            sourceTokenAccount: sourceTokenAccount.data,
            destinationTokenAccount: destinationTokenAccount.data,
            authority: sourceOwnerSigner,
            amount: 1,
            sourceElgamalKeypair: source.elgamalKeypair,
            aesKey: source.aesKey,
            programAddress: TEST_PROGRAM_ID.toBase58(),
        });

        const execution = await executeV1ProofPlan(
            connection,
            payer,
            plan,
            instruction => {
                const data = getConfidentialTransferInstructionDataDecoder().decode(instruction.data!);
                const accounts = instruction.accounts!;
                return createConfidentialTransferInstruction(
                    source.tokenAccount,
                    mint,
                    destination.tokenAccount,
                    sourceOwner.publicKey,
                    [],
                    {
                        equalityRecord: new Address(accounts[3].address),
                        ciphertextValidityRecord: new Address(accounts[4].address),
                        rangeRecord: new Address(accounts[5].address),
                    },
                    new Uint8Array(data.newSourceDecryptableAvailableBalance),
                    new Uint8Array(data.transferAmountAuditorCiphertextLo),
                    new Uint8Array(data.transferAmountAuditorCiphertextHi),
                    data.equalityProofInstructionOffset,
                    data.ciphertextValidityProofInstructionOffset,
                    data.rangeProofInstructionOffset,
                    TEST_PROGRAM_ID,
                );
            },
            [sourceOwner],
        );
        expect(execution.coreInstructionCount).toEqual(4);
        expect(execution.coreTransactionSize).toBeLessThanOrEqual(4096);

        const destinationState = getConfidentialTransferAccount(
            await getAccount(connection, destination.tokenAccount, undefined, TEST_PROGRAM_ID),
        );
        expect(destinationState?.pendingBalanceCreditCounter).toEqual(1n);
    });

    it('can empty a confidential transfer account with a zero-balance proof fixture', async () => {
        const { mint, mintAuthority } = await createConfidentialTransferMint(connection, payer);
        const owner = await Keypair.generate();
        const { tokenAccount, elgamalKeypair, aesKey } = await createConfiguredConfidentialTransferTokenAccount(
            connection,
            payer,
            mint,
            owner,
        );
        await sendAndConfirmTransaction(
            connection,
            new Transaction().add(
                createMintToInstruction(mint, tokenAccount, mintAuthority.publicKey, 1, [], TEST_PROGRAM_ID),
            ),
            [payer, mintAuthority],
        );
        await sendAndConfirmTransaction(
            connection,
            new Transaction().add(
                createConfidentialDepositInstruction(tokenAccount, mint, owner.publicKey, [], 1, 2, TEST_PROGRAM_ID),
                createApplyConfidentialPendingBalanceInstruction(
                    tokenAccount,
                    owner.publicKey,
                    [],
                    1,
                    aesKey.encrypt(1n).toBytes(),
                    TEST_PROGRAM_ID,
                ),
            ),
            [payer, owner],
        );
        const rpc = getSolanaRpc();
        const payerSigner = payer;
        const ownerSigner = owner;
        const tokenBeforeWithdraw = await fetchToken(rpc, tokenAccount.toBase58());
        const withdrawPlan = await getConfidentialWithdrawInstructionPlan({
            rpc,
            payer: payerSigner,
            token: tokenAccount.toBase58(),
            mint: mint.toBase58(),
            tokenAccount: tokenBeforeWithdraw.data,
            authority: ownerSigner,
            amount: 1,
            decimals: 2,
            elgamalKeypair,
            aesKey,
            programAddress: TEST_PROGRAM_ID.toBase58(),
        });
        await executeV1ProofPlan(
            connection,
            payer,
            withdrawPlan,
            instruction => {
                const data = getConfidentialWithdrawInstructionDataDecoder().decode(instruction.data!);
                const accounts = instruction.accounts!;
                return createConfidentialWithdrawInstruction(
                    tokenAccount,
                    mint,
                    owner.publicKey,
                    [],
                    {
                        equalityRecord: new Address(accounts[2].address),
                        rangeRecord: new Address(accounts[3].address),
                    },
                    data.amount,
                    data.decimals,
                    new Uint8Array(data.newDecryptableAvailableBalance),
                    data.equalityProofInstructionOffset,
                    data.rangeProofInstructionOffset,
                    TEST_PROGRAM_ID,
                );
            },
            [owner],
        );
        const zeroBalanceState = getConfidentialTransferAccount(
            await getAccount(connection, tokenAccount, undefined, TEST_PROGRAM_ID),
        )!;
        await sendAndConfirmTransaction(
            connection,
            new Transaction().add(
                createEmptyConfidentialTransferAccountInstruction(
                    tokenAccount,
                    SYSVAR_INSTRUCTIONS_PUBKEY,
                    owner.publicKey,
                    [],
                    1,
                    TEST_PROGRAM_ID,
                ),
                createZeroCiphertextProofInstruction(elgamalKeypair, zeroBalanceState.availableBalance),
            ),
            [payer, owner],
        );

        const state = getConfidentialTransferAccount(
            await getAccount(connection, tokenAccount, undefined, TEST_PROGRAM_ID),
        );
        expect(state?.availableBalance).toEqual(new Uint8Array(64));
    });
    it('can transfer with fee using a multi-proof fixture', async () => {
        const { mint, withdrawWithheldElGamalKeypair } = await createConfidentialTransferFeeMint(connection, payer);
        const sourceOwner = await Keypair.generate();
        const destinationOwner = await Keypair.generate();
        const source = await createConfiguredConfidentialTransferTokenAccount(connection, payer, mint, sourceOwner, {
            includeTransferFeeAmount: true,
        });
        const destination = await createConfiguredConfidentialTransferTokenAccount(
            connection,
            payer,
            mint,
            destinationOwner,
            { includeTransferFeeAmount: true },
        );
        const sourceState = getConfidentialTransferAccount(
            await getAccount(connection, source.tokenAccount, undefined, TEST_PROGRAM_ID),
        )!;
        const rpc = getSolanaRpc();
        const payerSigner = payer;
        const fixture = await createConfidentialTransferWithFeeProofPlan({
            rpc,
            payer: payerSigner,
            currentAvailableBalance: sourceState.availableBalance,
            sourceElgamalKeypair: source.elgamalKeypair,
            sourceAesKey: source.aesKey,
            destinationElgamalPubkey: destination.elgamalKeypair.pubkey(),
            withdrawWithheldElgamalPubkey: withdrawWithheldElGamalKeypair.pubkey(),
            programAddress: TEST_PROGRAM_ID.toBase58(),
        });

        const execution = await executeV1ProofPlan(
            connection,
            payer,
            fixture.plan,
            () =>
                createConfidentialTransferWithFeeInstruction(
                    source.tokenAccount,
                    mint,
                    destination.tokenAccount,
                    sourceOwner.publicKey,
                    [],
                    {
                        equalityRecord: new Address(fixture.proofAccounts.equalityRecord),
                        transferAmountCiphertextValidityRecord: new Address(
                            fixture.proofAccounts.transferAmountCiphertextValidityRecord,
                        ),
                        feeSigmaRecord: new Address(fixture.proofAccounts.feeSigmaRecord),
                        feeCiphertextValidityRecord: new Address(fixture.proofAccounts.feeCiphertextValidityRecord),
                        rangeRecord: new Address(fixture.proofAccounts.rangeRecord),
                    },
                    fixture.newSourceDecryptableAvailableBalance,
                    fixture.transferAmountAuditorCiphertextLo,
                    fixture.transferAmountAuditorCiphertextHi,
                    0,
                    0,
                    0,
                    0,
                    0,
                    TEST_PROGRAM_ID,
                ),
            [sourceOwner],
        );
        expect(execution.coreInstructionCount).toEqual(6);
        expect(execution.coreTransactionSize).toBeLessThanOrEqual(4096);

        const destinationState = getConfidentialTransferAccount(
            await getAccount(connection, destination.tokenAccount, undefined, TEST_PROGRAM_ID),
        );
        const feeState = getConfidentialTransferFeeAmount(
            await getAccount(connection, destination.tokenAccount, undefined, TEST_PROGRAM_ID),
        );
        expect(destinationState?.pendingBalanceCreditCounter).toEqual(1n);
        expect(feeState?.withheldAmount).not.toEqual(new Uint8Array(64));
    });
    it('can configure a confidential transfer account with the ElGamal registry', async () => {
        const { mint } = await createConfidentialTransferMint(connection, payer);
        const owner = await Keypair.generate();
        const { tokenAccount } = await createTokenAccount(connection, payer, mint, owner.publicKey);
        const elgamalKeypair = new ElGamalKeypair();
        const [registry] = await Address.findProgramAddress(
            [Buffer.from('elgamal-registry'), owner.publicKey.toBytes()],
            ELGAMAL_REGISTRY_PROGRAM_ID,
        );
        const registryRent = await connection.getMinimumBalanceForRentExemption(ELGAMAL_REGISTRY_ACCOUNT_SIZE);

        await sendAndConfirmTransaction(
            connection,
            new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: new Address(payer.address),
                    toPubkey: registry,
                    lamports: registryRent,
                }),
                new TransactionInstruction({
                    programId: ELGAMAL_REGISTRY_PROGRAM_ID,
                    keys: [
                        { pubkey: registry, isSigner: false, isWritable: true },
                        { pubkey: owner.publicKey, isSigner: true, isWritable: false },
                        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                        { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },
                    ],
                    data: Buffer.from([0, 1]),
                }),
                createPubkeyValidityProofInstruction(elgamalKeypair),
            ),
            [payer, owner],
        );

        await sendAndConfirmTransaction(
            connection,
            new Transaction().add(
                createConfigureConfidentialTransferAccountWithRegistryInstruction(
                    tokenAccount,
                    mint,
                    registry,
                    new Address(payer.address),
                    undefined,
                    TEST_PROGRAM_ID,
                ),
            ),
            [payer],
        );

        const state = getConfidentialTransferAccount(
            await getAccount(connection, tokenAccount, undefined, TEST_PROGRAM_ID),
        );
        expect(state).not.toBeNull();
        expect(state?.approved).toEqual(true);
        expect(state?.elgamalPubkey).toEqual(new Address(elgamalKeypair.pubkey().toBytes()));
    });
});
