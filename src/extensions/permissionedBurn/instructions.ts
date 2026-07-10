import {
    getInitializePermissionedBurnInstructionDataEncoder,
    getPermissionedBurnCheckedInstructionDataEncoder,
    getPermissionedBurnInstructionDataEncoder,
} from '@solana-program/token-2022';
import type { Address, Signer } from '@solana/web3.js';
import { TransactionInstruction } from '@solana/web3.js';
import { programSupportsExtensions, TOKEN_2022_PROGRAM_ID } from '../../constants.js';
import { TokenUnsupportedInstructionError } from '../../errors.js';
import { addSigners } from '../../instructions/internal.js';
import type { TokenInstruction } from '../../instructions/types.js';

export enum PermissionedBurnInstruction {
    Initialize = 0,
    Burn = 1,
    BurnChecked = 2,
}

interface InitializePermissionedBurnInstructionData {
    instruction: TokenInstruction.PermissionedBurnExtension;
    permissionedBurnInstruction: PermissionedBurnInstruction.Initialize;
    authority: Address;
}

/**
 * Construct a InitializePermissionedBurnConfig instruction
 *
 * @param mint          Token mint account
 * @param authority     The permissioned burn mint's authority
 * @param programId     SPL Token program account
 */
export function createInitializePermissionedBurnInstruction(
    mint: Address,
    authority: Address,
    programId = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }

    const keys = [{ pubkey: mint, isSigner: false, isWritable: true }];
    const data = Buffer.from(
        getInitializePermissionedBurnInstructionDataEncoder().encode({ authority: authority.toBase58() }),
    );

    return new TransactionInstruction({ keys, programId, data });
}

interface PermissionedBurnInstructionData {
    instruction: TokenInstruction.PermissionedBurnExtension;
    permissionedBurnInstruction: PermissionedBurnInstruction.Burn;
    amount: bigint;
}

/**
 * Construct a permissioned burn instruction
 *
 * @param account                       Token account to update
 * @param mint                          Token mint account
 * @param owner                         The account's owner/delegate
 * @param permissionedBurnAuthority     Authority configured on the mint for permissioned burns
 * @param amount                        Amount to burn
 * @param multiSigners                  The signer account(s)
 * @param programId                     SPL Token program account
 */
export function createPermissionedBurnInstruction(
    account: Address,
    mint: Address,
    owner: Address,
    permissionedBurnAuthority: Address,
    amount: number | bigint,
    multiSigners: (Signer | Address)[] = [],
    programId = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }

    const keys = addSigners(
        [
            { pubkey: account, isSigner: false, isWritable: true },
            { pubkey: mint, isSigner: false, isWritable: true },
            { pubkey: permissionedBurnAuthority, isSigner: true, isWritable: false },
        ],
        owner,
        multiSigners,
    );

    const data = Buffer.from(getPermissionedBurnInstructionDataEncoder().encode({ amount }));

    return new TransactionInstruction({ keys, programId, data });
}

interface PermissionedBurnCheckedInstructionData {
    instruction: TokenInstruction.PermissionedBurnExtension;
    permissionedBurnInstruction: PermissionedBurnInstruction.BurnChecked;
    amount: bigint;
    decimals: number;
}

/**
 * Construct a checked permissioned burn instruction
 *
 * @param account                       Token account to update
 * @param mint                          Token mint account
 * @param owner                         The account's owner/delegate
 * @param permissionedBurnAuthority     Authority configured on the mint for permissioned burns
 * @param amount                        Amount to burn
 * @param decimals                      Number of the decimals of the mint
 * @param multiSigners                  The signer account(s)
 * @param programId                     SPL Token program account
 */
export function createPermissionedBurnCheckedInstruction(
    account: Address,
    mint: Address,
    owner: Address,
    permissionedBurnAuthority: Address,
    amount: number | bigint,
    decimals: number,
    multiSigners: (Signer | Address)[] = [],
    programId = TOKEN_2022_PROGRAM_ID,
): TransactionInstruction {
    if (!programSupportsExtensions(programId)) {
        throw new TokenUnsupportedInstructionError();
    }

    const keys = addSigners(
        [
            { pubkey: account, isSigner: false, isWritable: true },
            { pubkey: mint, isSigner: false, isWritable: true },
            { pubkey: permissionedBurnAuthority, isSigner: true, isWritable: false },
        ],
        owner,
        multiSigners,
    );

    const data = Buffer.from(getPermissionedBurnCheckedInstructionDataEncoder().encode({ amount, decimals }));

    return new TransactionInstruction({ keys, programId, data });
}
