import { describe, expect, it } from 'vitest';
import { Keypair } from '@solana/web3.js';
import {
    TOKEN_2022_PROGRAM_ID,
    TokenInstruction,
    createUnwrapLamportsInstruction,
    decodeInstruction,
    decodeUnwrapLamportsInstruction,
    isUnwrapLamportsInstruction,
} from '../../src';

describe('unwrapLamports', () => {
    it('creates and decodes UnwrapLamports with Some amount and None amount', async () => {
        const source = (await Keypair.generate()).publicKey;
        const destination = (await Keypair.generate()).publicKey;
        const owner = (await Keypair.generate()).publicKey;

        const withAmount = createUnwrapLamportsInstruction(source, destination, owner, 42n, [], TOKEN_2022_PROGRAM_ID);
        const withoutAmount = createUnwrapLamportsInstruction(
            source,
            destination,
            owner,
            null,
            [],
            TOKEN_2022_PROGRAM_ID,
        );

        expect(withAmount.data).toEqual(Uint8Array.from([TokenInstruction.UnwrapLamports, 1, 42, 0, 0, 0, 0, 0, 0, 0]));
        expect(withoutAmount.data).toEqual(Uint8Array.from([TokenInstruction.UnwrapLamports, 0]));
        expect(decodeUnwrapLamportsInstruction(withAmount, TOKEN_2022_PROGRAM_ID).data.amount).toEqual(42n);
        expect(decodeUnwrapLamportsInstruction(withoutAmount, TOKEN_2022_PROGRAM_ID).data.amount).toEqual(null);
    });

    it('routes through the generic decoder', async () => {
        const source = (await Keypair.generate()).publicKey;
        const destination = (await Keypair.generate()).publicKey;
        const owner = (await Keypair.generate()).publicKey;

        const decoded = decodeInstruction(createUnwrapLamportsInstruction(source, destination, owner, null));

        expect(isUnwrapLamportsInstruction(decoded)).toEqual(true);
    });

    it('keeps the discriminator stable', () => {
        expect(TokenInstruction.UnwrapLamports).toEqual(45);
    });
});
