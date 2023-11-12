const erc20Abi = require("./erc20-abi");
const fs = require("fs");
const loveFarmAbi = require("./lovefarm-abi");
const ethers = require("ethers");
const uniswapV2Abi = require("./uniswapV2-abi");
require('dotenv').config()
const jsonRpcUrl = process.env.JSON_RPC_URL

if (!jsonRpcUrl) {
  throw new Error('JSON_RPC_URL not set')
}

const provider = new ethers.providers.JsonRpcProvider(jsonRpcUrl);

const loveAddr = "0xB22C05CeDbF879a661fcc566B5a759d005Cf7b4C";

const war3EthLpAddr = "0xE44975f2e85c63EF1a3721994cBBc2a87BeeAab0";
const war3LoveLpAddr = "0x1c9189593669b5c1fbc33d7ff522b1b2dd0646e4";
const loveContract = new ethers.Contract(loveAddr, erc20Abi, provider);

const faithContract = new ethers.Contract(
  "0xb66f07D7bF1f048Ea0600b3E6EB480eDA951392a",
  erc20Abi,
  provider
);

const war3Contract = new ethers.Contract(
  "0x36d7aA5c67EFd83992fC5CBc488cc2f9Ba7689B8",
  erc20Abi,
  provider
);

const loveFarmContract = new ethers.Contract(
  "0xfb063b1ae6471e6795d6ad1fc7f47c1cab1f3422",
  loveFarmAbi,
  provider
);

const blockNumber = 18546848;


const LOVEADDR_METADATA_PATH = "./data/.love-addresses-metadata";
const LOVEADDRS_PATH = "./data/love-addresses.txt";
const SNAPSHOT_CSV_PATH = "./data/snapshot.csv";

const SNAPSHOT_IPFS_PATH = `./data/snapshot-${blockNumber}.json`

const main = async () => {
  const addrs = fs.readFileSync(SNAPSHOT_CSV_PATH, "utf8").split("\n").filter(v => v !== "").map((line) => line.split(","));
  const snapshotApi = {
    score: addrs.map(([address, score]) => ({
      address: ethers.utils.getAddress(address),
      score: Number(score).toFixed()
    }))
  }
  fs.writeFileSync(SNAPSHOT_IPFS_PATH, JSON.stringify(snapshotApi))
};

main();
