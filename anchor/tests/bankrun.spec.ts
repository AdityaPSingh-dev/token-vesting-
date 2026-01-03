import * as anchor from "@coral-xyz/anchor";
import {BankrunProvider} from "anchor-bankrun";
import {TOKEN_PROGRAM_ID} from "@solana/spl-token";
import {BN, Program} from "@coral-xyz/anchor";

import {
    startAnchor,
    Clock,
    BanksClient,
    ProgramTestContext,
} from "solana-bankrun";

import {createMint, mintTo} from "spl-token-bankrun";
import {PublicKey, Keypair} from "@solana/web3.js";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";

import IDL from ""
import {Vesting} from "../target/types/vesting";
import {SYSTEM_PROGRAM_ID} from "@coral-xyz/anchor/dist/cjs/native/system";
import {setTimeout} from "node:timers/promises";


describe("Vesting Smart Contract Tests", () => {
    const companyName = "Company";
    let beneficiary: Keypair;
    let vestingAccountKey: PublicKey;
    let treasuryTokenAccount: PublicKey;
    let employeeAccount: PublicKey;
    let provider: BankrunProvider;
    let program: Program<Vesting>;
    let banksClient: BanksClient;
    let employer: Keypair;
    let mint: PublicKey;
    let beneficiaryProvider: BankrunProvider;
    let program2: Program<Vesting>;
    let context: ProgramTestContext;

    beforeAll(async () => {
        beneficiary = new anchor.web3.Keypair();

        // set up bankrun
        context = await startAnchor(
            "",
            [{name: "vesting", programId: new PublicKey(IDL.address)}],
            [
                {
                    address: beneficiary.publicKey,
                    info: {
                        lamports: 1_000_000_000,
                        data: Buffer.alloc(0),
                        owner: SYSTEM_PROGRAM_ID,
                        executable: false,
                    },
                },
            ]
        );
        provider = new BankrunProvider(context);

        anchor.setProvider(provider);

        program = new Program<Vesting>(IDL as Vesting, provider);

        banksClient = context.banksClient;

        employer = provider.wallet.payer;

        // Create a new mint
        // @ts-ignore
        mint = await createMint(banksClient, employer, employer.publicKey, null, 2);

        // Generate a new keypair for the beneficiary
        beneficiaryProvider = new BankrunProvider(context);
        beneficiaryProvider.wallet = new NodeWallet(beneficiary);

        program2 = new Program<Vesting>(IDL as Vesting, beneficiaryProvider);

        // Derive PDAs
        [vestingAccountKey] = PublicKey.findProgramAddressSync(
            [Buffer.from(companyName)],
            program.programId
        );

        [treasuryTokenAccount] = PublicKey.findProgramAddressSync(
            [Buffer.from("vesting_treasury"), Buffer.from(companyName)],
            program.programId
        );

        [employeeAccount] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("employee_vesting"),
                beneficiary.publicKey.toBuffer(),
                vestingAccountKey.toBuffer(),
            ],
            program.programId
        );
    });

    it("should create a vesting account", async () => {
            const tx = await program.methods
                .createVestingAccount(companyName)
                .accounts({
                    signer: employer.publicKey,
                    mint,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .rpc({commitment: "confirmed"});

            const vestingAccountData = await program.account.vestingAccount.fetch(
                vestingAccountKey,
                "confirmed"
            );
            console.log(
                "Vesting Account Data:",
                JSON.stringify(vestingAccountData, null, 2)
            );

            console.log("Create Vesting Account Transaction Signature:", tx);
        }
    );
    it("should fund the treasury token account", async () => {
        const amount = 10000 * 10 ** 9;

        const mintTx = await mintTo(
            // @ts-expect-error -type mismatch
            banksClient,
            employer, mint, treasuryTokenAccount, employer, amount
        );
        console.log("Mint treasury tokenAccount",mintTx)
    });
    it("Should create a employe vesting account", async()=>{
        const tx2=await program.methods.createEmployeeAccount(new BN(0),new BN(100),new BN(100),new BN(0)).accounts({beneficiary:beneficiary.publicKey,vestingAccount:vestingAccountKey})
            .rpc({commitment:"confirmed",skipPreflight:true});
        console.log("create Employee Account Tx",tx2);
        console.log("Employee Account",employeeAccount.toBase58());
    })
    it("Should claim tokens",async ()=>{
        // @ts-ignore
        await new Promise((resolve)=>setTimeout(resolve,1000))
        const currentClock= await banksClient.getClock();
        context.setClock(new Clock(currentClock.slot,currentClock.epochStartTimestamp,currentClock.epoch,currentClock.leaderScheduleEpoch,new BN(1000)));

    const tx3=await program2.methods.claimTokens(companyName).accounts({tokenProgram:TOKEN_PROGRAM_ID}).rpc({commitment:"confirmed"});

    console.log("Claim Tokens Tx:",tx3)
    })
})