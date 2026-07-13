import { beforeAll, describe, expect, it } from 'vitest';
import type { Connection, Signer } from '@solana/web3.js';
import { Keypair, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { getAccount, getMint } from '../../src';
import {
    createHarvestWithheldTokensToMintForConfidentialTransferFeeInstruction,
    createDisableHarvestToMintInstruction,
    createEnableHarvestToMintInstruction,
    getConfidentialTransferFeeAmount,
    getConfidentialTransferFeeConfig,
} from '../../src/extensions/confidentialTransferFee/index';
import {
    TEST_PROGRAM_ID,
    createConfiguredConfidentialTransferTokenAccount,
    createConfidentialTransferFeeMint,
    getConnection,
    newAccountWithLamports,
} from '../common';

describe('confidentialTransferFee', () => {
    let connection: Connection;
    let payer: Signer;

    beforeAll(async () => {
        connection = await getConnection();
        payer = await newAccountWithLamports(connection, 1000000000);
    });

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

    it.todo(
        'can withdraw zero withheld tokens from mint with a ciphertext equality proof — not a tx-size blocker; needs a non-identity withheld ciphertext because identity all-zero ciphertexts cannot produce a valid equality proof',
    );

    it.todo(
        'can withdraw zero withheld tokens from accounts with a ciphertext equality proof — not a tx-size blocker; needs a non-identity withheld ciphertext because identity all-zero ciphertexts cannot produce a valid equality proof',
    );
});
