import type { LiteSVM } from 'litesvm/web3js';
import { FailedTransactionMetadata } from 'litesvm/web3js';
import { describe, expect, it } from 'vitest';
import { Keypair, Transaction, type Address } from '@solana/web3.js';
import { createUpdateRateInterestBearingMintInstruction, TOKEN_2022_PROGRAM_ID } from '../../src';
import {
    createLiteSvm,
    createTestMint,
    setLiteSvmClock,
    invokeAmountToUiAmount,
    invokeUiAmountToAmount,
    TEST_CLOCK_TIMESTAMP,
} from '../common';

async function updateTestInterestBearingMintRate(
    svm: LiteSVM,
    mint: { address: Address; authority: Keypair },
    rate: number,
): Promise<void> {
    const payer = await Keypair.generate();
    svm.airdrop(payer.publicKey, 1_000_000_000n);

    const transaction = new Transaction().add(
        createUpdateRateInterestBearingMintInstruction(
            mint.address,
            mint.authority.publicKey,
            rate,
            [],
            TOKEN_2022_PROGRAM_ID,
        ),
    );
    transaction.feePayer = payer.publicKey;
    transaction.recentBlockhash = svm.latestBlockhash();
    transaction.lastValidBlockHeight = 0n;
    await transaction.sign(payer, mint.authority);

    const result = await svm.sendTransaction(transaction);
    if (result instanceof FailedTransactionMetadata) {
        throw new Error(`LiteSVM transaction failed: ${result.toString()}`);
    }
}

describe('interest-bearing amount conversion instructions', () => {
    it('should return the correct UiAmount when interest bearing config is not present', async () => {
        const testCases = [
            { decimals: 0, amount: 100n, expected: '100' },
            { decimals: 2, amount: 100n, expected: '1' },
            { decimals: 9, amount: 1000000000n, expected: '1' },
            { decimals: 10, amount: 1n, expected: '0.0000000001' },
            { decimals: 10, amount: 1000000000n, expected: '0.1' },
        ];

        for (const { decimals, amount, expected } of testCases) {
            const svm = createLiteSvm(TEST_CLOCK_TIMESTAMP);
            const mint = await createTestMint(svm, decimals);
            expect(await invokeAmountToUiAmount(svm, amount, mint.address)).toBe(expected);
        }
    });

    // continuous compounding interest of 5% for 1 year for 1 token = 1.0512710963760240397
    it('should return the correct UiAmount for constant 5% rate', async () => {
        const testCases = [
            { decimals: 0, amount: 1n, expected: '1' },
            { decimals: 1, amount: 1n, expected: '0.1' },
            { decimals: 10, amount: 1n, expected: '0.0000000001' },
            { decimals: 10, amount: 10000000000n, expected: '1.0512710964' },
        ];

        for (const { decimals, amount, expected } of testCases) {
            const svm = createLiteSvm(0);
            const mint = await createTestMint(svm, decimals, { type: 'interestBearing' });
            setLiteSvmClock(svm, TEST_CLOCK_TIMESTAMP);
            expect(await invokeAmountToUiAmount(svm, amount, mint.address)).toBe(expected);
        }
    });

    it('should return the correct UiAmount for constant -5% rate', async () => {
        const svm = createLiteSvm(0);
        const mint = await createTestMint(svm, 10, { type: 'interestBearing', rate: -500 });
        setLiteSvmClock(svm, TEST_CLOCK_TIMESTAMP);
        expect(await invokeAmountToUiAmount(svm, 10000000000n, mint.address)).toBe('0.9512294245');
    });

    it('should return the correct UiAmount for netting out rates', async () => {
        const svm = createLiteSvm(0);
        const mint = await createTestMint(svm, 10, { type: 'interestBearing', rate: -500 });
        setLiteSvmClock(svm, TEST_CLOCK_TIMESTAMP);
        await updateTestInterestBearingMintRate(svm, mint, 500);
        setLiteSvmClock(svm, TEST_CLOCK_TIMESTAMP * 2);
        expect(await invokeAmountToUiAmount(svm, 10000000000n, mint.address)).toBe('1');
    });

    it('should handle huge values correctly', async () => {
        const svm = createLiteSvm(0);
        const mint = await createTestMint(svm, 6, { type: 'interestBearing' });
        setLiteSvmClock(svm, TEST_CLOCK_TIMESTAMP * 2);
        expect(await invokeAmountToUiAmount(svm, 18446744073709551615n, mint.address)).toBe('20386805083448.097656');
    });

    it('should return the correct amount for constant 5% rate', async () => {
        const svm = createLiteSvm(0);
        const mint = await createTestMint(svm, 10, { type: 'interestBearing' });
        setLiteSvmClock(svm, TEST_CLOCK_TIMESTAMP);
        expect(await invokeUiAmountToAmount(svm, '1.0512710963760241', mint.address)).toBe(10000000000n);
    });

    it('should handle decimal places correctly', async () => {
        const testCases = [
            { decimals: 1, uiAmount: '0.10512710963760241', expected: 1n },
            { decimals: 10, uiAmount: '0.00000000010512710963760242', expected: 1n },
            { decimals: 10, uiAmount: '1.0512710963760241', expected: 10000000000n },
        ];

        for (const { decimals, uiAmount, expected } of testCases) {
            const svm = createLiteSvm(0);
            const mint = await createTestMint(svm, decimals, { type: 'interestBearing' });
            setLiteSvmClock(svm, TEST_CLOCK_TIMESTAMP);
            expect(await invokeUiAmountToAmount(svm, uiAmount, mint.address)).toBe(expected);
        }
    });

    it('should return the correct amount for constant -5% rate', async () => {
        const svm = createLiteSvm(0);
        const mint = await createTestMint(svm, 10, { type: 'interestBearing', rate: -500 });
        setLiteSvmClock(svm, TEST_CLOCK_TIMESTAMP);
        expect(await invokeUiAmountToAmount(svm, '0.951229424500714', mint.address)).toBe(10000000000n);
    });

    it('should return the correct amount for netting out rates', async () => {
        const svm = createLiteSvm(0);
        const mint = await createTestMint(svm, 10, { type: 'interestBearing', rate: -500 });
        setLiteSvmClock(svm, TEST_CLOCK_TIMESTAMP);
        await updateTestInterestBearingMintRate(svm, mint, 500);
        setLiteSvmClock(svm, TEST_CLOCK_TIMESTAMP * 2);
        expect(await invokeUiAmountToAmount(svm, '1', mint.address)).toBe(10000000000n);
    });
});
