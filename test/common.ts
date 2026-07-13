import type { Address as KitAddress, InstructionPlan, TransactionSigner } from '@solana/kit';
import {
    createKeyPairSignerFromBytes,
    createSolanaRpc,
    flattenInstructionPlan,
    isSignerRole,
    isWritableRole,
    nonDivisibleSequentialInstructionPlan,
} from '@solana/kit';
import { ristretto255 } from '@noble/curves/ed25519';
import { getCreateConfidentialTransferAccountInstructionPlan } from '@solana-program/token-2022/confidential';
import {
    ExtensionType as KitExtensionType,
    getConfigureConfidentialTransferAccountInstruction,
    getCreateAssociatedTokenIdempotentInstruction,
    getReallocateInstruction,
} from '@solana-program/token-2022';
import {
    AeKey,
    BatchedGroupedCiphertext3HandlesValidityProofData,
    BatchedRangeProofU128Data,
    CiphertextCiphertextEqualityProofData,
    CiphertextCommitmentEqualityProofData,
    ElGamalCiphertext,
    ElGamalKeypair,
    ElGamalPubkey,
    GroupedElGamalCiphertext3Handles,
    PedersenCommitment,
    PedersenOpening,
    PubkeyValidityProofData,
} from '@solana/zk-sdk/bundler';
import type { Signer } from '@solana/web3.js';
import {
    Address,
    Keypair,
    Connection,
    SystemProgram,
    Transaction,
    TransactionInstruction,
    sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
    ExtensionType,
    TOKEN_PROGRAM_ID,
    createInitializeAccountInstruction,
    createInitializeMintInstruction,
    getAccountLen,
    getAccount,
    getAssociatedTokenAddress,
    getMintLen,
} from '../src';
import { createInitializeConfidentialMintBurnInstruction } from '../src/extensions/confidentialMintBurn/index';
import { createInitializeConfidentialTransferMintInstruction } from '../src/extensions/confidentialTransfer/index';
import { createInitializeConfidentialTransferFeeConfigInstruction } from '../src/extensions/confidentialTransferFee/index';
import { createInitializeTransferFeeConfigInstruction } from '../src/extensions/transferFee/index';

export async function newAccountWithLamports(connection: Connection, lamports = 1000000): Promise<Signer> {
    const account = await Keypair.generate();
    const signature = await connection.requestAirdrop(account.publicKey, lamports);
    await connection.confirmTransaction(signature);
    return account;
}

export async function getConnection(): Promise<Connection> {
    const url = 'http://127.0.0.1:8899';
    const connection = new Connection(url, 'confirmed');
    return connection;
}

export const TEST_PROGRAM_ID = process.env.TEST_PROGRAM_ID
    ? new Address(process.env.TEST_PROGRAM_ID)
    : TOKEN_PROGRAM_ID;

export const TRANSFER_HOOK_TEST_PROGRAM_ID = new Address('TokenHookExampLe8smaVNrxTBezWTRbEwxwb1Zykrb');

async function toKitSigner(signer: Signer): Promise<TransactionSigner> {
    return await createKeyPairSignerFromBytes((signer as unknown as { secretKey: Uint8Array }).secretKey);
}

function kitInstructionPlanToTransaction(plan: InstructionPlan): Transaction {
    const transaction = new Transaction();
    for (const leaf of flattenInstructionPlan(plan)) {
        if (leaf.kind !== 'single') {
            throw new Error(`Unsupported instruction plan kind: ${leaf.kind}`);
        }
        const instruction = leaf.instruction as {
            programAddress: string;
            accounts?: { address: string; role: number }[];
            data?: Uint8Array;
        };
        transaction.add(
            new TransactionInstruction({
                programId: new Address(instruction.programAddress),
                keys:
                    instruction.accounts?.map(account => ({
                        pubkey: new Address(account.address),
                        isSigner: isSignerRole(account.role),
                        isWritable: isWritableRole(account.role),
                    })) ?? [],
                data: Buffer.from(instruction.data ?? new Uint8Array()),
            }),
        );
    }
    return transaction;
}

