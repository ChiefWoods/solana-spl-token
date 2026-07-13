import {
    getApplyConfidentialPendingBurnInstructionDataEncoder,
    getConfidentialBurnInstructionDataEncoder,
    getConfidentialMintInstructionDataEncoder,
    getInitializeConfidentialMintBurnInstructionDataEncoder,
    getRotateSupplyElgamalPubkeyInstructionDataEncoder,
    getUpdateConfidentialMintBurnDecryptableSupplyInstructionDataEncoder,
} from '@solana-program/token-2022';
import type { Address, Signer } from '@solana/web3.js';
import { TransactionInstruction } from '@solana/web3.js';
import { programSupportsExtensions, TOKEN_2022_PROGRAM_ID } from '../../constants.js';
import { TokenUnsupportedInstructionError } from '../../errors.js';
import { addSigners } from '../../instructions/internal.js';
import type { TokenInstruction } from '../../instructions/types.js';

export enum ConfidentialMintBurnInstruction {
    InitializeMint = 0,
    RotateSupplyElGamalPubkey = 1,
    UpdateDecryptableSupply = 2,
    Mint = 3,
    Burn = 4,
    ApplyPendingBurn = 5,
}

export type ConfidentialMintBurnProofAccounts = {
    instructionsSysvar?: Address;
    equalityRecord?: Address;
    ciphertextValidityRecord?: Address;
    rangeRecord?: Address;
};

export interface InitializeConfidentialMintBurnInstructionData {
    instruction: TokenInstruction.ConfidentialMintBurnExtension;
    confidentialMintBurnInstruction: ConfidentialMintBurnInstruction.InitializeMint;
    supplyElGamalPubkey: Address;
    decryptableSupply: Uint8Array;
}

export function createInitializeConfidentialMintBurnInstruction(
    mint: Address,
    supplyElGamalPubkey: Address,
    decryptableSupply: Uint8Array,
    programId = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }
    const keys = [{ pubkey: mint, isSigner: false, isWritable: true }];
    const data = Buffer.from(
        getInitializeConfidentialMintBurnInstructionDataEncoder().encode({
            supplyElgamalPubkey: supplyElGamalPubkey.toBase58(),
            decryptableSupply,
        }),
    );
    return new TransactionInstruction({ keys, programId, data });
}

export interface RotateSupplyElGamalPubkeyInstructionData {
    instruction: TokenInstruction.ConfidentialMintBurnExtension;
    confidentialMintBurnInstruction: ConfidentialMintBurnInstruction.RotateSupplyElGamalPubkey;
    newSupplyElGamalPubkey: Address;
    proofInstructionOffset: number;
}

export function createRotateSupplyElGamalPubkeyInstruction(
    mint: Address,
    instructionsSysvarOrContextState: Address,
    authority: Address,
    multiSigners: (Signer | Address)[],
    newSupplyElGamalPubkey: Address,
    proofInstructionOffset: number,
    programId = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }
    const keys = addSigners(
        [
            { pubkey: mint, isSigner: false, isWritable: true },
            { pubkey: instructionsSysvarOrContextState, isSigner: false, isWritable: false },
        ],
        authority,
        multiSigners,
    );
    const data = Buffer.from(
        getRotateSupplyElgamalPubkeyInstructionDataEncoder().encode({
            newSupplyElgamalPubkey: newSupplyElGamalPubkey.toBase58(),
            proofInstructionOffset,
        }),
    );
    return new TransactionInstruction({ keys, programId, data });
}

export interface UpdateConfidentialMintBurnDecryptableSupplyInstructionData {
    instruction: TokenInstruction.ConfidentialMintBurnExtension;
    confidentialMintBurnInstruction: ConfidentialMintBurnInstruction.UpdateDecryptableSupply;
    newDecryptableSupply: Uint8Array;
}

export function createUpdateConfidentialMintBurnDecryptableSupplyInstruction(
    mint: Address,
    authority: Address,
    multiSigners: (Signer | Address)[],
    newDecryptableSupply: Uint8Array,
    programId = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }
    const keys = addSigners([{ pubkey: mint, isSigner: false, isWritable: true }], authority, multiSigners);
    const data = Buffer.from(
        getUpdateConfidentialMintBurnDecryptableSupplyInstructionDataEncoder().encode({ newDecryptableSupply }),
    );
    return new TransactionInstruction({ keys, programId, data });
}

