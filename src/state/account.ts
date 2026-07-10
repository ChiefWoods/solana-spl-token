import {
    getTokenDecoder,
    getTokenEncoder,
    getTokenSize,
    type Token as CodamaToken,
    type TokenArgs,
} from '@solana-program/token';
import type { AccountInfo, Commitment, Connection } from '@solana/web3.js';
import { Address } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '../constants.js';
import {
    TokenAccountNotFoundError,
    TokenInvalidAccountError,
    TokenInvalidAccountOwnerError,
    TokenInvalidAccountSizeError,
} from '../errors.js';
import { ACCOUNT_TYPE_SIZE, AccountType } from '../extensions/accountType.js';
import type { ExtensionType } from '../extensions/extensionType.js';
import { getAccountLen } from '../extensions/extensionType.js';
import { MULTISIG_SIZE } from './multisig.js';

/** Information about a token account */
export interface Account {
    /** Address of the account */
    address: Address;
    /** Mint associated with the account */
    mint: Address;
    /** Owner of the account */
    owner: Address;
    /** Number of tokens the account holds */
    amount: bigint;
    /** Authority that can transfer tokens from the account */
    delegate: Address | null;
    /** Number of tokens the delegate is authorized to transfer */
    delegatedAmount: bigint;
    /** True if the account is initialized */
    isInitialized: boolean;
    /** True if the account is frozen */
    isFrozen: boolean;
    /** True if the account is a native token account */
    isNative: boolean;
    /**
     * If the account is a native token account, it must be rent-exempt. The rent-exempt reserve is the amount that must
     * remain in the balance until the account is closed.
     */
    rentExemptReserve: bigint | null;
    /** Optional authority to close the account */
    closeAuthority: Address | null;
    tlvData: Buffer;
}

/** Token account state as stored by the program */
export enum AccountState {
    Uninitialized = 0,
    Initialized = 1,
    Frozen = 2,
}

/** Token account as stored by the program */
export interface RawAccount {
    mint: Address;
    owner: Address;
    amount: bigint;
    delegateOption: 1 | 0;
    delegate: Address;
    state: AccountState;
    isNativeOption: 1 | 0;
    isNative: bigint;
    delegatedAmount: bigint;
    closeAuthorityOption: 1 | 0;
    closeAuthority: Address;
}

type CodamaOption<T> = { __option: 'Some'; value: T } | { __option: 'None' };

const DEFAULT_ADDRESS = new Address('11111111111111111111111111111111');

function unwrapAddressOption(option: CodamaOption<string>): Address | null {
    return option.__option === 'Some' ? new Address(option.value) : null;
}

function unwrapBigIntOption(option: CodamaOption<bigint>): bigint | null {
    return option.__option === 'Some' ? option.value : null;
}

function getRawAddressOption(option: CodamaOption<string>): { option: 1 | 0; address: Address } {
    return option.__option === 'Some'
        ? { option: 1, address: new Address(option.value) }
        : { option: 0, address: DEFAULT_ADDRESS };
}

function rawAccountToCodamaArgs(rawAccount: RawAccount): TokenArgs {
    return {
        mint: rawAccount.mint.toBase58() as TokenArgs['mint'],
        owner: rawAccount.owner.toBase58() as TokenArgs['owner'],
        amount: rawAccount.amount,
        delegate: rawAccount.delegateOption ? (rawAccount.delegate.toBase58() as TokenArgs['delegate']) : null,
        state: rawAccount.state as TokenArgs['state'],
        isNative: rawAccount.isNativeOption ? rawAccount.isNative : null,
        delegatedAmount: rawAccount.delegatedAmount,
        closeAuthority: rawAccount.closeAuthorityOption
            ? (rawAccount.closeAuthority.toBase58() as TokenArgs['closeAuthority'])
            : null,
    };
}

/** Codama-backed layout compatibility helper for de/serializing a token account */
export const AccountLayout = {
    span: getTokenSize(),
    decode(data: Uint8Array, offset = 0): RawAccount {
        const account = getTokenDecoder().decode(data.slice(offset, offset + ACCOUNT_SIZE));
        const delegate = getRawAddressOption(account.delegate);
        const closeAuthority = getRawAddressOption(account.closeAuthority);

        return {
            mint: new Address(account.mint),
            owner: new Address(account.owner),
            amount: account.amount,
            delegateOption: delegate.option,
            delegate: delegate.address,
            state: account.state,
            isNativeOption: account.isNative.__option === 'Some' ? 1 : 0,
            isNative: account.isNative.__option === 'Some' ? account.isNative.value : BigInt(0),
            delegatedAmount: account.delegatedAmount,
            closeAuthorityOption: closeAuthority.option,
            closeAuthority: closeAuthority.address,
        };
    },
    encode(rawAccount: RawAccount, buffer: Uint8Array = new Uint8Array(ACCOUNT_SIZE), offset = 0): number {
        buffer.set(getTokenEncoder().encode(rawAccountToCodamaArgs(rawAccount)), offset);
        return ACCOUNT_SIZE;
    },
};

