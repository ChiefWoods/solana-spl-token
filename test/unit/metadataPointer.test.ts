import { describe, expect, it } from 'vitest';
import { Address, Keypair, TransactionInstruction } from '@solana/web3.js';
import type { Mint } from '../../src';
import {
    TOKEN_2022_PROGRAM_ID,
    createInitializeMetadataPointerInstruction,
    createUpdateMetadataPointerInstruction,
    getMetadataPointerState,
} from '../../src';

const AUTHORITY_ADDRESS_BYTES = Buffer.alloc(32).fill(8);
const METADATA_ADDRESS_BYTES = Buffer.alloc(32).fill(5);
const NULL_OPTIONAL_NONZERO_PUBKEY_BYTES = Buffer.alloc(32).fill(0);

describe('SPL Token 2022 MetadataPointer Extension', () => {
    it('can create InitializeMetadataPointerInstruction', async () => {
        const mint = (await Keypair.generate()).publicKey;
        const authority = new Address(AUTHORITY_ADDRESS_BYTES);
        const metadataAddress = new Address(METADATA_ADDRESS_BYTES);
        const instruction = createInitializeMetadataPointerInstruction(
            mint,
            authority,
            metadataAddress,
            TOKEN_2022_PROGRAM_ID,
        );
        expect(instruction).toEqual(
            new TransactionInstruction({
                programId: TOKEN_2022_PROGRAM_ID,
                keys: [{ isSigner: false, isWritable: true, pubkey: mint }],
                data: Buffer.concat([
                    Buffer.from([
                        39, // Token instruction discriminator
                        0, // MetadataPointer instruction discriminator
                    ]),
                    AUTHORITY_ADDRESS_BYTES,
                    METADATA_ADDRESS_BYTES,
                ]),
            }),
        );
    });
    it('can create UpdateMetadataPointerInstruction', async () => {
        const mint = (await Keypair.generate()).publicKey;
        const authority = (await Keypair.generate()).publicKey;
        const metadataAddress = new Address(METADATA_ADDRESS_BYTES);
        const instruction = createUpdateMetadataPointerInstruction(mint, authority, metadataAddress);
        expect(instruction).toEqual(
            new TransactionInstruction({
                programId: TOKEN_2022_PROGRAM_ID,
                keys: [
                    { isSigner: false, isWritable: true, pubkey: mint },
                    { isSigner: true, isWritable: false, pubkey: authority },
                ],
                data: Buffer.concat([
                    Buffer.from([
                        39, // Token instruction discriminator
                        1, // MetadataPointer instruction discriminator
                    ]),
                    METADATA_ADDRESS_BYTES,
                ]),
            }),
        );
    });
    it('can create UpdateMetadataPointerInstruction to none', async () => {
        const mint = (await Keypair.generate()).publicKey;
        const authority = (await Keypair.generate()).publicKey;
        const metadataAddress = null;
        const instruction = createUpdateMetadataPointerInstruction(mint, authority, metadataAddress);
        expect(instruction).toEqual(
            new TransactionInstruction({
                programId: TOKEN_2022_PROGRAM_ID,
                keys: [
                    { isSigner: false, isWritable: true, pubkey: mint },
                    { isSigner: true, isWritable: false, pubkey: authority },
                ],
                data: Buffer.concat([
                    Buffer.from([
                        39, // Token instruction discriminator
                        1, // MetadataPointer instruction discriminator
                    ]),
                    NULL_OPTIONAL_NONZERO_PUBKEY_BYTES,
                ]),
            }),
        );
    });
    it('can get state with authority and metadata address', async () => {
        const mintInfo = {
            tlvData: Buffer.concat([
                Buffer.from([
                    // Extension discriminator
                    18, 0,
                    // Extension length
                    64, 0,
                ]),
                AUTHORITY_ADDRESS_BYTES,
                METADATA_ADDRESS_BYTES,
            ]),
        } as Mint;
        const metadataPointer = getMetadataPointerState(mintInfo);
        expect(metadataPointer).toEqual({
            authority: new Address(AUTHORITY_ADDRESS_BYTES),
            metadataAddress: new Address(METADATA_ADDRESS_BYTES),
        });
    });
    it('can get state with only metadata address', async () => {
        const mintInfo = {
            tlvData: Buffer.concat([
                Buffer.from([
                    // Extension discriminator
                    18, 0,
                    // Extension length
                    64, 0,
                ]),
                NULL_OPTIONAL_NONZERO_PUBKEY_BYTES,
                METADATA_ADDRESS_BYTES,
            ]),
        } as Mint;
        const metadataPointer = getMetadataPointerState(mintInfo);
        expect(metadataPointer).toEqual({
            authority: null,
            metadataAddress: new Address(METADATA_ADDRESS_BYTES),
        });
    });
    it('can get state with only authority address', async () => {
        const mintInfo = {
            tlvData: Buffer.concat([
                Buffer.from([
                    // Extension discriminator
                    18, 0,
                    // Extension length
                    64, 0,
                ]),
                AUTHORITY_ADDRESS_BYTES,
                NULL_OPTIONAL_NONZERO_PUBKEY_BYTES,
            ]),
        } as Mint;
        const metadataPointer = getMetadataPointerState(mintInfo);
        expect(metadataPointer).toEqual({
            authority: new Address(AUTHORITY_ADDRESS_BYTES),
            metadataAddress: null,
        });
    });
});
