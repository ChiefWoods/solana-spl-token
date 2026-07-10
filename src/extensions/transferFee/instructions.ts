import {
    getHarvestWithheldTokensToMintInstructionDataDecoder,
    getHarvestWithheldTokensToMintInstructionDataEncoder,
    getInitializeTransferFeeConfigInstructionDataDecoder,
    getInitializeTransferFeeConfigInstructionDataEncoder,
    getSetTransferFeeInstructionDataDecoder,
    getSetTransferFeeInstructionDataEncoder,
    getTransferCheckedWithFeeInstructionDataDecoder,
    getTransferCheckedWithFeeInstructionDataEncoder,
    getWithdrawWithheldTokensFromAccountsInstructionDataDecoder,
    getWithdrawWithheldTokensFromAccountsInstructionDataEncoder,
    getWithdrawWithheldTokensFromMintInstructionDataDecoder,
    getWithdrawWithheldTokensFromMintInstructionDataEncoder,
} from '@solana-program/token-2022';
import type { AccountMeta, Signer, Address } from '@solana/web3.js';
import { Address as Web3Address, TransactionInstruction } from '@solana/web3.js';
import { programSupportsExtensions, TOKEN_2022_PROGRAM_ID } from '../../constants.js';
import {
    TokenInvalidInstructionDataError,
    TokenInvalidInstructionKeysError,
    TokenInvalidInstructionProgramError,
    TokenInvalidInstructionTypeError,
    TokenUnsupportedInstructionError,
} from '../../errors.js';
import { addSigners } from '../../instructions/internal.js';
import { TokenInstruction } from '../../instructions/types.js';

type CodamaOption<T> = { __option: 'Some'; value: T } | { __option: 'None' };

function unwrapAddressOption(option: CodamaOption<string>): Address | null {
    return option.__option === 'Some' ? new Web3Address(option.value) : null;
}

export enum TransferFeeInstruction {
    InitializeTransferFeeConfig = 0,
    TransferCheckedWithFee = 1,
    WithdrawWithheldTokensFromMint = 2,
    WithdrawWithheldTokensFromAccounts = 3,
    HarvestWithheldTokensToMint = 4,
    SetTransferFee = 5,
}

// InitializeTransferFeeConfig

/** Instruction data for an InitializeTransferFeeConfig instruction. */
export interface InitializeTransferFeeConfigInstructionData {
    instruction: TokenInstruction.TransferFeeExtension;
    transferFeeInstruction: TransferFeeInstruction.InitializeTransferFeeConfig;
    transferFeeConfigAuthority: Address | null;
    withdrawWithheldAuthority: Address | null;
    transferFeeBasisPoints: number;
    maximumFee: bigint;
}

/**
 * Construct an InitializeTransferFeeConfig instruction
 *
 * @param mint            Token mint account
 * @param transferFeeConfigAuthority  Optional authority that can update the fees
 * @param withdrawWithheldAuthority Optional authority that can withdraw fees
 * @param transferFeeBasisPoints Amount of transfer collected as fees, expressed as basis points of the transfer amount
 * @param maximumFee        Maximum fee assessed on transfers
 * @param programId       SPL Token program account
 *
 * @return Instruction to add to a transaction
 */
export function createInitializeTransferFeeConfigInstruction(
    mint: Address,
    transferFeeConfigAuthority: Address | null,
    withdrawWithheldAuthority: Address | null,
    transferFeeBasisPoints: number,
    maximumFee: bigint,
    programId = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }
    const keys = [{ pubkey: mint, isSigner: false, isWritable: true }];
    const data = Buffer.from(
        getInitializeTransferFeeConfigInstructionDataEncoder().encode({
            transferFeeConfigAuthority: transferFeeConfigAuthority?.toBase58() ?? null,
            withdrawWithheldAuthority: withdrawWithheldAuthority?.toBase58() ?? null,
            transferFeeBasisPoints: transferFeeBasisPoints,
            maximumFee: maximumFee,
        }),
    );

    return new TransactionInstruction({
        keys,
        programId,
        data,
    });
}

/** A decoded, valid InitializeTransferFeeConfig instruction */
export interface DecodedInitializeTransferFeeConfigInstruction {
    programId: Address;
    keys: {
        mint: AccountMeta;
    };
    data: {
        instruction: TokenInstruction.TransferFeeExtension;
        transferFeeInstruction: TransferFeeInstruction.InitializeTransferFeeConfig;
        transferFeeConfigAuthority: Address | null;
        withdrawWithheldAuthority: Address | null;
        transferFeeBasisPoints: number;
        maximumFee: bigint;
    };
}