function extractCiphertextFromGroupedBytes(groupedCiphertext: Uint8Array, handleIndex: number) {
    const ciphertext = new Uint8Array(64);
    ciphertext.set(groupedCiphertext.slice(0, 32), 0);
    ciphertext.set(groupedCiphertext.slice(32 + handleIndex * 32, 64 + handleIndex * 32), 32);
    return ciphertext;
}

const { Point: RistrettoPoint } = ristretto255;

function ciphertextToPoints(ciphertext: Uint8Array) {
    return {
        commitment: RistrettoPoint.fromHex(ciphertext.slice(0, 32)),
        handle: RistrettoPoint.fromHex(ciphertext.slice(32, 64)),
    };
}

function pointsToCiphertext(commitment: typeof RistrettoPoint.BASE, handle: typeof RistrettoPoint.BASE) {
    const ciphertext = new Uint8Array(64);
    ciphertext.set(commitment.toRawBytes(), 0);
    ciphertext.set(handle.toRawBytes(), 32);
    return ciphertext;
}

function combineLoHiCiphertexts(ciphertextLo: Uint8Array, ciphertextHi: Uint8Array, bitLength: bigint) {
    const scale = 1n << bitLength;
    const loPoints = ciphertextToPoints(ciphertextLo);
    const hiPoints = ciphertextToPoints(ciphertextHi);
    return pointsToCiphertext(
        loPoints.commitment.add(hiPoints.commitment.multiply(scale)),
        loPoints.handle.add(hiPoints.handle.multiply(scale)),
    );
}

function addWithLoHiCiphertexts(
    left: Uint8Array,
    ciphertextLo: Uint8Array,
    ciphertextHi: Uint8Array,
    bitLength: bigint,
) {
    const leftPoints = ciphertextToPoints(left);
    const rightPoints = ciphertextToPoints(combineLoHiCiphertexts(ciphertextLo, ciphertextHi, bitLength));
    return pointsToCiphertext(
        leftPoints.commitment.add(rightPoints.commitment),
        leftPoints.handle.add(rightPoints.handle),
    );
}

function subtractWithLoHiCiphertexts(
    left: Uint8Array,
    ciphertextLo: Uint8Array,
    ciphertextHi: Uint8Array,
    bitLength: bigint,
) {
    const leftPoints = ciphertextToPoints(left);
    const rightPoints = ciphertextToPoints(combineLoHiCiphertexts(ciphertextLo, ciphertextHi, bitLength));
    return pointsToCiphertext(
        leftPoints.commitment.subtract(rightPoints.commitment),
        leftPoints.handle.subtract(rightPoints.handle),
    );
}

const ZK_ELGAMAL_PROOF_PROGRAM_ID = new Address('ZkE1Gama1Proof11111111111111111111111111111');
const CIPHERTEXT_CIPHERTEXT_EQUALITY_PROOF = 2;
const CIPHERTEXT_COMMITMENT_EQUALITY_PROOF = 3;
const PUBKEY_VALIDITY_PROOF = 4;
const BATCHED_RANGE_PROOF_U128 = 7;
const BATCHED_GROUPED_CIPHERTEXT_3_HANDLES_VALIDITY_PROOF = 12;
const CIPHERTEXT_COMMITMENT_EQUALITY_CONTEXT_ACCOUNT_SIZE = 33 + 128;
const BATCHED_RANGE_PROOF_CONTEXT_ACCOUNT_SIZE = 33 + 264;
const BATCHED_GROUPED_CIPHERTEXT_3_HANDLES_VALIDITY_CONTEXT_ACCOUNT_SIZE = 33 + 352;

function createVerifyProofInstruction(
    discriminator: number,
    proofData: Uint8Array,
    contextState?: Address,
    contextStateAuthority?: Address,
): TransactionInstruction {
    const data = Buffer.concat([Buffer.from([discriminator]), Buffer.from(proofData)]);
    const keys =
        contextState && contextStateAuthority
            ? [
                  { pubkey: contextState, isSigner: false, isWritable: true },
                  { pubkey: contextStateAuthority, isSigner: false, isWritable: false },
              ]
            : [];
    return new TransactionInstruction({ programId: ZK_ELGAMAL_PROOF_PROGRAM_ID, keys, data });
}

