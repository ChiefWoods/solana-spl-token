import { Address, Keypair, TransactionInstruction } from '@solana/web3.js';
import { expect } from 'chai';
import type { Mint } from '../../src';
import {
    TOKEN_2022_PROGRAM_ID,
    createInitializeGroupMemberPointerInstruction,
    createUpdateGroupMemberPointerInstruction,
    getGroupMemberPointerState,
} from '../../src';

const AUTHORITY_ADDRESS_BYTES = Buffer.alloc(32).fill(8);
const GROUP_MEMBER_ADDRESS_BYTES = Buffer.alloc(32).fill(5);
const NULL_OPTIONAL_NONZERO_PUBKEY_BYTES = Buffer.alloc(32).fill(0);

describe('SPL Token 2022 GroupMemberPointer Extension', () => {
    it('can create InitializeGroupMemberPointerInstruction', async () => {
        const mint = (await Keypair.generate()).publicKey;
        const authority = new Address(AUTHORITY_ADDRESS_BYTES);
        const memberAddress = new Address(GROUP_MEMBER_ADDRESS_BYTES);
        const instruction = createInitializeGroupMemberPointerInstruction(
            mint,
            authority,
            memberAddress,
            TOKEN_2022_PROGRAM_ID,
        );
        expect(instruction).to.deep.equal(
            new TransactionInstruction({
                programId: TOKEN_2022_PROGRAM_ID,
                keys: [{ isSigner: false, isWritable: true, pubkey: mint }],
                data: Buffer.concat([
                    Buffer.from([
                        41, // Token instruction discriminator
                        0, // GroupMemberPointer instruction discriminator
                    ]),
                    AUTHORITY_ADDRESS_BYTES,
                    GROUP_MEMBER_ADDRESS_BYTES,
                ]),
            }),
        );
    });
    it('can create UpdateGroupMemberPointerInstruction', async () => {
        const mint = (await Keypair.generate()).publicKey;
        const authority = (await Keypair.generate()).publicKey;
        const memberAddress = new Address(GROUP_MEMBER_ADDRESS_BYTES);
        const instruction = createUpdateGroupMemberPointerInstruction(mint, authority, memberAddress);
        expect(instruction).to.deep.equal(
            new TransactionInstruction({
                programId: TOKEN_2022_PROGRAM_ID,
                keys: [
                    { isSigner: false, isWritable: true, pubkey: mint },
                    { isSigner: true, isWritable: false, pubkey: authority },
                ],
                data: Buffer.concat([
                    Buffer.from([
                        41, // Token instruction discriminator
                        1, // GroupMemberPointer instruction discriminator
                    ]),
                    GROUP_MEMBER_ADDRESS_BYTES,
                ]),
            }),
        );
    });
    it('can create UpdateGroupMemberPointerInstruction to none', async () => {
        const mint = (await Keypair.generate()).publicKey;
        const authority = (await Keypair.generate()).publicKey;
        const memberAddress = null;
        const instruction = createUpdateGroupMemberPointerInstruction(mint, authority, memberAddress);
        expect(instruction).to.deep.equal(
            new TransactionInstruction({
                programId: TOKEN_2022_PROGRAM_ID,
                keys: [
                    { isSigner: false, isWritable: true, pubkey: mint },
                    { isSigner: true, isWritable: false, pubkey: authority },
                ],
                data: Buffer.concat([
                    Buffer.from([
                        41, // Token instruction discriminator
                        1, // GroupMemberPointer instruction discriminator
                    ]),
                    NULL_OPTIONAL_NONZERO_PUBKEY_BYTES,
                ]),
            }),
        );
    });
    it('can get state with authority and group address', async () => {
        const mintInfo = {
            tlvData: Buffer.concat([
                Buffer.from([
                    // Extension discriminator
                    22, 0,
                    // Extension length
                    64, 0,
                ]),
                AUTHORITY_ADDRESS_BYTES,
                GROUP_MEMBER_ADDRESS_BYTES,
            ]),
        } as Mint;
        const groupPointer = getGroupMemberPointerState(mintInfo);
        expect(groupPointer).to.deep.equal({
            authority: new Address(AUTHORITY_ADDRESS_BYTES),
            memberAddress: new Address(GROUP_MEMBER_ADDRESS_BYTES),
        });
    });
    it('can get state with only group address', async () => {
        const mintInfo = {
            tlvData: Buffer.concat([
                Buffer.from([
                    // Extension discriminator
                    22, 0,
                    // Extension length
                    64, 0,
                ]),
                NULL_OPTIONAL_NONZERO_PUBKEY_BYTES,
                GROUP_MEMBER_ADDRESS_BYTES,
            ]),
        } as Mint;
        const groupPointer = getGroupMemberPointerState(mintInfo);
        expect(groupPointer).to.deep.equal({
            authority: null,
            memberAddress: new Address(GROUP_MEMBER_ADDRESS_BYTES),
        });
    });
    it('can get state with only authority address', async () => {
        const mintInfo = {
            tlvData: Buffer.concat([
                Buffer.from([
                    // Extension discriminator
                    22, 0,
                    // Extension length
                    64, 0,
                ]),
                AUTHORITY_ADDRESS_BYTES,
                NULL_OPTIONAL_NONZERO_PUBKEY_BYTES,
            ]),
        } as Mint;
        const groupPointer = getGroupMemberPointerState(mintInfo);
        expect(groupPointer).to.deep.equal({
            authority: new Address(AUTHORITY_ADDRESS_BYTES),
            memberAddress: null,
        });
    });
});
