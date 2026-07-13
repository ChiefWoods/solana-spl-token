import { beforeAll, describe, expect, it } from 'vitest';
import type { Connection } from '@solana/web3.js';
import { Address, Keypair, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { getAccount, getMint } from '../../src';
import {
    createConfidentialTransferWithFeeInstruction,
    getConfidentialTransferAccount,
} from '../../src/extensions/confidentialTransfer/index';
import {
    createHarvestWithheldTokensToMintForConfidentialTransferFeeInstruction,
    createDisableHarvestToMintInstruction,
    createEnableHarvestToMintInstruction,
    createWithdrawWithheldTokensFromAccountsForConfidentialTransferFeeInstruction,
    createWithdrawWithheldTokensFromMintForConfidentialTransferFeeInstruction,
    getConfidentialTransferFeeAmount,
    getConfidentialTransferFeeConfig,
} from '../../src/extensions/confidentialTransferFee/index';
import {
    SYSVAR_INSTRUCTIONS_PUBKEY,
    TEST_PROGRAM_ID,
    getConnection,
    getSolanaRpc,
    newAccountWithLamports,
} from '../common';
import {
    createCiphertextCiphertextEqualityProofInstruction,
    createConfidentialTransferWithFeeProofPlan,
    createConfiguredConfidentialTransferTokenAccount,
    createConfidentialTransferFeeMint,
    executeV1ProofPlan,
} from '../helpers/confidential';

describe('confidentialTransferFee', () => {
    let connection: Connection;
    let payer: Keypair;

    beforeAll(async () => {
        connection = await getConnection();
        payer = await newAccountWithLamports(connection, 1000000000);
    });

    async function createNonIdentityWithheldAmount() {
        const mintSetup = await createConfidentialTransferFeeMint(connection, payer);
        const sourceOwner = await Keypair.generate();
        const feeSourceOwner = await Keypair.generate();
        const withdrawDestinationOwner = await Keypair.generate();
        const source = await createConfiguredConfidentialTransferTokenAccount(
            connection,
            payer,
            mintSetup.mint,
            sourceOwner,
            { includeTransferFeeAmount: true },
        );
        const feeSource = await createConfiguredConfidentialTransferTokenAccount(
            connection,
            payer,
            mintSetup.mint,
            feeSourceOwner,
            { includeTransferFeeAmount: true },
        );
        const withdrawDestination = await createConfiguredConfidentialTransferTokenAccount(
            connection,
            payer,
            mintSetup.mint,
            withdrawDestinationOwner,
            { includeTransferFeeAmount: true },
        );
        const sourceState = getConfidentialTransferAccount(
            await getAccount(connection, source.tokenAccount, undefined, TEST_PROGRAM_ID),
        )!;
        const rpc = getSolanaRpc();
        const payerSigner = payer;
        const proofFixture = await createConfidentialTransferWithFeeProofPlan({
            rpc,
            payer: payerSigner,
            currentAvailableBalance: sourceState.availableBalance,
            sourceElgamalKeypair: source.elgamalKeypair,
            sourceAesKey: source.aesKey,
            destinationElgamalPubkey: feeSource.elgamalKeypair.pubkey(),
            withdrawWithheldElgamalPubkey: mintSetup.withdrawWithheldElGamalKeypair.pubkey(),
            programAddress: TEST_PROGRAM_ID.toBase58(),
        });
        await executeV1ProofPlan(
            connection,
            payer,
            proofFixture.plan,
            () =>
                createConfidentialTransferWithFeeInstruction(
                    source.tokenAccount,
                    mintSetup.mint,
                    feeSource.tokenAccount,
                    sourceOwner.publicKey,
                    [],
                    {
                        equalityRecord: new Address(proofFixture.proofAccounts.equalityRecord),
                        transferAmountCiphertextValidityRecord: new Address(
                            proofFixture.proofAccounts.transferAmountCiphertextValidityRecord,
                        ),
                        feeSigmaRecord: new Address(proofFixture.proofAccounts.feeSigmaRecord),
                        feeCiphertextValidityRecord: new Address(
                            proofFixture.proofAccounts.feeCiphertextValidityRecord,
                        ),
                        rangeRecord: new Address(proofFixture.proofAccounts.rangeRecord),
                    },
                    proofFixture.newSourceDecryptableAvailableBalance,
                    proofFixture.transferAmountAuditorCiphertextLo,
                    proofFixture.transferAmountAuditorCiphertextHi,
                    0,
                    0,
                    0,
                    0,
                    0,
                    TEST_PROGRAM_ID,
                ),
            [sourceOwner],
        );
        const feeState = getConfidentialTransferFeeAmount(
            await getAccount(connection, feeSource.tokenAccount, undefined, TEST_PROGRAM_ID),
        )!;
        expect(feeState.withheldAmount).not.toEqual(new Uint8Array(64));
        return { mintSetup, feeSource, withdrawDestination, feeState };
    }

    it('can initialize and fetch mint config', async () => {
        const { mint, confidentialTransferFeeAuthority, elgamalPubkey } = await createConfidentialTransferFeeMint(
            connection,
            payer,
        );

        const mintInfo = await getMint(connection, mint, undefined, TEST_PROGRAM_ID);
        const config = getConfidentialTransferFeeConfig(mintInfo);

        expect(config).not.toBeNull();
        expect(config?.authority?.toBase58()).toEqual(confidentialTransferFeeAuthority.publicKey.toBase58());
        expect(config?.withdrawWithheldAuthorityElGamalPubkey.toBase58()).toEqual(elgamalPubkey.toBase58());
        expect(config?.harvestToMintEnabled).toEqual(true);
        expect(config?.withheldAmount).toEqual(new Uint8Array(64));
    });

    it('can disable and re-enable harvest to mint', async () => {
        const { mint, confidentialTransferFeeAuthority } = await createConfidentialTransferFeeMint(connection, payer);

        let config = getConfidentialTransferFeeConfig(await getMint(connection, mint, undefined, TEST_PROGRAM_ID));
        expect(config?.harvestToMintEnabled).toEqual(true);

        await sendAndConfirmTransaction(
            connection,
            new Transaction().add(
                createDisableHarvestToMintInstruction(
                    mint,
                    confidentialTransferFeeAuthority.publicKey,
                    [],
                    TEST_PROGRAM_ID,
                ),
            ),
            [payer, confidentialTransferFeeAuthority],
            undefined,
        );
        config = getConfidentialTransferFeeConfig(await getMint(connection, mint, undefined, TEST_PROGRAM_ID));
        expect(config?.harvestToMintEnabled).toEqual(false);

        await sendAndConfirmTransaction(
            connection,
            new Transaction().add(
                createEnableHarvestToMintInstruction(
                    mint,
                    confidentialTransferFeeAuthority.publicKey,
                    [],
                    TEST_PROGRAM_ID,
                ),
            ),
            [payer, confidentialTransferFeeAuthority],
            undefined,
        );
        config = getConfidentialTransferFeeConfig(await getMint(connection, mint, undefined, TEST_PROGRAM_ID));
        expect(config?.harvestToMintEnabled).toEqual(true);
    });

    it('rejects harvest toggle from the wrong authority', async () => {
        const { mint } = await createConfidentialTransferFeeMint(connection, payer);
        const wrongAuthority = await Keypair.generate();

        await expect(
            sendAndConfirmTransaction(
                connection,
                new Transaction().add(
                    createDisableHarvestToMintInstruction(mint, wrongAuthority.publicKey, [], TEST_PROGRAM_ID),
                ),
                [payer, wrongAuthority],
                undefined,
            ),
        ).rejects.toThrow();

        const config = getConfidentialTransferFeeConfig(await getMint(connection, mint, undefined, TEST_PROGRAM_ID));
        expect(config?.harvestToMintEnabled).toEqual(true);
    });

    it('can harvest zero withheld amounts from a configured confidential transfer account', async () => {
        const { mint } = await createConfidentialTransferFeeMint(connection, payer);
        const owner = await Keypair.generate();
        const { tokenAccount } = await createConfiguredConfidentialTransferTokenAccount(
            connection,
            payer,
            mint,
            owner,
            { includeTransferFeeAmount: true },
        );

        const accountBefore = getConfidentialTransferFeeAmount(
            await getAccount(connection, tokenAccount, undefined, TEST_PROGRAM_ID),
        );
        expect(accountBefore).not.toBeNull();
        expect(accountBefore?.withheldAmount).toEqual(new Uint8Array(64));

        await sendAndConfirmTransaction(
            connection,
            new Transaction().add(
                createHarvestWithheldTokensToMintForConfidentialTransferFeeInstruction(
                    mint,
                    [tokenAccount],
                    TEST_PROGRAM_ID,
                ),
            ),
            [payer],
            undefined,
        );

        const mintConfig = getConfidentialTransferFeeConfig(
            await getMint(connection, mint, undefined, TEST_PROGRAM_ID),
        );
        const accountAfter = getConfidentialTransferFeeAmount(
            await getAccount(connection, tokenAccount, undefined, TEST_PROGRAM_ID),
        );
        expect(mintConfig?.withheldAmount).toEqual(new Uint8Array(64));
        expect(accountAfter?.withheldAmount).toEqual(new Uint8Array(64));
    });

    it('can withdraw zero withheld tokens from mint with a ciphertext equality proof', async () => {
        const { mintSetup, feeSource, withdrawDestination, feeState } = await createNonIdentityWithheldAmount();
        await sendAndConfirmTransaction(
            connection,
            new Transaction().add(
                createHarvestWithheldTokensToMintForConfidentialTransferFeeInstruction(
                    mintSetup.mint,
                    [feeSource.tokenAccount],
                    TEST_PROGRAM_ID,
                ),
            ),
            [payer],
        );
        const mintFeeState = getConfidentialTransferFeeConfig(
            await getMint(connection, mintSetup.mint, undefined, TEST_PROGRAM_ID),
        )!;
        expect(mintFeeState.withheldAmount).toEqual(feeState.withheldAmount);
        const proof = await createCiphertextCiphertextEqualityProofInstruction(
            connection,
            payer,
            mintSetup.withdrawWithheldElGamalKeypair,
            withdrawDestination.elgamalKeypair.pubkey(),
            mintFeeState.withheldAmount,
        );
        const decryptableBalance = withdrawDestination.aesKey.encrypt(0n).toBytes();
        await sendAndConfirmTransaction(
            connection,
            new Transaction().add(
                createWithdrawWithheldTokensFromMintForConfidentialTransferFeeInstruction(
                    mintSetup.mint,
                    withdrawDestination.tokenAccount,
                    mintSetup.withdrawWithheldAuthority.publicKey,
                    SYSVAR_INSTRUCTIONS_PUBKEY,
                    1,
                    decryptableBalance,
                    [],
                    TEST_PROGRAM_ID,
                ),
                proof.instruction,
            ),
            [payer, mintSetup.withdrawWithheldAuthority],
        );

        const configAfter = getConfidentialTransferFeeConfig(
            await getMint(connection, mintSetup.mint, undefined, TEST_PROGRAM_ID),
        );
        const destinationAfter = getConfidentialTransferAccount(
            await getAccount(connection, withdrawDestination.tokenAccount, undefined, TEST_PROGRAM_ID),
        );
        expect(configAfter?.withheldAmount).toEqual(new Uint8Array(64));
        expect(destinationAfter?.availableBalance).toEqual(proof.secondCiphertext);
        expect(destinationAfter?.decryptableAvailableBalance).toEqual(decryptableBalance);
    });

    it('can withdraw zero withheld tokens from accounts with a ciphertext equality proof', async () => {
        const { mintSetup, feeSource, withdrawDestination, feeState } = await createNonIdentityWithheldAmount();
        const proof = await createCiphertextCiphertextEqualityProofInstruction(
            connection,
            payer,
            mintSetup.withdrawWithheldElGamalKeypair,
            withdrawDestination.elgamalKeypair.pubkey(),
            feeState.withheldAmount,
        );
        const decryptableBalance = withdrawDestination.aesKey.encrypt(0n).toBytes();
        await sendAndConfirmTransaction(
            connection,
            new Transaction().add(
                createWithdrawWithheldTokensFromAccountsForConfidentialTransferFeeInstruction(
                    mintSetup.mint,
                    withdrawDestination.tokenAccount,
                    mintSetup.withdrawWithheldAuthority.publicKey,
                    SYSVAR_INSTRUCTIONS_PUBKEY,
                    1,
                    decryptableBalance,
                    [feeSource.tokenAccount],
                    [],
                    TEST_PROGRAM_ID,
                ),
                proof.instruction,
            ),
            [payer, mintSetup.withdrawWithheldAuthority],
        );

        const feeSourceAfter = getConfidentialTransferFeeAmount(
            await getAccount(connection, feeSource.tokenAccount, undefined, TEST_PROGRAM_ID),
        );
        const destinationAfter = getConfidentialTransferAccount(
            await getAccount(connection, withdrawDestination.tokenAccount, undefined, TEST_PROGRAM_ID),
        );
        expect(feeSourceAfter?.withheldAmount).toEqual(new Uint8Array(64));
        expect(destinationAfter?.availableBalance).toEqual(proof.secondCiphertext);
        expect(destinationAfter?.decryptableAvailableBalance).toEqual(decryptableBalance);
    });
});
