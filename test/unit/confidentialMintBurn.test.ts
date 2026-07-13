import { describe, expect, it } from 'vitest';
import type { ReadonlyUint8Array } from '@solana/kit';
import {
    getApplyConfidentialPendingBurnInstructionDataDecoder,
    getConfidentialBurnInstructionDataDecoder,
    getConfidentialMintInstructionDataDecoder,
    getInitializeConfidentialMintBurnInstructionDataDecoder,
    getRotateSupplyElgamalPubkeyInstructionDataDecoder,
    getUpdateConfidentialMintBurnDecryptableSupplyInstructionDataDecoder,
} from '@solana-program/token-2022';
import { Address, Keypair } from '@solana/web3.js';
import { ExtensionType, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, TokenInstruction, getMintLen } from '../../src';
import { TokenUnsupportedInstructionError } from '../../src/errors';
import type { Mint } from '../../src/state/mint';
import {
    CONFIDENTIAL_MINT_BURN_SIZE,
    ConfidentialMintBurnCodec,
    ConfidentialMintBurnInstruction,
    createApplyConfidentialPendingBurnInstruction,
    createConfidentialBurnInstruction,
    createConfidentialMintBurnInstruction,
    createInitializeConfidentialMintBurnInstruction,
    createRotateSupplyElGamalPubkeyInstruction,
    createUpdateConfidentialMintBurnDecryptableSupplyInstruction,
    getConfidentialMintBurn,
} from '../../src/extensions/confidentialMintBurn/index';

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

