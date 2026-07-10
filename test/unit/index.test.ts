import { Keypair, Address } from '@solana/web3.js';
import { expect, use } from 'chai';
import {
    ASSOCIATED_TOKEN_PROGRAM_ID,
    createAssociatedTokenAccountInstruction,
    createAssociatedTokenAccountIdempotentInstruction,
    createAssociatedTokenAccountIdempotentInstructionWithDerivation,
    createReallocateInstruction,
    createInitializeMintInstruction,
    createInitializeMint2Instruction,
    createSyncNativeInstruction,
    createTransferCheckedInstruction,
    getAssociatedTokenAddress,
    TOKEN_PROGRAM_ID,
    TOKEN_2022_PROGRAM_ID,
    TokenInstruction,
    TokenOwnerOffCurveError,
    getAccountLen,
    ExtensionType,
    isMintExtension,
    isAccountExtension,
    getAssociatedTokenAddressSync,
    createInitializeAccount2Instruction,
    createInitializeAccount3Instruction,
    createAmountToUiAmountInstruction,
    createUiAmountToAmountInstruction,
    getMintLen,
} from '../../src';
import chaiAsPromised from 'chai-as-promised';
use(chaiAsPromised);

describe('spl-token instructions', () => {
    it('TransferChecked', async () => {
        const ix = createTransferCheckedInstruction(
            (await Keypair.generate()).publicKey,
            (await Keypair.generate()).publicKey,
            (await Keypair.generate()).publicKey,
            (await Keypair.generate()).publicKey,
            1,
            9,
        );
        expect(ix.programId).to.eql(TOKEN_PROGRAM_ID);
        expect(ix.keys).to.have.length(4);
    });

    it('InitializeMint', async () => {
        const ix = createInitializeMintInstruction(
            (await Keypair.generate()).publicKey,
            9,
            (await Keypair.generate()).publicKey,
            null,
        );
        expect(ix.programId).to.eql(TOKEN_PROGRAM_ID);
        expect(ix.keys).to.have.length(2);
    });

    it('InitializeMint2', async () => {
        const ix = createInitializeMint2Instruction(
            (await Keypair.generate()).publicKey,
            9,
            (await Keypair.generate()).publicKey,
            null,
        );
        expect(ix.programId).to.eql(TOKEN_PROGRAM_ID);
        expect(ix.keys).to.have.length(1);
    });

    it('SyncNative', async () => {
        const ix = createSyncNativeInstruction((await Keypair.generate()).publicKey);
        expect(ix.programId).to.eql(TOKEN_PROGRAM_ID);
        expect(ix.keys).to.have.length(1);
    });

    it('InitializeAccount2', async () => {
        const ix = createInitializeAccount2Instruction(
            (await Keypair.generate()).publicKey,
            (await Keypair.generate()).publicKey,
            (await Keypair.generate()).publicKey,
        );
        expect(ix.programId).to.eql(TOKEN_PROGRAM_ID);
        expect(ix.keys).to.have.length(3);
    });

    it('InitializeAccount3', async () => {
        const ix = createInitializeAccount3Instruction(
            (await Keypair.generate()).publicKey,
            (await Keypair.generate()).publicKey,
            (await Keypair.generate()).publicKey,
        );
        expect(ix.programId).to.eql(TOKEN_PROGRAM_ID);
        expect(ix.keys).to.have.length(2);
    });
});

