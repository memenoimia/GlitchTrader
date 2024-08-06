import axios from "axios";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import chalk from "chalk";
import { buyToken } from "./src/buy.js";
import { sellToken } from "./src/sell.js";
import { checkSolanaBalance, checkTokenBalance } from "./src/balance.js";

// Configure environment variables
dotenv.config();

// Load token address from environment variables
const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS;

// Log environment variables for debugging
console.log("Environment Variables Loaded:");
console.log(`PRICE_CHECK_DELAY: ${process.env.PRICE_CHECK_DELAY}`);
console.log(`TAKE_PROFIT: ${process.env.TAKE_PROFIT}`);
console.log(`STOP_LOSS: ${process.env.STOP_LOSS}`);
console.log(`MAX_SELL_RETRIES: ${process.env.MAX_SELL_RETRIES}`);
console.log(`BUY_AMOUNT: ${process.env.BUY_AMOUNT}`);
console.log(`SELL_AMOUNT: ${process.env.SELL_AMOUNT}`);
console.log(`BUY_SECONDS: ${process.env.BUY_SECONDS}`);
console.log(`SELL_SECONDS: ${process.env.SELL_SECONDS}`);
console.log(`BUY_SLIPPAGE: ${process.env.BUY_SLIPPAGE}`);
console.log(`SELL_SLIPPAGE: ${process.env.SELL_SLIPPAGE}`);
console.log(`Trading Token Address: ${TOKEN_ADDRESS}`);

// Constant values fetched from the environment variables
const PRICE_CHECK_DELAY = parseInt(process.env.PRICE_CHECK_DELAY);
const TAKE_PROFIT = parseInt(process.env.TAKE_PROFIT);
const STOP_LOSS = parseInt(process.env.STOP_LOSS);
const MAX_SELL_RETRIES = parseInt(process.env.MAX_SELL_RETRIES);
const BUY_AMOUNT = parseFloat(process.env.BUY_AMOUNT);
const SELL_AMOUNT = parseFloat(process.env.SELL_AMOUNT);
const BUY_SECONDS = parseInt(process.env.BUY_SECONDS) * 1000; // Convert to milliseconds
const SELL_SECONDS = parseInt(process.env.SELL_SECONDS) * 1000; // Convert to milliseconds
const API_URL = "https://api.moonshot.cc/token/v1/solana/";
const MAX_RETRIES = 3;

// Function to log messages with color coding based on type
const logBox = (message, type = "info") => {
  let colorFunc;
  switch (type) {
    case "success":
      colorFunc = chalk.green;
      break;
    case "error":
      colorFunc = chalk.red;
      break;
    case "warning":
      colorFunc = chalk.yellow;
      break;
    default:
      colorFunc = chalk.white;
  }
  console.log(colorFunc(message));
};

// Determine file paths
const recordsPath = path.resolve("./records.json");

// Function to load records from a JSON file
const loadRecords = () => {
  try {
    const data = fs.readFileSync(recordsPath, "utf8");
    if (!data) {
      logBox(
        "No data found in records file. Initializing empty records.",
        "warning"
      );
      return {};
    }
    return JSON.parse(data);
  } catch (error) {
    logBox(`Error loading records: ${error.message}`, "error");
    return null;
  }
};

// Function to save records to a JSON file
const saveRecords = (records) => {
  try {
    fs.writeFileSync(
      recordsPath,
      JSON.stringify(
        records,
        (key, value) => {
          if (key === "bought_at" && typeof value === "number") {
            return value.toFixed(10);
          }
          return value;
        },
        2
      ),
      "utf8"
    );
    logBox("Records saved successfully.", "success");
  } catch (error) {
    logBox(`Error saving records: ${error.message}`, "error");
  }
};

// Function to fetch the current price of a token
const fetchCurrentPrice = async (mint, retries = 0) => {
  try {
    const response = await axios.get(`${API_URL}${mint}`);
    logBox(`Fetched price for ${mint}: ${response.data.priceUsd}`, "success");
    return parseFloat(response.data.priceUsd);
  } catch (error) {
    if (retries < MAX_RETRIES) {
      logBox(
        `Error fetching price for ${mint}. Retrying... (${retries + 1})`,
        "warning"
      );
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return fetchCurrentPrice(mint, retries + 1);
    } else {
      logBox(
        `Failed to fetch price for ${mint} after ${MAX_RETRIES} retries: ${error.message}`,
        "error"
      );
      return null;
    }
  }
};

