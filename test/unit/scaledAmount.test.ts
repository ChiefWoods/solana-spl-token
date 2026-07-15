import { describe, expect, it } from 'vitest';
import {
    createLiteSvm,
    createTestMint,
    setLiteSvmClock,
    invokeAmountToUiAmount,
    invokeUiAmountToAmount,
    TEST_CLOCK_TIMESTAMP,
} from '../common';

describe('scaled UI amount conversion instructions', () => {
    it('should correctly scale amounts with different multipliers', async () => {
        const testCases = [
            { amount: 100n, multiplier: 1, decimals: 2, expected: '1' },
            { amount: 100n, multiplier: 2, decimals: 2, expected: '2' },
            { amount: 100n, multiplier: 0.5, decimals: 2, expected: '0.5' },
            { amount: 1000000n, multiplier: 1.5, decimals: 6, expected: '1.5' },
        ];

        for (const { amount, multiplier, decimals, expected } of testCases) {
            const svm = createLiteSvm(TEST_CLOCK_TIMESTAMP);
            const mint = await createTestMint(svm, decimals, { type: 'scaledUiAmount', multiplier });
            expect(await invokeAmountToUiAmount(svm, amount, mint.address)).toBe(expected);
        }
    });

    it('should handle large numbers correctly', async () => {
        const svm = createLiteSvm(TEST_CLOCK_TIMESTAMP);
        const mint = await createTestMint(svm, 10, { type: 'scaledUiAmount', multiplier: 5 });
        expect(await invokeAmountToUiAmount(svm, 10000000000n, mint.address)).toBe('5');
    });

    it('should correctly unscale amounts with different multipliers', async () => {
        const testCases = [
            { uiAmount: '1', multiplier: 1, decimals: 2, expected: 100n },
            { uiAmount: '2', multiplier: 2, decimals: 2, expected: 100n },
            { uiAmount: '0.5', multiplier: 0.5, decimals: 2, expected: 100n },
            { uiAmount: '1.5', multiplier: 1.5, decimals: 6, expected: 1000000n },
        ];

        for (const { uiAmount, multiplier, decimals, expected } of testCases) {
            const svm = createLiteSvm(TEST_CLOCK_TIMESTAMP);
            const mint = await createTestMint(svm, decimals, { type: 'scaledUiAmount', multiplier });
            expect(await invokeUiAmountToAmount(svm, uiAmount, mint.address)).toBe(expected);
        }
    });

    it('should throw when unscaling with zero multiplier', async () => {
        const svm = createLiteSvm(TEST_CLOCK_TIMESTAMP);
        await expect(createTestMint(svm, 2, { type: 'scaledUiAmount', multiplier: 0 })).rejects.toThrow(
            'Invalid scale for scaled ui amount',
        );
    });

    it('should handle large ui amounts correctly', async () => {
        const svm = createLiteSvm(TEST_CLOCK_TIMESTAMP);
        const mint = await createTestMint(svm, 10, { type: 'scaledUiAmount', multiplier: 5 });
        expect(await invokeUiAmountToAmount(svm, '5.0000000000000000', mint.address)).toBe(10000000000n);
    });

    it('should handle multiplier transition correctly', async () => {
        const svm = createLiteSvm(TEST_CLOCK_TIMESTAMP);
        const mint = await createTestMint(svm, 2, {
            type: 'scaledUiAmount',
            multiplier: 1,
            newMultiplier: 2,
            newMultiplierEffectiveTimestamp: TEST_CLOCK_TIMESTAMP * 2,
        });

        expect(await invokeAmountToUiAmount(svm, 100n, mint.address)).toBe('1');

        setLiteSvmClock(svm, TEST_CLOCK_TIMESTAMP * 2);
        expect(await invokeAmountToUiAmount(svm, 100n, mint.address)).toBe('2');
    });

    it('should correctly convert back and forth', async () => {
        const svm = createLiteSvm(TEST_CLOCK_TIMESTAMP);
        const mint = await createTestMint(svm, 2, {
            type: 'scaledUiAmount',
            multiplier: 5,
            newMultiplierEffectiveTimestamp: 0,
            newMultiplier: 5,
        });

        const uiAmount = await invokeAmountToUiAmount(svm, 100n, mint.address);
        expect(uiAmount).toBe('5');
        expect(await invokeUiAmountToAmount(svm, uiAmount, mint.address)).toBe(100n);
    });

    it('should handle max values correctly', async () => {
        const svm = createLiteSvm(TEST_CLOCK_TIMESTAMP);
        const mint = await createTestMint(svm, 0, {
            type: 'scaledUiAmount',
            multiplier: Number.MAX_VALUE,
            newMultiplierEffectiveTimestamp: 0,
            newMultiplier: Number.MAX_VALUE,
        });

        expect(await invokeAmountToUiAmount(svm, BigInt(Number.MAX_SAFE_INTEGER), mint.address)).toBe('inf');
    });
});