/**
 * Decode an InitializeTransferFeeConfig instruction and validate it
 *
 * @param instruction Transaction instruction to decode
 * @param programId   SPL Token program account
 *
 * @return Decoded, valid instruction
 */
export function decodeInitializeTransferFeeConfigInstruction(
    instruction: TransactionInstruction,
    programId: Address,
): DecodedInitializeTransferFeeConfigInstruction {
    if (!instruction.programId.equals(programId)) throw new TokenInvalidInstructionProgramError();

    const {
        keys: { mint },
        data,
    } = decodeInitializeTransferFeeConfigInstructionUnchecked(instruction);
    if (
        instruction.data.length !==
        getInitializeTransferFeeConfigInstructionDataEncoder().encode({
            transferFeeConfigAuthority: data.transferFeeConfigAuthority?.toBase58() ?? null,
            withdrawWithheldAuthority: data.withdrawWithheldAuthority?.toBase58() ?? null,
            transferFeeBasisPoints: data.transferFeeBasisPoints,
            maximumFee: data.maximumFee,
        }).length
    )
        throw new TokenInvalidInstructionDataError();
    if (
        data.instruction !== TokenInstruction.TransferFeeExtension ||
        data.transferFeeInstruction !== TransferFeeInstruction.InitializeTransferFeeConfig
    )
        throw new TokenInvalidInstructionTypeError();
    if (!mint) throw new TokenInvalidInstructionKeysError();

    return {
        programId,
        keys: {
            mint,
        },
        data,
    };
}

/** A decoded, non-validated InitializeTransferFeeConfig instruction */
export interface DecodedInitializeTransferFeeConfigInstructionUnchecked {
    programId: Address;
    keys: {
        mint: AccountMeta | undefined;
    };
    data: {
        instruction: TokenInstruction.TransferFeeExtension;
        transferFeeInstruction: TransferFeeInstruction.InitializeTransferFeeConfig;
        transferFeeConfigAuthority: Address | null;
        withdrawWithheldAuthority: Address | null;
        transferFeeBasisPoints: number;
        maximumFee: bigint;
    };
}

/**
 * Decode an InitializeTransferFeeConfig instruction without validating it
 *
 * @param instruction Transaction instruction to decode
 *
 * @return Decoded, non-validated instruction
 */
export function decodeInitializeTransferFeeConfigInstructionUnchecked({
    programId,
    keys: [mint],
    data,
}: TransactionInstruction): DecodedInitializeTransferFeeConfigInstructionUnchecked {
    const {
        discriminator,
        transferFeeDiscriminator,
        transferFeeConfigAuthority,
        withdrawWithheldAuthority,
        transferFeeBasisPoints,
        maximumFee,
    } = getInitializeTransferFeeConfigInstructionDataDecoder().decode(data);

    return {
        programId,
        keys: {
            mint,
        },
        data: {
            instruction: discriminator,
            transferFeeInstruction: transferFeeDiscriminator,
            transferFeeConfigAuthority: unwrapAddressOption(transferFeeConfigAuthority),
            withdrawWithheldAuthority: unwrapAddressOption(withdrawWithheldAuthority),
            transferFeeBasisPoints,
            maximumFee,
        },
    };
}

// TransferCheckedWithFee
export interface TransferCheckedWithFeeInstructionData {
    instruction: TokenInstruction.TransferFeeExtension;
    transferFeeInstruction: TransferFeeInstruction.TransferCheckedWithFee;
    amount: bigint;
    decimals: number;
    fee: bigint;
}

/**
 * Construct an TransferCheckedWithFee instruction
 *
 * @param source          The source account
 * @param mint            The token mint
 * @param destination     The destination account
 * @param authority       The source account's owner/delegate
 * @param signers         The signer account(s)
 * @param amount          The amount of tokens to transfer
 * @param decimals        The expected number of base 10 digits to the right of the decimal place
 * @param fee             The expected fee assesed on this transfer, calculated off-chain based on the transferFeeBasisPoints and maximumFee of the mint.
 * @param programId       SPL Token program account
 *
 * @return Instruction to add to a transaction
 */
