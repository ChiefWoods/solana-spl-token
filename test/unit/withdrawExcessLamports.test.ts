import { describe, expect, it } from 'vitest';
import { Keypair } from '@solana/web3.js';
import {
    TOKEN_PROGRAM_ID,
    TokenInstruction,
    createWithdrawExcessLamportsInstruction,
    decodeInstruction,
    decodeWithdrawExcessLamportsInstruction,
    isWithdrawExcessLamportsInstruction,
} from '../../src';

describe('withdrawExcessLamports', () => {
    it('creates and decodes WithdrawExcessLamports', async () => {
        const source = (await Keypair.generate()).publicKey;
        const destination = (await Keypair.generate()).publicKey;
        const authority = (await Keypair.generate()).publicKey;

        const instruction = createWithdrawExcessLamportsInstruction(source, destination, authority);
        const decoded = decodeWithdrawExcessLamportsInstruction(instruction);

        expect(instruction.programId).toEqual(TOKEN_PROGRAM_ID);
        expect(instruction.data).toEqual(Uint8Array.from([TokenInstruction.WithdrawExcessLamports]));
        expect(instruction.keys).toHaveLength(3);
        expect(decoded.keys.source.pubkey).toEqual(source);
        expect(decoded.keys.destination.pubkey).toEqual(destination);
        expect(decoded.keys.authority.pubkey).toEqual(authority);
    });

    it('routes through the generic decoder', async () => {
        const source = (await Keypair.generate()).publicKey;
        const destination = (await Keypair.generate()).publicKey;
        const authority = (await Keypair.generate()).publicKey;

        const decoded = decodeInstruction(createWithdrawExcessLamportsInstruction(source, destination, authority));

        expect(isWithdrawExcessLamportsInstruction(decoded)).toEqual(true);
    });

    it('keeps the discriminator stable', () => {
        expect(TokenInstruction.WithdrawExcessLamports).toEqual(38);
    });
});
