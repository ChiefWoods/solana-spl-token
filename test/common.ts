import { FailedTransactionMetadata, LiteSVM, type TransactionMetadata } from 'litesvm-web3js';
import path from 'node:path';
import type {
    AccountInfo,
    Address as AddressType,
    BlockhashWithExpiryBlockHeight,
    Commitment,
    Connection,
    SendOptions,
    Signer,
    SimulatedTransactionResponse,
    TokenAmount,
    TransactionConfirmationStrategy,
    TransactionSignature,
    VersionedTransaction,
} from '@solana/web3.js';
import { Address, Keypair, SystemProgram, Transaction } from '@solana/web3.js';
import {
    createAmountToUiAmountInstruction,
    createInitializeInterestBearingMintInstruction,
    createInitializeMintInstruction,
    createInitializeScaledUiAmountConfigInstruction,
    createUpdateMultiplierDataInstruction,
    createUiAmountToAmountInstruction,
    ExtensionType,
    NATIVE_MINT_2022,
    TOKEN_2022_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    getMintLen,
} from '../src';
import { unpackAccount } from '../src/state/account';
import { unpackMint } from '../src/state/mint';

export async function newAccountWithLamports(connection: Connection, lamports = 1000000): Promise<Signer> {
    const account = await Keypair.generate();
    const signature = await connection.requestAirdrop(account.publicKey, lamports);
    await connection.confirmTransaction(signature);
    return account;
}

const FIXTURES_DIR = path.resolve(import.meta.dirname, '..', 'fixtures');
const TRANSFER_HOOK_FIXTURE = path.join(FIXTURES_DIR, 'spl_transfer_hook_example_no_default_features.so');

const CONFIRMED_CONTEXT = { slot: 0n };
const CONFIRMED_SIGNATURE_RESULT = { context: CONFIRMED_CONTEXT, value: { err: null } };
export const TEST_CLOCK_TIMESTAMP = 31556736;

type InterestBearingMintConfig = {
    type: 'interestBearing';
    rate?: number;
};

type ScaledUiAmountMintConfig = {
    type: 'scaledUiAmount';
    multiplier?: number;
    newMultiplierEffectiveTimestamp?: number;
    newMultiplier?: number;
};

type MintExtensionConfig = InterestBearingMintConfig | ScaledUiAmountMintConfig;

async function settlePendingSignatures(): Promise<void> {
    await new Promise(resolve => setImmediate(resolve));
}

function toSignature(metadata: TransactionMetadata): TransactionSignature {
    return Buffer.from(metadata.signature()).toString('base64') as TransactionSignature;
}

function toAccountInfo(account: ReturnType<LiteSVM['getAccount']>): AccountInfo<Uint8Array> | null {
    if (!account) return null;

    return {
        data: account.data,
        executable: account.executable,
        lamports: BigInt(account.lamports),
        owner: account.owner,
        rentEpoch: BigInt(account.rentEpoch ?? 0n),
    };
}

export function createLiteSvm(unixTimestamp = Math.floor(Date.now() / 1000)): LiteSVM {
    const svm = new LiteSVM().withSigverify(false).withTransactionHistory(0n).withNativeMints();
    const clock = svm.getClock();
    clock.unixTimestamp = BigInt(unixTimestamp);
    svm.setClock(clock);
    svm.addProgramFromFile(TRANSFER_HOOK_TEST_PROGRAM_ID, TRANSFER_HOOK_FIXTURE);
    return svm;
}

export function setLiteSvmClock(svm: LiteSVM, unixTimestamp: number): void {
    const clock = svm.getClock();
    clock.unixTimestamp = BigInt(unixTimestamp);
    svm.setClock(clock);
}

type TestMint = {
    address: Address;
    authority: Keypair;
};

async function sendLiteSvmTransaction(
    svm: LiteSVM,
    transaction: Transaction,
    signers: Signer[] = [],
    payer?: Keypair,
): Promise<TransactionMetadata> {
    payer ??= await Keypair.generate();
    svm.airdrop(payer.publicKey, 1_000_000_000n);
    transaction.feePayer = payer.publicKey;
    transaction.recentBlockhash = svm.latestBlockhash();
    transaction.lastValidBlockHeight = 0n;
    await transaction.sign(payer, ...signers);

    const result = await svm.sendTransaction(transaction);
    if (result instanceof FailedTransactionMetadata) {
        throw new Error(`LiteSVM transaction failed: ${result.toString()}`);
    }

    return result;
}