export function createTransferCheckedWithFeeInstruction(
    source: Address,
    mint: Address,
    destination: Address,
    authority: Address,
    amount: bigint,
    decimals: number,
    fee: bigint,
    multiSigners: (Signer | Address)[] = [],
    programId = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }
    const data = Buffer.from(getTransferCheckedWithFeeInstructionDataEncoder().encode({ amount, decimals, fee }));
    const keys = addSigners(
        [
            { pubkey: source, isSigner: false, isWritable: true },
            { pubkey: mint, isSigner: false, isWritable: false },
            { pubkey: destination, isSigner: false, isWritable: true },
        ],
        authority,
        multiSigners,
    );
    return new TransactionInstruction({ keys, programId, data });
}

/** A decoded, valid TransferCheckedWithFee instruction */
export interface DecodedTransferCheckedWithFeeInstruction {
    programId: Address;
    keys: {
        source: AccountMeta;
        mint: AccountMeta;
        destination: AccountMeta;
        authority: AccountMeta;
        signers: AccountMeta[] | null;
    };
    data: {
        instruction: TokenInstruction.TransferFeeExtension;
        transferFeeInstruction: TransferFeeInstruction.TransferCheckedWithFee;
        amount: bigint;
        decimals: number;
        fee: bigint;
    };
}

/**
 * Decode a TransferCheckedWithFee instruction and validate it
 *
 * @param instruction Transaction instruction to decode
 * @param programId   SPL Token program account
 *
 * @return Decoded, valid instruction
 */
export function decodeTransferCheckedWithFeeInstruction(
    instruction: TransactionInstruction,
    programId: Address,
): DecodedTransferCheckedWithFeeInstruction {
    if (!instruction.programId.equals(programId)) throw new TokenInvalidInstructionProgramError();
    if (
        instruction.data.length !==
        getTransferCheckedWithFeeInstructionDataEncoder().encode({ amount: BigInt(0), decimals: 0, fee: BigInt(0) })
            .length
    )
        throw new TokenInvalidInstructionDataError();

    const {
        keys: { source, mint, destination, authority, signers },
        data,
    } = decodeTransferCheckedWithFeeInstructionUnchecked(instruction);
    if (
        data.instruction !== TokenInstruction.TransferFeeExtension ||
        data.transferFeeInstruction !== TransferFeeInstruction.TransferCheckedWithFee
    )
        throw new TokenInvalidInstructionTypeError();
    if (!mint) throw new TokenInvalidInstructionKeysError();

    return {
        programId,
        keys: {
            source,
            mint,
            destination,
            authority,
            signers: signers ? signers : null,
        },
        data,
    };
}

/** A decoded, non-validated TransferCheckedWithFees instruction */
export interface DecodedTransferCheckedWithFeeInstructionUnchecked {
    programId: Address;
    keys: {
        source: AccountMeta;
        mint: AccountMeta;
        destination: AccountMeta;
        authority: AccountMeta;
        signers: AccountMeta[] | undefined;
    };
    data: {
        instruction: TokenInstruction.TransferFeeExtension;
        transferFeeInstruction: TransferFeeInstruction.TransferCheckedWithFee;
        amount: bigint;
        decimals: number;
        fee: bigint;
    };
}

/**
 * Decode a TransferCheckedWithFees instruction without validating it
 *
 * @param instruction Transaction instruction to decode
 *
 * @return Decoded, non-validated instruction
 */
export function decodeTransferCheckedWithFeeInstructionUnchecked({
    programId,
    keys: [source, mint, destination, authority, ...signers],
    data,
}: TransactionInstruction): DecodedTransferCheckedWithFeeInstructionUnchecked {
    const { discriminator, transferFeeDiscriminator, amount, decimals, fee } =
        getTransferCheckedWithFeeInstructionDataDecoder().decode(data);

    return {
        programId,
        keys: {
            source,
            mint,
            destination,
            authority,
            signers,
        },
        data: {
            instruction: discriminator,
            transferFeeInstruction: transferFeeDiscriminator,
            amount,
            decimals,
            fee,
        },
    };
}

// WithdrawWithheldTokensFromMint
export interface WithdrawWithheldTokensFromMintInstructionData {
    instruction: TokenInstruction.TransferFeeExtension;
    transferFeeInstruction: TransferFeeInstruction.WithdrawWithheldTokensFromMint;
}

