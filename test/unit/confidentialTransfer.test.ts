import { describe, expect, it } from 'vitest';
import type { ReadonlyUint8Array } from '@solana/kit';
import {
    getApplyConfidentialPendingBalanceInstructionDataDecoder,
    getApproveConfidentialTransferAccountInstructionDataDecoder,
    getConfidentialDepositInstructionDataDecoder,
    getConfidentialTransferInstructionDataDecoder,
    getConfidentialTransferWithFeeInstructionDataDecoder,
    getConfidentialWithdrawInstructionDataDecoder,
    getConfigureConfidentialTransferAccountInstructionDataDecoder,
    getConfigureConfidentialTransferAccountWithRegistryInstructionDataDecoder,
    getDisableConfidentialCreditsInstructionDataDecoder,
    getDisableNonConfidentialCreditsInstructionDataDecoder,
    getEmptyConfidentialTransferAccountInstructionDataDecoder,
    getEnableConfidentialCreditsInstructionDataDecoder,
    getEnableNonConfidentialCreditsInstructionDataDecoder,
    getInitializeConfidentialTransferMintInstructionDataDecoder,
    getUpdateConfidentialTransferMintInstructionDataDecoder,
} from '@solana-program/token-2022';
import { Address, Keypair, SystemProgram } from '@solana/web3.js';
import {
    ExtensionType,
    TOKEN_2022_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    TokenInstruction,
    getAccountLen,
    getAccountTypeOfMintType,
    getMintLen,
    isAccountExtension,
    isMintExtension,
} from '../../src';
import { TokenUnsupportedInstructionError } from '../../src/errors';
import type { Account } from '../../src/state/account';
import type { Mint } from '../../src/state/mint';
import {
    CONFIDENTIAL_TRANSFER_ACCOUNT_SIZE,
    CONFIDENTIAL_TRANSFER_DECRYPTABLE_BALANCE_SIZE,
    CONFIDENTIAL_TRANSFER_ENCRYPTED_BALANCE_SIZE,
    CONFIDENTIAL_TRANSFER_MINT_SIZE,
    ConfidentialTransferAccountCodec,
    ConfidentialTransferInstruction,
    ConfidentialTransferMintCodec,
    createApplyConfidentialPendingBalanceInstruction,
    createApproveConfidentialTransferAccountInstruction,
    createConfidentialDepositInstruction,
    createConfidentialTransferInstruction,
    createConfidentialTransferWithFeeInstruction,
    createConfidentialWithdrawInstruction,
    createConfigureConfidentialTransferAccountInstruction,
    createConfigureConfidentialTransferAccountWithRegistryInstruction,
    createDisableConfidentialCreditsInstruction,
    createDisableNonConfidentialCreditsInstruction,
    createEmptyConfidentialTransferAccountInstruction,
    createEnableConfidentialCreditsInstruction,
    createEnableNonConfidentialCreditsInstruction,
    createInitializeConfidentialTransferMintInstruction,
    createUpdateConfidentialTransferMintInstruction,
    getConfidentialTransferAccount,
    getConfidentialTransferMint,
} from '../../src/extensions/confidentialTransfer/index';

const TYPE_SIZE = 2;
const LENGTH_SIZE = 2;

function tlv(type: ExtensionType, data: Uint8Array | ReadonlyUint8Array): Buffer {
    const buffer = Buffer.alloc(TYPE_SIZE + LENGTH_SIZE + data.length);
    buffer.writeUInt16LE(type, 0);
    buffer.writeUInt16LE(data.length, TYPE_SIZE);
    Buffer.from(data).copy(buffer, TYPE_SIZE + LENGTH_SIZE);
    return buffer;
}

function mintWithTlv(tlvData: Buffer): Mint {
    return { tlvData } as Mint;
}

function accountWithTlv(tlvData: Buffer): Account {
    return { tlvData } as Account;
}

