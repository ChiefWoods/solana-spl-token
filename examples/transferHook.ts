import {
    clusterApiUrl,
    sendAndConfirmTransaction,
    Connection,
    Keypair,
    Address,
    SystemProgram,
    Transaction,
    LAMPORTS_PER_SOL,
} from '@solana/web3.js';

import {
    ExtensionType,
    createInitializeMintInstruction,
    createInitializeTransferHookInstruction,
    getMintLen,
    TOKEN_2022_PROGRAM_ID,
    updateTransferHook,
    transferCheckedWithTransferHook,
    getAssociatedTokenAddress,
    ASSOCIATED_TOKEN_PROGRAM_ID,
} from '../src';

(async () => {
    const payer = await Keypair.generate();

    const mintAuthority = await Keypair.generate();
    const mintKeypair = await Keypair.generate();
    const mint = mintKeypair.publicKey;

    const sender = await Keypair.generate();
    const recipient = await Keypair.generate();

    const extensions = [ExtensionType.TransferHook];
    const mintLen = getMintLen(extensions);
    const decimals = 9;
    const transferHookPogramId = new Address('7N4HggYEJAtCLJdnHGCtFqfxcB5rhQCsQTze3ftYstVj');
    const newTransferHookProgramId = new Address('7N4HggYEJAtCLJdnHGCtFqfxcB5rhQCsQTze3ftYstVj');

    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

    const airdropSignature = await connection.requestAirdrop(payer.publicKey, 2 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction({ signature: airdropSignature, ...(await connection.getLatestBlockhash()) });

    const mintLamports = await connection.getMinimumBalanceForRentExemption(mintLen);
    const mintTransaction = new Transaction().add(
        SystemProgram.createAccount({
            fromPubkey: payer.publicKey,
            newAccountPubkey: mint,
            space: mintLen,
            lamports: mintLamports,
            programId: TOKEN_2022_PROGRAM_ID,
        }),
        createInitializeTransferHookInstruction(mint, payer.publicKey, transferHookPogramId, TOKEN_2022_PROGRAM_ID),
        createInitializeMintInstruction(mint, decimals, mintAuthority.publicKey, null, TOKEN_2022_PROGRAM_ID),
    );
    await sendAndConfirmTransaction(connection, mintTransaction, [payer, mintKeypair], undefined);

    await updateTransferHook(
        connection,
        payer,
        mint,
        newTransferHookProgramId,
        payer.publicKey,
        [],
        undefined,
        TOKEN_2022_PROGRAM_ID,
    );

    const senderAta = await getAssociatedTokenAddress(
        mint,
        sender.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    const recipientAta = await getAssociatedTokenAddress(
        mint,
        recipient.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    await transferCheckedWithTransferHook(
        connection,
        payer,
        senderAta,
        mint,
        recipientAta,
        sender,
        BigInt(1000000000),
        9,
        [],
        undefined,
        TOKEN_2022_PROGRAM_ID,
    );
})();
