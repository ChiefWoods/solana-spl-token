import { expect } from 'chai';
import type { AccountMeta, Connection, Signer } from '@solana/web3.js';
import { Address, TransactionInstruction } from '@solana/web3.js';
import { sendAndConfirmTransaction, Keypair, SystemProgram, Transaction } from '@solana/web3.js';
import {
    createInitializeMintInstruction,
    getMint,
    getMintLen,
    ExtensionType,
    createInitializeTransferHookInstruction,
    getTransferHook,
    updateTransferHook,
    AuthorityType,
    setAuthority,
    createAssociatedTokenAccountInstruction,
    getAssociatedTokenAddress,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    createMintToCheckedInstruction,
    getExtraAccountMetaAddress,
    ExtraAccountMetaListCodec,
    ExtraAccountMetaCodec,
    transferCheckedWithTransferHook,
    createAssociatedTokenAccountIdempotent,
} from '../../src';
import { TEST_PROGRAM_ID, newAccountWithLamports, getConnection, TRANSFER_HOOK_TEST_PROGRAM_ID } from '../common';
import { createHash } from 'crypto';

const TEST_TOKEN_DECIMALS = 2;
const EXTENSIONS = [ExtensionType.TransferHook];
describe('transferHook', () => {
    let connection: Connection;
    let payer: Signer;
    let payerAddress: Address;
    let payerAta: Address;
    let destinationAuthority: Address;
    let destinationAta: Address;
    let transferHookAuthority: Keypair;
    let pdaExtraAccountMeta: Address;
    let mint: Address;
    before(async () => {
        connection = await getConnection();
        payer = await newAccountWithLamports(connection, 1000000000);
        payerAddress = new Address(payer.address);
        destinationAuthority = (await Keypair.generate()).publicKey;
        transferHookAuthority = await Keypair.generate();
    });
    beforeEach(async () => {
        const mintKeypair = await Keypair.generate();
        mint = mintKeypair.publicKey;
        pdaExtraAccountMeta = await getExtraAccountMetaAddress(mint, TRANSFER_HOOK_TEST_PROGRAM_ID);
        payerAta = await getAssociatedTokenAddress(
            mint,
            new Address(payer.address),
            false,
            TEST_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID,
        );
        destinationAta = await getAssociatedTokenAddress(
            mint,
            destinationAuthority,
            false,
            TEST_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID,
        );
        const mintLen = getMintLen(EXTENSIONS);
        const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);
        const transaction = new Transaction().add(
            SystemProgram.createAccount({
                fromPubkey: payerAddress,
                newAccountPubkey: mint,
                space: mintLen,
                lamports,
                programId: TEST_PROGRAM_ID,
            }),
            createInitializeTransferHookInstruction(
                mint,
                transferHookAuthority.publicKey,
                TRANSFER_HOOK_TEST_PROGRAM_ID,
                TEST_PROGRAM_ID,
            ),
            createInitializeMintInstruction(mint, TEST_TOKEN_DECIMALS, payerAddress, null, TEST_PROGRAM_ID),
        );

        await sendAndConfirmTransaction(connection, transaction, [payer, mintKeypair], undefined);
    });
    it('is initialized', async () => {
        const mintInfo = await getMint(connection, mint, undefined, TEST_PROGRAM_ID);
        const transferHook = getTransferHook(mintInfo);
        expect(transferHook).to.not.equal(null);
        if (transferHook !== null) {
            expect(transferHook.authority).to.eql(transferHookAuthority.publicKey);
            expect(transferHook.programId).to.eql(TRANSFER_HOOK_TEST_PROGRAM_ID);
        }
    });
    it('can be updated', async () => {
        const newTransferHookProgramId = (await Keypair.generate()).publicKey;
        await updateTransferHook(
            connection,
            payer,
            mint,
            newTransferHookProgramId,
            transferHookAuthority,
            [],
            undefined,
            TEST_PROGRAM_ID,
        );
        const mintInfo = await getMint(connection, mint, undefined, TEST_PROGRAM_ID);
        const transferHook = getTransferHook(mintInfo);
        expect(transferHook).to.not.equal(null);
        if (transferHook !== null) {
            expect(transferHook.authority).to.eql(transferHookAuthority.publicKey);
            expect(transferHook.programId).to.eql(newTransferHookProgramId);
        }
    });
    it('authority', async () => {
        await setAuthority(
            connection,
            payer,
            mint,
            transferHookAuthority,
            AuthorityType.TransferHookProgramId,
            null,
            [],
            undefined,
            TEST_PROGRAM_ID,
        );
        const mintInfo = await getMint(connection, mint, undefined, TEST_PROGRAM_ID);
        const transferHook = getTransferHook(mintInfo);
        expect(transferHook).to.not.equal(null);
        if (transferHook !== null) {
            expect(transferHook.authority).to.eql(Address.default);
        }
    });
    it('transferChecked', async () => {
        const extraAccount = (await Keypair.generate()).publicKey;
        const keys: AccountMeta[] = [
            { pubkey: pdaExtraAccountMeta, isSigner: false, isWritable: true },
            { pubkey: mint, isSigner: false, isWritable: false },
            { pubkey: payerAddress, isSigner: true, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ];

        const data = Buffer.alloc(8 + 4 + ExtraAccountMetaCodec.fixedSize);
        const discriminator = createHash('sha256')
            .update('spl-transfer-hook-interface:initialize-extra-account-metas')
            .digest()
            .subarray(0, 8);
        discriminator.copy(data);
        ExtraAccountMetaListCodec.write(
            {
                count: 1,
                extraAccounts: [
                    {
                        discriminator: 0,
                        addressConfig: extraAccount.toBytes(),
                        isSigner: false,
                        isWritable: false,
                    },
                ],
            },
            data,
            8,
        );

        const initExtraAccountMetaInstruction = new TransactionInstruction({
            keys,
            data,
            programId: TRANSFER_HOOK_TEST_PROGRAM_ID,
        });

        const setupTransaction = new Transaction().add(
            initExtraAccountMetaInstruction,
            SystemProgram.transfer({
                fromPubkey: payerAddress,
                toPubkey: pdaExtraAccountMeta,
                lamports: 10000000,
            }),
            createAssociatedTokenAccountInstruction(
                payerAddress,
                payerAta,
                payerAddress,
                mint,
                TEST_PROGRAM_ID,
                ASSOCIATED_TOKEN_PROGRAM_ID,
            ),
            createMintToCheckedInstruction(
                mint,
                payerAta,
                payerAddress,
                5 * 10 ** TEST_TOKEN_DECIMALS,
                TEST_TOKEN_DECIMALS,
                [],
                TEST_PROGRAM_ID,
            ),
        );

        await sendAndConfirmTransaction(connection, setupTransaction, [payer]);

        await createAssociatedTokenAccountIdempotent(
            connection,
            payer,
            mint,
            destinationAuthority,
            undefined,
            TEST_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID,
        );

        await transferCheckedWithTransferHook(
            connection,
            payer,
            payerAta,
            mint,
            destinationAta,
            payer,
            BigInt(10 ** TEST_TOKEN_DECIMALS),
            TEST_TOKEN_DECIMALS,
            [],
            undefined,
            TEST_PROGRAM_ID,
        );
    });
});
