import { describe, expect, it } from 'vitest';
import { Keypair, Address } from '@solana/web3.js';
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
    createInitializeMultisig2Instruction,
    createAmountToUiAmountInstruction,
    createUiAmountToAmountInstruction,
    getMintLen,
} from '../../src';

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
        expect(ix.programId).toEqual(TOKEN_PROGRAM_ID);
        expect(ix.keys).toHaveLength(4);
    });

    it('InitializeMint', async () => {
        const ix = createInitializeMintInstruction(
            (await Keypair.generate()).publicKey,
            9,
            (await Keypair.generate()).publicKey,
            null,
        );
        expect(ix.programId).toEqual(TOKEN_PROGRAM_ID);
        expect(ix.keys).toHaveLength(2);
    });

    it('InitializeMint2', async () => {
        const ix = createInitializeMint2Instruction(
            (await Keypair.generate()).publicKey,
            9,
            (await Keypair.generate()).publicKey,
            null,
        );
        expect(ix.programId).toEqual(TOKEN_PROGRAM_ID);
        expect(ix.keys).toHaveLength(1);
    });

    it('SyncNative', async () => {
        const ix = createSyncNativeInstruction((await Keypair.generate()).publicKey);
        expect(ix.programId).toEqual(TOKEN_PROGRAM_ID);
        expect(ix.keys).toHaveLength(1);
    });

    it('InitializeAccount2', async () => {
        const ix = createInitializeAccount2Instruction(
            (await Keypair.generate()).publicKey,
            (await Keypair.generate()).publicKey,
            (await Keypair.generate()).publicKey,
        );
        expect(ix.programId).toEqual(TOKEN_PROGRAM_ID);
        expect(ix.keys).toHaveLength(3);
    });

    it('InitializeAccount3', async () => {
        const ix = createInitializeAccount3Instruction(
            (await Keypair.generate()).publicKey,
            (await Keypair.generate()).publicKey,
            (await Keypair.generate()).publicKey,
        );
        expect(ix.programId).toEqual(TOKEN_PROGRAM_ID);
        expect(ix.keys).toHaveLength(2);
    });

    it('InitializeMultisig2', async () => {
        const ix = createInitializeMultisig2Instruction(
            (await Keypair.generate()).publicKey,
            [(await Keypair.generate()).publicKey, (await Keypair.generate()).publicKey],
            2,
        );
        expect(ix.programId).toEqual(TOKEN_PROGRAM_ID);
        expect(ix.keys).toHaveLength(3);
        expect(ix.data[0]).toEqual(TokenInstruction.InitializeMultisig2);
        expect(ix.data[1]).toEqual(2);
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
        expect(ix.programId).toEqual(TOKEN_2022_PROGRAM_ID);
        expect(ix.keys).toHaveLength(4);
    });

    it('InitializeMint', async () => {
        const ix = createInitializeMintInstruction(
            (await Keypair.generate()).publicKey,
            9,
            (await Keypair.generate()).publicKey,
            null,
            TOKEN_2022_PROGRAM_ID,
        );
        expect(ix.programId).toEqual(TOKEN_2022_PROGRAM_ID);
        expect(ix.keys).toHaveLength(2);
    });

    it('InitializeMint2', async () => {
        const ix = createInitializeMint2Instruction(
            (await Keypair.generate()).publicKey,
            9,
            (await Keypair.generate()).publicKey,
            null,
            TOKEN_2022_PROGRAM_ID,
        );
        expect(ix.programId).toEqual(TOKEN_2022_PROGRAM_ID);
        expect(ix.keys).toHaveLength(1);
    });

    it('SyncNative', async () => {
        const ix = createSyncNativeInstruction((await Keypair.generate()).publicKey, TOKEN_2022_PROGRAM_ID);
        expect(ix.programId).toEqual(TOKEN_2022_PROGRAM_ID);
        expect(ix.keys).toHaveLength(1);
    });

    it('Reallocate', async () => {
        const publicKey = (await Keypair.generate()).publicKey;
        const extensionTypes = [ExtensionType.MintCloseAuthority, ExtensionType.TransferFeeConfig];
        const ix = createReallocateInstruction(publicKey, publicKey, extensionTypes, publicKey);
        expect(ix.programId).toEqual(TOKEN_2022_PROGRAM_ID);
        expect(ix.keys).toHaveLength(4);
        expect(ix.data[0]).toEqual(TokenInstruction.Reallocate);
        expect(ix.data[1]).toEqual(extensionTypes[0]);
        expect(ix.data[3]).toEqual(extensionTypes[1]);
    });

    it('AmountToUiAmount', async () => {
        const ix = createAmountToUiAmountInstruction((await Keypair.generate()).publicKey, 22, TOKEN_2022_PROGRAM_ID);
        expect(ix.programId).toEqual(TOKEN_2022_PROGRAM_ID);
        expect(ix.keys).toHaveLength(1);
    });

    it('UiAmountToAmount', async () => {
        const ix = createUiAmountToAmountInstruction((await Keypair.generate()).publicKey, '22', TOKEN_2022_PROGRAM_ID);
        expect(ix.programId).toEqual(TOKEN_2022_PROGRAM_ID);
        expect(ix.keys).toHaveLength(1);
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
        expect(ix.programId).toEqual(ASSOCIATED_TOKEN_PROGRAM_ID);
        expect(ix.keys).toHaveLength(6);
    });

    it('create idempotent', async () => {
        const ix = createAssociatedTokenAccountIdempotentInstruction(
            (await Keypair.generate()).publicKey,
            (await Keypair.generate()).publicKey,
            (await Keypair.generate()).publicKey,
            (await Keypair.generate()).publicKey,
        );
        expect(ix.programId).toEqual(ASSOCIATED_TOKEN_PROGRAM_ID);
        expect(ix.keys).toHaveLength(6);
    });

    it('create idempotent with derivation', async () => {
        const ix = await createAssociatedTokenAccountIdempotentInstructionWithDerivation(
            (await Keypair.generate()).publicKey,
            (await Keypair.generate()).publicKey,
            (await Keypair.generate()).publicKey,
        );
        expect(ix.programId).toEqual(ASSOCIATED_TOKEN_PROGRAM_ID);
        expect(ix.keys).toHaveLength(6);
    });

    it('create idempotent with derivation same without', async () => {
        const payer = (await Keypair.generate()).publicKey;
        const owner = (await Keypair.generate()).publicKey;
        const mint = (await Keypair.generate()).publicKey;
        const associatedToken = await getAssociatedTokenAddress(mint, owner, true);
        const ix = createAssociatedTokenAccountIdempotentInstruction(payer, associatedToken, owner, mint);
        const ixDerivation = await createAssociatedTokenAccountIdempotentInstructionWithDerivation(payer, owner, mint);
        expect(ix).toEqual(ixDerivation);
    });
});

