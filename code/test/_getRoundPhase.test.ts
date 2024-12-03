import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { BuyerAgent, ERC20, Swan } from "../typechain-types";
import { deployTokenFixture, deploySwanFixture } from "./fixtures/deploy";
import { transferTokens } from "./helpers";
import { parseEther } from "ethers";
import { buyerAgentDeployer } from "./fixtures";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { minutes } from "@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time/duration";
import { Phase } from "./types/enums";

describe("BuyerAgent", function () {
  let buyerAgent: BuyerAgent;
  let token: ERC20;
  let swan: Swan;

  let buyerAgentOwner: HardhatEthersSigner;
  let dria: HardhatEthersSigner;
  let user: HardhatEthersSigner;

  const PRICE1 = ethers.parseEther("0.1");
  const PRICE2 = ethers.parseEther("0.3");
  const AMOUNT_PER_ROUND = ethers.parseEther("0.1");
  const SUPPLY = parseEther("1000");
  const ROYALTY_FEE = 1n;

  const STAKES = {
    generatorStakeAmount: parseEther("0.01"),
    validatorStakeAmount: parseEther("0.01"),
  };

  const FEES = {
    platformFee: 1n,
    generationFee: parseEther("0.02"),
    validationFee: parseEther("0.03"),
  };

  const MARKET_PARAMETERS = {
    withdrawInterval: minutes(30),
    sellInterval: minutes(60),
    buyInterval: minutes(20),
    platformFee: 1n,
    maxAssetCount: 5n,
    timestamp: 0n,
  };

  const ORACLE_PARAMETERS = {
    difficulty: 1,
    numGenerations: 1,
    numValidations: 1,
  };

  this.beforeAll(async function () {
    [dria, buyerAgentOwner, user] = await ethers.getSigners();
  });

  it("should deploy token and swan contracts", async function () {
    token = await deployTokenFixture(dria, SUPPLY);

    MARKET_PARAMETERS.timestamp = (await ethers.provider
      .getBlock("latest")
      .then((block) => block?.timestamp)) as bigint;

    ({ swan } = await deploySwanFixture(dria, token, STAKES, FEES, MARKET_PARAMETERS, ORACLE_PARAMETERS));
  });

  it("should fund agent owner", async function () {
    await transferTokens(token, [[buyerAgentOwner.address, BigInt(PRICE1 + PRICE2)]]);
  });

  it("should deploy buyer agent", async function () {
    buyerAgent = await loadFixture(
      buyerAgentDeployer(swan, {
        name: "Name of the agent",
        description: "Description of the agent",
        royaltyFee: ROYALTY_FEE,
        amountPerRound: AMOUNT_PER_ROUND,
        owner: buyerAgentOwner,
      })
    );
  });
  
  describe("buy phase", function () {
    it("should increase time to buy phase", async function () {
      await time.increase(MARKET_PARAMETERS.sellInterval);

      // get current round and phase
      const [round, phase] = await buyerAgent.getRoundPhase();
      console.log("Buy - Phase: ", round, phase)
      // expect(round).to.be.equal(0n);
      // expect(phase).to.be.equal(Phase.Buy);
    });


  });

});
