import type {
    AccountMeta,
    Address as KitAddress,
    Instruction,
    InstructionPlan,
    TransactionMessage,
    TransactionSigner,
} from '@solana/kit';
import {
    AccountRole,
    address,
    appendTransactionMessageInstructions,
    createSolanaRpc,
    generateKeyPairSigner,
    getBase64EncodedWireTransaction,
    getTransactionSize,
    setTransactionMessageFeePayerSigner,
    setTransactionMessageLifetimeUsingBlockhash,
    signTransactionMessageWithSigners,
    parallelInstructionPlan,
    nonDivisibleSequentialInstructionPlan,
    sequentialInstructionPlan,
} from '@solana/kit';
import {
    closeContextStateProof,
    verifyBatchedGroupedCiphertext2HandlesValidity,
    verifyBatchedGroupedCiphertext3HandlesValidity,
    verifyBatchedRangeProofU128,
    verifyBatchedRangeProofU256,
    verifyCiphertextCommitmentEquality,
    verifyPercentageWithCap,
} from '@solana-program/zk-elgamal-proof';
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
    BatchedGroupedCiphertext2HandlesValidityProofData,
    BatchedGroupedCiphertext3HandlesValidityProofData,
    BatchedRangeProofU128Data,
    BatchedRangeProofU256Data,
    CiphertextCiphertextEqualityProofData,
    CiphertextCommitmentEqualityProofData,
    ElGamalCiphertext,
    ElGamalKeypair,
    ElGamalPubkey,
    GroupedElGamalCiphertext2Handles,
    GroupedElGamalCiphertext3Handles,
    PedersenCommitment,
    PedersenOpening,
    PercentageWithCapProofData,
    PubkeyValidityProofData,
    ZeroCiphertextProofData,
} from '@solana/zk-sdk/bundler';
import type { Connection, TransactionInstruction } from '@solana/web3.js';
import {
    Address,
    Keypair,
    SystemProgram,
    Transaction,
    ZkElGamalProofProgram,
    sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
    ExtensionType,
    createInitializeMintInstruction,
    getAccount,
    getAssociatedTokenAddress,
    getMintLen,
} from '../../src';
import { createInitializeConfidentialMintBurnInstruction } from '../../src/extensions/confidentialMintBurn/index';
import { createInitializeConfidentialTransferMintInstruction } from '../../src/extensions/confidentialTransfer/index';
import { createInitializeConfidentialTransferFeeConfigInstruction } from '../../src/extensions/confidentialTransferFee/index';
import { createInitializeTransferFeeConfigInstruction } from '../../src/extensions/transferFee/index';
import { TEST_PROGRAM_ID, createTokenAccount } from '../common';

function convertLegacyInstruction(
    legacyInstruction: TransactionInstruction,
    signerByAddress: Map<string, TransactionSigner>,
): Instruction {
    return {
        programAddress: address(legacyInstruction.programId.toBase58()),
        accounts: legacyInstruction.keys.map(key => {
            const role = key.isWritable
                ? key.isSigner
                    ? AccountRole.WRITABLE_SIGNER
                    : AccountRole.WRITABLE
                : key.isSigner
                  ? AccountRole.READONLY_SIGNER
                  : AccountRole.READONLY;
            const signer = key.isSigner ? signerByAddress.get(key.pubkey.toBase58()) : undefined;
            if (key.isSigner && !signer) {
                throw new Error(`Missing signer for ${key.pubkey.toBase58()}`);
            }
            return {
                address: address(key.pubkey.toBase58()),
                role,
                ...(signer ? { signer } : {}),
            } as AccountMeta;
        }),
        data: new Uint8Array(legacyInstruction.data),
    };
}

const { Point: RistrettoPoint } = ristretto255;

function extractCiphertextFromGroupedBytes(groupedCiphertext: Uint8Array, handleIndex: number): Uint8Array {
    const ciphertext = new Uint8Array(64);
    ciphertext.set(groupedCiphertext.slice(0, 32), 0);
    ciphertext.set(groupedCiphertext.slice(32 + handleIndex * 32, 64 + handleIndex * 32), 32);
    return ciphertext;
}