describe('state', () => {
    it('getAssociatedTokenAddress', async () => {
        const associatedPublicKey = await getAssociatedTokenAddress(
            new Address('7o36UsWR1JQLpZ9PE2gn9L4SQ69CNNiWAXd4Jt7rqz9Z'),
            new Address('B8UwBUUnKwCyKuGMbFKWaG7exYdDk2ozZrPg72NyVbfj'),
        );
        expect(associatedPublicKey.toString()).toEqual(
            new Address('DShWnroshVbeUp28oopA3Pu7oFPDBtC1DBmPECXXAQ9n').toString(),
        );
        await expect(
            getAssociatedTokenAddress(new Address('7o36UsWR1JQLpZ9PE2gn9L4SQ69CNNiWAXd4Jt7rqz9Z'), associatedPublicKey),
        ).rejects.toThrow(TokenOwnerOffCurveError);

        const associatedPublicKey2 = await getAssociatedTokenAddress(
            new Address('7o36UsWR1JQLpZ9PE2gn9L4SQ69CNNiWAXd4Jt7rqz9Z'),
            associatedPublicKey,
            true,
        );
        expect(associatedPublicKey2.toString()).toEqual(
            new Address('F3DmXZFqkfEWFA7MN2vDPs813GeEWPaT6nLk4PSGuWJd').toString(),
        );
    });

    it('getAssociatedTokenAddressSync reports unsupported under web3.js v3', async () => {
        const asyncAssociatedPublicKey = await getAssociatedTokenAddress(
            new Address('7o36UsWR1JQLpZ9PE2gn9L4SQ69CNNiWAXd4Jt7rqz9Z'),
            new Address('B8UwBUUnKwCyKuGMbFKWaG7exYdDk2ozZrPg72NyVbfj'),
        );
        expect(asyncAssociatedPublicKey.toString()).toEqual(
            new Address('DShWnroshVbeUp28oopA3Pu7oFPDBtC1DBmPECXXAQ9n').toString(),
        );

        expect(function () {
            getAssociatedTokenAddressSync(
                new Address('7o36UsWR1JQLpZ9PE2gn9L4SQ69CNNiWAXd4Jt7rqz9Z'),
                new Address('B8UwBUUnKwCyKuGMbFKWaG7exYdDk2ozZrPg72NyVbfj'),
            );
        }).toThrow('getAssociatedTokenAddressSync is not supported with @solana/web3.js v3');

        const asyncAssociatedPublicKey2 = await getAssociatedTokenAddress(
            new Address('7o36UsWR1JQLpZ9PE2gn9L4SQ69CNNiWAXd4Jt7rqz9Z'),
            asyncAssociatedPublicKey,
            true,
        );
        expect(asyncAssociatedPublicKey2.toString()).toEqual(
            new Address('F3DmXZFqkfEWFA7MN2vDPs813GeEWPaT6nLk4PSGuWJd').toString(),
        );
    });
});

