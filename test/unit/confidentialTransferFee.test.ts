import { describe, expect, it } from 'vitest';
import type { ReadonlyUint8Array } from '@solana/kit';
import {
    getDisableHarvestToMintInstructionDataDecoder,
    getEnableHarvestToMintInstructionDataDecoder,
    getHarvestWithheldTokensToMintForConfidentialTransferFeeInstructionDataDecoder,
    getInitializeConfidentialTransferFeeInstructionDataDecoder,
    getWithdrawWithheldTokensFromAccountsForConfidentialTransferFeeInstructionDataDecoder,
    getWithdrawWithheldTokensFromMintForConfidentialTransferFeeInstructionDataDecoder,
} from '@solana-program/token-2022';
import { Address, Keypair } from '@solana/web3.js';
import {
    ExtensionType,
    TOKEN_2022_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    TokenInstruction,
    getAccountLen,
    getMintLen,
} from '../../src';
import { TokenUnsupportedInstructionError } from '../../src/errors';
import type { Account } from '../../src/state/account';
import type { Mint } from '../../src/state/mint';
import {
    CONFIDENTIAL_TRANSFER_FEE_AMOUNT_SIZE,
    CONFIDENTIAL_TRANSFER_FEE_CONFIG_SIZE,
    ConfidentialTransferFeeAmountCodec,
    ConfidentialTransferFeeConfigCodec,
    ConfidentialTransferFeeInstruction,
    createDisableHarvestToMintInstruction,
    createEnableHarvestToMintInstruction,
    createHarvestWithheldTokensToMintForConfidentialTransferFeeInstruction,
    createInitializeConfidentialTransferFeeConfigInstruction,
    createWithdrawWithheldTokensFromAccountsForConfidentialTransferFeeInstruction,
    createWithdrawWithheldTokensFromMintForConfidentialTransferFeeInstruction,
    getConfidentialTransferFeeAmount,
    getConfidentialTransferFeeConfig,
} from '../../src/extensions/confidentialTransferFee/index';

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

function keyStrings(keys: { pubkey: Address }[]): string[] {
    return keys.map(key => key.pubkey.toBase58());
}