async function createContextStateProof(
    connection: Connection,
    payer: Signer,
    proofData: Uint8Array,
    discriminator: number,
    space: number,
): Promise<{ record: Address; transactions: Transaction[]; signers: (Keypair | null)[] }> {
    // Large proofs (e.g. BatchedRangeProofU128) exceed the 1232-byte legacy tx limit when
    // create-account and verify-proof share a transaction. Split them: verify only needs the
    // context account to already exist.
    const signer = await Keypair.generate();
    const lamports = await connection.getMinimumBalanceForRentExemption(space);
    const authority = new Address(payer.address);
    return {
        record: signer.publicKey,
        transactions: [
            new Transaction().add(
                SystemProgram.createAccount({
                    fromPubkey: authority,
                    newAccountPubkey: signer.publicKey,
                    lamports,
                    space,
                    programId: ZK_ELGAMAL_PROOF_PROGRAM_ID,
                }),
            ),
            new Transaction().add(createVerifyProofInstruction(discriminator, proofData, signer.publicKey, authority)),
        ],
        signers: [signer, null],
    };
}

export type ConfidentialTransferFeeMintSetup = {
    mint: Address;
    mintKeypair: Keypair;
    mintAuthority: Keypair;
    transferFeeAuthority: Keypair;
    withdrawWithheldAuthority: Keypair;
    confidentialTransferFeeAuthority: Keypair;
    elgamalPubkey: Address;
    withdrawWithheldElGamalKeypair: ElGamalKeypair;
};

export type ConfidentialTransferMintSetup = {
    mint: Address;
    mintKeypair: Keypair;
    mintAuthority: Keypair;
    confidentialTransferAuthority: Keypair;
    autoApproveNewAccounts: boolean;
    auditorElgamalPubkey: Address | null;
};

export async function createConfidentialTransferMint(
    connection: Connection,
    payer: Signer,
    {
        decimals = 2,
        autoApproveNewAccounts = true,
        auditorElgamalPubkey = null,
    }: {
        decimals?: number;
        autoApproveNewAccounts?: boolean;
        auditorElgamalPubkey?: Address | null;
    } = {},
): Promise<ConfidentialTransferMintSetup> {
    const mintKeypair = await Keypair.generate();
    const mint = mintKeypair.publicKey;
    const mintAuthority = await Keypair.generate();
    const confidentialTransferAuthority = await Keypair.generate();
    const mintLen = getMintLen([ExtensionType.ConfidentialTransferMint]);
    const mintLamports = await connection.getMinimumBalanceForRentExemption(mintLen);

    const transaction = new Transaction().add(
        SystemProgram.createAccount({
            fromPubkey: new Address(payer.address),
            newAccountPubkey: mint,
            space: mintLen,
            lamports: mintLamports,
            programId: TEST_PROGRAM_ID,
        }),
        createInitializeConfidentialTransferMintInstruction(
            mint,
            confidentialTransferAuthority.publicKey,
            autoApproveNewAccounts,
            auditorElgamalPubkey,
            TEST_PROGRAM_ID,
        ),
        createInitializeMintInstruction(mint, decimals, mintAuthority.publicKey, null, TEST_PROGRAM_ID),
    );
    await sendAndConfirmTransaction(connection, transaction, [payer, mintKeypair], undefined);

    return {
        mint,
        mintKeypair,
        mintAuthority,
        confidentialTransferAuthority,
        autoApproveNewAccounts,
        auditorElgamalPubkey,
    };
}

