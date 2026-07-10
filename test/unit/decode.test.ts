import { expect } from 'chai';
import { Keypair } from '@solana/web3.js';
import {
    createInitializeMintCloseAuthorityInstruction,
    createInitializePermanentDelegateInstruction,
    TOKEN_2022_PROGRAM_ID,
} from '../../src';

describe('spl-token-2022 instructions', () => {
    it('InitializeMintCloseAuthority', async () => {
        const ix = createInitializeMintCloseAuthorityInstruction(
            (await Keypair.generate()).publicKey,
            (await Keypair.generate()).publicKey,
            TOKEN_2022_PROGRAM_ID,
        );
        expect(ix.programId).to.eql(TOKEN_2022_PROGRAM_ID);
        expect(ix.keys).to.have.length(1);
    });
    it('InitializePermanentDelegate', async () => {
        const ix = createInitializePermanentDelegateInstruction(
            (await Keypair.generate()).publicKey,
            (await Keypair.generate()).publicKey,
            TOKEN_2022_PROGRAM_ID,
        );
        expect(ix.programId).to.eql(TOKEN_2022_PROGRAM_ID);
        expect(ix.keys).to.have.length(1);
    });
});