describe('confidential mint burn extension', () => {
    it('decodes mint state', () => {
        const confidentialSupply = new Uint8Array(64).fill(1);
        const decryptableSupply = new Uint8Array(36).fill(2);
        const supplyElGamalPubkey = new Address(new Uint8Array(32).fill(3));
        const pendingBurn = new Uint8Array(64).fill(4);
        const data = ConfidentialMintBurnCodec.encode({
            confidentialSupply,
            decryptableSupply,
            supplyElGamalPubkey: supplyElGamalPubkey.toBase58(),
            pendingBurn,
        });

        expect(data).toHaveLength(196);
        expect(CONFIDENTIAL_MINT_BURN_SIZE).toEqual(196);
        expect(ConfidentialMintBurnCodec.decode(data).decryptableSupply).toHaveLength(36);
        expect(getMintLen([ExtensionType.ConfidentialMintBurn])).toEqual(166 + 4 + 196);

        const state = getConfidentialMintBurn(mintWithTlv(tlv(ExtensionType.ConfidentialMintBurn, data)));

        expect(state).toEqual({
            confidentialSupply,
            decryptableSupply,
            supplyElGamalPubkey,
            pendingBurn,
        });
    });

    it('returns null when extension TLV data is missing', () => {
        expect(getConfidentialMintBurn(mintWithTlv(Buffer.alloc(0)))).toBeNull();
    });

    it('constructs initialize instruction data and account metas', async () => {
        const mint = (await Keypair.generate()).publicKey;
        const supplyElGamalPubkey = new Address(new Uint8Array(32).fill(3));
        const decryptableSupply = new Uint8Array(36).fill(2);

        const instruction = createInitializeConfidentialMintBurnInstruction(
            mint,
            supplyElGamalPubkey,
            decryptableSupply,
        );
        const decoded = getInitializeConfidentialMintBurnInstructionDataDecoder().decode(instruction.data);

        expect(instruction.programId).toEqual(TOKEN_2022_PROGRAM_ID);
        expect(decoded).toEqual({
            discriminator: TokenInstruction.ConfidentialMintBurnExtension,
            confidentialMintBurnDiscriminator: ConfidentialMintBurnInstruction.InitializeMint,
            supplyElgamalPubkey: supplyElGamalPubkey.toBase58(),
            decryptableSupply,
        });
        expect(instruction.keys).toEqual([{ pubkey: mint, isSigner: false, isWritable: true }]);
    });

    it('constructs rotate supply ElGamal pubkey instruction data and account metas', async () => {
        const mint = (await Keypair.generate()).publicKey;
        const proofAccount = (await Keypair.generate()).publicKey;
        const authority = (await Keypair.generate()).publicKey;
        const supplyElGamalPubkey = new Address(new Uint8Array(32).fill(3));

        const instruction = createRotateSupplyElGamalPubkeyInstruction(
            mint,
            proofAccount,
            authority,
            [],
            supplyElGamalPubkey,
            -1,
        );
        const decoded = getRotateSupplyElgamalPubkeyInstructionDataDecoder().decode(instruction.data);

        expect(decoded).toEqual({
            discriminator: TokenInstruction.ConfidentialMintBurnExtension,
            confidentialMintBurnDiscriminator: ConfidentialMintBurnInstruction.RotateSupplyElGamalPubkey,
            newSupplyElgamalPubkey: supplyElGamalPubkey.toBase58(),
            proofInstructionOffset: -1,
        });
        expect(instruction.keys).toEqual([
            { pubkey: mint, isSigner: false, isWritable: true },
            { pubkey: proofAccount, isSigner: false, isWritable: false },
            { pubkey: authority, isSigner: true, isWritable: false },
        ]);
    });

    it('constructs rotate supply ElGamal pubkey multisig account metas', async () => {
        const mint = (await Keypair.generate()).publicKey;
        const proofAccount = (await Keypair.generate()).publicKey;
        const authority = (await Keypair.generate()).publicKey;
        const signerA = await Keypair.generate();
        const signerB = await Keypair.generate();

        const instruction = createRotateSupplyElGamalPubkeyInstruction(
            mint,
            proofAccount,
            authority,
            [signerA, signerB],
            new Address(new Uint8Array(32).fill(3)),
            0,
        );

        expect(instruction.keys.slice(2)).toEqual([
            { pubkey: authority, isSigner: false, isWritable: false },
            { pubkey: signerA.publicKey, isSigner: true, isWritable: false },
            { pubkey: signerB.publicKey, isSigner: true, isWritable: false },
        ]);
    });

    it('constructs update decryptable supply instruction data and account metas', async () => {
        const mint = (await Keypair.generate()).publicKey;
        const authority = (await Keypair.generate()).publicKey;
        const signerA = await Keypair.generate();
        const newDecryptableSupply = new Uint8Array(36).fill(2);

        const instruction = createUpdateConfidentialMintBurnDecryptableSupplyInstruction(
            mint,
            authority,
            [signerA],
            newDecryptableSupply,
        );
        const decoded = getUpdateConfidentialMintBurnDecryptableSupplyInstructionDataDecoder().decode(instruction.data);

        expect(decoded).toEqual({
            discriminator: TokenInstruction.ConfidentialMintBurnExtension,
            confidentialMintBurnDiscriminator: ConfidentialMintBurnInstruction.UpdateDecryptableSupply,
            newDecryptableSupply,
        });
        expect(instruction.keys).toEqual([
            { pubkey: mint, isSigner: false, isWritable: true },
            { pubkey: authority, isSigner: false, isWritable: false },
            { pubkey: signerA.publicKey, isSigner: true, isWritable: false },
        ]);
    });

    it('constructs confidential mint instruction data and account metas', async () => {
        const token = (await Keypair.generate()).publicKey;
        const mint = (await Keypair.generate()).publicKey;
        const authority = (await Keypair.generate()).publicKey;
        const instructionsSysvar = (await Keypair.generate()).publicKey;
        const equalityRecord = (await Keypair.generate()).publicKey;
        const ciphertextValidityRecord = (await Keypair.generate()).publicKey;
        const rangeRecord = (await Keypair.generate()).publicKey;
        const signerA = await Keypair.generate();
        const decryptableSupply = new Uint8Array(36).fill(2);
        const ciphertextLo = new Uint8Array(64).fill(4);
        const ciphertextHi = new Uint8Array(64).fill(5);

        const instruction = createConfidentialMintBurnInstruction(
            token,
            mint,
            authority,
            [signerA],
            { equalityRecord, ciphertextValidityRecord, rangeRecord },
            decryptableSupply,
            ciphertextLo,
            ciphertextHi,
            1,
            2,
            3,
        );
        const decoded = getConfidentialMintInstructionDataDecoder().decode(instruction.data);

        expect(decoded).toEqual({
            discriminator: TokenInstruction.ConfidentialMintBurnExtension,
            confidentialMintBurnDiscriminator: ConfidentialMintBurnInstruction.Mint,
            newDecryptableSupply: decryptableSupply,
            mintAmountAuditorCiphertextLo: ciphertextLo,
            mintAmountAuditorCiphertextHi: ciphertextHi,
            equalityProofInstructionOffset: 1,
            ciphertextValidityProofInstructionOffset: 2,
            rangeProofInstructionOffset: 3,
        });
        expect(instruction.keys).toEqual([
            { pubkey: token, isSigner: false, isWritable: true },
            { pubkey: mint, isSigner: false, isWritable: true },
            { pubkey: equalityRecord, isSigner: false, isWritable: false },
            { pubkey: ciphertextValidityRecord, isSigner: false, isWritable: false },
            { pubkey: rangeRecord, isSigner: false, isWritable: false },
            { pubkey: authority, isSigner: false, isWritable: false },
            { pubkey: signerA.publicKey, isSigner: true, isWritable: false },
        ]);

        const sysvarInstruction = createConfidentialMintBurnInstruction(
            token,
            mint,
            authority,
            [],
            { instructionsSysvar },
            decryptableSupply,
            ciphertextLo,
            ciphertextHi,
            1,
            2,
            3,
        );
        expect(sysvarInstruction.keys).toEqual([
            { pubkey: token, isSigner: false, isWritable: true },
            { pubkey: mint, isSigner: false, isWritable: true },
            { pubkey: instructionsSysvar, isSigner: false, isWritable: false },
            { pubkey: authority, isSigner: true, isWritable: false },
        ]);
    });

    it('constructs confidential burn instruction data and account metas', async () => {
        const token = (await Keypair.generate()).publicKey;
        const mint = (await Keypair.generate()).publicKey;
        const authority = (await Keypair.generate()).publicKey;
        const instructionsSysvar = (await Keypair.generate()).publicKey;
        const equalityRecord = (await Keypair.generate()).publicKey;
        const ciphertextValidityRecord = (await Keypair.generate()).publicKey;
        const rangeRecord = (await Keypair.generate()).publicKey;
        const signerA = await Keypair.generate();
        const decryptableBalance = new Uint8Array(36).fill(2);
        const ciphertextLo = new Uint8Array(64).fill(4);
        const ciphertextHi = new Uint8Array(64).fill(5);

        const instruction = createConfidentialBurnInstruction(
            token,
            mint,
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
        const decoded = getConfidentialBurnInstructionDataDecoder().decode(instruction.data);

        expect(decoded).toEqual({
            discriminator: TokenInstruction.ConfidentialMintBurnExtension,
            confidentialMintBurnDiscriminator: ConfidentialMintBurnInstruction.Burn,
            newDecryptableAvailableBalance: decryptableBalance,
            burnAmountAuditorCiphertextLo: ciphertextLo,
            burnAmountAuditorCiphertextHi: ciphertextHi,
            equalityProofInstructionOffset: 1,
            ciphertextValidityProofInstructionOffset: 2,
            rangeProofInstructionOffset: 3,
        });
        expect(instruction.keys).toEqual([
            { pubkey: token, isSigner: false, isWritable: true },
            { pubkey: mint, isSigner: false, isWritable: true },
            { pubkey: equalityRecord, isSigner: false, isWritable: false },
            { pubkey: ciphertextValidityRecord, isSigner: false, isWritable: false },
            { pubkey: rangeRecord, isSigner: false, isWritable: false },
            { pubkey: authority, isSigner: false, isWritable: false },
            { pubkey: signerA.publicKey, isSigner: true, isWritable: false },
        ]);

        const sysvarInstruction = createConfidentialBurnInstruction(
            token,
            mint,
            authority,
            [],
            { instructionsSysvar },
            decryptableBalance,
            ciphertextLo,
            ciphertextHi,
            1,
            2,
            3,
        );
        expect(sysvarInstruction.keys).toEqual([
            { pubkey: token, isSigner: false, isWritable: true },
            { pubkey: mint, isSigner: false, isWritable: true },
            { pubkey: instructionsSysvar, isSigner: false, isWritable: false },
            { pubkey: authority, isSigner: true, isWritable: false },
        ]);
    });

    it('constructs apply pending burn instruction data and account metas', async () => {
        const mint = (await Keypair.generate()).publicKey;
        const authority = (await Keypair.generate()).publicKey;
        const signerA = await Keypair.generate();

        const instruction = createApplyConfidentialPendingBurnInstruction(mint, authority, [signerA]);
        const decoded = getApplyConfidentialPendingBurnInstructionDataDecoder().decode(instruction.data);

        expect(decoded).toEqual({
            discriminator: TokenInstruction.ConfidentialMintBurnExtension,
            confidentialMintBurnDiscriminator: ConfidentialMintBurnInstruction.ApplyPendingBurn,
        });
        expect(instruction.keys).toEqual([
            { pubkey: mint, isSigner: false, isWritable: true },
            { pubkey: authority, isSigner: false, isWritable: false },
            { pubkey: signerA.publicKey, isSigner: true, isWritable: false },
        ]);
    });

    it('rejects unsupported program ids for all instruction builders', async () => {
        const token = (await Keypair.generate()).publicKey;
        const mint = (await Keypair.generate()).publicKey;
        const authority = (await Keypair.generate()).publicKey;
        const proofAccount = (await Keypair.generate()).publicKey;
        const supplyElGamalPubkey = new Address(new Uint8Array(32).fill(3));
        const decryptableBalance = new Uint8Array(36);
        const ciphertextLo = new Uint8Array(64);
        const ciphertextHi = new Uint8Array(64);

        expect(() =>
            createInitializeConfidentialMintBurnInstruction(
                mint,
                supplyElGamalPubkey,
                decryptableBalance,
                TOKEN_PROGRAM_ID,
            ),
        ).toThrow(TokenUnsupportedInstructionError);
        expect(() =>
            createRotateSupplyElGamalPubkeyInstruction(
                mint,
                proofAccount,
                authority,
                [],
                supplyElGamalPubkey,
                0,
                TOKEN_PROGRAM_ID,
            ),
        ).toThrow(TokenUnsupportedInstructionError);
        expect(() =>
            createUpdateConfidentialMintBurnDecryptableSupplyInstruction(
                mint,
                authority,
                [],
                decryptableBalance,
                TOKEN_PROGRAM_ID,
            ),
        ).toThrow(TokenUnsupportedInstructionError);
        expect(() =>
            createConfidentialMintBurnInstruction(
                token,
                mint,
                authority,
                [],
                { instructionsSysvar: proofAccount },
                decryptableBalance,
                ciphertextLo,
                ciphertextHi,
                1,
                2,
                3,
                TOKEN_PROGRAM_ID,
            ),
        ).toThrow(TokenUnsupportedInstructionError);
        expect(() =>
            createConfidentialBurnInstruction(
                token,
                mint,
                authority,
                [],
                { instructionsSysvar: proofAccount },
                decryptableBalance,
                ciphertextLo,
                ciphertextHi,
                1,
                2,
                3,
                TOKEN_PROGRAM_ID,
            ),
        ).toThrow(TokenUnsupportedInstructionError);
        expect(() => createApplyConfidentialPendingBurnInstruction(mint, authority, [], TOKEN_PROGRAM_ID)).toThrow(
            TokenUnsupportedInstructionError,
        );
    });
});
