import {
    getMintDecoder,
    getMintEncoder,
    getMintSize,
    type Mint as CodamaMint,
    type MintArgs,
} from '@solana-program/token';
import type { AccountInfo, Commitment, Connection } from '@solana/web3.js';
import { Address } from '@solana/web3.js';
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '../constants.js';
import {
    TokenAccountNotFoundError,
    TokenInvalidAccountOwnerError,
    TokenInvalidAccountSizeError,
    TokenInvalidMintError,
    TokenOwnerOffCurveError,
} from '../errors.js';
import { ACCOUNT_TYPE_SIZE, AccountType } from '../extensions/accountType.js';
import type { ExtensionType } from '../extensions/extensionType.js';
import { getMintLen } from '../extensions/extensionType.js';
import { ACCOUNT_SIZE } from './account.js';
import { MULTISIG_SIZE } from './multisig.js';

/** Information about a mint */
export interface Mint {
    /** Address of the mint */
    address: Address;
    /**
     * Optional authority used to mint new tokens. The mint authority may only be provided during mint creation.
     * If no mint authority is present then the mint has a fixed supply and no further tokens may be minted.
     */
    mintAuthority: Address | null;
    /** Total supply of tokens */
    supply: bigint;
    /** Number of base 10 digits to the right of the decimal place */
    decimals: number;
    /** Is this mint initialized */
    isInitialized: boolean;
    /** Optional authority to freeze token accounts */
    freezeAuthority: Address | null;
    /** Additional data for extension */
    tlvData: Buffer;
}

/** Mint as stored by the program */
export interface RawMint {
    mintAuthorityOption: 1 | 0;
    mintAuthority: Address;
    supply: bigint;
    decimals: number;
    isInitialized: boolean;
    freezeAuthorityOption: 1 | 0;
    freezeAuthority: Address;
}

type CodamaOption<T> = { __option: 'Some'; value: T } | { __option: 'None' };

const DEFAULT_ADDRESS = new Address('11111111111111111111111111111111');

function unwrapAddressOption(option: CodamaOption<string>): Address | null {
    return option.__option === 'Some' ? new Address(option.value) : null;
}

function getRawAddressOption(option: CodamaOption<string>): { option: 1 | 0; address: Address } {
    return option.__option === 'Some'
        ? { option: 1, address: new Address(option.value) }
        : { option: 0, address: DEFAULT_ADDRESS };
}

function rawMintToCodamaArgs(rawMint: RawMint): MintArgs {
    return {
        mintAuthority: rawMint.mintAuthorityOption
            ? (rawMint.mintAuthority.toBase58() as MintArgs['mintAuthority'])
            : null,
        supply: rawMint.supply,
        decimals: rawMint.decimals,
        isInitialized: rawMint.isInitialized,
        freezeAuthority: rawMint.freezeAuthorityOption
            ? (rawMint.freezeAuthority.toBase58() as MintArgs['freezeAuthority'])
            : null,
    };
}

/** Codama-backed layout compatibility helper for de/serializing a mint */
export const MintLayout = {
    span: getMintSize(),
    decode(data: Uint8Array, offset = 0): RawMint {
        const mint = getMintDecoder().decode(data.slice(offset, offset + MINT_SIZE));
        const mintAuthority = getRawAddressOption(mint.mintAuthority);
        const freezeAuthority = getRawAddressOption(mint.freezeAuthority);

        return {
            mintAuthorityOption: mintAuthority.option,
            mintAuthority: mintAuthority.address,
            supply: mint.supply,
            decimals: mint.decimals,
            isInitialized: mint.isInitialized,
            freezeAuthorityOption: freezeAuthority.option,
            freezeAuthority: freezeAuthority.address,
        };
    },
    encode(rawMint: RawMint, buffer: Uint8Array = new Uint8Array(MINT_SIZE), offset = 0): number {
        buffer.set(getMintEncoder().encode(rawMintToCodamaArgs(rawMint)), offset);
        return MINT_SIZE;
    },
};

/** Byte length of a mint */
export const MINT_SIZE = getMintSize();

/**
 * Retrieve information about a mint
 *
 * @param connection Connection to use
 * @param address    Mint account
 * @param commitment Desired level of commitment for querying the state
 * @param programId  SPL Token program account
 *
 * @return Mint information
 */
export async function getMint(
    connection: Connection,
    address: Address,
    commitment?: Commitment,
    programId = TOKEN_PROGRAM_ID,
): Promise<Mint> {
    const info = await connection.getAccountInfo(address, commitment);
    return unpackMint(address, info, programId);
}

