import {
    clusterApiUrl,
    sendAndConfirmTransaction,
    Connection,
    Keypair,
    SystemProgram,
    Transaction,
    LAMPORTS_PER_SOL,
} from '@solana/web3.js';

import {
    ExtensionType,
    createInitializeMintInstruction,
    createInitializePermanentDelegateInstruction,
    mintTo,
    createAccount,
    getMintLen,
    transferChecked,
    TOKEN_2022_PROGRAM_ID,
} from '../src';

(async () => {
    const payer = await Keypair.generate();

    const mintAuthority = await Keypair.generate();
    const mintKeypair = await Keypair.generate();
    const mint = mintKeypair.publicKey;
    const permanentDelegate = await Keypair.generate();

    const extensions = [ExtensionType.PermanentDelegate];
    const mintLen = getMintLen(extensions);
    const decimals = 9;

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
        createInitializePermanentDelegateInstruction(mint, permanentDelegate.publicKey, TOKEN_2022_PROGRAM_ID),
        createInitializeMintInstruction(mint, decimals, mintAuthority.publicKey, null, TOKEN_2022_PROGRAM_ID),
    );
    await sendAndConfirmTransaction(connection, mintTransaction, [payer, mintKeypair], undefined);

    const mintAmount = BigInt(1_000_000_000);
    const owner = await Keypair.generate();
    const sourceAccount = await createAccount(
        connection,
        payer,
        mint,
        owner.publicKey,
        undefined,
        undefined,
        TOKEN_2022_PROGRAM_ID,
    );
    await mintTo(
        connection,
        payer,
        mint,
        sourceAccount,
        mintAuthority,
        mintAmount,
        [],
        undefined,
        TOKEN_2022_PROGRAM_ID,
    );

    const accountKeypair = await Keypair.generate();
    const destinationAccount = await createAccount(
        connection,
        payer,
        mint,
        owner.publicKey,
        accountKeypair,
        undefined,
        TOKEN_2022_PROGRAM_ID,
    );

    // Transfer by signing with the permanent delegate
    const signature = await transferChecked(
        connection,
        payer,
        sourceAccount,
        mint,
        destinationAccount,
        permanentDelegate,
        mintAmount,
        decimals,
        [],
        undefined,
        TOKEN_2022_PROGRAM_ID,
    );
})();