function subtractWithLoHiCiphertexts(
    left: Uint8Array,
    ciphertextLo: Uint8Array,
    ciphertextHi: Uint8Array,
    bitLength: bigint,
): Uint8Array {
    const leftCommitment = RistrettoPoint.fromHex(left.slice(0, 32));
    const leftHandle = RistrettoPoint.fromHex(left.slice(32, 64));
    const loCommitment = RistrettoPoint.fromHex(ciphertextLo.slice(0, 32));
    const loHandle = RistrettoPoint.fromHex(ciphertextLo.slice(32, 64));
    const hiCommitment = RistrettoPoint.fromHex(ciphertextHi.slice(0, 32));
    const hiHandle = RistrettoPoint.fromHex(ciphertextHi.slice(32, 64));
    const scale = 1n << bitLength;
    const out = new Uint8Array(64);
    out.set(leftCommitment.subtract(loCommitment.add(hiCommitment.multiply(scale))).toRawBytes(), 0);
    out.set(leftHandle.subtract(loHandle.add(hiHandle.multiply(scale))).toRawBytes(), 32);
    return out;
}

function addWithLoHiCiphertexts(left: Uint8Array, lo: Uint8Array, hi: Uint8Array, bitLength: bigint) {
    const leftCommitment = RistrettoPoint.fromHex(left.slice(0, 32));
    const leftHandle = RistrettoPoint.fromHex(left.slice(32, 64));
    const loCommitment = RistrettoPoint.fromHex(lo.slice(0, 32));
    const loHandle = RistrettoPoint.fromHex(lo.slice(32, 64));
    const hiCommitment = RistrettoPoint.fromHex(hi.slice(0, 32));
    const hiHandle = RistrettoPoint.fromHex(hi.slice(32, 64));
    const scale = 1n << bitLength;
    const out = new Uint8Array(64);
    out.set(leftCommitment.add(loCommitment.add(hiCommitment.multiply(scale))).toRawBytes(), 0);
    out.set(leftHandle.add(loHandle.add(hiHandle.multiply(scale))).toRawBytes(), 32);
    return out;
}

type ProofVerifier = (args: {
    rpc: ReturnType<typeof createSolanaRpc>;
    payer: TransactionSigner;
    proofData: Uint8Array;
    contextState: {
        contextAccount: Awaited<ReturnType<typeof generateKeyPairSigner>>;
        authority: TransactionSigner['address'];
    };
}) => Promise<Instruction[]>;

async function createContextProofPlan(
    rpc: ReturnType<typeof createSolanaRpc>,
    payer: TransactionSigner,
    proofData: Uint8Array,
    verify: ProofVerifier,
) {
    const contextAccount = await generateKeyPairSigner();
    const setupInstructions = await verify({
        rpc,
        payer,
        proofData,
        contextState: { contextAccount, authority: payer.address },
    });
    return {
        address: contextAccount.address,
        setup: sequentialInstructionPlan(setupInstructions),
        cleanup: closeContextStateProof({
            contextState: contextAccount.address,
            authority: payer,
            destination: payer.address,
        }),
    };
}