describe('spl-token-2022 instructions', () => {
    it('TransferChecked', async () => {
        const ix = createTransferCheckedInstruction(
            (await Keypair.generate()).publicKey,
            (await Keypair.generate()).publicKey,
            (await Keypair.generate()).publicKey,
            (await Keypair.generate()).publicKey,
            1,
            9,
            [],
            TOKEN_2022_PROGRAM_ID,
        );
        expect(ix.programId).to.eql(TOKEN_2022_PROGRAM_ID);
        expect(ix.keys).to.have.length(4);
    });

    it('InitializeMint', async () => {
        const ix = createInitializeMintInstruction(
            (await Keypair.generate()).publicKey,
            9,
            (await Keypair.generate()).publicKey,
            null,
            TOKEN_2022_PROGRAM_ID,
        );
        expect(ix.programId).to.eql(TOKEN_2022_PROGRAM_ID);
        expect(ix.keys).to.have.length(2);
    });

    it('InitializeMint2', async () => {
        const ix = createInitializeMint2Instruction(
            (await Keypair.generate()).publicKey,
            9,
            (await Keypair.generate()).publicKey,
            null,
            TOKEN_2022_PROGRAM_ID,
        );
        expect(ix.programId).to.eql(TOKEN_2022_PROGRAM_ID);
        expect(ix.keys).to.have.length(1);
    });

    it('SyncNative', async () => {
        const ix = createSyncNativeInstruction((await Keypair.generate()).publicKey, TOKEN_2022_PROGRAM_ID);
        expect(ix.programId).to.eql(TOKEN_2022_PROGRAM_ID);
        expect(ix.keys).to.have.length(1);
    });

    it('Reallocate', async () => {
        const publicKey = (await Keypair.generate()).publicKey;
        const extensionTypes = [ExtensionType.MintCloseAuthority, ExtensionType.TransferFeeConfig];
        const ix = createReallocateInstruction(publicKey, publicKey, extensionTypes, publicKey);
        expect(ix.programId).to.eql(TOKEN_2022_PROGRAM_ID);
        expect(ix.keys).to.have.length(4);
        console.error(ix.data);
        expect(ix.data[0]).to.eql(TokenInstruction.Reallocate);
        expect(ix.data[1]).to.eql(extensionTypes[0]);
        expect(ix.data[3]).to.eql(extensionTypes[1]);
    });

    it('AmountToUiAmount', async () => {
        const ix = createAmountToUiAmountInstruction((await Keypair.generate()).publicKey, 22, TOKEN_2022_PROGRAM_ID);
        expect(ix.programId).to.eql(TOKEN_2022_PROGRAM_ID);
        expect(ix.keys).to.have.length(1);
    });

    it('UiAmountToAmount', async () => {
        const ix = createUiAmountToAmountInstruction((await Keypair.generate()).publicKey, '22', TOKEN_2022_PROGRAM_ID);
        expect(ix.programId).to.eql(TOKEN_2022_PROGRAM_ID);
        expect(ix.keys).to.have.length(1);
    });
});

describe('spl-associated-token-account instructions', () => {
    it('create', async () => {
        const ix = createAssociatedTokenAccountInstruction(
            (await Keypair.generate()).publicKey,
            (await Keypair.generate()).publicKey,
            (await Keypair.generate()).publicKey,
            (await Keypair.generate()).publicKey,
        );
        expect(ix.programId).to.eql(ASSOCIATED_TOKEN_PROGRAM_ID);
        expect(ix.keys).to.have.length(6);
    });

    it('create idempotent', async () => {
        const ix = createAssociatedTokenAccountIdempotentInstruction(
            (await Keypair.generate()).publicKey,
            (await Keypair.generate()).publicKey,
            (await Keypair.generate()).publicKey,
            (await Keypair.generate()).publicKey,
        );
        expect(ix.programId).to.eql(ASSOCIATED_TOKEN_PROGRAM_ID);
        expect(ix.keys).to.have.length(6);
    });

    it('create idempotent with derivation', async () => {
        const ix = await createAssociatedTokenAccountIdempotentInstructionWithDerivation(
            (await Keypair.generate()).publicKey,
            (await Keypair.generate()).publicKey,
            (await Keypair.generate()).publicKey,
        );
        expect(ix.programId).to.eql(ASSOCIATED_TOKEN_PROGRAM_ID);
        expect(ix.keys).to.have.length(6);
    });

    it('create idempotent with derivation same without', async () => {
        const payer = (await Keypair.generate()).publicKey;
        const owner = (await Keypair.generate()).publicKey;
        const mint = (await Keypair.generate()).publicKey;
        const associatedToken = await getAssociatedTokenAddress(mint, owner, true);
        const ix = createAssociatedTokenAccountIdempotentInstruction(payer, associatedToken, owner, mint);
        const ixDerivation = await createAssociatedTokenAccountIdempotentInstructionWithDerivation(payer, owner, mint);
        expect(ix).to.deep.eq(ixDerivation);
    });
});