/**
 * Construct a WithdrawWithheldTokensFromMint instruction
 *
 * @param mint              The token mint
 * @param destination       The destination account
 * @param authority         The source account's owner/delegate
 * @param signers           The signer account(s)
 * @param programID         SPL Token program account
 *
 * @return Instruction to add to a transaction
 */
export function createWithdrawWithheldTokensFromMintInstruction(
    mint: Address,
    destination: Address,
    authority: Address,
    signers: (Signer | Address)[] = [],
    programId = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }
    const data = Buffer.from(getWithdrawWithheldTokensFromMintInstructionDataEncoder().encode({}));
    const keys = addSigners(
        [
            { pubkey: mint, isSigner: false, isWritable: true },
            { pubkey: destination, isSigner: false, isWritable: true },
        ],
        authority,
        signers,
    );
    return new TransactionInstruction({ keys, programId, data });
}

/** A decoded, valid WithdrawWithheldTokensFromMint instruction */
export interface DecodedWithdrawWithheldTokensFromMintInstruction {
    programId: Address;
    keys: {
        mint: AccountMeta;
        destination: AccountMeta;
        authority: AccountMeta;
        signers: AccountMeta[] | null;
    };
    data: {
        instruction: TokenInstruction.TransferFeeExtension;
        transferFeeInstruction: TransferFeeInstruction.WithdrawWithheldTokensFromMint;
    };
}

/**
 * Decode a WithdrawWithheldTokensFromMint instruction and validate it
 *
 * @param instruction Transaction instruction to decode
 * @param programId   SPL Token program account
 *
 * @return Decoded, valid instruction
 */
export function decodeWithdrawWithheldTokensFromMintInstruction(
    instruction: TransactionInstruction,
    programId: Address,
): DecodedWithdrawWithheldTokensFromMintInstruction {
    if (!instruction.programId.equals(programId)) throw new TokenInvalidInstructionProgramError();
    if (instruction.data.length !== getWithdrawWithheldTokensFromMintInstructionDataEncoder().encode({}).length)
        throw new TokenInvalidInstructionDataError();

    const {
        keys: { mint, destination, authority, signers },
        data,
    } = decodeWithdrawWithheldTokensFromMintInstructionUnchecked(instruction);
    if (
        data.instruction !== TokenInstruction.TransferFeeExtension ||
        data.transferFeeInstruction !== TransferFeeInstruction.WithdrawWithheldTokensFromMint
    )
        throw new TokenInvalidInstructionTypeError();
    if (!mint) throw new TokenInvalidInstructionKeysError();

    return {
        programId,
        keys: {
            mint,
            destination,
            authority,
            signers: signers ? signers : null,
        },
        data,
    };
}

/** A decoded, valid WithdrawWithheldTokensFromMint instruction */
export interface DecodedWithdrawWithheldTokensFromMintInstructionUnchecked {
    programId: Address;
    keys: {
        mint: AccountMeta;
        destination: AccountMeta;
        authority: AccountMeta;
        signers: AccountMeta[] | null;
    };
    data: {
        instruction: TokenInstruction.TransferFeeExtension;
        transferFeeInstruction: TransferFeeInstruction.WithdrawWithheldTokensFromMint;
    };
}

/**
 * Decode a WithdrawWithheldTokensFromMint instruction without validating it
 *
 * @param instruction Transaction instruction to decode
 *
 * @return Decoded, non-validated instruction
 */
export function decodeWithdrawWithheldTokensFromMintInstructionUnchecked({
    programId,
    keys: [mint, destination, authority, ...signers],
    data,
}: TransactionInstruction): DecodedWithdrawWithheldTokensFromMintInstructionUnchecked {
    const { discriminator, transferFeeDiscriminator } =
        getWithdrawWithheldTokensFromMintInstructionDataDecoder().decode(data);

    return {
        programId,
        keys: {
            mint,
            destination,
            authority,
            signers,
        },
        data: {
            instruction: discriminator,
            transferFeeInstruction: transferFeeDiscriminator,
        },
    };
}

// WithdrawWithheldTokensFromAccounts
export interface WithdrawWithheldTokensFromAccountsInstructionData {
    instruction: TokenInstruction.TransferFeeExtension;
    transferFeeInstruction: TransferFeeInstruction.WithdrawWithheldTokensFromAccounts;
    numTokenAccounts: number;
}