function addProofAccounts(
    keys: { pubkey: Address; isSigner: boolean; isWritable: boolean }[],
    proofAccounts: ConfidentialMintBurnProofAccounts,
) {
    if (proofAccounts.instructionsSysvar) {
        keys.push({ pubkey: proofAccounts.instructionsSysvar, isSigner: false, isWritable: false });
    }
    if (proofAccounts.equalityRecord) {
        keys.push({ pubkey: proofAccounts.equalityRecord, isSigner: false, isWritable: false });
    }
    if (proofAccounts.ciphertextValidityRecord) {
        keys.push({ pubkey: proofAccounts.ciphertextValidityRecord, isSigner: false, isWritable: false });
    }
    if (proofAccounts.rangeRecord) {
        keys.push({ pubkey: proofAccounts.rangeRecord, isSigner: false, isWritable: false });
    }
}

export interface ConfidentialMintInstructionData {
    instruction: TokenInstruction.ConfidentialMintBurnExtension;
    confidentialMintBurnInstruction: ConfidentialMintBurnInstruction.Mint;
    newDecryptableSupply: Uint8Array;
    mintAmountAuditorCiphertextLo: Uint8Array;
    mintAmountAuditorCiphertextHi: Uint8Array;
    equalityProofInstructionOffset: number;
    ciphertextValidityProofInstructionOffset: number;
    rangeProofInstructionOffset: number;
}

export function createConfidentialMintInstruction(
    token: Address,
    mint: Address,
    authority: Address,
    multiSigners: (Signer | Address)[],
    proofAccounts: ConfidentialMintBurnProofAccounts,
    newDecryptableSupply: Uint8Array,
    mintAmountAuditorCiphertextLo: Uint8Array,
    mintAmountAuditorCiphertextHi: Uint8Array,
    equalityProofInstructionOffset: number,
    ciphertextValidityProofInstructionOffset: number,
    rangeProofInstructionOffset: number,
    programId = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }
    const baseKeys = [
        { pubkey: token, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: true },
    ];
    addProofAccounts(baseKeys, proofAccounts);
    const keys = addSigners(baseKeys, authority, multiSigners);
    const data = Buffer.from(
        getConfidentialMintInstructionDataEncoder().encode({
            newDecryptableSupply,
            mintAmountAuditorCiphertextLo,
            mintAmountAuditorCiphertextHi,
            equalityProofInstructionOffset,
            ciphertextValidityProofInstructionOffset,
            rangeProofInstructionOffset,
        }),
    );
    return new TransactionInstruction({ keys, programId, data });
}

export const createConfidentialMintBurnInstruction = createConfidentialMintInstruction;

export interface ConfidentialBurnInstructionData {
    instruction: TokenInstruction.ConfidentialMintBurnExtension;
    confidentialMintBurnInstruction: ConfidentialMintBurnInstruction.Burn;
    newDecryptableAvailableBalance: Uint8Array;
    burnAmountAuditorCiphertextLo: Uint8Array;
    burnAmountAuditorCiphertextHi: Uint8Array;
    equalityProofInstructionOffset: number;
    ciphertextValidityProofInstructionOffset: number;
    rangeProofInstructionOffset: number;
}

export function createConfidentialBurnInstruction(
    token: Address,
    mint: Address,
    authority: Address,
    multiSigners: (Signer | Address)[],
    proofAccounts: ConfidentialMintBurnProofAccounts,
    newDecryptableAvailableBalance: Uint8Array,
    burnAmountAuditorCiphertextLo: Uint8Array,
    burnAmountAuditorCiphertextHi: Uint8Array,
    equalityProofInstructionOffset: number,
    ciphertextValidityProofInstructionOffset: number,
    rangeProofInstructionOffset: number,
    programId = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }
    const baseKeys = [
        { pubkey: token, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: true },
    ];
    addProofAccounts(baseKeys, proofAccounts);
    const keys = addSigners(baseKeys, authority, multiSigners);
    const data = Buffer.from(
        getConfidentialBurnInstructionDataEncoder().encode({
            newDecryptableAvailableBalance,
            burnAmountAuditorCiphertextLo,
            burnAmountAuditorCiphertextHi,
            equalityProofInstructionOffset,
            ciphertextValidityProofInstructionOffset,
            rangeProofInstructionOffset,
        }),
    );
    return new TransactionInstruction({ keys, programId, data });
}

export interface ApplyConfidentialPendingBurnInstructionData {
    instruction: TokenInstruction.ConfidentialMintBurnExtension;
    confidentialMintBurnInstruction: ConfidentialMintBurnInstruction.ApplyPendingBurn;
}

export function createApplyConfidentialPendingBurnInstruction(
    mint: Address,
    authority: Address,
    multiSigners: (Signer | Address)[] = [],
    programId = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }
    const keys = addSigners([{ pubkey: mint, isSigner: false, isWritable: true }], authority, multiSigners);
    const data = Buffer.from(getApplyConfidentialPendingBurnInstructionDataEncoder().encode({}));
    return new TransactionInstruction({ keys, programId, data });
}
