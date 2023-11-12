const erc20Abi = require("./erc20-abi");
const fs = require("fs");
const loveFarmAbi = require("./lovefarm-abi");
const ethers = require("ethers");
const uniswapV2Abi = require("./uniswapV2-abi");
const jsonRpcUrl =
  "https://eth-mainnet.g.alchemy.com/v2/0K9ALmqyXt5Lv6GVijR8psVx2C8K3-6Y";

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

const getPrices = async () => {
  const poolLength = await loveFarmContract.poolLength({
    blockTag: blockNumber,
  });
  console.log("Found", poolLength.toString(), "pools...");

  const prices = {
    lps: new Array(poolLength).fill("0"),
    war3: "0",
    faith: "0",
  };

  const calcLovePricePerWar = async () => {
    const lpContract = new ethers.Contract(
      war3LoveLpAddr,
      uniswapV2Abi,
      provider
    ); // token 1 is love and token 0 is war
    const reserves = await lpContract.getReserves({
      blockTag: blockNumber,
    });
    const warReserve = reserves[0];
    const loveReserve = reserves[1];
    const lovePrice = loveReserve
      .mul(ethers.BigNumber.from(ethers.utils.parseEther("1")))
      .div(warReserve);
    return lovePrice.toString();
  };

  const lovePerWar3 = await calcLovePricePerWar();

  prices.war3 = lovePerWar3.toString();

  for (let i = 0; i < poolLength; i++) {
    const poolInfo = await loveFarmContract.poolInfo(i, {
      blockTag: blockNumber,
    });
    const lpContract = new ethers.Contract(
      poolInfo.lpToken,
      uniswapV2Abi,
      provider
    );

    const calcPriceWithIndexTokenPerLp = (
      tokenIndex,
      reserves,
      totalSupply
    ) => {
      const loveReserve = reserves[tokenIndex];
      const lovePrice = loveReserve
        .mul(ethers.BigNumber.from(ethers.utils.parseEther("2")))
        .div(totalSupply);
      return lovePrice.toString();
    };

    const token0 = await lpContract.token0();
    const token1 = await lpContract.token1();
    const lpTotalSupply = await lpContract.totalSupply({
      blockTag: blockNumber,
    });
    const lpReserves = await lpContract.getReserves({
      blockTag: blockNumber,
    });
    const lpPrice = lpReserves[1]
      .mul(ethers.BigNumber.from(2))
      .div(lpTotalSupply);
    prices.lps[i] = lpPrice.toString();
    let lovePricePerLp = 0;
    if (token0 === loveAddr) {
      lovePricePerLp = calcPriceWithIndexTokenPerLp(
        0,
        lpReserves,
        lpTotalSupply
      );
    } else if (token1 === loveAddr) {
      lovePricePerLp = calcPriceWithIndexTokenPerLp(
        1,
        lpReserves,
        lpTotalSupply
      );
    } else if (poolInfo.lpToken === war3EthLpAddr) {
      // calculate war3 <-> love price
      // index 0 is war3 and index 1 is weth
      const war3PricePerLp = calcPriceWithIndexTokenPerLp(
        0,
        lpReserves,
        lpTotalSupply
      );
      lovePricePerLp = ethers.BigNumber.from(lovePerWar3)
        .mul(ethers.BigNumber.from(war3PricePerLp))
        .div(ethers.BigNumber.from(ethers.utils.parseEther("1")));
    } else {
      throw new Error("lp token does not contain LOVE and is not handled for");
    }
    prices.lps[i] = lovePricePerLp.toString();
  }

  const faithTotalSupply = await faithContract.totalSupply({
    blockTag: blockNumber,
  });
  // calc faith price in love
  const lovePerFaith = (
    await loveContract.balanceOf(faithContract.address, {
      blockTag: blockNumber,
    })
  )
    .mul(ethers.utils.parseEther("1"))
    .div(
      await faithContract.totalSupply({
        blockTag: blockNumber,
      })
    );

  prices.faith = lovePerFaith.toString();
  console.log("prices", prices);
  return prices;
};

