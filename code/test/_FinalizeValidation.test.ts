import { expect } from "chai";
import { ethers } from "hardhat";
import type { ERC20, LLMOracleCoordinator, LLMOracleRegistry } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { parseEther } from "ethers";
import { deployLLMFixture, deployTokenFixture } from "./fixtures/deploy";
import { registerOracles, safeRequest, safeRespond, safeValidate } from "./helpers";
import { transferTokens } from "./helpers";
import { PANIC_CODES } from "@nomicfoundation/hardhat-chai-matchers/panic";

describe("Statistics", function () {
  let dria: HardhatEthersSigner;
  let requester: HardhatEthersSigner;
  let generators: HardhatEthersSigner[];
  let validators: HardhatEthersSigner[];

  let coordinator: LLMOracleCoordinator;
  let registry: LLMOracleRegistry;
  let token: ERC20;
  let taskId = 1n; 

  const input = "0x" + Buffer.from("What is 2 + 2?").toString("hex");
  const output = "0x" + Buffer.from("2 + 2 equals 4.").toString("hex");
  const models = "0x" + Buffer.from("gpt-4o-mini").toString("hex");
  const metadata = "0x"; 
  const difficulty = 2;
  const SUPPLY = parseEther("1000");

  const STAKES = {
    generatorStakeAmount: parseEther("0.01"),
    validatorStakeAmount: parseEther("0.01"),
  };

  const FEES = {
    platformFee: parseEther("0.001"),
    generationFee: parseEther("0.002"),
    validationFee: parseEther("0.0003"),
  };

  const [numGenerations, numValidations] = [2, 5];

  this.beforeAll(async function () {
    const [deployer, req1, gen1, gen2, gen3, val1, val2, val3, val4, val5] = await ethers.getSigners();
    dria = deployer;
    requester = req1;
    generators = [gen1, gen2, gen3];
    validators = [val1, val2, val3, val4, val5];

    token = await deployTokenFixture(deployer, SUPPLY);

    ({ registry, coordinator } = await deployLLMFixture(dria, token, STAKES, FEES));

    const requesterFunds = parseEther("1");
    await transferTokens(token, [
      [requester.address, requesterFunds],

      ...generators.map<[string, bigint]>((oracle) => [oracle.address, STAKES.generatorStakeAmount]),
      ...validators.map<[string, bigint]>((oracle) => [oracle.address, STAKES.validatorStakeAmount]),
    ]);
  }); 
  
  it("finalizeValidation underflows", async function () {
    await registerOracles(token, registry, generators, validators, STAKES);

    //make a request
    await safeRequest(coordinator, token, requester, taskId, input, models, {
      difficulty,
      numGenerations,
      numValidations,
    });

    //respond 
    for (let i = 0; i < numGenerations; i++) {
      await safeRespond(coordinator, generators[i], output, metadata, taskId, BigInt(i));
    }

    //first validation 
    let scores = new Array(0n, 0n)
    await safeValidate(coordinator, validators[0], scores, metadata, taskId, 0n);  
    
    //second validation => calls finalizeValidation => calls Statistics.stddev(generationScores)
    scores = new Array(0n, 0n)
    await safeValidate(coordinator, validators[1], scores, metadata, taskId, 1n);  

    //third validation
    scores = new Array(0n, 0n)
    await safeValidate(coordinator, validators[2], scores, metadata, taskId, 2n);  

    //fourth validation
    scores = new Array(0n, 0n)
    await safeValidate(coordinator, validators[3], scores, metadata, taskId, 3n); 

    //fifth validation
    scores = new Array(10n, 10n)

    //this will generate an underflow at: score >= _mean - _stddev; in finalizeValidation() =>
    //_mean - _stdde == 2 - 4  => underflow !
    await safeValidate(coordinator, validators[4], scores, metadata, taskId, 4n)
    // await expect(safeValidate(coordinator, validators[4], scores, metadata, taskId, 4n))
    //   .to.be.revertedWithPanic(PANIC_CODES.ARITHMETIC_OVERFLOW);
  });
   
});
