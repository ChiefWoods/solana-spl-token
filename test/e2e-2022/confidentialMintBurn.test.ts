import { beforeAll, describe, expect, it } from 'vitest';
import { ElGamalKeypair } from '@solana/zk-sdk/bundler';
import type { Connection, Signer } from '@solana/web3.js';
import { Address, Keypair, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { getMint } from '../../src';
import {
    createApplyConfidentialPendingBurnInstruction,
    createConfidentialBurnInstruction,
    createConfidentialMintInstruction,
    createRotateSupplyElGamalPubkeyInstruction,
    createUpdateConfidentialMintBurnDecryptableSupplyInstruction,
    getConfidentialMintBurn,
} from '../../src/extensions/confidentialMintBurn/index';
import {
    TEST_PROGRAM_ID,
    createCiphertextCiphertextEqualityProofInstruction,
    createConfidentialBurnProofFixture,
    createConfidentialMintProofFixture,
    createConfiguredConfidentialTransferTokenAccount,
    createConfidentialMintBurnMint,
    getConnection,
    newAccountWithLamports,
} from '../common';

const SYSVAR_INSTRUCTIONS_PUBKEY = new Address('Sysvar1nstructions1111111111111111111111111');

describe('confidentialMintBurn', () => {
    let connection: Connection;
    let payer: Signer;

    beforeAll(async () => {
        connection = await getConnection();
        payer = await newAccountWithLamports(connection, 1000000000);
    });

    it('can initialize and fetch mint state', async () => {
        const { mint, supplyElGamalPubkey, decryptableSupply } = await createConfidentialMintBurnMint(
            connection,
            payer,
        );

        const mintInfo = await getMint(connection, mint, undefined, TEST_PROGRAM_ID);
        const state = getConfidentialMintBurn(mintInfo);

        expect(state).not.toBeNull();
        expect(state?.confidentialSupply).toEqual(new Uint8Array(64));
        expect(state?.decryptableSupply).toEqual(decryptableSupply);
        expect(state?.supplyElGamalPubkey.toBase58()).toEqual(supplyElGamalPubkey.toBase58());
        expect(state?.pendingBurn).toEqual(new Uint8Array(64));
    });

    it('can update decryptable supply', async () => {
        const { mint, mintAuthority } = await createConfidentialMintBurnMint(connection, payer);
        const newDecryptableSupply = new Uint8Array(36).fill(9);

        await sendAndConfirmTransaction(
            connection,
            new Transaction().add(
                createUpdateConfidentialMintBurnDecryptableSupplyInstruction(
                    mint,
                    mintAuthority.publicKey,
                    [],
                    newDecryptableSupply,
                    TEST_PROGRAM_ID,
                ),
            ),
            [payer, mintAuthority],
            undefined,
        );

        const state = getConfidentialMintBurn(await getMint(connection, mint, undefined, TEST_PROGRAM_ID));
        expect(state?.decryptableSupply).toEqual(newDecryptableSupply);
    });

    it('rejects decryptable supply updates from the wrong authority', async () => {
        const { mint, decryptableSupply } = await createConfidentialMintBurnMint(connection, payer);
        const wrongAuthority = await Keypair.generate();
        const newDecryptableSupply = new Uint8Array(36).fill(9);

        await expect(
            sendAndConfirmTransaction(
                connection,
                new Transaction().add(
                    createUpdateConfidentialMintBurnDecryptableSupplyInstruction(
                        mint,
                        wrongAuthority.publicKey,
                        [],
                        newDecryptableSupply,
                        TEST_PROGRAM_ID,
                    ),
                ),
                [payer, wrongAuthority],
                undefined,
            ),
        ).rejects.toThrow();

        const state = getConfidentialMintBurn(await getMint(connection, mint, undefined, TEST_PROGRAM_ID));
        expect(state?.decryptableSupply).toEqual(decryptableSupply);
    });

    it('can apply a zero pending burn', async () => {
        const { mint, mintAuthority } = await createConfidentialMintBurnMint(connection, payer);
        const initialState = getConfidentialMintBurn(await getMint(connection, mint, undefined, TEST_PROGRAM_ID));
        expect(initialState?.pendingBurn).toEqual(new Uint8Array(64));

        await sendAndConfirmTransaction(
            connection,
            new Transaction().add(
                createApplyConfidentialPendingBurnInstruction(mint, mintAuthority.publicKey, [], TEST_PROGRAM_ID),
            ),
            [payer, mintAuthority],
            undefined,
        );

        const state = getConfidentialMintBurn(await getMint(connection, mint, undefined, TEST_PROGRAM_ID));
        expect(state?.pendingBurn).toEqual(new Uint8Array(64));
        expect(state?.confidentialSupply).toEqual(new Uint8Array(64));
    });

    it('can rotate supply ElGamal pubkey with a ciphertext equality proof', async () => {
        const { mint, mintAuthority, supplyElGamalKeypair, aesKey } = await createConfidentialMintBurnMint(
            connection,
            payer,
        );
        const owner = await Keypair.generate();
        const { tokenAccount, elgamalKeypair: destinationElGamalKeypair } =
            await createConfiguredConfidentialTransferTokenAccount(connection, payer, mint, owner);

        // Identity (all-zero) supply ciphertexts cannot produce a valid equality proof.
        // Mint zero first so confidential supply becomes a real encryption of 0.
        const initialState = getConfidentialMintBurn(await getMint(connection, mint, undefined, TEST_PROGRAM_ID));
        expect(initialState).not.toBeNull();
        const mintProofFixture = await createConfidentialMintProofFixture(
            connection,
            payer,
            initialState!.confidentialSupply,
            supplyElGamalKeypair,
            destinationElGamalKeypair.pubkey(),
        );
        for (const [index, transaction] of mintProofFixture.transactions.entries()) {
            const signers: Signer[] = [payer];
            const extra = mintProofFixture.signers[index];
            if (extra) signers.push(extra);
            await sendAndConfirmTransaction(connection, transaction, signers, undefined);
        }
        await sendAndConfirmTransaction(
            connection,
            new Transaction().add(
                createConfidentialMintInstruction(
                    tokenAccount,
                    mint,
                    mintAuthority.publicKey,
                    [],
                    {
                        equalityRecord: mintProofFixture.equalityRecord,
                        ciphertextValidityRecord: mintProofFixture.ciphertextValidityRecord,
                        rangeRecord: mintProofFixture.rangeRecord,
                    },
                    aesKey.encrypt(0n).toBytes(),
                    mintProofFixture.mintAmountAuditorCiphertextLo,
                    mintProofFixture.mintAmountAuditorCiphertextHi,
                    0,
                    0,
                    0,
                    TEST_PROGRAM_ID,
                ),
            ),
            [payer, mintAuthority],
            undefined,
        );

        const supplyState = getConfidentialMintBurn(await getMint(connection, mint, undefined, TEST_PROGRAM_ID));
        expect(supplyState).not.toBeNull();
        expect(supplyState!.confidentialSupply).not.toEqual(new Uint8Array(64));

        const newSupplyElGamalKeypair = new ElGamalKeypair();
        const newSupplyElGamalPubkey = new Address(newSupplyElGamalKeypair.pubkey().toBytes());
        const { instruction: proofInstruction } = await createCiphertextCiphertextEqualityProofInstruction(
            connection,
            payer,
            supplyElGamalKeypair,
            newSupplyElGamalKeypair.pubkey(),
            supplyState!.confidentialSupply,
        );

        await sendAndConfirmTransaction(
            connection,
            new Transaction().add(
                createRotateSupplyElGamalPubkeyInstruction(
                    mint,
                    SYSVAR_INSTRUCTIONS_PUBKEY,
                    mintAuthority.publicKey,
                    [],
                    newSupplyElGamalPubkey,
                    1,
                    TEST_PROGRAM_ID,
                ),
                proofInstruction,
            ),
            [payer, mintAuthority],
            undefined,
        );

        const state = getConfidentialMintBurn(await getMint(connection, mint, undefined, TEST_PROGRAM_ID));
        expect(state?.supplyElGamalPubkey.toBase58()).toEqual(newSupplyElGamalPubkey.toBase58());
    });

    it('can confidentially mint zero tokens with equality, ciphertext validity, and range proof fixtures', async () => {
        const { mint, mintAuthority, supplyElGamalKeypair, aesKey } = await createConfidentialMintBurnMint(
            connection,
            payer,
        );
        const owner = await Keypair.generate();
        const { tokenAccount, elgamalKeypair: destinationElGamalKeypair } =
            await createConfiguredConfidentialTransferTokenAccount(connection, payer, mint, owner);
        const initialState = getConfidentialMintBurn(await getMint(connection, mint, undefined, TEST_PROGRAM_ID));
        expect(initialState).not.toBeNull();
        const proofFixture = await createConfidentialMintProofFixture(
            connection,
            payer,
            initialState!.confidentialSupply,
            supplyElGamalKeypair,
            destinationElGamalKeypair.pubkey(),
        );
        for (const [index, transaction] of proofFixture.transactions.entries()) {
            const signers: Signer[] = [payer];
            const extra = proofFixture.signers[index];
            if (extra) signers.push(extra);
            await sendAndConfirmTransaction(connection, transaction, signers, undefined);
        }

        const newDecryptableSupply = aesKey.encrypt(0n).toBytes();
        await sendAndConfirmTransaction(
            connection,
            new Transaction().add(
                createConfidentialMintInstruction(
                    tokenAccount,
                    mint,
                    mintAuthority.publicKey,
                    [],
                    {
                        equalityRecord: proofFixture.equalityRecord,
                        ciphertextValidityRecord: proofFixture.ciphertextValidityRecord,
                        rangeRecord: proofFixture.rangeRecord,
                    },
                    newDecryptableSupply,
                    proofFixture.mintAmountAuditorCiphertextLo,
                    proofFixture.mintAmountAuditorCiphertextHi,
                    0,
                    0,
                    0,
                    TEST_PROGRAM_ID,
                ),
            ),
            [payer, mintAuthority],
            undefined,
        );

        const state = getConfidentialMintBurn(await getMint(connection, mint, undefined, TEST_PROGRAM_ID));
        expect(state?.decryptableSupply).toEqual(newDecryptableSupply);
    });

    it('can confidentially burn zero tokens with equality, ciphertext validity, and range proof fixtures', async () => {
        const { mint, supplyElGamalKeypair } = await createConfidentialMintBurnMint(connection, payer);
        const owner = await Keypair.generate();
        const {
            tokenAccount,
            elgamalKeypair: sourceElGamalKeypair,
            aesKey,
        } = await createConfiguredConfidentialTransferTokenAccount(connection, payer, mint, owner);
        const proofFixture = await createConfidentialBurnProofFixture(
            connection,
            payer,
            new Uint8Array(64),
            sourceElGamalKeypair,
            supplyElGamalKeypair.pubkey(),
        );
        for (const [index, transaction] of proofFixture.transactions.entries()) {
            const signers: Signer[] = [payer];
            const extra = proofFixture.signers[index];
            if (extra) signers.push(extra);
            await sendAndConfirmTransaction(connection, transaction, signers, undefined);
        }

        await sendAndConfirmTransaction(
            connection,
            new Transaction().add(
                createConfidentialBurnInstruction(
                    tokenAccount,
                    mint,
                    owner.publicKey,
                    [],
                    {
                        equalityRecord: proofFixture.equalityRecord,
                        ciphertextValidityRecord: proofFixture.ciphertextValidityRecord,
                        rangeRecord: proofFixture.rangeRecord,
                    },
                    aesKey.encrypt(0n).toBytes(),
                    proofFixture.burnAmountAuditorCiphertextLo,
                    proofFixture.burnAmountAuditorCiphertextHi,
                    0,
                    0,
                    0,
                    TEST_PROGRAM_ID,
                ),
            ),
            [payer, owner],
            undefined,
        );

        const state = getConfidentialMintBurn(await getMint(connection, mint, undefined, TEST_PROGRAM_ID));
        expect(state).not.toBeNull();
    });
});