/**
 * Construct a WithdrawWithheldTokensFromAccounts instruction
 *
 * @param mint              The token mint
 * @param destination       The destination account
 * @param authority         The source account's owner/delegate
 * @param signers           The signer account(s)
 * @param sources           The source accounts to withdraw from
 * @param programID         SPL Token program account
 *
 * @return Instruction to add to a transaction
 */
export function createWithdrawWithheldTokensFromAccountsInstruction(
    mint: Address,
    destination: Address,
    authority: Address,
    signers: (Signer | Address)[],
    sources: Address[],
    programId = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }
    const data = Buffer.from(
        getWithdrawWithheldTokensFromAccountsInstructionDataEncoder().encode({ numTokenAccounts: sources.length }),
    );
    const keys = addSigners(
        [
            { pubkey: mint, isSigner: false, isWritable: true },
            { pubkey: destination, isSigner: false, isWritable: true },
        ],
        authority,
        signers,
    );
    for (const source of sources) {
        keys.push({ pubkey: source, isSigner: false, isWritable: true });
    }
    return new TransactionInstruction({ keys, programId, data });
}

/** A decoded, valid WithdrawWithheldTokensFromAccounts instruction */
export interface DecodedWithdrawWithheldTokensFromAccountsInstruction {
    programId: Address;
    keys: {
        mint: AccountMeta;
        destination: AccountMeta;
        authority: AccountMeta;
        signers: AccountMeta[] | null;
        sources: AccountMeta[] | null;
    };
    data: {
        instruction: TokenInstruction.TransferFeeExtension;
        transferFeeInstruction: TransferFeeInstruction.WithdrawWithheldTokensFromAccounts;
        numTokenAccounts: number;
    };
}

/**
 * Decode a WithdrawWithheldTokensFromAccounts instruction and validate it
 *
 * @param instruction Transaction instruction to decode
 * @param programId   SPL Token program account
 *
 * @return Decoded, valid instruction
 */
export function decodeWithdrawWithheldTokensFromAccountsInstruction(
    instruction: TransactionInstruction,
    programId: Address,
): DecodedWithdrawWithheldTokensFromAccountsInstruction {
    if (!instruction.programId.equals(programId)) throw new TokenInvalidInstructionProgramError();
    if (
        instruction.data.length !==
        getWithdrawWithheldTokensFromAccountsInstructionDataEncoder().encode({ numTokenAccounts: 0 }).length
    )
        throw new TokenInvalidInstructionDataError();

    const {
        keys: { mint, destination, authority, signers, sources },
        data,
    } = decodeWithdrawWithheldTokensFromAccountsInstructionUnchecked(instruction);
    if (
        data.instruction !== TokenInstruction.TransferFeeExtension ||
        data.transferFeeInstruction !== TransferFeeInstruction.WithdrawWithheldTokensFromAccounts
    )
        throw new TokenInvalidInstructionTypeError();
    if (!mint) throw new TokenInvalidInstructionKeysError();

    return {
        programId,
        keys: {
            mint,
            destination,
            authority,
            signers: signers ? signers : null,
            sources: sources ? sources : null,
        },
        data,
    };
}

/** A decoded, valid WithdrawWithheldTokensFromAccounts instruction */
export interface DecodedWithdrawWithheldTokensFromAccountsInstructionUnchecked {
    programId: Address;
    keys: {
        mint: AccountMeta;
        destination: AccountMeta;
        authority: AccountMeta;
        signers: AccountMeta[] | null;
        sources: AccountMeta[] | null;
    };
    data: {
        instruction: TokenInstruction.TransferFeeExtension;
        transferFeeInstruction: TransferFeeInstruction.WithdrawWithheldTokensFromAccounts;
        numTokenAccounts: number;
    };
}

/**
 * Decode a WithdrawWithheldTokensFromAccount instruction without validating it
 *
 * @param instruction Transaction instruction to decode
 *
 * @return Decoded, non-validated instruction
 */