/** Byte length of a token account */
export const ACCOUNT_SIZE = getTokenSize();

/**
 * Retrieve information about a token account
 *
 * @param connection Connection to use
 * @param address    Token account
 * @param commitment Desired level of commitment for querying the state
 * @param programId  SPL Token program account
 *
 * @return Token account information
 */
export async function getAccount(
    connection: Connection,
    address: Address,
    commitment?: Commitment,
    programId = TOKEN_PROGRAM_ID,
): Promise<Account> {
    const info = await connection.getAccountInfo(address, commitment);
    return unpackAccount(address, info, programId);
}

/**
 * Retrieve information about multiple token accounts in a single RPC call
 *
 * @param connection Connection to use
 * @param addresses  Token accounts
 * @param commitment Desired level of commitment for querying the state
 * @param programId  SPL Token program account
 *
 * @return Token account information
 */
export async function getMultipleAccounts(
    connection: Connection,
    addresses: Address[],
    commitment?: Commitment,
    programId = TOKEN_PROGRAM_ID,
): Promise<Account[]> {
    const infos = await connection.getMultipleAccountsInfo(addresses, commitment);
    return addresses.map((address, i) => unpackAccount(address, infos[i], programId));
}

/** Get the minimum lamport balance for a base token account to be rent exempt
 *
 * @param connection Connection to use
 * @param commitment Desired level of commitment for querying the state
 *
 * @return Amount of lamports required
 */
export async function getMinimumBalanceForRentExemptAccount(
    connection: Connection,
    commitment?: Commitment,
): Promise<number> {
    return await getMinimumBalanceForRentExemptAccountWithExtensions(connection, [], commitment);
}

/** Get the minimum lamport balance for a rent-exempt token account with extensions
 *
 * @param connection Connection to use
 * @param commitment Desired level of commitment for querying the state
 *
 * @return Amount of lamports required
 */
export async function getMinimumBalanceForRentExemptAccountWithExtensions(
    connection: Connection,
    extensions: ExtensionType[],
    commitment?: Commitment,
): Promise<number> {
    const accountLen = getAccountLen(extensions);
    return Number(await connection.getMinimumBalanceForRentExemption(accountLen, commitment));
}

/**
 * Unpack a token account
 *
 * @param address   Token account
 * @param info      Token account data
 * @param programId SPL Token program account
 *
 * @return Unpacked token account
 */
export function unpackAccount(
    address: Address,
    info: AccountInfo<Uint8Array> | null,
    programId = TOKEN_PROGRAM_ID,
): Account {
    if (!info) throw new TokenAccountNotFoundError();
    if (!info.owner.equals(programId)) throw new TokenInvalidAccountOwnerError();
    if (info.data.length < ACCOUNT_SIZE) throw new TokenInvalidAccountSizeError();

    const rawAccount: CodamaToken = getTokenDecoder().decode(info.data.slice(0, ACCOUNT_SIZE));
    let tlvData = Buffer.alloc(0);
    if (info.data.length > ACCOUNT_SIZE) {
        if (info.data.length === MULTISIG_SIZE) throw new TokenInvalidAccountSizeError();
        if (info.data[ACCOUNT_SIZE] != AccountType.Account) throw new TokenInvalidAccountError();
        tlvData = Buffer.from(info.data.slice(ACCOUNT_SIZE + ACCOUNT_TYPE_SIZE));
    }

    return {
        address,
        mint: new Address(rawAccount.mint),
        owner: new Address(rawAccount.owner),
        amount: rawAccount.amount,
        delegate: unwrapAddressOption(rawAccount.delegate),
        delegatedAmount: rawAccount.delegatedAmount,
        isInitialized: rawAccount.state !== AccountState.Uninitialized,
        isFrozen: rawAccount.state === AccountState.Frozen,
        isNative: rawAccount.isNative.__option === 'Some',
        rentExemptReserve: unwrapBigIntOption(rawAccount.isNative),
        closeAuthority: unwrapAddressOption(rawAccount.closeAuthority),
        tlvData,
    };
}