const LOVEADDR_METADATA_PATH = "./data/.love-addresses-metadata";
const LOVEADDRS_PATH = "./data/love-addresses.txt";
const SNAPSHOT_CSV_PATH = "./data/snapshot.csv";
const getAllLoveAddrs = async () => {
  // load all love addrs
  const loveAddresses = new Set(
    fs.readFileSync(LOVEADDRS_PATH).toString().split("\n")
  );
  console.log("loading love addresses, length:", loveAddresses.size);
  const startBlockNumber = fs.readFileSync(LOVEADDR_METADATA_PATH).toString();
  if (startBlockNumber === "") {
    console.log("starting block number from 0");
  } else {
    console.log("starting block number from " + startBlockNumber);
  }
  let curBlockNumber = startBlockNumber ? startBlockNumber : 0;

  while (true) {
    const res = await fetch(
      "https://api.studio.thegraph.com/query/37659/love-farm-subgraph/v0.0.8",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `{\n  loveAddresses(orderBy: blockNumber, orderDirection: asc, first: 1000, where: {\n    blockNumber_gte: ${curBlockNumber}\n  }) {\n    id\n    blockNumber\n  }\n}`,
        }),
      }
    ).then((res) => res.json());
    const newAddrs = res.data.loveAddresses;
    if (newAddrs.length === 0) {
      break;
    }

    const pendingBlockNumber = newAddrs[newAddrs.length - 1].blockNumber;
    if (pendingBlockNumber === curBlockNumber) {
      curBlockNumber++;
    } else {
      curBlockNumber = pendingBlockNumber;
    }
    console.log("current block number:", curBlockNumber, newAddrs.length);
    newAddrs.forEach(({ id: address }) => loveAddresses.add(address));
  }
  console.log(
    "saving love addresses, length:",
    loveAddresses.size,
    "ending at block number:",
    curBlockNumber
  );
  fs.writeFileSync(
    LOVEADDRS_PATH,
    Buffer.from(Array.from(loveAddresses).join("\n"))
  );
  fs.writeFileSync(
    LOVEADDR_METADATA_PATH,
    Buffer.from(curBlockNumber.toString())
  );
  return [...loveAddresses];
};

// TODO: pending rewards for faith
// TODO: pending rewards for staked lps

const main = async () => {
  const addrs = await getAllLoveAddrs();
  const prices = await getPrices();
  const loveBalances = [];
  const addresses = [];
  const startPosition = fs
    .readFileSync(SNAPSHOT_CSV_PATH)
    .toString()
    .split("\n")
    .filter((v) => v !== "").length;

  console.log("starting at position", startPosition);
  for (let n = startPosition; n < addrs.length; n++) {
    if ((n - startPosition) % 2 === 0 && n !== startPosition) {
      // every 100 add to csv
      //https://snapshot.org/#/strategy/spreadsheet
      let str = "";
      while (loveBalances.length > 0) {
        str = str.concat(
          addresses[0]
            .toString()
            .concat(",")
            .concat(ethers.utils.formatEther(loveBalances[0]).toString())
            .concat("\n")
        );
        loveBalances.shift();
        addresses.shift();
        isFirstLine = false;
      }
      fs.appendFileSync(
        SNAPSHOT_CSV_PATH,
        isFirstLine ? str : str
      );
      console.log("processing address #", n, "of", addrs.length);
    }
    const addr = addrs[n];
    let loveBalance = ethers.BigNumber.from(0);
    for (let i = 0; i < prices.lps.length; i++) {
      const pendingLove = await loveFarmContract.pendingLove(i, addr, {
        blockTag: blockNumber,
      });
      const userInfo = await loveFarmContract.userInfo(i, addr, {
        blockTag: blockNumber,
      });
      const lpInLove = userInfo.amount
        .mul(prices.lps[i])
        .div(ethers.BigNumber.from(ethers.utils.parseEther("1")));
      loveBalance = loveBalance.add(pendingLove).add(lpInLove);
    }

    // faith calculation
    const faithBalance = await faithContract.balanceOf(addr, {
      blockTag: blockNumber,
    });
    const faithInLove = faithBalance;
    loveBalance = loveBalance.add(faithInLove);

    // war3 calculation
    const war3Balance = await war3Contract.balanceOf(addr, {
      blockTag: blockNumber,
    });
    const war3InLove = war3Balance
      .mul(prices.war3)
      .div(ethers.BigNumber.from(ethers.utils.parseEther("1")));
    loveBalance = loveBalance.add(war3InLove);

    loveBalance = loveBalance.toString();
    loveBalances.push(loveBalance);
    addresses.push(addr);
  }
  // const prices = createPrices(10);
};

main();