export async function createConfidentialTransferWithFeeProofPlan({
    rpc,
    payer,
    currentAvailableBalance,
    sourceElgamalKeypair,
    sourceAesKey,
    destinationElgamalPubkey,
    withdrawWithheldElgamalPubkey,
    programAddress,
    transferAmount = 0n,
    currentAvailableBalanceAmount = 0n,
    feeBasisPoints = 100n,
    maximumFee = 100_000n,
}: {
    rpc: ReturnType<typeof createSolanaRpc>;
    payer: TransactionSigner;
    currentAvailableBalance: Uint8Array;
    sourceElgamalKeypair: ElGamalKeypair;
    sourceAesKey: AeKey;
    destinationElgamalPubkey: ElGamalPubkey;
    withdrawWithheldElgamalPubkey: ElGamalPubkey;
    programAddress: string;
    transferAmount?: bigint;
    currentAvailableBalanceAmount?: bigint;
    feeBasisPoints?: bigint;
    maximumFee?: bigint;
}): Promise<{
    plan: InstructionPlan;
    proofAccounts: {
        equalityRecord: string;
        transferAmountCiphertextValidityRecord: string;
        feeSigmaRecord: string;
        feeCiphertextValidityRecord: string;
        rangeRecord: string;
    };
    newSourceDecryptableAvailableBalance: Uint8Array;
    transferAmountAuditorCiphertextLo: Uint8Array;
    transferAmountAuditorCiphertextHi: Uint8Array;
}> {
    const transferAmountLo = transferAmount & ((1n << 16n) - 1n);
    const transferAmountHi = transferAmount >> 16n;
    const sourcePubkey = sourceElgamalKeypair.pubkey();
    const auditorPubkey = ElGamalPubkey.fromBytes(new Uint8Array(32));
    const transferOpeningLo = new PedersenOpening();
    const transferOpeningHi = new PedersenOpening();
    const transferCiphertextLo = GroupedElGamalCiphertext3Handles.encryptWith(
        sourcePubkey,
        destinationElgamalPubkey,
        auditorPubkey,
        transferAmountLo,
        transferOpeningLo,
    );
    const transferCiphertextHi = GroupedElGamalCiphertext3Handles.encryptWith(
        sourcePubkey,
        destinationElgamalPubkey,
        auditorPubkey,
        transferAmountHi,
        transferOpeningHi,
    );
    const transferCiphertextLoBytes = transferCiphertextLo.toBytes();
    const transferCiphertextHiBytes = transferCiphertextHi.toBytes();
    const newAvailableBalance = currentAvailableBalanceAmount - transferAmount;
    const newAvailableBalanceOpening = new PedersenOpening();
    const newAvailableBalanceCommitment = PedersenCommitment.from(newAvailableBalance, newAvailableBalanceOpening);
    const newAvailableBalanceCiphertext = ElGamalCiphertext.fromBytes(
        subtractWithLoHiCiphertexts(
            currentAvailableBalance,
            extractCiphertextFromGroupedBytes(transferCiphertextLoBytes, 0),
            extractCiphertextFromGroupedBytes(transferCiphertextHiBytes, 0),
            16n,
        ),
    )!;
    const equalityProof = new CiphertextCommitmentEqualityProofData(
        sourceElgamalKeypair,
        newAvailableBalanceCiphertext,
        newAvailableBalanceCommitment,
        newAvailableBalanceOpening,
        newAvailableBalance,
    );
    const transferValidityProof = new BatchedGroupedCiphertext3HandlesValidityProofData(
        sourcePubkey,
        destinationElgamalPubkey,
        auditorPubkey,
        transferCiphertextLo,
        transferCiphertextHi,
        transferAmountLo,
        transferAmountHi,
        transferOpeningLo,
        transferOpeningHi,
    );

    const numerator = transferAmount * feeBasisPoints;
    const rawFee = (numerator + 9_999n) / 10_000n;
    const rawDelta = rawFee * 10_000n - numerator;
    const feeAmount = rawFee > maximumFee ? maximumFee : rawFee;
    const claimedDelta = rawFee > maximumFee ? 0n : rawDelta;
    const netTransferAmount = transferAmount - feeAmount;
    const feeAmountLo = feeAmount & ((1n << 16n) - 1n);
    const feeAmountHi = feeAmount >> 16n;
    const feeOpeningLo = new PedersenOpening();
    const feeOpeningHi = new PedersenOpening();
    const feeCiphertextLo = GroupedElGamalCiphertext2Handles.encryptWith(
        destinationElgamalPubkey,
        withdrawWithheldElgamalPubkey,
        feeAmountLo,
        feeOpeningLo,
    );
    const feeCiphertextHi = GroupedElGamalCiphertext2Handles.encryptWith(
        destinationElgamalPubkey,
        withdrawWithheldElgamalPubkey,
        feeAmountHi,
        feeOpeningHi,
    );
    const combinedTransferCommitment = PedersenCommitment.combineLoHi(
        PedersenCommitment.fromBytes(transferCiphertextLoBytes.slice(0, 32)),
        PedersenCommitment.fromBytes(transferCiphertextHiBytes.slice(0, 32)),
        16,
    );
    const combinedTransferOpening = PedersenOpening.combineLoHi(transferOpeningLo, transferOpeningHi, 16);
    const feeCiphertextLoBytes = feeCiphertextLo.toBytes();
    const feeCiphertextHiBytes = feeCiphertextHi.toBytes();
    const combinedFeeCommitment = PedersenCommitment.combineLoHi(
        PedersenCommitment.fromBytes(feeCiphertextLoBytes.slice(0, 32)),
        PedersenCommitment.fromBytes(feeCiphertextHiBytes.slice(0, 32)),
        16,
    );
    const combinedFeeOpening = PedersenOpening.combineLoHi(feeOpeningLo, feeOpeningHi, 16);
    const netTransferCommitment = combinedTransferCommitment.subtract(combinedFeeCommitment);
    const netTransferOpening = combinedTransferOpening.subtract(combinedFeeOpening);
    const claimedOpening = new PedersenOpening();
    const claimedCommitment = PedersenCommitment.from(claimedDelta, claimedOpening);
    const deltaCommitment = combinedFeeCommitment
        .multiplyByU64(10_000n)
        .subtract(combinedTransferCommitment.multiplyByU64(feeBasisPoints));
    const deltaOpening = combinedFeeOpening
        .multiplyByU64(10_000n)
        .subtract(combinedTransferOpening.multiplyByU64(feeBasisPoints));
    const percentageWithCapProof = new PercentageWithCapProofData(
        combinedFeeCommitment,
        combinedFeeOpening,
        feeAmount,
        deltaCommitment,
        deltaOpening,
        claimedDelta,
        claimedCommitment,
        claimedOpening,
        maximumFee,
    );
    const feeValidityProof = new BatchedGroupedCiphertext2HandlesValidityProofData(
        destinationElgamalPubkey,
        withdrawWithheldElgamalPubkey,
        feeCiphertextLo,
        feeCiphertextHi,
        feeAmountLo,
        feeAmountHi,
        feeOpeningLo,
        feeOpeningHi,
    );
    const claimedComplement = 9_999n - claimedDelta;
    const claimedComplementCommitment = PedersenCommitment.from(9_999n, PedersenOpening.zero()).subtract(
        claimedCommitment,
    );
    const claimedComplementOpening = PedersenOpening.zero().subtract(claimedOpening);
    const rangeProof = new BatchedRangeProofU256Data(
        [
            newAvailableBalanceCommitment,
            PedersenCommitment.fromBytes(transferCiphertextLoBytes.slice(0, 32)),
            PedersenCommitment.fromBytes(transferCiphertextHiBytes.slice(0, 32)),
            claimedCommitment,
            claimedComplementCommitment,
            PedersenCommitment.fromBytes(feeCiphertextLoBytes.slice(0, 32)),
            PedersenCommitment.fromBytes(feeCiphertextHiBytes.slice(0, 32)),
            netTransferCommitment,
        ],
        new BigUint64Array([
            newAvailableBalance,
            transferAmountLo,
            transferAmountHi,
            claimedDelta,
            claimedComplement,
            feeAmountLo,
            feeAmountHi,
            netTransferAmount,
        ]),
        Uint8Array.from([64, 16, 32, 16, 16, 16, 32, 64]),
        [
            newAvailableBalanceOpening,
            transferOpeningLo,
            transferOpeningHi,
            claimedOpening,
            claimedComplementOpening,
            feeOpeningLo,
            feeOpeningHi,
            netTransferOpening,
        ],
    );

    const [equality, transferValidity, feeSigma, feeValidity, range] = await Promise.all([
        createContextProofPlan(rpc, payer, equalityProof.toBytes(), verifyCiphertextCommitmentEquality),
        createContextProofPlan(
            rpc,
            payer,
            transferValidityProof.toBytes(),
            verifyBatchedGroupedCiphertext3HandlesValidity,
        ),
        createContextProofPlan(rpc, payer, percentageWithCapProof.toBytes(), verifyPercentageWithCap),
        createContextProofPlan(rpc, payer, feeValidityProof.toBytes(), verifyBatchedGroupedCiphertext2HandlesValidity),
        createContextProofPlan(rpc, payer, rangeProof.toBytes(), verifyBatchedRangeProofU256),
    ]);
    const plan = sequentialInstructionPlan([
        parallelInstructionPlan([
            equality.setup,
            transferValidity.setup,
            feeSigma.setup,
            feeValidity.setup,
            range.setup,
        ]),
        { programAddress: address(programAddress) },
        parallelInstructionPlan([
            equality.cleanup,
            transferValidity.cleanup,
            feeSigma.cleanup,
            feeValidity.cleanup,
            range.cleanup,
        ]),
    ]);

    return {
        plan,
        proofAccounts: {
            equalityRecord: equality.address,
            transferAmountCiphertextValidityRecord: transferValidity.address,
            feeSigmaRecord: feeSigma.address,
            feeCiphertextValidityRecord: feeValidity.address,
            rangeRecord: range.address,
        },
        newSourceDecryptableAvailableBalance: sourceAesKey.encrypt(newAvailableBalance).toBytes(),
        transferAmountAuditorCiphertextLo: extractCiphertextFromGroupedBytes(transferCiphertextLoBytes, 2),
        transferAmountAuditorCiphertextHi: extractCiphertextFromGroupedBytes(transferCiphertextHiBytes, 2),
    };
}