// Function to directly sell a token
const sellTokenDirectly = async (amountSol, mint, type, retries = 0) => {
  try {
    const success = await sellToken(amountSol, mint);
    if (success) {
      const messageType = type === "TP" ? "success" : "info";
      const logMessage = `${type} Hit: Sold ${mint}`;
      logBox(logMessage, messageType);

      const records = loadRecords();
      if (records && records[mint]) {
        records[mint].status = "sold";
        saveRecords(records);
      }

      return true;
    } else {
      logBox("Failed to sell tokens", "error");
      return false;
    }
  } catch (error) {
    logBox(`Error selling token ${mint}: ${error.message}`, "error");
    const records = loadRecords();
    if (retries < MAX_SELL_RETRIES) {
      logBox(
        `Retrying sell operation for ${mint}... (${retries + 1})`,
        "warning"
      );
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return sellTokenDirectly(amountSol, mint, type, retries + 1);
    } else {
      logBox(
        `Max retries reached for selling token ${mint}. Marking as failed.`,
        "error"
      );
      if (records && records[mint]) {
        records[mint].status = "failed";
        saveRecords(records);
      }
      return false;
    }
  }
};

// Function to check and update the price of a token
const checkAndUpdatePrice = async (mint, record) => {
  logBox(`Checking price for ${mint}`, "info");
  const currentPrice = await fetchCurrentPrice(mint);
  if (currentPrice !== null) {
    const records = loadRecords();
    records[mint].price = currentPrice;
    saveRecords(records);

    const boughtAt = parseFloat(record.bought_at);
    const takeProfitPrice = boughtAt * (1 + TAKE_PROFIT / 100);
    const stopLossPrice = boughtAt * (1 - STOP_LOSS / 100);

    // Display the current balances
    await displayBalances();

    if (currentPrice >= takeProfitPrice) {
      logBox(`Price target reached for ${mint}: Taking profit.`, "success");
      await sellTokenDirectly(SELL_AMOUNT, mint, "TP");
    } else if (currentPrice <= stopLossPrice) {
      logBox(`Stop loss triggered for ${mint}: Selling token.`, "warning");
      await sellTokenDirectly(SELL_AMOUNT, mint, "SL");
    } else {
      logBox(
        `Current price for ${mint}: ${currentPrice}. No action taken.`,
        "info"
      );
    }
  }
};

// Function to monitor prices and trigger actions based on conditions
const monitorPrices = async () => {
  try {
    logBox("Starting price monitoring...", "info");
    let records = loadRecords();
    while (records === null) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      records = loadRecords();
    }

    const mints = Object.keys(records);

    for (const mint of mints) {
      const record = records[mint];
      if (record.status === "bought") {
        await checkAndUpdatePrice(mint, record);
        await new Promise((resolve) => setTimeout(resolve, PRICE_CHECK_DELAY));
      }
    }

    logBox("Price monitoring cycle complete. Restarting...", "info");
    setImmediate(monitorPrices); // Continue monitoring without blocking
  } catch (error) {
    logBox(`Error in price monitoring: ${error.message}`, "error");
  }
};

// Function to periodically buy tokens
const periodicBuy = async () => {
  try {
    const success = await buyToken(BUY_AMOUNT, TOKEN_ADDRESS);
    if (success) {
      logBox(`Bought ${BUY_AMOUNT} of ${TOKEN_ADDRESS}`, "success");
    }
  } catch (error) {
    logBox(`Error in periodic buy: ${error.message}`, "error");
  }
};

// Function to periodically sell tokens
const periodicSell = async () => {
  try {
    const success = await sellToken(SELL_AMOUNT, TOKEN_ADDRESS);
    if (success) {
      logBox(`Sold ${SELL_AMOUNT} of ${TOKEN_ADDRESS}`, "success");
    }
  } catch (error) {
    logBox(`Error in periodic sell: ${error.message}`, "error");
  }
};

// Display the current balances
const displayBalances = async () => {
  try {
    const solBalance = await checkSolanaBalance();
    const tokenBalance = await checkTokenBalance(TOKEN_ADDRESS);
    logBox(`Current SOL balance: ${solBalance}`, "info");
    logBox(
      `Current TOKEN balance: ${tokenBalance} for ${TOKEN_ADDRESS}`,
      "info"
    );
  } catch (error) {
    logBox(`Error fetching balances: ${error.message}`, "error");
  }
};

// Initial display of balances
await displayBalances();

// Set intervals for buying and selling
setInterval(periodicBuy, BUY_SECONDS);
setInterval(periodicSell, SELL_SECONDS);

// Global handler for unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  logBox(`Unhandled Rejection at: ${promise} reason: ${reason}`, "error");
});

// Start monitoring prices
monitorPrices();