export async function createConfidentialTransferFeeMint(
    connection: Connection,
    payer: Signer,
    {
        decimals = 2,
        feeBasisPoints = 100,
        maxFee = 100_000n,
        withdrawWithheldElGamalKeypair = new ElGamalKeypair(),
        elgamalPubkey = new Address(withdrawWithheldElGamalKeypair.pubkey().toBytes()),
    }: {
        decimals?: number;
        feeBasisPoints?: number;
        maxFee?: bigint;
        withdrawWithheldElGamalKeypair?: ElGamalKeypair;
        elgamalPubkey?: Address;
    } = {},
): Promise<ConfidentialTransferFeeMintSetup> {
    const mintKeypair = await Keypair.generate();
    const mint = mintKeypair.publicKey;
    const mintAuthority = await Keypair.generate();
    const transferFeeAuthority = await Keypair.generate();
    const withdrawWithheldAuthority = await Keypair.generate();
    const confidentialTransferFeeAuthority = await Keypair.generate();
    const mintLen = getMintLen([
        ExtensionType.TransferFeeConfig,
        ExtensionType.ConfidentialTransferMint,
        ExtensionType.ConfidentialTransferFee,
    ]);
    const mintLamports = await connection.getMinimumBalanceForRentExemption(mintLen);

    const transaction = new Transaction().add(
        SystemProgram.createAccount({
            fromPubkey: new Address(payer.address),
            newAccountPubkey: mint,
            space: mintLen,
            lamports: mintLamports,
            programId: TEST_PROGRAM_ID,
        }),
        createInitializeTransferFeeConfigInstruction(
            mint,
            transferFeeAuthority.publicKey,
            withdrawWithheldAuthority.publicKey,
            feeBasisPoints,
            maxFee,
            TEST_PROGRAM_ID,
        ),
        createInitializeConfidentialTransferMintInstruction(mint, mintAuthority.publicKey, true, null, TEST_PROGRAM_ID),
        createInitializeConfidentialTransferFeeConfigInstruction(
            mint,
            confidentialTransferFeeAuthority.publicKey,
            elgamalPubkey,
            TEST_PROGRAM_ID,
        ),
        createInitializeMintInstruction(mint, decimals, mintAuthority.publicKey, null, TEST_PROGRAM_ID),
    );
    await sendAndConfirmTransaction(connection, transaction, [payer, mintKeypair], undefined);

    return {
        mint,
        mintKeypair,
        mintAuthority,
        transferFeeAuthority,
        withdrawWithheldAuthority,
        confidentialTransferFeeAuthority,
        elgamalPubkey,
        withdrawWithheldElGamalKeypair,
    };
}

export type ConfidentialMintBurnMintSetup = {
    mint: Address;
    mintKeypair: Keypair;
    mintAuthority: Keypair;
    supplyElGamalPubkey: Address;
    supplyElGamalKeypair: ElGamalKeypair;
    aesKey: AeKey;
    decryptableSupply: Uint8Array;
};

export async function createConfidentialMintBurnMint(
    connection: Connection,
    payer: Signer,
    {
        decimals = 2,
        supplyElGamalKeypair = new ElGamalKeypair(),
        supplyElGamalPubkey = new Address(supplyElGamalKeypair.pubkey().toBytes()),
        aesKey = new AeKey(),
        decryptableSupply = aesKey.encrypt(0n).toBytes(),
    }: {
        decimals?: number;
        supplyElGamalKeypair?: ElGamalKeypair;
        supplyElGamalPubkey?: Address;
        aesKey?: AeKey;
        decryptableSupply?: Uint8Array;
    } = {},
): Promise<ConfidentialMintBurnMintSetup> {
    const mintKeypair = await Keypair.generate();
    const mint = mintKeypair.publicKey;
    const mintAuthority = await Keypair.generate();
    const mintLen = getMintLen([ExtensionType.ConfidentialTransferMint, ExtensionType.ConfidentialMintBurn]);
    const mintLamports = await connection.getMinimumBalanceForRentExemption(mintLen);

    const transaction = new Transaction().add(
        SystemProgram.createAccount({
            fromPubkey: new Address(payer.address),
            newAccountPubkey: mint,
            space: mintLen,
            lamports: mintLamports,
            programId: TEST_PROGRAM_ID,
        }),
        createInitializeConfidentialTransferMintInstruction(mint, mintAuthority.publicKey, true, null, TEST_PROGRAM_ID),
        createInitializeConfidentialMintBurnInstruction(mint, supplyElGamalPubkey, decryptableSupply, TEST_PROGRAM_ID),
        createInitializeMintInstruction(mint, decimals, mintAuthority.publicKey, null, TEST_PROGRAM_ID),
    );
    await sendAndConfirmTransaction(connection, transaction, [payer, mintKeypair], undefined);

    return { mint, mintKeypair, mintAuthority, supplyElGamalPubkey, supplyElGamalKeypair, aesKey, decryptableSupply };
}