export function decodeWithdrawWithheldTokensFromAccountsInstructionUnchecked({
    programId,
    keys,
    data,
}: TransactionInstruction): DecodedWithdrawWithheldTokensFromAccountsInstructionUnchecked {
    const { discriminator, transferFeeDiscriminator, numTokenAccounts } =
        getWithdrawWithheldTokensFromAccountsInstructionDataDecoder().decode(data);
    const [mint, destination, authority, signers, sources] = [
        keys[0],
        keys[1],
        keys[2],
        keys.slice(3, 3 + numTokenAccounts),
        keys.slice(-1 * numTokenAccounts),
    ];
    return {
        programId,
        keys: {
            mint,
            destination,
            authority,
            signers,
            sources,
        },
        data: {
            instruction: discriminator,
            transferFeeInstruction: transferFeeDiscriminator,
            numTokenAccounts,
        },
    };
}

// HarvestWithheldTokensToMint

export interface HarvestWithheldTokensToMintInstructionData {
    instruction: TokenInstruction.TransferFeeExtension;
    transferFeeInstruction: TransferFeeInstruction.HarvestWithheldTokensToMint;
}

/**
 * Construct a HarvestWithheldTokensToMint instruction
 *
 * @param mint              The token mint
 * @param sources           The source accounts to withdraw from
 * @param programID         SPL Token program account
 *
 * @return Instruction to add to a transaction
 */
export function createHarvestWithheldTokensToMintInstruction(
    mint: Address,
    sources: Address[],
    programId = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }
    const data = Buffer.from(getHarvestWithheldTokensToMintInstructionDataEncoder().encode({}));
    const keys: AccountMeta[] = [];
    keys.push({ pubkey: mint, isSigner: false, isWritable: true });
    for (const source of sources) {
        keys.push({ pubkey: source, isSigner: false, isWritable: true });
    }
    return new TransactionInstruction({ keys, programId, data });
}

/** A decoded, valid HarvestWithheldTokensToMint instruction */
export interface DecodedHarvestWithheldTokensToMintInstruction {
    programId: Address;
    keys: {
        mint: AccountMeta;
        sources: AccountMeta[] | null;
    };
    data: {
        instruction: TokenInstruction.TransferFeeExtension;
        transferFeeInstruction: TransferFeeInstruction.HarvestWithheldTokensToMint;
    };
}

/**
 * Decode a HarvestWithheldTokensToMint instruction and validate it
 *
 * @param instruction Transaction instruction to decode
 * @param programId   SPL Token program account
 *
 * @return Decoded, valid instruction
 */
export function decodeHarvestWithheldTokensToMintInstruction(
    instruction: TransactionInstruction,
    programId: Address,
): DecodedHarvestWithheldTokensToMintInstruction {
    if (!instruction.programId.equals(programId)) throw new TokenInvalidInstructionProgramError();
    if (instruction.data.length !== getHarvestWithheldTokensToMintInstructionDataEncoder().encode({}).length)
        throw new TokenInvalidInstructionDataError();

    const {
        keys: { mint, sources },
        data,
    } = decodeHarvestWithheldTokensToMintInstructionUnchecked(instruction);
    if (
        data.instruction !== TokenInstruction.TransferFeeExtension ||
        data.transferFeeInstruction !== TransferFeeInstruction.HarvestWithheldTokensToMint
    )
        throw new TokenInvalidInstructionTypeError();
    if (!mint) throw new TokenInvalidInstructionKeysError();

    return {
        programId,
        keys: {
            mint,
            sources,
        },
        data,
    };
}

/** A decoded, valid HarvestWithheldTokensToMint instruction */
export interface DecodedHarvestWithheldTokensToMintInstructionUnchecked {
    programId: Address;
    keys: {
        mint: AccountMeta;
        sources: AccountMeta[] | null;
    };
    data: {
        instruction: TokenInstruction.TransferFeeExtension;
        transferFeeInstruction: TransferFeeInstruction.HarvestWithheldTokensToMint;
    };
}

/**
 * Decode a HarvestWithheldTokensToMint instruction without validating it
 *
 * @param instruction Transaction instruction to decode
 *
 * @return Decoded, non-validated instruction
 */
export function decodeHarvestWithheldTokensToMintInstructionUnchecked({
    programId,
    keys: [mint, ...sources],
    data,
}: TransactionInstruction): DecodedHarvestWithheldTokensToMintInstructionUnchecked {
    const { discriminator, transferFeeDiscriminator } =
        getHarvestWithheldTokensToMintInstructionDataDecoder().decode(data);
    return {
        programId,
        keys: {
            mint,
            sources,
        },
        data: {
            instruction: discriminator,
            transferFeeInstruction: transferFeeDiscriminator,
        },
    };
}

// SetTransferFee