/**
 * Unpack a mint
 *
 * @param address   Mint account
 * @param info      Mint account data
 * @param programId SPL Token program account
 *
 * @return Unpacked mint
 */
export function unpackMint(address: Address, info: AccountInfo<Uint8Array> | null, programId = TOKEN_PROGRAM_ID): Mint {
    if (!info) throw new TokenAccountNotFoundError();
    if (!info.owner.equals(programId)) throw new TokenInvalidAccountOwnerError();
    if (info.data.length < MINT_SIZE) throw new TokenInvalidAccountSizeError();

    const rawMint: CodamaMint = getMintDecoder().decode(info.data.slice(0, MINT_SIZE));
    let tlvData = Buffer.alloc(0);
    if (info.data.length > MINT_SIZE) {
        if (info.data.length <= ACCOUNT_SIZE) throw new TokenInvalidAccountSizeError();
        if (info.data.length === MULTISIG_SIZE) throw new TokenInvalidAccountSizeError();
        if (info.data[ACCOUNT_SIZE] != AccountType.Mint) throw new TokenInvalidMintError();
        tlvData = Buffer.from(info.data.slice(ACCOUNT_SIZE + ACCOUNT_TYPE_SIZE));
    }

    return {
        address,
        mintAuthority: unwrapAddressOption(rawMint.mintAuthority),
        supply: rawMint.supply,
        decimals: rawMint.decimals,
        isInitialized: rawMint.isInitialized,
        freezeAuthority: unwrapAddressOption(rawMint.freezeAuthority),
        tlvData,
    };
}

/** Get the minimum lamport balance for a mint to be rent exempt
 *
 * @param connection Connection to use
 * @param commitment Desired level of commitment for querying the state
 *
 * @return Amount of lamports required
 */
export async function getMinimumBalanceForRentExemptMint(
    connection: Connection,
    commitment?: Commitment,
): Promise<number> {
    return await getMinimumBalanceForRentExemptMintWithExtensions(connection, [], commitment);
}

/** Get the minimum lamport balance for a rent-exempt mint with extensions
 *
 * @param connection Connection to use
 * @param extensions Extension types included in the mint
 * @param commitment Desired level of commitment for querying the state
 *
 * @return Amount of lamports required
 */
export async function getMinimumBalanceForRentExemptMintWithExtensions(
    connection: Connection,
    extensions: ExtensionType[],
    commitment?: Commitment,
): Promise<number> {
    const mintLen = getMintLen(extensions);
    return Number(await connection.getMinimumBalanceForRentExemption(mintLen, commitment));
}

/**
 * Async version of getAssociatedTokenAddressSync
 * For backwards compatibility
 *
 * @param mint                     Token mint account
 * @param owner                    Owner of the new account
 * @param allowOwnerOffCurve       Allow the owner account to be a PDA (Program Derived Address)
 * @param programId                SPL Token program account
 * @param associatedTokenProgramId SPL Associated Token program account
 *
 * @return Promise containing the address of the associated token account
 */
export async function getAssociatedTokenAddress(
    mint: Address,
    owner: Address,
    allowOwnerOffCurve = false,
    programId = TOKEN_PROGRAM_ID,
    associatedTokenProgramId = ASSOCIATED_TOKEN_PROGRAM_ID,
): Promise<Address> {
    if (!allowOwnerOffCurve && !Address.isOnCurve(owner.toBytes())) throw new TokenOwnerOffCurveError();

    const [address] = await Address.findProgramAddress(
        [owner.toBytes(), programId.toBytes(), mint.toBytes()],
        associatedTokenProgramId,
    );

    return address;
}

/**
 * Get the address of the associated token account for a given mint and owner
 *
 * @param mint                     Token mint account
 * @param owner                    Owner of the new account
 * @param allowOwnerOffCurve       Allow the owner account to be a PDA (Program Derived Address)
 * @param programId                SPL Token program account
 * @param associatedTokenProgramId SPL Associated Token program account
 *
 * @return Address of the associated token account
 */
export function getAssociatedTokenAddressSync(
    mint: Address,
    owner: Address,
    allowOwnerOffCurve = false,
    programId = TOKEN_PROGRAM_ID,
    associatedTokenProgramId = ASSOCIATED_TOKEN_PROGRAM_ID,
): Address {
    if (!allowOwnerOffCurve && !Address.isOnCurve(owner.toBytes())) throw new TokenOwnerOffCurveError();
    throw new Error(
        'getAssociatedTokenAddressSync is not supported with @solana/web3.js v3; use getAssociatedTokenAddress instead',
    );
}