describe('confidential transfer extension', () => {
    it('defines discriminators and extension lengths', () => {
        expect(TokenInstruction.ConfidentialTransferExtension).toEqual(27);
        expect(ExtensionType.ConfidentialTransferMint).toEqual(4);
        expect(ExtensionType.ConfidentialTransferAccount).toEqual(5);
        expect(getMintLen([ExtensionType.ConfidentialTransferMint])).toEqual(166 + 4 + 65);
        expect(getAccountLen([ExtensionType.ConfidentialTransferAccount])).toEqual(165 + 1 + 4 + 295);
        expect(isMintExtension(ExtensionType.ConfidentialTransferMint)).toEqual(true);
        expect(isAccountExtension(ExtensionType.ConfidentialTransferAccount)).toEqual(true);
        expect(getAccountTypeOfMintType(ExtensionType.ConfidentialTransferMint)).toEqual(
            ExtensionType.ConfidentialTransferAccount,
        );
    });

    it('decodes mint and account state', () => {
        const authority = new Address('11111111111111111111111111111112');
        const auditor = new Address(new Uint8Array(32).fill(2));
        const elgamalPubkey = new Address(new Uint8Array(32).fill(3));
        const pendingBalanceLow = new Uint8Array(64).fill(4);
        const pendingBalanceHigh = new Uint8Array(64).fill(5);
        const availableBalance = new Uint8Array(64).fill(6);
        const decryptableAvailableBalance = new Uint8Array(36).fill(7);

        const mintData = ConfidentialTransferMintCodec.encode({
            authority: authority.toBase58(),
            autoApproveNewAccounts: true,
            auditorElgamalPubkey: auditor.toBase58(),
        });
        const accountData = ConfidentialTransferAccountCodec.encode({
            approved: true,
            elgamalPubkey: elgamalPubkey.toBase58(),
            pendingBalanceLow,
            pendingBalanceHigh,
            availableBalance,
            decryptableAvailableBalance,
            allowConfidentialCredits: true,
            allowNonConfidentialCredits: false,
            pendingBalanceCreditCounter: 1n,
            maximumPendingBalanceCreditCounter: 2n,
            expectedPendingBalanceCreditCounter: 3n,
            actualPendingBalanceCreditCounter: 4n,
        });

        expect(mintData).toHaveLength(65);
        expect(accountData).toHaveLength(295);
        expect(CONFIDENTIAL_TRANSFER_MINT_SIZE).toEqual(65);
        expect(CONFIDENTIAL_TRANSFER_ACCOUNT_SIZE).toEqual(295);
        expect(CONFIDENTIAL_TRANSFER_ENCRYPTED_BALANCE_SIZE).toEqual(64);
        expect(CONFIDENTIAL_TRANSFER_DECRYPTABLE_BALANCE_SIZE).toEqual(36);

        expect(getConfidentialTransferMint(mintWithTlv(tlv(ExtensionType.ConfidentialTransferMint, mintData)))).toEqual(
            {
                authority,
                autoApproveNewAccounts: true,
                auditorElgamalPubkey: auditor,
            },
        );
        expect(
            getConfidentialTransferAccount(accountWithTlv(tlv(ExtensionType.ConfidentialTransferAccount, accountData))),
        ).toEqual({
            approved: true,
            elgamalPubkey,
            pendingBalanceLow,
            pendingBalanceHigh,
            availableBalance,
            decryptableAvailableBalance,
            allowConfidentialCredits: true,
            allowNonConfidentialCredits: false,
            pendingBalanceCreditCounter: 1n,
            maximumPendingBalanceCreditCounter: 2n,
            expectedPendingBalanceCreditCounter: 3n,
            actualPendingBalanceCreditCounter: 4n,
        });
    });

    it('returns null for missing TLV data and nullable mint addresses', () => {
        expect(getConfidentialTransferMint(mintWithTlv(Buffer.alloc(0)))).toBeNull();
        expect(getConfidentialTransferAccount(accountWithTlv(Buffer.alloc(0)))).toBeNull();

        const mintData = ConfidentialTransferMintCodec.encode({
            authority: Address.default.toBase58(),
            autoApproveNewAccounts: false,
            auditorElgamalPubkey: Address.default.toBase58(),
        });
        const config = getConfidentialTransferMint(mintWithTlv(tlv(ExtensionType.ConfidentialTransferMint, mintData)));

        expect(config).toEqual({
            authority: null,
            autoApproveNewAccounts: false,
            auditorElgamalPubkey: null,
        });
    });

    it('constructs initialize mint instruction data and metas', async () => {
        const mint = (await Keypair.generate()).publicKey;
        const authority = (await Keypair.generate()).publicKey;
        const auditor = new Address(new Uint8Array(32).fill(2));

        const instruction = createInitializeConfidentialTransferMintInstruction(mint, authority, true, auditor);
        const decoded = getInitializeConfidentialTransferMintInstructionDataDecoder().decode(instruction.data);

        expect(instruction.programId).toEqual(TOKEN_2022_PROGRAM_ID);
        expect(decoded).toEqual({
            discriminator: TokenInstruction.ConfidentialTransferExtension,
            confidentialTransferDiscriminator: ConfidentialTransferInstruction.InitializeMint,
            authority: { __option: 'Some', value: authority.toBase58() },
            autoApproveNewAccounts: true,
            auditorElgamalPubkey: { __option: 'Some', value: auditor.toBase58() },
        });
        expect(instruction.keys).toEqual([{ pubkey: mint, isSigner: false, isWritable: true }]);

        const nullInstruction = createInitializeConfidentialTransferMintInstruction(mint, null, false, null);
        const nullDecoded = getInitializeConfidentialTransferMintInstructionDataDecoder().decode(nullInstruction.data);
        expect(nullDecoded.authority).toEqual({ __option: 'None' });
        expect(nullDecoded.auditorElgamalPubkey).toEqual({ __option: 'None' });
    });

    it('constructs update mint instruction data and multisig metas', async () => {
        const mint = (await Keypair.generate()).publicKey;
        const authority = (await Keypair.generate()).publicKey;
        const signerA = await Keypair.generate();
        const auditor = new Address(new Uint8Array(32).fill(2));

        const instruction = createUpdateConfidentialTransferMintInstruction(mint, authority, [signerA], false, auditor);
        const decoded = getUpdateConfidentialTransferMintInstructionDataDecoder().decode(instruction.data);

        expect(decoded).toEqual({
            discriminator: TokenInstruction.ConfidentialTransferExtension,
            confidentialTransferDiscriminator: ConfidentialTransferInstruction.UpdateMint,
            autoApproveNewAccounts: false,
            auditorElgamalPubkey: { __option: 'Some', value: auditor.toBase58() },
        });
        expect(instruction.keys).toEqual([
            { pubkey: mint, isSigner: false, isWritable: true },
            { pubkey: authority, isSigner: false, isWritable: false },
            { pubkey: signerA.publicKey, isSigner: true, isWritable: false },
        ]);
    });

    it('constructs configure account instruction data and metas', async () => {
        const token = (await Keypair.generate()).publicKey;
        const mint = (await Keypair.generate()).publicKey;
        const proofAccount = (await Keypair.generate()).publicKey;
        const authority = (await Keypair.generate()).publicKey;
        const signerA = await Keypair.generate();
        const decryptableZeroBalance = new Uint8Array(36).fill(1);

        const instruction = createConfigureConfidentialTransferAccountInstruction(
            token,
            mint,
            proofAccount,
            authority,
            [signerA],
            decryptableZeroBalance,
            2n,
            -1,
        );
        const decoded = getConfigureConfidentialTransferAccountInstructionDataDecoder().decode(instruction.data);

        expect(decoded).toEqual({
            discriminator: TokenInstruction.ConfidentialTransferExtension,
            confidentialTransferDiscriminator: ConfidentialTransferInstruction.ConfigureAccount,
            decryptableZeroBalance,
            maximumPendingBalanceCreditCounter: 2n,
            proofInstructionOffset: -1,
        });
        expect(instruction.keys).toEqual([
            { pubkey: token, isSigner: false, isWritable: true },
            { pubkey: mint, isSigner: false, isWritable: false },
            { pubkey: proofAccount, isSigner: false, isWritable: false },
            { pubkey: authority, isSigner: false, isWritable: false },
            { pubkey: signerA.publicKey, isSigner: true, isWritable: false },
        ]);
    });

    it('constructs approve, deposit, apply, and credit toggle instructions', async () => {
        const token = (await Keypair.generate()).publicKey;
        const mint = (await Keypair.generate()).publicKey;
        const authority = (await Keypair.generate()).publicKey;
        const signerA = await Keypair.generate();
        const decryptableBalance = new Uint8Array(36).fill(9);

        const approve = createApproveConfidentialTransferAccountInstruction(token, mint, authority, [signerA]);
        expect(getApproveConfidentialTransferAccountInstructionDataDecoder().decode(approve.data)).toEqual({
            discriminator: TokenInstruction.ConfidentialTransferExtension,
            confidentialTransferDiscriminator: ConfidentialTransferInstruction.ApproveAccount,
        });
        expect(approve.keys).toEqual([
            { pubkey: token, isSigner: false, isWritable: true },
            { pubkey: mint, isSigner: false, isWritable: false },
            { pubkey: authority, isSigner: false, isWritable: false },
            { pubkey: signerA.publicKey, isSigner: true, isWritable: false },
        ]);

        const deposit = createConfidentialDepositInstruction(token, mint, authority, [], 55n, 2);
        expect(getConfidentialDepositInstructionDataDecoder().decode(deposit.data)).toEqual({
            discriminator: TokenInstruction.ConfidentialTransferExtension,
            confidentialTransferDiscriminator: ConfidentialTransferInstruction.Deposit,
            amount: 55n,
            decimals: 2,
        });
        expect(deposit.keys[2]).toEqual({ pubkey: authority, isSigner: true, isWritable: false });

        const apply = createApplyConfidentialPendingBalanceInstruction(
            token,
            authority,
            [signerA],
            3n,
            decryptableBalance,
        );
        expect(getApplyConfidentialPendingBalanceInstructionDataDecoder().decode(apply.data)).toEqual({
            discriminator: TokenInstruction.ConfidentialTransferExtension,
            confidentialTransferDiscriminator: ConfidentialTransferInstruction.ApplyPendingBalance,
            expectedPendingBalanceCreditCounter: 3n,
            newDecryptableAvailableBalance: decryptableBalance,
        });
        expect(apply.keys).toEqual([
            { pubkey: token, isSigner: false, isWritable: true },
            { pubkey: authority, isSigner: false, isWritable: false },
            { pubkey: signerA.publicKey, isSigner: true, isWritable: false },
        ]);

        const toggles = [
            [createEnableConfidentialCreditsInstruction, getEnableConfidentialCreditsInstructionDataDecoder(), 9],
            [createDisableConfidentialCreditsInstruction, getDisableConfidentialCreditsInstructionDataDecoder(), 10],
            [
                createEnableNonConfidentialCreditsInstruction,
                getEnableNonConfidentialCreditsInstructionDataDecoder(),
                11,
            ],
            [
                createDisableNonConfidentialCreditsInstruction,
                getDisableNonConfidentialCreditsInstructionDataDecoder(),
                12,
            ],
        ] as const;
        for (const [factory, decoder, discriminator] of toggles) {
            const instruction = factory(token, authority, [signerA]);
            expect(decoder.decode(instruction.data)).toEqual({
                discriminator: TokenInstruction.ConfidentialTransferExtension,
                confidentialTransferDiscriminator: discriminator,
            });
            expect(instruction.keys).toEqual([
                { pubkey: token, isSigner: false, isWritable: true },
                { pubkey: authority, isSigner: false, isWritable: false },
                { pubkey: signerA.publicKey, isSigner: true, isWritable: false },
            ]);
        }
    });

    it('constructs empty account instruction data and metas', async () => {
        const token = (await Keypair.generate()).publicKey;
        const proofAccount = (await Keypair.generate()).publicKey;
        const authority = (await Keypair.generate()).publicKey;

        const instruction = createEmptyConfidentialTransferAccountInstruction(token, proofAccount, authority, [], -1);
        expect(getEmptyConfidentialTransferAccountInstructionDataDecoder().decode(instruction.data)).toEqual({
            discriminator: TokenInstruction.ConfidentialTransferExtension,
            confidentialTransferDiscriminator: ConfidentialTransferInstruction.EmptyAccount,
            proofInstructionOffset: -1,
        });
        expect(instruction.keys).toEqual([
            { pubkey: token, isSigner: false, isWritable: true },
            { pubkey: proofAccount, isSigner: false, isWritable: false },
            { pubkey: authority, isSigner: true, isWritable: false },
        ]);
    });

    it('constructs withdraw instruction data and proof metas', async () => {
        const token = (await Keypair.generate()).publicKey;
        const mint = (await Keypair.generate()).publicKey;
        const authority = (await Keypair.generate()).publicKey;
        const equalityRecord = (await Keypair.generate()).publicKey;
        const rangeRecord = (await Keypair.generate()).publicKey;
        const decryptableBalance = new Uint8Array(36).fill(1);

        const instruction = createConfidentialWithdrawInstruction(
            token,
            mint,
            authority,
            [],
            { equalityRecord, rangeRecord },
            5n,
            2,
            decryptableBalance,
            1,
            2,
        );
        expect(getConfidentialWithdrawInstructionDataDecoder().decode(instruction.data)).toEqual({
            discriminator: TokenInstruction.ConfidentialTransferExtension,
            confidentialTransferDiscriminator: ConfidentialTransferInstruction.Withdraw,
            amount: 5n,
            decimals: 2,
            newDecryptableAvailableBalance: decryptableBalance,
            equalityProofInstructionOffset: 1,
            rangeProofInstructionOffset: 2,
        });
        expect(instruction.keys).toEqual([
            { pubkey: token, isSigner: false, isWritable: true },
            { pubkey: mint, isSigner: false, isWritable: false },
            { pubkey: equalityRecord, isSigner: false, isWritable: false },
            { pubkey: rangeRecord, isSigner: false, isWritable: false },
            { pubkey: authority, isSigner: true, isWritable: false },
        ]);
    });

    it('constructs transfer instruction data and proof metas', async () => {
        const source = (await Keypair.generate()).publicKey;
        const mint = (await Keypair.generate()).publicKey;
        const destination = (await Keypair.generate()).publicKey;
        const authority = (await Keypair.generate()).publicKey;
        const equalityRecord = (await Keypair.generate()).publicKey;
        const ciphertextValidityRecord = (await Keypair.generate()).publicKey;
        const rangeRecord = (await Keypair.generate()).publicKey;
        const signerA = await Keypair.generate();
        const decryptableBalance = new Uint8Array(36).fill(1);
        const ciphertextLo = new Uint8Array(64).fill(2);
        const ciphertextHi = new Uint8Array(64).fill(3);

        const instruction = createConfidentialTransferInstruction(
            source,
            mint,
            destination,
            authority,
            [signerA],
            { equalityRecord, ciphertextValidityRecord, rangeRecord },
            decryptableBalance,
            ciphertextLo,
            ciphertextHi,
            1,
            2,
            3,
        );
        expect(getConfidentialTransferInstructionDataDecoder().decode(instruction.data)).toEqual({
            discriminator: TokenInstruction.ConfidentialTransferExtension,
            confidentialTransferDiscriminator: ConfidentialTransferInstruction.Transfer,
            newSourceDecryptableAvailableBalance: decryptableBalance,
            transferAmountAuditorCiphertextLo: ciphertextLo,
            transferAmountAuditorCiphertextHi: ciphertextHi,
            equalityProofInstructionOffset: 1,
            ciphertextValidityProofInstructionOffset: 2,
            rangeProofInstructionOffset: 3,
        });
        expect(instruction.keys).toEqual([
            { pubkey: source, isSigner: false, isWritable: true },
            { pubkey: mint, isSigner: false, isWritable: false },
            { pubkey: destination, isSigner: false, isWritable: true },
            { pubkey: equalityRecord, isSigner: false, isWritable: false },
            { pubkey: ciphertextValidityRecord, isSigner: false, isWritable: false },
            { pubkey: rangeRecord, isSigner: false, isWritable: false },
            { pubkey: authority, isSigner: false, isWritable: false },
            { pubkey: signerA.publicKey, isSigner: true, isWritable: false },
        ]);
    });

    it('constructs transfer-with-fee instruction data and proof metas', async () => {
        const source = (await Keypair.generate()).publicKey;
        const mint = (await Keypair.generate()).publicKey;
        const destination = (await Keypair.generate()).publicKey;
        const authority = (await Keypair.generate()).publicKey;
        const equalityRecord = (await Keypair.generate()).publicKey;
        const transferAmountCiphertextValidityRecord = (await Keypair.generate()).publicKey;
        const feeSigmaRecord = (await Keypair.generate()).publicKey;
        const feeCiphertextValidityRecord = (await Keypair.generate()).publicKey;
        const rangeRecord = (await Keypair.generate()).publicKey;
        const decryptableBalance = new Uint8Array(36).fill(1);
        const ciphertextLo = new Uint8Array(64).fill(2);
        const ciphertextHi = new Uint8Array(64).fill(3);

        const instruction = createConfidentialTransferWithFeeInstruction(
            source,
            mint,
            destination,
            authority,
            [],
            {
                equalityRecord,
                transferAmountCiphertextValidityRecord,
                feeSigmaRecord,
                feeCiphertextValidityRecord,
                rangeRecord,
            },
            decryptableBalance,
            ciphertextLo,
            ciphertextHi,
            1,
            2,
            3,
            4,
            5,
        );
        expect(getConfidentialTransferWithFeeInstructionDataDecoder().decode(instruction.data)).toEqual({
            discriminator: TokenInstruction.ConfidentialTransferExtension,
            confidentialTransferDiscriminator: ConfidentialTransferInstruction.TransferWithFee,
            newSourceDecryptableAvailableBalance: decryptableBalance,
            transferAmountAuditorCiphertextLo: ciphertextLo,
            transferAmountAuditorCiphertextHi: ciphertextHi,
            equalityProofInstructionOffset: 1,
            transferAmountCiphertextValidityProofInstructionOffset: 2,
            feeSigmaProofInstructionOffset: 3,
            feeCiphertextValidityProofInstructionOffset: 4,
            rangeProofInstructionOffset: 5,
        });
        expect(instruction.keys).toEqual([
            { pubkey: source, isSigner: false, isWritable: true },
            { pubkey: mint, isSigner: false, isWritable: false },
            { pubkey: destination, isSigner: false, isWritable: true },
            { pubkey: equalityRecord, isSigner: false, isWritable: false },
            { pubkey: transferAmountCiphertextValidityRecord, isSigner: false, isWritable: false },
            { pubkey: feeSigmaRecord, isSigner: false, isWritable: false },
            { pubkey: feeCiphertextValidityRecord, isSigner: false, isWritable: false },
            { pubkey: rangeRecord, isSigner: false, isWritable: false },
            { pubkey: authority, isSigner: true, isWritable: false },
        ]);
    });

    it('constructs configure-with-registry instruction data and metas', async () => {
        const token = (await Keypair.generate()).publicKey;
        const mint = (await Keypair.generate()).publicKey;
        const registry = (await Keypair.generate()).publicKey;
        const payer = (await Keypair.generate()).publicKey;

        const instruction = createConfigureConfidentialTransferAccountWithRegistryInstruction(
            token,
            mint,
            registry,
            payer,
        );
        expect(
            getConfigureConfidentialTransferAccountWithRegistryInstructionDataDecoder().decode(instruction.data),
        ).toEqual({
            discriminator: TokenInstruction.ConfidentialTransferExtension,
            confidentialTransferDiscriminator: ConfidentialTransferInstruction.ConfigureAccountWithRegistry,
        });
        expect(instruction.keys).toEqual([
            { pubkey: token, isSigner: false, isWritable: true },
            { pubkey: mint, isSigner: false, isWritable: false },
            { pubkey: registry, isSigner: false, isWritable: false },
            { pubkey: payer, isSigner: true, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ]);
    });

    it('rejects unsupported program ids for all instruction builders', async () => {
        const token = (await Keypair.generate()).publicKey;
        const mint = (await Keypair.generate()).publicKey;
        const destination = (await Keypair.generate()).publicKey;
        const authority = (await Keypair.generate()).publicKey;
        const proof = (await Keypair.generate()).publicKey;
        const registry = (await Keypair.generate()).publicKey;
        const decryptableBalance = new Uint8Array(36);
        const ciphertext = new Uint8Array(64);

        expect(() =>
            createInitializeConfidentialTransferMintInstruction(mint, authority, true, null, TOKEN_PROGRAM_ID),
        ).toThrow(TokenUnsupportedInstructionError);
        expect(() =>
            createUpdateConfidentialTransferMintInstruction(mint, authority, [], true, null, TOKEN_PROGRAM_ID),
        ).toThrow(TokenUnsupportedInstructionError);
        expect(() =>
            createConfigureConfidentialTransferAccountInstruction(
                token,
                mint,
                proof,
                authority,
                [],
                decryptableBalance,
                1n,
                0,
                TOKEN_PROGRAM_ID,
            ),
        ).toThrow(TokenUnsupportedInstructionError);
        expect(() =>
            createApproveConfidentialTransferAccountInstruction(token, mint, authority, [], TOKEN_PROGRAM_ID),
        ).toThrow(TokenUnsupportedInstructionError);
        expect(() =>
            createEmptyConfidentialTransferAccountInstruction(token, proof, authority, [], 0, TOKEN_PROGRAM_ID),
        ).toThrow(TokenUnsupportedInstructionError);
        expect(() => createConfidentialDepositInstruction(token, mint, authority, [], 1n, 2, TOKEN_PROGRAM_ID)).toThrow(
            TokenUnsupportedInstructionError,
        );
        expect(() =>
            createConfidentialWithdrawInstruction(
                token,
                mint,
                authority,
                [],
                { equalityRecord: proof },
                1n,
                2,
                decryptableBalance,
                1,
                2,
                TOKEN_PROGRAM_ID,
            ),
        ).toThrow(TokenUnsupportedInstructionError);
        expect(() =>
            createConfidentialTransferInstruction(
                token,
                mint,
                destination,
                authority,
                [],
                { equalityRecord: proof },
                decryptableBalance,
                ciphertext,
                ciphertext,
                1,
                2,
                3,
                TOKEN_PROGRAM_ID,
            ),
        ).toThrow(TokenUnsupportedInstructionError);
        expect(() =>
            createApplyConfidentialPendingBalanceInstruction(
                token,
                authority,
                [],
                1n,
                decryptableBalance,
                TOKEN_PROGRAM_ID,
            ),
        ).toThrow(TokenUnsupportedInstructionError);
        expect(() => createEnableConfidentialCreditsInstruction(token, authority, [], TOKEN_PROGRAM_ID)).toThrow(
            TokenUnsupportedInstructionError,
        );
        expect(() => createDisableConfidentialCreditsInstruction(token, authority, [], TOKEN_PROGRAM_ID)).toThrow(
            TokenUnsupportedInstructionError,
        );
        expect(() => createEnableNonConfidentialCreditsInstruction(token, authority, [], TOKEN_PROGRAM_ID)).toThrow(
            TokenUnsupportedInstructionError,
        );
        expect(() => createDisableNonConfidentialCreditsInstruction(token, authority, [], TOKEN_PROGRAM_ID)).toThrow(
            TokenUnsupportedInstructionError,
        );
        expect(() =>
            createConfidentialTransferWithFeeInstruction(
                token,
                mint,
                destination,
                authority,
                [],
                { equalityRecord: proof },
                decryptableBalance,
                ciphertext,
                ciphertext,
                1,
                2,
                3,
                4,
                5,
                TOKEN_PROGRAM_ID,
            ),
        ).toThrow(TokenUnsupportedInstructionError);
        expect(() =>
            createConfigureConfidentialTransferAccountWithRegistryInstruction(
                token,
                mint,
                registry,
                authority,
                SystemProgram.programId,
                TOKEN_PROGRAM_ID,
            ),
        ).toThrow(TokenUnsupportedInstructionError);
    });
});