async function createMintBurnProofPlan({
    rpc,
    payer,
    currentCiphertext,
    sourceElgamalKeypair,
    destinationElgamalPubkey,
    amount,
    currentAmount,
    operation,
    programAddress,
}: {
    rpc: ReturnType<typeof createSolanaRpc>;
    payer: TransactionSigner;
    currentCiphertext: Uint8Array;
    sourceElgamalKeypair: ElGamalKeypair;
    destinationElgamalPubkey: ElGamalPubkey;
    amount: bigint;
    currentAmount: bigint;
    operation: 'mint' | 'burn';
    programAddress: string;
}): Promise<{
    plan: InstructionPlan;
    proofAccounts: { equalityRecord: string; ciphertextValidityRecord: string; rangeRecord: string };
    amountAuditorCiphertextLo: Uint8Array;
    amountAuditorCiphertextHi: Uint8Array;
}> {
    const amountLo = amount & ((1n << 16n) - 1n);
    const amountHi = amount >> 16n;
    const sourcePubkey = sourceElgamalKeypair.pubkey();
    const auditorPubkey = ElGamalPubkey.fromBytes(new Uint8Array(32));
    const openingLo = new PedersenOpening();
    const openingHi = new PedersenOpening();
    const firstPubkey = operation === 'mint' ? destinationElgamalPubkey : sourcePubkey;
    const secondPubkey = operation === 'mint' ? sourcePubkey : destinationElgamalPubkey;
    const groupedLo = GroupedElGamalCiphertext3Handles.encryptWith(
        firstPubkey,
        secondPubkey,
        auditorPubkey,
        amountLo,
        openingLo,
    );
    const groupedHi = GroupedElGamalCiphertext3Handles.encryptWith(
        firstPubkey,
        secondPubkey,
        auditorPubkey,
        amountHi,
        openingHi,
    );
    const groupedLoBytes = groupedLo.toBytes();
    const groupedHiBytes = groupedHi.toBytes();
    const resultAmount = operation === 'mint' ? currentAmount + amount : currentAmount - amount;
    const handleIndex = operation === 'mint' ? 1 : 0;
    const resultCiphertextBytes =
        operation === 'mint'
            ? addWithLoHiCiphertexts(
                  currentCiphertext,
                  extractCiphertextFromGroupedBytes(groupedLoBytes, handleIndex),
                  extractCiphertextFromGroupedBytes(groupedHiBytes, handleIndex),
                  16n,
              )
            : subtractWithLoHiCiphertexts(
                  currentCiphertext,
                  extractCiphertextFromGroupedBytes(groupedLoBytes, handleIndex),
                  extractCiphertextFromGroupedBytes(groupedHiBytes, handleIndex),
                  16n,
              );
    const resultOpening = new PedersenOpening();
    const resultCommitment = PedersenCommitment.from(resultAmount, resultOpening);
    const equalityProof = new CiphertextCommitmentEqualityProofData(
        sourceElgamalKeypair,
        ElGamalCiphertext.fromBytes(resultCiphertextBytes)!,
        resultCommitment,
        resultOpening,
        resultAmount,
    );
    const validityProof = new BatchedGroupedCiphertext3HandlesValidityProofData(
        firstPubkey,
        secondPubkey,
        auditorPubkey,
        groupedLo,
        groupedHi,
        amountLo,
        amountHi,
        openingLo,
        openingHi,
    );
    const paddingOpening = new PedersenOpening();
    const rangeProof = new BatchedRangeProofU128Data(
        [
            resultCommitment,
            PedersenCommitment.fromBytes(groupedLoBytes.slice(0, 32)),
            PedersenCommitment.fromBytes(groupedHiBytes.slice(0, 32)),
            PedersenCommitment.from(0n, paddingOpening),
        ],
        new BigUint64Array([resultAmount, amountLo, amountHi, 0n]),
        Uint8Array.from([64, 16, 32, 16]),
        [resultOpening, openingLo, openingHi, paddingOpening],
    );
    const [equality, validity, range] = await Promise.all([
        createContextProofPlan(rpc, payer, equalityProof.toBytes(), verifyCiphertextCommitmentEquality),
        createContextProofPlan(rpc, payer, validityProof.toBytes(), verifyBatchedGroupedCiphertext3HandlesValidity),
        createContextProofPlan(rpc, payer, rangeProof.toBytes(), verifyBatchedRangeProofU128),
    ]);
    return {
        plan: sequentialInstructionPlan([
            parallelInstructionPlan([equality.setup, validity.setup, range.setup]),
            { programAddress: address(programAddress) },
            parallelInstructionPlan([equality.cleanup, validity.cleanup, range.cleanup]),
        ]),
        proofAccounts: {
            equalityRecord: equality.address,
            ciphertextValidityRecord: validity.address,
            rangeRecord: range.address,
        },
        amountAuditorCiphertextLo: extractCiphertextFromGroupedBytes(groupedLoBytes, 2),
        amountAuditorCiphertextHi: extractCiphertextFromGroupedBytes(groupedHiBytes, 2),
    };
}

