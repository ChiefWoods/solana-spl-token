import {
    getMultisigDecoder,
    getMultisigEncoder,
    getMultisigSize,
    type Multisig as CodamaMultisig,
    type MultisigArgs,
} from '@solana-program/token';
import type { AccountInfo, Commitment, Connection } from '@solana/web3.js';
import { Address } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '../constants.js';
import { TokenAccountNotFoundError, TokenInvalidAccountOwnerError, TokenInvalidAccountSizeError } from '../errors.js';

/** Information about a multisig */
export interface Multisig {
    /** Address of the multisig */
    address: Address;
    /** Number of signers required */
    m: number;
    /** Number of possible signers, corresponds to the number of `signers` that are valid */
    n: number;
    /** Is this mint initialized */
    isInitialized: boolean;
    /** Full set of signers, of which `n` are valid */
    signer1: Address;
    signer2: Address;
    signer3: Address;
    signer4: Address;
    signer5: Address;
    signer6: Address;
    signer7: Address;
    signer8: Address;
    signer9: Address;
    signer10: Address;
    signer11: Address;
}

/** Multisig as stored by the program */
export type RawMultisig = Omit<Multisig, 'address'>;

function rawMultisigToCodamaArgs(multisig: RawMultisig): MultisigArgs {
    return {
        m: multisig.m,
        n: multisig.n,
        isInitialized: multisig.isInitialized,
        signers: [
            multisig.signer1.toBase58(),
            multisig.signer2.toBase58(),
            multisig.signer3.toBase58(),
            multisig.signer4.toBase58(),
            multisig.signer5.toBase58(),
            multisig.signer6.toBase58(),
            multisig.signer7.toBase58(),
            multisig.signer8.toBase58(),
            multisig.signer9.toBase58(),
            multisig.signer10.toBase58(),
            multisig.signer11.toBase58(),
        ] as MultisigArgs['signers'],
    };
}

function codamaMultisigToRaw(multisig: CodamaMultisig): RawMultisig {
    return {
        m: multisig.m,
        n: multisig.n,
        isInitialized: multisig.isInitialized,
        signer1: new Address(multisig.signers[0]),
        signer2: new Address(multisig.signers[1]),
        signer3: new Address(multisig.signers[2]),
        signer4: new Address(multisig.signers[3]),
        signer5: new Address(multisig.signers[4]),
        signer6: new Address(multisig.signers[5]),
        signer7: new Address(multisig.signers[6]),
        signer8: new Address(multisig.signers[7]),
        signer9: new Address(multisig.signers[8]),
        signer10: new Address(multisig.signers[9]),
        signer11: new Address(multisig.signers[10]),
    };
}

/** Codama-backed layout compatibility helper for de/serializing a multisig */
export const MultisigLayout = {
    span: getMultisigSize(),
    decode(data: Uint8Array, offset = 0): RawMultisig {
        return codamaMultisigToRaw(getMultisigDecoder().decode(data.slice(offset, offset + MULTISIG_SIZE)));
    },
    encode(multisig: RawMultisig, buffer: Uint8Array = new Uint8Array(MULTISIG_SIZE), offset = 0): number {
        buffer.set(getMultisigEncoder().encode(rawMultisigToCodamaArgs(multisig)), offset);
        return MULTISIG_SIZE;
    },
};

/** Byte length of a multisig */
export const MULTISIG_SIZE = getMultisigSize();

/**
 * Retrieve information about a multisig
 *
 * @param connection Connection to use
 * @param address    Multisig account
 * @param commitment Desired level of commitment for querying the state
 * @param programId  SPL Token program account
 *
 * @return Multisig information
 */
export async function getMultisig(
    connection: Connection,
    address: Address,
    commitment?: Commitment,
    programId = TOKEN_PROGRAM_ID,
): Promise<Multisig> {
    const info = await connection.getAccountInfo(address, commitment);
    return unpackMultisig(address, info, programId);
}

/**
 * Unpack a multisig
 *
 * @param address   Multisig account
 * @param info      Multisig account data
 * @param programId SPL Token program account
 *
 * @return Unpacked multisig
 */
export function unpackMultisig(
    address: Address,
    info: AccountInfo<Uint8Array> | null,
    programId = TOKEN_PROGRAM_ID,
): Multisig {
    if (!info) throw new TokenAccountNotFoundError();
    if (!info.owner.equals(programId)) throw new TokenInvalidAccountOwnerError();
    if (info.data.length != MULTISIG_SIZE) throw new TokenInvalidAccountSizeError();

    const multisig = codamaMultisigToRaw(getMultisigDecoder().decode(info.data));

    return { address, ...multisig };
}

/** Get the minimum lamport balance for a multisig to be rent exempt
 *
 * @param connection Connection to use
 * @param commitment Desired level of commitment for querying the state
 *
 * @return Amount of lamports required
 */
export async function getMinimumBalanceForRentExemptMultisig(
    connection: Connection,
    commitment?: Commitment,
): Promise<number> {
    return Number(await connection.getMinimumBalanceForRentExemption(MULTISIG_SIZE, commitment));
}
