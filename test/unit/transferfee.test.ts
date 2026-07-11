import { describe, expect, it } from 'vitest';
import {
    calculateFee,
    calculateEpochFee,
    ONE_IN_BASIS_POINTS,
    createInitializeTransferFeeConfigInstruction,
    decodeInitializeTransferFeeConfigInstruction,
    TOKEN_2022_PROGRAM_ID,
} from '../../src';
import { Keypair, Address } from '@solana/web3.js';

describe('transferFee', () => {
    describe('encoding/decoding `InitializeTransferFeeConfig` instructions', () => {
        it('should encode and decode with both authorities', async () => {
            const mint = (await Keypair.generate()).publicKey;
            const transferFeeConfigAuthority = (await Keypair.generate()).publicKey;
            const withdrawWithheldAuthority = (await Keypair.generate()).publicKey;
            const instruction = createInitializeTransferFeeConfigInstruction(
                mint,
                transferFeeConfigAuthority,
                withdrawWithheldAuthority,
                100,
                100n,
            );
            expect(instruction.data.length).toEqual(78);
            const decoded = decodeInitializeTransferFeeConfigInstruction(instruction, TOKEN_2022_PROGRAM_ID);
            expect(decoded.data.transferFeeConfigAuthority).toEqual(transferFeeConfigAuthority);
            expect(decoded.data.withdrawWithheldAuthority).toEqual(withdrawWithheldAuthority);
            expect(decoded.data.transferFeeBasisPoints).toEqual(100);
            expect(decoded.data.maximumFee).toEqual(100n);
        });
        it('should encode and decode with no transfer fee config authority', async () => {
            const mint = (await Keypair.generate()).publicKey;
            const withdrawWithheldAuthority = (await Keypair.generate()).publicKey;
            const instruction = createInitializeTransferFeeConfigInstruction(
                mint,
                null,
                withdrawWithheldAuthority,
                100,
                100n,
            );
            expect(instruction.data.length).toEqual(46);
            const decoded = decodeInitializeTransferFeeConfigInstruction(instruction, TOKEN_2022_PROGRAM_ID);
            expect(decoded.data.transferFeeConfigAuthority).toEqual(null);
            expect(decoded.data.withdrawWithheldAuthority).toEqual(withdrawWithheldAuthority);
            expect(decoded.data.transferFeeBasisPoints).toEqual(100);
            expect(decoded.data.maximumFee).toEqual(100n);
        });
        it('should encode and decode with no withdraw withheld authority', async () => {
            const mint = (await Keypair.generate()).publicKey;
            const transferFeeConfigAuthority = (await Keypair.generate()).publicKey;
            const instruction = createInitializeTransferFeeConfigInstruction(
                mint,
                transferFeeConfigAuthority,
                null,
                100,
                100n,
            );
            expect(instruction.data.length).toEqual(46);
            const decoded = decodeInitializeTransferFeeConfigInstruction(instruction, TOKEN_2022_PROGRAM_ID);
            expect(decoded.data.transferFeeConfigAuthority).toEqual(transferFeeConfigAuthority);
            expect(decoded.data.withdrawWithheldAuthority).toEqual(null);
            expect(decoded.data.transferFeeBasisPoints).toEqual(100);
            expect(decoded.data.maximumFee).toEqual(100n);
        });
        it('should encode and decode with no authorities', async () => {
            const mint = (await Keypair.generate()).publicKey;
            const instruction = createInitializeTransferFeeConfigInstruction(mint, null, null, 100, 100n);
            expect(instruction.data.length).toEqual(14);
            const decoded = decodeInitializeTransferFeeConfigInstruction(instruction, TOKEN_2022_PROGRAM_ID);
            expect(decoded.data.transferFeeConfigAuthority).toEqual(null);
            expect(decoded.data.withdrawWithheldAuthority).toEqual(null);
            expect(decoded.data.transferFeeBasisPoints).toEqual(100);
            expect(decoded.data.maximumFee).toEqual(100n);
        });
    });

    describe('calculateFee', () => {
        it('should return 0 fee when transferFeeBasisPoints is 0', () => {
            const transferFee = {
                epoch: 1n,
                maximumFee: 100n,
                transferFeeBasisPoints: 0,
            };
            const preFeeAmount = 100n;
            const fee = calculateFee(transferFee, preFeeAmount);
            expect(fee).toEqual(0n);
        });

        it('should return 0 fee when preFeeAmount is 0', () => {
            const transferFee = {
                epoch: 1n,
                maximumFee: 100n,
                transferFeeBasisPoints: 100,
            };
            const preFeeAmount = 0n;
            const fee = calculateFee(transferFee, preFeeAmount);
            expect(fee).toEqual(0n);
        });

        it('should calculate the fee correctly when preFeeAmount is non-zero', () => {
            const transferFee = {
                epoch: 1n,
                maximumFee: 100n,
                transferFeeBasisPoints: 50,
            };
            const preFeeAmount = 500n;
            const fee = calculateFee(transferFee, preFeeAmount);
            expect(fee).toEqual(3n);
        });

        it('fee should be equal to maximum fee', () => {
            const transferFee = {
                epoch: 1n,
                maximumFee: 5000n,
                transferFeeBasisPoints: 50,
            };
            const preFeeAmount = transferFee.maximumFee;
            const fee = calculateFee(transferFee, preFeeAmount * ONE_IN_BASIS_POINTS);
            expect(fee).toEqual(transferFee.maximumFee);
        });
        it('fee should be equal to maximum fee when added 1 to preFeeAmount', () => {
            const transferFee = {
                epoch: 1n,
                maximumFee: 5000n,
                transferFeeBasisPoints: 50,
            };
            const preFeeAmount = transferFee.maximumFee;
            const fee = calculateFee(transferFee, preFeeAmount * ONE_IN_BASIS_POINTS + 1n);
            expect(fee).toEqual(transferFee.maximumFee);
        });
    });

    describe('calculateEpochFee', () => {
        const transferFeeConfig = {
            transferFeeConfigAuthority: Address.default,
            withdrawWithheldAuthority: Address.default,
            withheldAmount: 500n,
            olderTransferFee: {
                epoch: 1n,
                maximumFee: 100n,
                transferFeeBasisPoints: 50,
            },
            newerTransferFee: {
                epoch: 2n,
                maximumFee: 200n,
                transferFeeBasisPoints: 75,
            },
        };

        it('should return olderTransferFee when epoch is less than newerTransferFee.epoch', () => {
            const preFeeAmount = 200n;
            const epoch = 1n;
            const fee = calculateEpochFee(transferFeeConfig, epoch, preFeeAmount);
            expect(fee).toEqual(1n);
        });

        it('should return newerTransferFee when epoch is greater than or equal to newerTransferFee.epoch', () => {
            const preFeeAmount = 200n;
            const epoch = 2n;
            const fee = calculateEpochFee(transferFeeConfig, epoch, preFeeAmount);
            expect(fee).toEqual(2n);
        });

        it('should cap the fee to the maximumFee when calculated fee exceeds maximumFee', () => {
            const preFeeAmount = 500n;
            const epoch = 2n;
            const fee = calculateEpochFee(transferFeeConfig, epoch, preFeeAmount);
            expect(fee).toEqual(4n);
        });
    });
});