describe('state', () => {
    it('getAssociatedTokenAddress', async () => {
        const associatedPublicKey = await getAssociatedTokenAddress(
            new Address('7o36UsWR1JQLpZ9PE2gn9L4SQ69CNNiWAXd4Jt7rqz9Z'),
            new Address('B8UwBUUnKwCyKuGMbFKWaG7exYdDk2ozZrPg72NyVbfj'),
        );
        expect(associatedPublicKey.toString()).to.eql(
            new Address('DShWnroshVbeUp28oopA3Pu7oFPDBtC1DBmPECXXAQ9n').toString(),
        );
        await expect(
            getAssociatedTokenAddress(new Address('7o36UsWR1JQLpZ9PE2gn9L4SQ69CNNiWAXd4Jt7rqz9Z'), associatedPublicKey),
        ).to.be.rejectedWith(TokenOwnerOffCurveError);

        const associatedPublicKey2 = await getAssociatedTokenAddress(
            new Address('7o36UsWR1JQLpZ9PE2gn9L4SQ69CNNiWAXd4Jt7rqz9Z'),
            associatedPublicKey,
            true,
        );
        expect(associatedPublicKey2.toString()).to.eql(
            new Address('F3DmXZFqkfEWFA7MN2vDPs813GeEWPaT6nLk4PSGuWJd').toString(),
        );
    });

    it('getAssociatedTokenAddressSync reports unsupported under web3.js v3', async () => {
        const asyncAssociatedPublicKey = await getAssociatedTokenAddress(
            new Address('7o36UsWR1JQLpZ9PE2gn9L4SQ69CNNiWAXd4Jt7rqz9Z'),
            new Address('B8UwBUUnKwCyKuGMbFKWaG7exYdDk2ozZrPg72NyVbfj'),
        );
        expect(asyncAssociatedPublicKey.toString()).to.eql(
            new Address('DShWnroshVbeUp28oopA3Pu7oFPDBtC1DBmPECXXAQ9n').toString(),
        );

        expect(function () {
            getAssociatedTokenAddressSync(
                new Address('7o36UsWR1JQLpZ9PE2gn9L4SQ69CNNiWAXd4Jt7rqz9Z'),
                new Address('B8UwBUUnKwCyKuGMbFKWaG7exYdDk2ozZrPg72NyVbfj'),
            );
        }).to.throw('getAssociatedTokenAddressSync is not supported with @solana/web3.js v3');

        const asyncAssociatedPublicKey2 = await getAssociatedTokenAddress(
            new Address('7o36UsWR1JQLpZ9PE2gn9L4SQ69CNNiWAXd4Jt7rqz9Z'),
            asyncAssociatedPublicKey,
            true,
        );
        expect(asyncAssociatedPublicKey2.toString()).to.eql(
            new Address('F3DmXZFqkfEWFA7MN2vDPs813GeEWPaT6nLk4PSGuWJd').toString(),
        );
    });
});

describe('extensionType', () => {
    it('calculates size for accounts', () => {
        expect(getAccountLen([ExtensionType.MintCloseAuthority, ExtensionType.TransferFeeConfig])).to.eql(314);
        expect(getAccountLen([])).to.eql(165);
        expect(getAccountLen([ExtensionType.ImmutableOwner])).to.eql(170);
        expect(getAccountLen([ExtensionType.PermanentDelegate])).to.eql(202);
    });

    it('calculates size for mints', () => {
        expect(getMintLen([ExtensionType.TransferFeeConfig, ExtensionType.NonTransferable])).to.eql(282);
        expect(getMintLen([])).to.eql(82);
        expect(getMintLen([ExtensionType.TransferHook])).to.eql(234);
        expect(getMintLen([ExtensionType.MetadataPointer])).to.eql(234);
        expect(
            getMintLen([ExtensionType.TransferFeeConfig, ExtensionType.NonTransferable], {
                [ExtensionType.TokenMetadata]: 200,
            }),
        ).to.eql(486);
        expect(
            getMintLen([], {
                [ExtensionType.TokenMetadata]: 200,
            }),
        ).to.eql(370);
        // Should error on an extension that isn't variable-length
        expect(() =>
            getMintLen([ExtensionType.TransferFeeConfig, ExtensionType.NonTransferable], {
                [ExtensionType.TransferHook]: 200,
            }),
        ).to.throw('Extension 14 is not variable length');
    });

    it('exclusive and exhaustive predicates', () => {
        const exts = Object.values(ExtensionType).filter(Number.isInteger);
        const mintExts = exts.filter((e: any): e is ExtensionType => isMintExtension(e));
        const accountExts = exts.filter((e: any): e is ExtensionType => isAccountExtension(e));
        const collectedExts = [ExtensionType.Uninitialized].concat(mintExts, accountExts);

        expect(collectedExts.sort()).to.eql(exts.sort());
    });
});