export async function createTokenAccount(
    connection: Connection,
    payer: Signer,
    mint: Address,
    owner: Address,
    extensions: ExtensionType[] = [],
    programId = TEST_PROGRAM_ID,
): Promise<{ tokenAccount: Address; tokenAccountKeypair: Keypair }> {
    const tokenAccountKeypair = await Keypair.generate();
    const tokenAccount = tokenAccountKeypair.publicKey;
    const accountLen = getAccountLen(extensions);
    const accountLamports = await connection.getMinimumBalanceForRentExemption(accountLen);

    const transaction = new Transaction().add(
        SystemProgram.createAccount({
            fromPubkey: new Address(payer.address),
            newAccountPubkey: tokenAccount,
            space: accountLen,
            lamports: accountLamports,
            programId,
        }),
        createInitializeAccountInstruction(tokenAccount, mint, owner, programId),
    );
    await sendAndConfirmTransaction(connection, transaction, [payer, tokenAccountKeypair], undefined);

    return { tokenAccount, tokenAccountKeypair };
}

export async function createConfidentialFeeTokenAccount(
    connection: Connection,
    payer: Signer,
    mint: Address,
    owner: Address,
): Promise<{ tokenAccount: Address; tokenAccountKeypair: Keypair }> {
    return await createTokenAccount(
        connection,
        payer,
        mint,
        owner,
        [ExtensionType.ConfidentialTransferAccount, ExtensionType.ConfidentialTransferFeeAmount],
        TEST_PROGRAM_ID,
    );
}

export async function createConfidentialTransferTokenAccount(
    connection: Connection,
    payer: Signer,
    mint: Address,
    owner: Address,
): Promise<{ tokenAccount: Address; tokenAccountKeypair: Keypair }> {
    return await createTokenAccount(
        connection,
        payer,
        mint,
        owner,
        [ExtensionType.ConfidentialTransferAccount],
        TEST_PROGRAM_ID,
    );
}

export async function createConfiguredConfidentialTransferTokenAccount(
    connection: Connection,
    payer: Signer,
    mint: Address,
    owner: Keypair,
    { includeTransferFeeAmount = false }: { includeTransferFeeAmount?: boolean } = {},
): Promise<{ tokenAccount: Address; elgamalKeypair: ElGamalKeypair; aesKey: AeKey }> {
    const payerSigner = await toKitSigner(payer);
    const ownerSigner = await toKitSigner(owner);
    const elgamalKeypair = new ElGamalKeypair();
    const aesKey = new AeKey();
    const tokenAccount = await getAssociatedTokenAddress(mint, owner.publicKey, false, TEST_PROGRAM_ID);
    const programAddress = TEST_PROGRAM_ID.toBase58() as KitAddress;
    const mintAddress = mint.toBase58() as KitAddress;
    const tokenAddress = tokenAccount.toBase58() as KitAddress;

    if (!includeTransferFeeAmount) {
        const plan = await getCreateConfidentialTransferAccountInstructionPlan({
            payer: payerSigner,
            owner: ownerSigner,
            mint: mintAddress,
            rpc: createSolanaRpc(connection.rpcEndpoint),
            elgamalKeypair,
            aesKey,
            programAddress,
        });
        await sendAndConfirmTransaction(connection, kitInstructionPlanToTransaction(plan), [payer, owner], undefined);
    } else {
        // Fee mints require ConfidentialTransferFeeAmount before ConfigureAccount.
        const pubkeyValidityProofData = new PubkeyValidityProofData(elgamalKeypair);
        const plan = nonDivisibleSequentialInstructionPlan([
            getCreateAssociatedTokenIdempotentInstruction({
                ata: tokenAddress,
                mint: mintAddress,
                owner: owner.publicKey.toBase58() as KitAddress,
                payer: payerSigner,
                tokenProgram: programAddress,
            }),
            getReallocateInstruction(
                {
                    token: tokenAddress,
                    payer: payerSigner,
                    owner: ownerSigner,
                    newExtensionTypes: [
                        KitExtensionType.ConfidentialTransferAccount,
                        KitExtensionType.ConfidentialTransferFeeAmount,
                    ],
                },
                { programAddress },
            ),
            getConfigureConfidentialTransferAccountInstruction(
                {
                    token: tokenAddress,
                    mint: mintAddress,
                    authority: ownerSigner,
                    decryptableZeroBalance: aesKey.encrypt(0n).toBytes(),
                    maximumPendingBalanceCreditCounter: 1n << 16n,
                    proofInstructionOffset: 1,
                },
                { programAddress },
            ),
        ]);
        const transaction = kitInstructionPlanToTransaction(plan).add(
            createVerifyProofInstruction(PUBKEY_VALIDITY_PROOF, pubkeyValidityProofData.toBytes()),
        );
        await sendAndConfirmTransaction(connection, transaction, [payer, owner], undefined);
    }

    await getAccount(connection, tokenAccount, undefined, TEST_PROGRAM_ID);
    return { tokenAccount, elgamalKeypair, aesKey };
}