describe('extensionType', () => {
    it('calculates size for accounts', () => {
        expect(getAccountLen([ExtensionType.MintCloseAuthority, ExtensionType.TransferFeeConfig])).toEqual(314);
        expect(getAccountLen([])).toEqual(165);
        expect(getAccountLen([ExtensionType.ImmutableOwner])).toEqual(170);
        expect(getAccountLen([ExtensionType.PermanentDelegate])).toEqual(202);
    });

    it('calculates size for mints', () => {
        expect(getMintLen([ExtensionType.TransferFeeConfig, ExtensionType.NonTransferable])).toEqual(282);
        expect(getMintLen([])).toEqual(82);
        expect(getMintLen([ExtensionType.TransferHook])).toEqual(234);
        expect(getMintLen([ExtensionType.MetadataPointer])).toEqual(234);
        expect(
            getMintLen([ExtensionType.TransferFeeConfig, ExtensionType.NonTransferable], {
                [ExtensionType.TokenMetadata]: 200,
            }),
        ).toEqual(486);
        expect(
            getMintLen([], {
                [ExtensionType.TokenMetadata]: 200,
            }),
        ).toEqual(370);
        // Should error on an extension that isn't variable-length
        expect(() =>
            getMintLen([ExtensionType.TransferFeeConfig, ExtensionType.NonTransferable], {
                [ExtensionType.TransferHook]: 200,
            }),
        ).toThrow('Extension 14 is not variable length');
    });

    it('exclusive and exhaustive predicates', () => {
        const exts = Object.values(ExtensionType).filter(Number.isInteger);
        const mintExts = exts.filter((e: any): e is ExtensionType => isMintExtension(e));
        const accountExts = exts.filter((e: any): e is ExtensionType => isAccountExtension(e));
        const collectedExts = [ExtensionType.Uninitialized].concat(mintExts, accountExts);

        expect(collectedExts.sort()).toEqual(exts.sort());
    });
});