export interface SetTransferFeeInstructionData {
    instruction: TokenInstruction.TransferFeeExtension;
    transferFeeInstruction: TransferFeeInstruction.SetTransferFee;
    transferFeeBasisPoints: number;
    maximumFee: bigint;
}

/**
 * Construct a SetTransferFeeInstruction instruction
 *
 * @param mint                      The token mint
 * @param authority                 The authority of the transfer fee
 * @param signers                   The signer account(s)
 * @param transferFeeBasisPoints    Amount of transfer collected as fees, expressed as basis points of the transfer amount
 * @param maximumFee                Maximum fee assessed on transfers
 * @param programID                 SPL Token program account
 *
 * @return Instruction to add to a transaction
 */
export function createSetTransferFeeInstruction(
    mint: Address,
    authority: Address,
    signers: (Signer | Address)[],
    transferFeeBasisPoints: number,
    maximumFee: bigint,
    programId = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }

    const data = Buffer.from(
        getSetTransferFeeInstructionDataEncoder().encode({
            transferFeeBasisPoints: transferFeeBasisPoints,
            maximumFee: maximumFee,
        }),
    );
    const keys = addSigners([{ pubkey: mint, isSigner: false, isWritable: true }], authority, signers);

    return new TransactionInstruction({ keys, programId, data });
}

/** A decoded, valid SetTransferFee instruction */
export interface DecodedSetTransferFeeInstruction {
    programId: Address;
    keys: {
        mint: AccountMeta;
        authority: AccountMeta;
        signers: AccountMeta[] | null;
    };
    data: {
        instruction: TokenInstruction.TransferFeeExtension;
        transferFeeInstruction: TransferFeeInstruction.SetTransferFee;
        transferFeeBasisPoints: number;
        maximumFee: bigint;
    };
}

/**
 * Decode an SetTransferFee instruction and validate it
 *
 * @param instruction Transaction instruction to decode
 * @param programId   SPL Token program account
 *
 * @return Decoded, valid instruction
 */
export function decodeSetTransferFeeInstruction(
    instruction: TransactionInstruction,
    programId: Address,
): DecodedSetTransferFeeInstruction {
    if (!instruction.programId.equals(programId)) throw new TokenInvalidInstructionProgramError();
    if (
        instruction.data.length !==
        getSetTransferFeeInstructionDataEncoder().encode({ transferFeeBasisPoints: 0, maximumFee: BigInt(0) }).length
    )
        throw new TokenInvalidInstructionDataError();

    const {
        keys: { mint, authority, signers },
        data,
    } = decodeSetTransferFeeInstructionUnchecked(instruction);
    if (
        data.instruction !== TokenInstruction.TransferFeeExtension ||
        data.transferFeeInstruction !== TransferFeeInstruction.SetTransferFee
    )
        throw new TokenInvalidInstructionTypeError();
    if (!mint) throw new TokenInvalidInstructionKeysError();

    return {
        programId,
        keys: {
            mint,
            authority,
            signers: signers ? signers : null,
        },
        data,
    };
}

/** A decoded, valid SetTransferFee instruction */
export interface DecodedSetTransferFeeInstructionUnchecked {
    programId: Address;
    keys: {
        mint: AccountMeta;
        authority: AccountMeta;
        signers: AccountMeta[] | undefined;
    };
    data: {
        instruction: TokenInstruction.TransferFeeExtension;
        transferFeeInstruction: TransferFeeInstruction.SetTransferFee;
        transferFeeBasisPoints: number;
        maximumFee: bigint;
    };
}

/**
 * Decode a SetTransferFee instruction without validating it
 *
 * @param instruction Transaction instruction to decode
 *
 * @return Decoded, non-validated instruction
 */
export function decodeSetTransferFeeInstructionUnchecked({
    programId,
    keys: [mint, authority, ...signers],
    data,
}: TransactionInstruction): DecodedSetTransferFeeInstructionUnchecked {
    const { discriminator, transferFeeDiscriminator, transferFeeBasisPoints, maximumFee } =
        getSetTransferFeeInstructionDataDecoder().decode(data);

    return {
        programId,
        keys: {
            mint,
            authority,
            signers,
        },
        data: {
            instruction: discriminator,
            transferFeeInstruction: transferFeeDiscriminator,
            transferFeeBasisPoints,
            maximumFee,
        },
    };
}