export async function createCiphertextCiphertextEqualityProofInstruction(
    connection: Connection,
    payer: Signer,
    firstKeypair: ElGamalKeypair,
    secondPubkey: ElGamalPubkey,
    firstCiphertext: Uint8Array,
    amount = 0n,
): Promise<{ instruction: TransactionInstruction; secondCiphertext: Uint8Array }> {
    const opening = new PedersenOpening();
    const secondCiphertext = secondPubkey.encryptWith(amount, opening);
    const proofData = new CiphertextCiphertextEqualityProofData(
        firstKeypair,
        secondPubkey,
        ElGamalCiphertext.fromBytes(firstCiphertext)!,
        secondCiphertext,
        opening,
        amount,
    );
    return {
        instruction: createVerifyProofInstruction(CIPHERTEXT_CIPHERTEXT_EQUALITY_PROOF, proofData.toBytes()),
        secondCiphertext: secondCiphertext.toBytes(),
    };
}

export function createPubkeyValidityProofInstruction(elgamalKeypair: ElGamalKeypair): TransactionInstruction {
    return createVerifyProofInstruction(PUBKEY_VALIDITY_PROOF, new PubkeyValidityProofData(elgamalKeypair).toBytes());
}

export async function createConfidentialMintProofFixture(
    connection: Connection,
    payer: Signer,
    currentSupplyCiphertext: Uint8Array,
    supplyElGamalKeypair: ElGamalKeypair,
    destinationElGamalPubkey: ElGamalPubkey,
    mintAmount = 0n,
    currentSupply = 0n,
): Promise<{
    equalityRecord: Address;
    ciphertextValidityRecord: Address;
    rangeRecord: Address;
    mintAmountAuditorCiphertextLo: Uint8Array;
    mintAmountAuditorCiphertextHi: Uint8Array;
    signers: (Keypair | null)[];
    transactions: Transaction[];
}> {
    const mintAmountLo = mintAmount & ((1n << 16n) - 1n);
    const mintAmountHi = mintAmount >> 16n;
    const supplyPubkey = supplyElGamalKeypair.pubkey();
    const auditorPubkey = ElGamalPubkey.fromBytes(new Uint8Array(32));
    const openingLo = new PedersenOpening();
    const openingHi = new PedersenOpening();
    const groupedCiphertextLo = GroupedElGamalCiphertext3Handles.encryptWith(
        destinationElGamalPubkey,
        supplyPubkey,
        auditorPubkey,
        mintAmountLo,
        openingLo,
    );
    const groupedCiphertextHi = GroupedElGamalCiphertext3Handles.encryptWith(
        destinationElGamalPubkey,
        supplyPubkey,
        auditorPubkey,
        mintAmountHi,
        openingHi,
    );
    const groupedCiphertextLoBytes = groupedCiphertextLo.toBytes();
    const groupedCiphertextHiBytes = groupedCiphertextHi.toBytes();
    const newSupply = currentSupply + mintAmount;
    const newSupplyCiphertext = addWithLoHiCiphertexts(
        currentSupplyCiphertext,
        extractCiphertextFromGroupedBytes(groupedCiphertextLoBytes, 1),
        extractCiphertextFromGroupedBytes(groupedCiphertextHiBytes, 1),
        16n,
    );
    const newSupplyOpening = new PedersenOpening();
    const newSupplyCommitment = PedersenCommitment.from(newSupply, newSupplyOpening);
    const equalityProofData = new CiphertextCommitmentEqualityProofData(
        supplyElGamalKeypair,
        ElGamalCiphertext.fromBytes(newSupplyCiphertext)!,
        newSupplyCommitment,
        newSupplyOpening,
        newSupply,
    );
    const ciphertextValidityProofData = new BatchedGroupedCiphertext3HandlesValidityProofData(
        destinationElGamalPubkey,
        supplyPubkey,
        auditorPubkey,
        groupedCiphertextLo,
        groupedCiphertextHi,
        mintAmountLo,
        mintAmountHi,
        openingLo,
        openingHi,
    );
    const paddingOpening = new PedersenOpening();
    const paddingCommitment = PedersenCommitment.from(0n, paddingOpening);
    const rangeProofData = new BatchedRangeProofU128Data(
        [
            newSupplyCommitment,
            PedersenCommitment.fromBytes(groupedCiphertextLoBytes.slice(0, 32)),
            PedersenCommitment.fromBytes(groupedCiphertextHiBytes.slice(0, 32)),
            paddingCommitment,
        ],
        new BigUint64Array([newSupply, mintAmountLo, mintAmountHi, 0n]),
        Uint8Array.from([64, 16, 32, 16]),
        [newSupplyOpening, openingLo, openingHi, paddingOpening],
    );
    const [equality, ciphertextValidity, range] = await Promise.all([
        createContextStateProof(
            connection,
            payer,
            equalityProofData.toBytes(),
            CIPHERTEXT_COMMITMENT_EQUALITY_PROOF,
            CIPHERTEXT_COMMITMENT_EQUALITY_CONTEXT_ACCOUNT_SIZE,
        ),
        createContextStateProof(
            connection,
            payer,
            ciphertextValidityProofData.toBytes(),
            BATCHED_GROUPED_CIPHERTEXT_3_HANDLES_VALIDITY_PROOF,
            BATCHED_GROUPED_CIPHERTEXT_3_HANDLES_VALIDITY_CONTEXT_ACCOUNT_SIZE,
        ),
        createContextStateProof(
            connection,
            payer,
            rangeProofData.toBytes(),
            BATCHED_RANGE_PROOF_U128,
            BATCHED_RANGE_PROOF_CONTEXT_ACCOUNT_SIZE,
        ),
    ]);

    return {
        equalityRecord: equality.record,
        ciphertextValidityRecord: ciphertextValidity.record,
        rangeRecord: range.record,
        mintAmountAuditorCiphertextLo: extractCiphertextFromGroupedBytes(groupedCiphertextLoBytes, 2),
        mintAmountAuditorCiphertextHi: extractCiphertextFromGroupedBytes(groupedCiphertextHiBytes, 2),
        signers: [...equality.signers, ...ciphertextValidity.signers, ...range.signers],
        transactions: [...equality.transactions, ...ciphertextValidity.transactions, ...range.transactions],
    };
}

