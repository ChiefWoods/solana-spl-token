import { describe, expect, it } from 'vitest';
import { Keypair, TransactionInstruction } from '@solana/web3.js';
import {
    TOKEN_2022_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    TokenInstruction,
    createBatchInstruction,
    createTransferInstruction,
    createWithdrawExcessLamportsInstruction,
    decodeBatchInstruction,
    decodeInstruction,
    isBatchInstruction,
} from '../../src';

describe('batch', () => {
    it('creates and decodes Batch instructions', async () => {
        const source = (await Keypair.generate()).publicKey;
        const destination = (await Keypair.generate()).publicKey;
        const owner = (await Keypair.generate()).publicKey;

        const transfer = createTransferInstruction(source, destination, owner, 5n);
        const withdraw = createWithdrawExcessLamportsInstruction(source, destination, owner);
        const batch = createBatchInstruction([transfer, withdraw]);
        const decoded = decodeBatchInstruction(batch);
        const genericDecoded = decodeInstruction(batch);

        expect(batch.programId).toEqual(TOKEN_PROGRAM_ID);
        expect(batch.data[0]).toEqual(TokenInstruction.Batch);
        expect(batch.keys).toEqual([...transfer.keys, ...withdraw.keys]);
        expect(decoded.data.entries).toHaveLength(2);
        expect(decoded.data.entries[0].keys).toEqual(transfer.keys);
        expect(decoded.data.entries[0].decodedInstruction?.data.instruction).toEqual(TokenInstruction.Transfer);
        expect(decoded.data.entries[1].keys).toEqual(withdraw.keys);
        expect(decoded.data.entries[1].decodedInstruction?.data.instruction).toEqual(
            TokenInstruction.WithdrawExcessLamports,
        );
        expect(isBatchInstruction(genericDecoded)).toEqual(true);
    });

    it('rejects nested Batch instructions', async () => {
        const source = (await Keypair.generate()).publicKey;
        const destination = (await Keypair.generate()).publicKey;
        const owner = (await Keypair.generate()).publicKey;
        const transfer = createTransferInstruction(source, destination, owner, 5n);
        const batch = createBatchInstruction([transfer]);

        expect(() => createBatchInstruction([batch])).toThrow('Batch instructions cannot be nested');
        expect(() =>
            decodeBatchInstruction(
                new TransactionInstruction({
                    keys: batch.keys,
                    programId: TOKEN_PROGRAM_ID,
                    data: Buffer.from([TokenInstruction.Batch, batch.keys.length, batch.data.length, ...batch.data]),
                }),
            ),
        ).toThrow('Batch instructions cannot be nested');
    });

    it('rejects Batch children with u8 overflows', async () => {
        const account = (await Keypair.generate()).publicKey;
        const tooManyAccounts = new TransactionInstruction({
            keys: Array.from({ length: 256 }, () => ({ pubkey: account, isSigner: false, isWritable: false })),
            programId: TOKEN_PROGRAM_ID,
            data: Buffer.from([TokenInstruction.SyncNative]),
        });
        const tooMuchData = new TransactionInstruction({
            keys: [],
            programId: TOKEN_PROGRAM_ID,
            data: Buffer.alloc(256),
        });

        expect(() => createBatchInstruction([tooManyAccounts])).toThrow('at most 255 accounts');
        expect(() => createBatchInstruction([tooMuchData])).toThrow('at most 255 bytes');
    });

    it('rejects Batch children for a different token program', async () => {
        const source = (await Keypair.generate()).publicKey;
        const destination = (await Keypair.generate()).publicKey;
        const owner = (await Keypair.generate()).publicKey;
        const transfer = createTransferInstruction(source, destination, owner, 5n, [], TOKEN_2022_PROGRAM_ID);

        expect(() => createBatchInstruction([transfer], TOKEN_PROGRAM_ID)).toThrow('same programId');
    });

    it('preserves undecodable Batch entries', async () => {
        const account = (await Keypair.generate()).publicKey;
        const unknown = Buffer.from([254]);
        const instruction = new TransactionInstruction({
            keys: [{ pubkey: account, isSigner: false, isWritable: false }],
            programId: TOKEN_PROGRAM_ID,
            data: Buffer.from([TokenInstruction.Batch, 1, unknown.length, ...unknown]),
        });

        const decoded = decodeBatchInstruction(instruction);

        expect(decoded.data.entries[0].instructionData).toEqual(unknown);
        expect(decoded.data.entries[0].decodedInstruction).toEqual(null);
    });

    it('rejects Batch entries that reference missing account metas', async () => {
        expect(() =>
            decodeBatchInstruction(
                new TransactionInstruction({
                    keys: [],
                    programId: TOKEN_PROGRAM_ID,
                    data: Buffer.from([TokenInstruction.Batch, 1, 1, TokenInstruction.SyncNative]),
                }),
            ),
        ).toThrow();
    });

    it('keeps the discriminator stable', () => {
        expect(TokenInstruction.Batch).toEqual(255);
    });
});