describe('confidential transfer fee extension', () => {
    it('decodes mint and account state', () => {
        const authority = new Address('11111111111111111111111111111112');
        const elgamalPubkey = new Address(new Uint8Array(32).fill(2));
        const withheldAmount = new Uint8Array(64).fill(3);
        const configData = ConfidentialTransferFeeConfigCodec.encode({
            authority: authority.toBase58(),
            withdrawWithheldAuthorityElGamalPubkey: elgamalPubkey.toBase58(),
            harvestToMintEnabled: true,
            withheldAmount,
        });
        const amountData = ConfidentialTransferFeeAmountCodec.encode({ withheldAmount });

        expect(configData).toHaveLength(129);
        expect(amountData).toHaveLength(64);
        expect(CONFIDENTIAL_TRANSFER_FEE_CONFIG_SIZE).toEqual(129);
        expect(CONFIDENTIAL_TRANSFER_FEE_AMOUNT_SIZE).toEqual(64);

        const config = getConfidentialTransferFeeConfig(
            mintWithTlv(tlv(ExtensionType.ConfidentialTransferFee, configData)),
        );
        const amount = getConfidentialTransferFeeAmount(
            accountWithTlv(tlv(ExtensionType.ConfidentialTransferFeeAmount, amountData)),
        );

        expect(config).toEqual({
            authority,
            withdrawWithheldAuthorityElGamalPubkey: elgamalPubkey,
            harvestToMintEnabled: true,
            withheldAmount,
        });
        expect(amount).toEqual({ withheldAmount });
    });

    it('returns null when extension TLV data is missing', () => {
        expect(getConfidentialTransferFeeConfig(mintWithTlv(Buffer.alloc(0)))).toBeNull();
        expect(getConfidentialTransferFeeAmount(accountWithTlv(Buffer.alloc(0)))).toBeNull();
    });

    it('treats an all-zero authority as null', () => {
        const configData = ConfidentialTransferFeeConfigCodec.encode({
            authority: Address.default.toBase58(),
            withdrawWithheldAuthorityElGamalPubkey: new Address(new Uint8Array(32).fill(2)).toBase58(),
            harvestToMintEnabled: false,
            withheldAmount: new Uint8Array(64),
        });

        const config = getConfidentialTransferFeeConfig(
            mintWithTlv(tlv(ExtensionType.ConfidentialTransferFee, configData)),
        );

        expect(config?.authority).toBeNull();
        expect(config?.harvestToMintEnabled).toEqual(false);
    });

    it('calculates mint and account sizes', () => {
        expect(getMintLen([ExtensionType.ConfidentialTransferFee])).toEqual(166 + 4 + 129);
        expect(getAccountLen([ExtensionType.ConfidentialTransferFeeAmount])).toEqual(166 + 4 + 64);
    });

    it('constructs initialize instruction data and account metas', async () => {
        const mint = (await Keypair.generate()).publicKey;
        const authority = (await Keypair.generate()).publicKey;
        const elgamalPubkey = new Address(new Uint8Array(32).fill(2));

        const initializeIx = createInitializeConfidentialTransferFeeConfigInstruction(mint, authority, elgamalPubkey);
        const decoded = getInitializeConfidentialTransferFeeInstructionDataDecoder().decode(initializeIx.data);

        expect(initializeIx.programId).toEqual(TOKEN_2022_PROGRAM_ID);
        expect(decoded).toEqual({
            discriminator: TokenInstruction.ConfidentialTransferFeeExtension,
            confidentialTransferFeeDiscriminator:
                ConfidentialTransferFeeInstruction.InitializeConfidentialTransferFeeConfig,
            authority: { __option: 'Some', value: authority.toBase58() },
            withdrawWithheldAuthorityElGamalPubkey: elgamalPubkey.toBase58(),
        });
        expect(initializeIx.keys).toEqual([{ pubkey: mint, isSigner: false, isWritable: true }]);

        const nullAuthorityIx = createInitializeConfidentialTransferFeeConfigInstruction(mint, null, elgamalPubkey);
        expect(
            getInitializeConfidentialTransferFeeInstructionDataDecoder().decode(nullAuthorityIx.data).authority,
        ).toEqual({
            __option: 'None',
        });
    });

    it('constructs withdraw-from-mint instruction data and account metas', async () => {
        const mint = (await Keypair.generate()).publicKey;
        const destination = (await Keypair.generate()).publicKey;
        const authority = (await Keypair.generate()).publicKey;
        const proofAccount = (await Keypair.generate()).publicKey;
        const decryptableBalance = new Uint8Array(36).fill(4);

        const instruction = createWithdrawWithheldTokensFromMintForConfidentialTransferFeeInstruction(
            mint,
            destination,
            authority,
            proofAccount,
            -1,
            decryptableBalance,
        );
        const decoded = getWithdrawWithheldTokensFromMintForConfidentialTransferFeeInstructionDataDecoder().decode(
            instruction.data,
        );

        expect(decoded).toEqual({
            discriminator: TokenInstruction.ConfidentialTransferFeeExtension,
            confidentialTransferFeeDiscriminator: ConfidentialTransferFeeInstruction.WithdrawWithheldTokensFromMint,
            proofInstructionOffset: -1,
            newDecryptableAvailableBalance: decryptableBalance,
        });
        expect(instruction.keys).toEqual([
            { pubkey: mint, isSigner: false, isWritable: true },
            { pubkey: destination, isSigner: false, isWritable: true },
            { pubkey: proofAccount, isSigner: false, isWritable: false },
            { pubkey: authority, isSigner: true, isWritable: false },
        ]);
    });

    it('constructs withdraw-from-mint multisig account metas', async () => {
        const mint = (await Keypair.generate()).publicKey;
        const destination = (await Keypair.generate()).publicKey;
        const authority = (await Keypair.generate()).publicKey;
        const proofAccount = (await Keypair.generate()).publicKey;
        const signerA = await Keypair.generate();
        const signerB = await Keypair.generate();

        const instruction = createWithdrawWithheldTokensFromMintForConfidentialTransferFeeInstruction(
            mint,
            destination,
            authority,
            proofAccount,
            0,
            new Uint8Array(36),
            [signerA, signerB],
        );

        expect(instruction.keys.slice(3)).toEqual([
            { pubkey: authority, isSigner: false, isWritable: false },
            { pubkey: signerA.publicKey, isSigner: true, isWritable: false },
            { pubkey: signerB.publicKey, isSigner: true, isWritable: false },
        ]);
    });

    it('constructs withdraw-from-accounts instruction data and account metas', async () => {
        const mint = (await Keypair.generate()).publicKey;
        const destination = (await Keypair.generate()).publicKey;
        const authority = (await Keypair.generate()).publicKey;
        const proofAccount = (await Keypair.generate()).publicKey;
        const sourceA = (await Keypair.generate()).publicKey;
        const sourceB = (await Keypair.generate()).publicKey;
        const decryptableBalance = new Uint8Array(36).fill(5);

        const instruction = createWithdrawWithheldTokensFromAccountsForConfidentialTransferFeeInstruction(
            mint,
            destination,
            authority,
            proofAccount,
            1,
            decryptableBalance,
            [sourceA, sourceB],
        );
        const decoded = getWithdrawWithheldTokensFromAccountsForConfidentialTransferFeeInstructionDataDecoder().decode(
            instruction.data,
        );

        expect(decoded).toEqual({
            discriminator: TokenInstruction.ConfidentialTransferFeeExtension,
            confidentialTransferFeeDiscriminator: ConfidentialTransferFeeInstruction.WithdrawWithheldTokensFromAccounts,
            numTokenAccounts: 2,
            proofInstructionOffset: 1,
            newDecryptableAvailableBalance: decryptableBalance,
        });
        expect(instruction.keys).toEqual([
            { pubkey: mint, isSigner: false, isWritable: false },
            { pubkey: destination, isSigner: false, isWritable: true },
            { pubkey: proofAccount, isSigner: false, isWritable: false },
            { pubkey: authority, isSigner: true, isWritable: false },
            { pubkey: sourceA, isSigner: false, isWritable: true },
            { pubkey: sourceB, isSigner: false, isWritable: true },
        ]);
    });

    it('constructs withdraw-from-accounts multisig account metas', async () => {
        const mint = (await Keypair.generate()).publicKey;
        const destination = (await Keypair.generate()).publicKey;
        const authority = (await Keypair.generate()).publicKey;
        const proofAccount = (await Keypair.generate()).publicKey;
        const source = (await Keypair.generate()).publicKey;
        const signerA = await Keypair.generate();
        const signerB = await Keypair.generate();

        const instruction = createWithdrawWithheldTokensFromAccountsForConfidentialTransferFeeInstruction(
            mint,
            destination,
            authority,
            proofAccount,
            0,
            new Uint8Array(36),
            [source],
            [signerA, signerB],
        );

        expect(instruction.keys.slice(3)).toEqual([
            { pubkey: authority, isSigner: false, isWritable: false },
            { pubkey: signerA.publicKey, isSigner: true, isWritable: false },
            { pubkey: signerB.publicKey, isSigner: true, isWritable: false },
            { pubkey: source, isSigner: false, isWritable: true },
        ]);
    });

    it('constructs harvest and harvest-toggle instruction data and account metas', async () => {
        const mint = (await Keypair.generate()).publicKey;
        const authority = (await Keypair.generate()).publicKey;
        const sourceA = (await Keypair.generate()).publicKey;
        const sourceB = (await Keypair.generate()).publicKey;
        const signerA = await Keypair.generate();
        const signerB = await Keypair.generate();

        const harvestIx = createHarvestWithheldTokensToMintForConfidentialTransferFeeInstruction(mint, [
            sourceA,
            sourceB,
        ]);
        expect(
            getHarvestWithheldTokensToMintForConfidentialTransferFeeInstructionDataDecoder().decode(harvestIx.data),
        ).toEqual({
            discriminator: TokenInstruction.ConfidentialTransferFeeExtension,
            confidentialTransferFeeDiscriminator: ConfidentialTransferFeeInstruction.HarvestWithheldTokensToMint,
        });
        expect(keyStrings(harvestIx.keys)).toEqual([mint, sourceA, sourceB].map(key => key.toBase58()));
        expect(harvestIx.keys.every(key => key.isWritable)).toEqual(true);

        const enableIx = createEnableHarvestToMintInstruction(mint, authority, [signerA, signerB]);
        expect(getEnableHarvestToMintInstructionDataDecoder().decode(enableIx.data)).toEqual({
            discriminator: TokenInstruction.ConfidentialTransferFeeExtension,
            confidentialTransferFeeDiscriminator: ConfidentialTransferFeeInstruction.EnableHarvestToMint,
        });
        expect(enableIx.keys).toEqual([
            { pubkey: mint, isSigner: false, isWritable: true },
            { pubkey: authority, isSigner: false, isWritable: false },
            { pubkey: signerA.publicKey, isSigner: true, isWritable: false },
            { pubkey: signerB.publicKey, isSigner: true, isWritable: false },
        ]);

        const disableIx = createDisableHarvestToMintInstruction(mint, authority, [signerA, signerB]);
        expect(getDisableHarvestToMintInstructionDataDecoder().decode(disableIx.data)).toEqual({
            discriminator: TokenInstruction.ConfidentialTransferFeeExtension,
            confidentialTransferFeeDiscriminator: ConfidentialTransferFeeInstruction.DisableHarvestToMint,
        });
        expect(disableIx.keys).toEqual(enableIx.keys);
    });

    it('rejects unsupported program ids for all instruction builders', async () => {
        const mint = (await Keypair.generate()).publicKey;
        const destination = (await Keypair.generate()).publicKey;
        const authority = (await Keypair.generate()).publicKey;
        const proofAccount = (await Keypair.generate()).publicKey;
        const source = (await Keypair.generate()).publicKey;
        const decryptableBalance = new Uint8Array(36);
        const elgamalPubkey = new Address(new Uint8Array(32).fill(2));

        expect(() =>
            createInitializeConfidentialTransferFeeConfigInstruction(mint, authority, elgamalPubkey, TOKEN_PROGRAM_ID),
        ).toThrow(TokenUnsupportedInstructionError);
        expect(() =>
            createWithdrawWithheldTokensFromMintForConfidentialTransferFeeInstruction(
                mint,
                destination,
                authority,
                proofAccount,
                0,
                decryptableBalance,
                [],
                TOKEN_PROGRAM_ID,
            ),
        ).toThrow(TokenUnsupportedInstructionError);
        expect(() =>
            createWithdrawWithheldTokensFromAccountsForConfidentialTransferFeeInstruction(
                mint,
                destination,
                authority,
                proofAccount,
                0,
                decryptableBalance,
                [source],
                [],
                TOKEN_PROGRAM_ID,
            ),
        ).toThrow(TokenUnsupportedInstructionError);
        expect(() =>
            createHarvestWithheldTokensToMintForConfidentialTransferFeeInstruction(mint, [source], TOKEN_PROGRAM_ID),
        ).toThrow(TokenUnsupportedInstructionError);
        expect(() => createEnableHarvestToMintInstruction(mint, authority, [], TOKEN_PROGRAM_ID)).toThrow(
            TokenUnsupportedInstructionError,
        );
        expect(() => createDisableHarvestToMintInstruction(mint, authority, [], TOKEN_PROGRAM_ID)).toThrow(
            TokenUnsupportedInstructionError,
        );
    });
});