export async function createTestMint(svm: LiteSVM, decimals = 2, extension?: MintExtensionConfig): Promise<TestMint> {
    const payer = await Keypair.generate();
    const mint = await Keypair.generate();
    const mintAuthority = await Keypair.generate();
    const extensionTypes =
        extension?.type === 'interestBearing'
            ? [ExtensionType.InterestBearingConfig]
            : extension?.type === 'scaledUiAmount'
              ? [ExtensionType.ScaledUiAmountConfig]
              : [];
    const mintLen = getMintLen(extensionTypes);
    const lamports = svm.minimumBalanceForRentExemption(BigInt(mintLen));
    const transaction = new Transaction().add(
        SystemProgram.createAccount({
            fromPubkey: payer.publicKey,
            newAccountPubkey: mint.publicKey,
            space: mintLen,
            lamports,
            programId: TOKEN_2022_PROGRAM_ID,
        }),
    );

    if (extension?.type === 'interestBearing') {
        transaction.add(
            createInitializeInterestBearingMintInstruction(
                mint.publicKey,
                mintAuthority.publicKey,
                extension.rate ?? 500,
                TOKEN_2022_PROGRAM_ID,
            ),
        );
    }

    if (extension?.type === 'scaledUiAmount') {
        transaction.add(
            createInitializeScaledUiAmountConfigInstruction(
                mint.publicKey,
                mintAuthority.publicKey,
                extension.multiplier ?? 0,
                TOKEN_2022_PROGRAM_ID,
            ),
        );
    }

    transaction.add(
        createInitializeMintInstruction(mint.publicKey, decimals, mintAuthority.publicKey, null, TOKEN_2022_PROGRAM_ID),
    );

    await sendLiteSvmTransaction(svm, transaction, [mint], payer);

    if (extension?.type === 'scaledUiAmount' && extension.newMultiplier !== undefined) {
        await sendLiteSvmTransaction(
            svm,
            new Transaction().add(
                createUpdateMultiplierDataInstruction(
                    mint.publicKey,
                    mintAuthority.publicKey,
                    extension.newMultiplier,
                    BigInt(extension.newMultiplierEffectiveTimestamp ?? TEST_CLOCK_TIMESTAMP),
                    [],
                    TOKEN_2022_PROGRAM_ID,
                ),
            ),
            [mintAuthority],
        );
    }

    return { address: mint.publicKey, authority: mintAuthority };
}

export async function invokeReturnData(
    svm: LiteSVM,
    transaction: Transaction,
    programId: AddressType = TOKEN_2022_PROGRAM_ID,
): Promise<Buffer> {
    const metadata = await sendLiteSvmTransaction(svm, transaction);
    const programReturnPrefix = `Program return: ${new Address(programId).toBase58()} `;
    const programReturnLog = metadata.logs().find(log => log.startsWith(programReturnPrefix));
    if (!programReturnLog) {
        throw new Error(`LiteSVM transaction did not emit return data for ${new Address(programId).toBase58()}`);
    }

    return Buffer.from(programReturnLog.slice(programReturnPrefix.length), 'base64');
}

export async function invokeAmountToUiAmount(
    svm: LiteSVM,
    amount: bigint,
    mint: AddressType = NATIVE_MINT_2022,
    programId: AddressType = TOKEN_2022_PROGRAM_ID,
): Promise<string> {
    const data = await invokeReturnData(
        svm,
        new Transaction().add(createAmountToUiAmountInstruction(mint, amount, programId)),
        programId,
    );
    return data.toString('utf8');
}

export async function invokeUiAmountToAmount(
    svm: LiteSVM,
    amount: string,
    mint: AddressType = NATIVE_MINT_2022,
    programId: AddressType = TOKEN_2022_PROGRAM_ID,
): Promise<bigint> {
    const data = await invokeReturnData(
        svm,
        new Transaction().add(createUiAmountToAmountInstruction(mint, amount, programId)),
        programId,
    );
    return data.readBigUInt64LE();
}

class LiteSvmConnection {
    constructor(private readonly svm: LiteSVM) {}

    async requestAirdrop(to: Address, lamports: number | bigint): Promise<TransactionSignature> {
        const result = this.svm.airdrop(to, BigInt(lamports));
        if (!result || result instanceof FailedTransactionMetadata) {
            throw new Error(`LiteSVM airdrop failed: ${result?.toString() ?? 'no result'}`);
        }
        return toSignature(result);
    }

