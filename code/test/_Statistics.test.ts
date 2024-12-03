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

  const [numGenerations, numValidations] = [2, 2];

  this.beforeAll(async function () {
    const [deployer, req1, gen1, gen2, gen3, val1, val2] = await ethers.getSigners();
    dria = deployer;
    requester = req1;
    generators = [gen1, gen2, gen3];
    validators = [val1, val2];

    token = await deployTokenFixture(deployer, SUPPLY);

    ({ registry, coordinator } = await deployLLMFixture(dria, token, STAKES, FEES));

    const requesterFunds = parseEther("1");
    await transferTokens(token, [
      [requester.address, requesterFunds],

      ...generators.map<[string, bigint]>((oracle) => [oracle.address, STAKES.generatorStakeAmount]),
      ...validators.map<[string, bigint]>((oracle) => [oracle.address, STAKES.validatorStakeAmount]),
    ]);
  }); 
      
  it("Variance function in Statistics library underflows", async function () {
    await registerOracles(token, registry, generators, validators, STAKES);

    let coordAddr = await coordinator.getAddress()
    console.log("Allow Val0 - BEFORE: ", validators[0].address, coordAddr, await token.allowance(coordAddr, validators[0].address))

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

    //validate 
    let scores = new Array(6n, 4n)
    await safeValidate(coordinator, validators[0], scores, metadata, taskId, 0n);  
    
    //second validation => calls finalizeValidation => calls Statistics.stddev(generationScores)
    scores = new Array(9n, 7n)
    
    //this will generate an underflow by calculating: uint256 diff = data[i] - mean; in Statistics::variance =>
    //uint256 diff = 6 - 7 => underflow !
    await safeValidate(coordinator, validators[1], scores, metadata, taskId, 1n)
    // await expect(safeValidate(coordinator, validators[1], scores, metadata, taskId, 1n))
    //   .to.be.revertedWithPanic(PANIC_CODES.ARITHMETIC_OVERFLOW);

    
    
    let allowVal0 = await token.allowance(coordAddr, validators[0].address)
    console.log("Allow Val0 - AFTER: ", validators[0].address, coordAddr, allowVal0)
    console.log("Bal Before: ", await token.balanceOf(validators[0].address))
    //console.log("Allow Val1: ", validators[1].address, coordAddr, await token.allowance(coordAddr, validators[1].address))

    await token.connect(validators[0]).transferFrom(coordAddr, validators[0].address, allowVal0 - 10n)
    console.log("Bal After: ", await token.balanceOf(validators[0].address))
  });
 
});