export async function createConfidentialMintProofPlan({
    rpc,
    payer,
    currentSupplyCiphertext,
    supplyElgamalKeypair,
    destinationElgamalPubkey,
    mintAmount = 0n,
    currentSupply = 0n,
    programAddress,
}: {
    rpc: ReturnType<typeof createSolanaRpc>;
    payer: TransactionSigner;
    currentSupplyCiphertext: Uint8Array;
    supplyElgamalKeypair: ElGamalKeypair;
    destinationElgamalPubkey: ElGamalPubkey;
    mintAmount?: bigint;
    currentSupply?: bigint;
    programAddress: string;
}): Promise<{
    plan: InstructionPlan;
    proofAccounts: { equalityRecord: string; ciphertextValidityRecord: string; rangeRecord: string };
    amountAuditorCiphertextLo: Uint8Array;
    amountAuditorCiphertextHi: Uint8Array;
}> {
    return await createMintBurnProofPlan({
        rpc,
        payer,
        currentCiphertext: currentSupplyCiphertext,
        sourceElgamalKeypair: supplyElgamalKeypair,
        destinationElgamalPubkey,
        amount: mintAmount,
        currentAmount: currentSupply,
        operation: 'mint',
        programAddress,
    });
}

export async function createConfidentialBurnProofPlan({
    rpc,
    payer,
    currentAvailableBalanceCiphertext,
    sourceElgamalKeypair,
    supplyElgamalPubkey,
    burnAmount = 0n,
    currentAvailableBalance = 0n,
    programAddress,
}: {
    rpc: ReturnType<typeof createSolanaRpc>;
    payer: TransactionSigner;
    currentAvailableBalanceCiphertext: Uint8Array;
    sourceElgamalKeypair: ElGamalKeypair;
    supplyElgamalPubkey: ElGamalPubkey;
    burnAmount?: bigint;
    currentAvailableBalance?: bigint;
    programAddress: string;
}): Promise<{
    plan: InstructionPlan;
    proofAccounts: { equalityRecord: string; ciphertextValidityRecord: string; rangeRecord: string };
    amountAuditorCiphertextLo: Uint8Array;
    amountAuditorCiphertextHi: Uint8Array;
}> {
    return await createMintBurnProofPlan({
        rpc,
        payer,
        currentCiphertext: currentAvailableBalanceCiphertext,
        sourceElgamalKeypair,
        destinationElgamalPubkey: supplyElgamalPubkey,
        amount: burnAmount,
        currentAmount: currentAvailableBalance,
        operation: 'burn',
        programAddress,
    });
}