export async function createConfidentialBurnProofFixture(
    connection: Connection,
    payer: Signer,
    currentAvailableBalanceCiphertext: Uint8Array,
    sourceElGamalKeypair: ElGamalKeypair,
    supplyElGamalPubkey: ElGamalPubkey,
    burnAmount = 0n,
    currentAvailableBalance = 0n,
): Promise<{
    equalityRecord: Address;
    ciphertextValidityRecord: Address;
    rangeRecord: Address;
    burnAmountAuditorCiphertextLo: Uint8Array;
    burnAmountAuditorCiphertextHi: Uint8Array;
    signers: (Keypair | null)[];
    transactions: Transaction[];
}> {
    const burnAmountLo = burnAmount & ((1n << 16n) - 1n);
    const burnAmountHi = burnAmount >> 16n;
    const sourcePubkey = sourceElGamalKeypair.pubkey();
    const auditorPubkey = ElGamalPubkey.fromBytes(new Uint8Array(32));
    const openingLo = new PedersenOpening();
    const openingHi = new PedersenOpening();
    const groupedCiphertextLo = GroupedElGamalCiphertext3Handles.encryptWith(
        sourcePubkey,
        supplyElGamalPubkey,
        auditorPubkey,
        burnAmountLo,
        openingLo,
    );
    const groupedCiphertextHi = GroupedElGamalCiphertext3Handles.encryptWith(
        sourcePubkey,
        supplyElGamalPubkey,
        auditorPubkey,
        burnAmountHi,
        openingHi,
    );
    const groupedCiphertextLoBytes = groupedCiphertextLo.toBytes();
    const groupedCiphertextHiBytes = groupedCiphertextHi.toBytes();
    const remainingBalance = currentAvailableBalance - burnAmount;
    const newAvailableBalanceCiphertext = subtractWithLoHiCiphertexts(
        currentAvailableBalanceCiphertext,
        extractCiphertextFromGroupedBytes(groupedCiphertextLoBytes, 0),
        extractCiphertextFromGroupedBytes(groupedCiphertextHiBytes, 0),
        16n,
    );
    const newAvailableBalanceOpening = new PedersenOpening();
    const newAvailableBalanceCommitment = PedersenCommitment.from(remainingBalance, newAvailableBalanceOpening);
    const equalityProofData = new CiphertextCommitmentEqualityProofData(
        sourceElGamalKeypair,
        ElGamalCiphertext.fromBytes(newAvailableBalanceCiphertext)!,
        newAvailableBalanceCommitment,
        newAvailableBalanceOpening,
        remainingBalance,
    );
    const ciphertextValidityProofData = new BatchedGroupedCiphertext3HandlesValidityProofData(
        sourcePubkey,
        supplyElGamalPubkey,
        auditorPubkey,
        groupedCiphertextLo,
        groupedCiphertextHi,
        burnAmountLo,
        burnAmountHi,
        openingLo,
        openingHi,
    );
    const paddingOpening = new PedersenOpening();
    const paddingCommitment = PedersenCommitment.from(0n, paddingOpening);
    const rangeProofData = new BatchedRangeProofU128Data(
        [
            newAvailableBalanceCommitment,
            PedersenCommitment.fromBytes(groupedCiphertextLoBytes.slice(0, 32)),
            PedersenCommitment.fromBytes(groupedCiphertextHiBytes.slice(0, 32)),
            paddingCommitment,
        ],
        new BigUint64Array([remainingBalance, burnAmountLo, burnAmountHi, 0n]),
        Uint8Array.from([64, 16, 32, 16]),
        [newAvailableBalanceOpening, openingLo, openingHi, paddingOpening],
    );
    const [equality, ciphertextValidity, range] = await Promise.all([
        createContextStateProof(
            connection,
            payer,
            equalityProofData.toBytes(),
            CIPHERTEXT_COMMITMENT_EQUALITY_PROOF,
            CIPHERTEXT_COMMITMENT_EQUALITY_CONTEXT_ACCOUNT_SIZE,
        ),
        createContextStateProof(
            connection,
            payer,
            ciphertextValidityProofData.toBytes(),
            BATCHED_GROUPED_CIPHERTEXT_3_HANDLES_VALIDITY_PROOF,
            BATCHED_GROUPED_CIPHERTEXT_3_HANDLES_VALIDITY_CONTEXT_ACCOUNT_SIZE,
        ),
        createContextStateProof(
            connection,
            payer,
            rangeProofData.toBytes(),
            BATCHED_RANGE_PROOF_U128,
            BATCHED_RANGE_PROOF_CONTEXT_ACCOUNT_SIZE,
        ),
    ]);

    return {
        equalityRecord: equality.record,
        ciphertextValidityRecord: ciphertextValidity.record,
        rangeRecord: range.record,
        burnAmountAuditorCiphertextLo: extractCiphertextFromGroupedBytes(groupedCiphertextLoBytes, 2),
        burnAmountAuditorCiphertextHi: extractCiphertextFromGroupedBytes(groupedCiphertextHiBytes, 2),
        signers: [...equality.signers, ...ciphertextValidity.signers, ...range.signers],
        transactions: [...equality.transactions, ...ciphertextValidity.transactions, ...range.transactions],
    };
}