    async confirmTransaction(
        _strategy: TransactionConfirmationStrategy | TransactionSignature,
        _commitment?: Commitment,
    ): Promise<typeof CONFIRMED_SIGNATURE_RESULT> {
        return CONFIRMED_SIGNATURE_RESULT;
    }

    async getLatestBlockhash(_commitment?: Commitment): Promise<BlockhashWithExpiryBlockHeight> {
        return {
            blockhash: this.svm.latestBlockhash(),
            lastValidBlockHeight: 0n,
        };
    }

    async getMinimumBalanceForRentExemption(dataLength: number | bigint, _commitment?: Commitment): Promise<bigint> {
        return this.svm.minimumBalanceForRentExemption(BigInt(dataLength));
    }

    async getBalance(address: Address): Promise<bigint> {
        return this.svm.getBalance(address) ?? 0n;
    }

    async getAccountInfo(address: Address, _commitment?: Commitment): Promise<AccountInfo<Uint8Array> | null> {
        return toAccountInfo(this.svm.getAccount(address));
    }

    async sendTransaction(
        transaction: Transaction | VersionedTransaction,
        signersOrOptions?: Signer[] | SendOptions,
        _options?: SendOptions,
    ): Promise<TransactionSignature> {
        if (transaction instanceof Transaction) {
            const signers = Array.isArray(signersOrOptions) ? signersOrOptions : [];
            transaction.recentBlockhash ??= this.svm.latestBlockhash();
            transaction.lastValidBlockHeight ??= 0n;
            await transaction.sign(...signers);
        } else {
            await settlePendingSignatures();
        }

        const result = await this.svm.sendTransaction(transaction);
        if (result instanceof FailedTransactionMetadata) {
            throw new Error(`LiteSVM transaction failed: ${result.toString()}`);
        }

        return toSignature(result);
    }

    async simulateTransaction(
        transaction: Transaction | VersionedTransaction,
        signersOrConfig?: Signer[] | unknown,
        _includeAccounts?: boolean | Address[],
    ): Promise<{ context: typeof CONFIRMED_CONTEXT; value: SimulatedTransactionResponse }> {
        if (transaction instanceof Transaction) {
            const signers = Array.isArray(signersOrConfig) ? signersOrConfig : [];
            transaction.recentBlockhash ??= this.svm.latestBlockhash();
            transaction.lastValidBlockHeight ??= 0n;
            await transaction.sign(...signers);
        } else {
            await settlePendingSignatures();
        }

        const result = await this.svm.simulateTransaction(transaction);
        const metadata = result instanceof FailedTransactionMetadata ? result.meta() : result.meta();
        const returnData = metadata.returnData();

        return {
            context: CONFIRMED_CONTEXT,
            value: {
                accounts: null,
                err:
                    result instanceof FailedTransactionMetadata
                        ? (result.err() as unknown as SimulatedTransactionResponse['err'])
                        : null,
                logs: metadata.logs(),
                returnData: {
                    data: [Buffer.from(returnData.data()).toString('base64'), 'base64'],
                    programId: new Address(returnData.programId()).toBase58(),
                },
                unitsConsumed: metadata.computeUnitsConsumed(),
            },
        };
    }

    async getTokenAccountBalance(address: Address): Promise<{ context: typeof CONFIRMED_CONTEXT; value: TokenAmount }> {
        const info = await this.getAccountInfo(address);
        const account = unpackAccount(address, info, TEST_PROGRAM_ID);
        const mintInfo = await this.getAccountInfo(account.mint);
        const mint = unpackMint(account.mint, mintInfo, TEST_PROGRAM_ID);
        const decimals = mint.decimals;
        const amount = account.amount.toString();
        const divisor = 10 ** decimals;
        const uiAmount = Number(account.amount) / divisor;

        return {
            context: CONFIRMED_CONTEXT,
            value: {
                amount,
                decimals,
                uiAmount,
                uiAmountString: uiAmount.toFixed(decimals),
            },
        };
    }
}

export async function getConnection(): Promise<Connection> {
    return new LiteSvmConnection(createLiteSvm()) as unknown as Connection;
}

export const TEST_PROGRAM_ID = process.env.TEST_PROGRAM_ID
    ? new Address(process.env.TEST_PROGRAM_ID)
    : TOKEN_PROGRAM_ID;

export const TRANSFER_HOOK_TEST_PROGRAM_ID = new Address('TokenHookExampLe8smaVNrxTBezWTRbEwxwb1Zykrb');
