const axios = require("axios").default;
const { Telegraf } = require("telegraf");
const web3 = require("@solana/web3.js");
const metaPlex = require("@metaplex-foundation/js");
const tgToken = "6883928470:AAHv9cpnjaVFjo5SqHBvbuvBpwRcndbRV0o";
const rpcURL =
  "https://wiser-weathered-vineyard.solana-mainnet.quiknode.pro/78ff15f7ed17f1807fc15e7535dbeb5756f179b5/";

const bot = new Telegraf(tgToken, { handlerTimeout: 9_000_000 });

const cmcURL = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest`;
const coinmarketcap_key = "24d06be6-dbcc-4bd3-bf24-c4f156546917";

const WSOL = "So11111111111111111111111111111111111111112";

const MIN = 0;
const MAX = 5;

const options = {
  method: "GET",
  headers: {
    "x-chain": "solana",
    "X-API-KEY": "97384de4c33b46789206f4f6837b30a6",
  },
};

function checkValidate(address) {
  // Check validation of address
  try {
    // Check Solana wallet validation.
    let pubKey = new web3.PublicKey(address);

    web3.PublicKey.isOnCurve(pubKey.toBuffer());

    return true;
  } catch {
    return false;
  }
}

async function runScanning(address) {
  // Get transaction of Solana chains
  console.log("waiting......");
  // ======================get sol price=====================================
  const options1 = {
    method: "GET",
    headers: { "X-API-KEY": "97384de4c33b46789206f4f6837b30a6" },
  };
  let solPrice = 0;
  await fetch(
    "https://public-api.birdeye.so/public/price?address=So11111111111111111111111111111111111111112",
    options1
  )
    .then((response) => response.json())
    .then((response) => (solPrice = response.data.value))
    .catch((err) => console.error(err));
  // =========================================================================
  let pubKey = new web3.PublicKey(address);
  let connection = new web3.Connection(rpcURL);

  let latestSigns = await connection.getSignaturesForAddress(pubKey);

  // Get latest 24 hours transactions
  const now = Math.round(new Date().getTime() / 1000);
  const before = now - 24 * 3600;
  //   console.log('time', now, before)

  //console.log("time", now, before);
  latestSigns = latestSigns.filter(
    (each) => each.blockTime && each.blockTime >= before
  );

  // Return only signature id
  let latestTxn1000 = latestSigns.map((each) => {
    // console.log(each)
    return each.signature;
  });

   let latestTxns = latestTxn1000

  //let latestTxns = latestTxn1000.slice(MIN, MAX);

  let replyText =
    " --------------- analysis transactions ------------------ \n";
  let replyArr = [];
  let emoji = "",
    plus = "";

  let totalSolDiff = 0;
  let totalWSolDiff = 0;
  let totalSolDiffPrice = 0;
  let totalWSolDiffPrice = 0;

  for (let each_signature of latestTxns) {
    // console.log("**************************");
    let detailed = await connection.getParsedTransaction(each_signature, {
      maxSupportedTransactionVersion: 0,
    });

    // console.log(detailed, "= Detailed ==");

    // Calculate SOL differences
    let preBalances = detailed.meta.preBalances;
    let postBalances = detailed.meta.postBalances;

    let amountPreBalances = 0;
    let loop = 0;
    for (loop of preBalances) {
      amountPreBalances += loop;
    }
    let amountPostBalances = 0;
    for (loop of postBalances) {
      amountPostBalances += loop;
    }

    solDiff = (amountPostBalances - amountPreBalances) / 10 ** 9;

    plus = "";
    emoji = "";

    if (solDiff > 0) {
      let plus = "+";
      emoji = "  🔵";
    } else if (solDiff < 0) {
      emoji = "  🔴";
    }

    totalSolDiff += solDiff;

    replyText += "----- \n";
    replyText += "Native SOL : " + plus + solDiff + emoji + "\n";

    // Calculate SPL_Token differences
    let preTokenBalances = detailed.meta.preTokenBalances.map((item) => {
      return item;
    });

    let postTokenBalances = detailed.meta.postTokenBalances.map((item) => {
      return item;
    });

    let lengthDiff = postTokenBalances.length - preTokenBalances.length;
    let eachArr = [];
    let postloop = 0,
      preloop = 0;
    if (lengthDiff >= 0) {
      for (postloop = 0; postloop < postTokenBalances.length; postloop++) {
        accountIndex = postTokenBalances[postloop].accountIndex;
        // console.log(accountIndex, "postAccountIndex");
        let containIndex = 0;
        let tokenDiff = 0;
        for (preloop = 0; preloop < preTokenBalances.length; preloop++) {
          if (accountIndex == preTokenBalances[preloop].accountIndex) {
            containIndex = 1;
            tokenDiff =
              postTokenBalances[postloop].uiTokenAmount.uiAmount -
              preTokenBalances[preloop].uiTokenAmount.uiAmount;
            break;
          }
        }
        if (containIndex == 0) {
          tokenDiff = postTokenBalances[postloop].uiTokenAmount.uiAmount;
        }

        // console.log(tokenDiff, " = tokenDiff");
        if (tokenDiff != 0) {
          let pubKey1 = new web3.PublicKey(postTokenBalances[postloop].mint);
          let metaplexProvider = metaPlex.Metaplex.make(connection);

          // ==============================get token price==================================
          let price = 0;
          await fetch(
            `https://public-api.birdeye.so/public/history_price?address=${pubKey1}&address_type=token&time_from=${before}&time_to=${now}`,
            options
          )
            .then((response) => response.json())
            .then((response) => {
              priceJson = response.data?.items;
              price = priceJson[0].value;
            })
            .catch((err) => console.error(err));

          // ===============================================================================
          let metadataAccount = metaplexProvider
            .nfts()
            .pdas()
            .metadata({ mint: pubKey1 });

          let metadataAccountInfo = await connection.getAccountInfo(
            metadataAccount
          );

          let tokenInfo = {};
          if (metadataAccountInfo) {
            tokenInfo = await metaplexProvider
              .nfts()
              .findByMint({ mintAddress: pubKey1 });
          } else {
            tokenInfo = {
              symbol: postTokenBalances[postloop].mint,
              name: postTokenBalances[postloop].mint,
              decimals: postTokenBalances[postloop].uiTokenAmount.decimals,
            };
          }
          emoji = "";
          plus = "";
          if (tokenDiff > 0) {
            plus = "+";
            emoji = "  🔵";
          } else if (tokenDiff < 0) {
            emoji = "  🔴";
          } else {
            emoji = "";
          }

          if (postTokenBalances[postloop].mint == WSOL) {
            totalWSolDiff += tokenDiff;
            totalWSolDiffPrice += Number(tokenDiff * price).toFixed(8);
          }
          //   =========================================================================
          replyText +=
            tokenInfo.symbol +
            " : " +
            plus +
            tokenDiff +
            emoji +
            " pnl: " +
            tokenDiff * price +
            " $" +
            "\n";
          const eachObj = {
            [tokenInfo.symbol]: tokenDiff * price,
            "balance change": tokenDiff,
          };
          eachArr.push(eachObj);
        }
      }
    } else {
      for (preloop = 0; preloop < preTokenBalances.length; preloop++) {
        accountIndex = preTokenBalances[preloop].accountIndex;
        let containIndex = 0;
        let tokenDiff = 0;
        for (postloop = 0; postloop < preTokenBalances.length; postloop++) {
          if (accountIndex == preTokenBalances[postloop].accountIndex) {
            containIndex = 1;
            tokenDiff =
              postTokenBalances[postloop].uiTokenAmount.uiAmount -
              preTokenBalances[preloop].uiTokenAmount.uiAmount;
            break;
          }
        }
        if (containIndex == 0) {
          tokenDiff = 0 - preTokenBalances[preloop].uiTokenAmount.uiAmount;
        }

        if (tokenDiff != 0) {
          let pubKey1 = new web3.PublicKey(preTokenBalances[preloop].mint);
          let metaplexProvider = metaPlex.Metaplex.make(connection);
          // ==============================get token price==================================
          let price = 0;
          await fetch(
            `https://public-api.birdeye.so/public/history_price?address=${pubKey1}&address_type=token&time_from=${before}&time_to=${now}`,
            options
          )
            .then((response) => response.json())
            .then((response) => {
              priceJson = response.data?.items;
              price = priceJson[0].value;
            })
            .catch((err) => console.error(err));

          // ===============================================================================

          let metadataAccount = metaplexProvider
            .nfts()
            .pdas()
            .metadata({ mint: pubKey1 });

          let metadataAccountInfo = await connection.getAccountInfo(
            metadataAccount
          );

          let tokenInfo = {};
          if (metadataAccountInfo) {
            tokenInfo = await metaplexProvider
              .nfts()
              .findByMint({ mintAddress: pubKey1 });
          } else {
            tokenInfo = {
              symbol: preTokenBalances[preloop].mint,
              name: preTokenBalances[preloop].mint,
              decimals: preTokenBalances[preloop].uiTokenAmount.decimals,
            };
          }
          emoji = "";
          plus = "";
          if (tokenDiff > 0) {
            plus = "+";
            emoji = "  🔵";
          } else if (tokenDiff < 0) {
            emoji = "  🔴";
          } else {
            emoji = "";
          }

          if (preTokenBalances[preloop].mint == WSOL) {
            totalWSolDiff += tokenDiff;
            totalWSolDiffPrice += Number(tokenDiff * price).toFixed(8);
          }

          replyText +=
            tokenInfo.symbol +
            " : " +
            plus +
            tokenDiff +
            emoji +
            " pnl: " +
            tokenDiff * price +
            " $" +
            "\n";
          const eachObj = {
            [tokenInfo.symbol]: tokenDiff * price,
            "balance change": tokenDiff,
          };
          eachArr.push(eachObj);
        }
      }
    }

    replyArr.push(eachArr);
  }
  const newArr = replyArr.flat();

  const totalSolPrice = Number(totalSolDiff * solPrice).toFixed;

  // ======================================================================
  const result = {};
  newArr.forEach((obj) => {
    const key = Object.keys(obj)[0];
    const value = obj[key];

    if (result[key]) {
      result[key] += value;
    } else {
      result[key] = value;
    }
  });

  const groupedArray = Object.keys(result).map((key) => ({
    [key]: result[key],
  }));
  // Convert result to array of objects
  // =======================return text=================================
  let returnText = " --------------PNL groupby token ----------------- \n";
  let totalPrice = 0;
  groupedArray.forEach((obj) => {
    const key = Object.keys(obj)[0];
    const value = obj[key].toFixed(8);
    // totalPrice += value.toFixed(8)
    const balance = Object.keys(obj)[1];

    if (value > 0) {
      returnText += `${key} : +${value} $  🔵\n`;
    } else {
      returnText += `${key} :  ${value} $  🔴\n`;
    }
    totalPrice += Number(value);
  });
  totalPrice = totalPrice.toFixed(8);
  // returnText += '**** Total PNL ****  \n\n'
  returnText += `PNL price: ${totalPrice} $ \n`;
  // ===================================================================
  // replyText += '\n **** Total ****  \n\n'
  // if (totalSolDiff > 0) {
  //   replyText +=
  //     'Native Sol : + ' +
  //     totalSolDiff +
  //     ' price:' +
  //     totalSolPrice +
  //     '  😍😍😍 \n\n'
  // } else if (totalSolDiff < 0) {
  //   replyText +=
  //     'Native Sol : ' +
  //     totalSolDiff +
  //     ' price:' +
  //     totalSolPrice +
  //     '  😡😡😡 \n\n'
  // } else {
  //   replyText += 'Native Sol : 0 \n\n'
  // }

  // if (totalWSolDiff > 0) {
  //   replyText +=
  //     'Wrapped Sol : + ' +
  //     totalWSolDiff +
  //     ' price:' +
  //     totalWSolDiffPrice +
  //     '  😍😍😍 \n\n'
  // } else if (totalWSolDiff < 0) {
  //   replyText +=
  //     'Wrapped Sol : ' +
  //     totalWSolDiff +
  //     ' price:' +
  //     totalWSolDiffPrice +
  //     '  😡😡😡 \n\n'
  // } else {
  //   replyText += 'Wrapped Sol : 0 \n\n'
  // }

  replyText +=
    // 'Total PNL = ' + Number(totalWSolDiffPrice) + Number(totalSolPrice) + '\n'
    "Total PNL = " + Number(totalPrice) + " $" + "\n";

  replyText += "------------ END ♥♥♥------------- \n";
  console.log("-----------finished!---------------");
  console.log(returnText + replyText);
  return returnText + replyText;
  // return returnText
}

bot.start((ctx) => ctx.reply("🙌🙌 Welcome To Solana PNL Bot 😁😁"));

bot.on("text", async (ctx) => {
  let validate = checkValidate(ctx.message.text);
  if (validate) {
    let response = await runScanning(ctx.message.text);
    await ctx.reply(response);
    // runScanning(ctx.message.text);
  } else {
    await ctx.reply("ERR: This is not Solana wallet");
  }
});

bot.launch();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

// runScanning("");