export async function executeV1ProofPlan(
    connection: Connection,
    payer: Keypair,
    plan: InstructionPlan,
    replaceTokenInstruction: (instruction: Instruction) => TransactionInstruction,
    additionalSigners: Keypair[] = [],
): Promise<{ coreInstructionCount: number; coreTransactionSize: number }> {
    if (plan.kind !== 'sequential' || plan.plans.length !== 3 || plan.plans[1].kind !== 'single') {
        throw new Error('Expected a setup → token instruction → cleanup proof plan.');
    }

    const signerEntries = [payer, ...additionalSigners].map(signer => [signer.address, signer] as const);
    const signerByAddress = new Map<string, TransactionSigner>(signerEntries);
    const legacyInstruction = replaceTokenInstruction(plan.plans[1].instruction);
    const replacementInstruction = convertLegacyInstruction(legacyInstruction, signerByAddress);
    const executablePlan: InstructionPlan = {
        ...plan,
        plans: [plan.plans[0], { ...plan.plans[1], instruction: replacementInstruction }, plan.plans[2]],
    };
    const payerSigner = payer;
    const rpc = createSolanaRpc(connection.rpcEndpoint);

    const sendInstructions = async (instructions: Instruction[]): Promise<number> => {
        const { value: latestBlockhash } = await rpc.getLatestBlockhash({ commitment: 'confirmed' }).send();
        const baseMessage = {
            version: 1 as const,
            instructions: [],
            config: {
                computeUnitLimit: 1_400_000,
                loadedAccountsDataSizeLimit: 64 * 1024 * 1024,
            },
        } as TransactionMessage & { version: 1 };
        const message = setTransactionMessageLifetimeUsingBlockhash(
            latestBlockhash,
            appendTransactionMessageInstructions(
                instructions,
                setTransactionMessageFeePayerSigner(payerSigner, baseMessage),
            ),
        );
        const transaction = await signTransactionMessageWithSigners(message);
        const transactionSize = getTransactionSize(transaction);
        if (transactionSize > 4096) {
            throw new Error(`Version 1 transaction is ${transactionSize} bytes; limit is 4096.`);
        }
        const signature = await rpc
            .sendTransaction(getBase64EncodedWireTransaction(transaction), {
                encoding: 'base64',
                preflightCommitment: 'confirmed',
            })
            .send();
        await connection.confirmTransaction(signature, 'confirmed');
        return transactionSize;
    };

    const execute = async (node: InstructionPlan): Promise<void> => {
        if (node.kind === 'single') {
            await sendInstructions([node.instruction]);
            return;
        }
        if (node.kind === 'messagePacker') {
            throw new Error('Message-packer proof plans are not supported by this test helper.');
        }
        if (node.kind === 'parallel') {
            await Promise.all(node.plans.map(execute));
            return;
        }
        if (node.plans.every(child => child.kind === 'single')) {
            await sendInstructions(node.plans.map(child => child.instruction));
            return;
        }
        for (const child of node.plans) {
            await execute(child);
        }
    };

    const setupPlan = executablePlan.plans[0];
    if (setupPlan.kind !== 'parallel') {
        throw new Error('Expected parallel proof-context setup plans.');
    }
    const proofInstructions: Instruction[] = [];
    const contextCreationPlans = setupPlan.plans.map(proofPlan => {
        if (
            proofPlan.kind !== 'sequential' ||
            proofPlan.plans.length < 2 ||
            !proofPlan.plans.every(child => child.kind === 'single')
        ) {
            throw new Error('Expected each proof setup to end with one proof-verification instruction.');
        }
        proofInstructions.push(proofPlan.plans.at(-1)!.instruction);
        return { ...proofPlan, plans: proofPlan.plans.slice(0, -1) };
    });

    await execute({ ...setupPlan, plans: contextCreationPlans });
    const coreInstructions = [...proofInstructions, replacementInstruction];
    const coreTransactionSize = await sendInstructions(coreInstructions);
    await execute(executablePlan.plans[2]);

    return { coreInstructionCount: coreInstructions.length, coreTransactionSize };
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
    payer: Keypair,
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
    payer: Keypair,
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
    payer: Keypair,
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

export async function createConfidentialFeeTokenAccount(
    connection: Connection,
    payer: Keypair,
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
    payer: Keypair,
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
    payer: Keypair,
    mint: Address,
    owner: Keypair,
    { includeTransferFeeAmount = false }: { includeTransferFeeAmount?: boolean } = {},
): Promise<{ tokenAccount: Address; elgamalKeypair: ElGamalKeypair; aesKey: AeKey }> {
    const payerSigner = payer;
    const ownerSigner = owner;
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
        await sendAndConfirmTransaction(connection, new Transaction().add(plan), [payer, owner], undefined);
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
        const transaction = new Transaction().add(
            plan,
            ZkElGamalProofProgram.verifyPubkeyValidity({ proofData: pubkeyValidityProofData.toBytes() }),
        );
        await sendAndConfirmTransaction(connection, transaction, [payer, owner], undefined);
    }

    await getAccount(connection, tokenAccount, undefined, TEST_PROGRAM_ID);
    return { tokenAccount, elgamalKeypair, aesKey };
}

export async function createCiphertextCiphertextEqualityProofInstruction(
    connection: Connection,
    payer: Keypair,
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
        instruction: ZkElGamalProofProgram.verifyCiphertextCiphertextEquality({ proofData: proofData.toBytes() }),
        secondCiphertext: secondCiphertext.toBytes(),
    };
}

export function createPubkeyValidityProofInstruction(elgamalKeypair: ElGamalKeypair): TransactionInstruction {
    return ZkElGamalProofProgram.verifyPubkeyValidity({
        proofData: new PubkeyValidityProofData(elgamalKeypair).toBytes(),
    });
}

export function createZeroCiphertextProofInstruction(
    elgamalKeypair: ElGamalKeypair,
    ciphertext: Uint8Array,
): TransactionInstruction {
    const proofData = new ZeroCiphertextProofData(elgamalKeypair, ElGamalCiphertext.fromBytes(ciphertext)!);
    return ZkElGamalProofProgram.verifyZeroCiphertext({ proofData: proofData.toBytes() });
}
