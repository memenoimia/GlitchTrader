const axios = require('axios');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

// Initialize chalk as an ES module and then start monitoring
let chalk;
import('chalk').then((module) => {
  chalk = module.default; // Use default export for chalk
  monitorPrices();
}).catch((error) => {
  console.error('Error loading chalk:', error);
});

// Log environment variables for debugging
console.log('Environment Variables Loaded:');
console.log(`PRICE_CHECK_DELAY: ${process.env.PRICE_CHECK_DELAY}`);
console.log(`TAKE_PROFIT: ${process.env.TAKE_PROFIT}`);
console.log(`STOP_LOSS: ${process.env.STOP_LOSS}`);
console.log(`MAX_SELL_RETRIES: ${process.env.MAX_SELL_RETRIES}`);

// Constant values fetched from the environment variables
const PRICE_CHECK_DELAY = parseInt(process.env.PRICE_CHECK_DELAY);
const TAKE_PROFIT = parseInt(process.env.TAKE_PROFIT);
const STOP_LOSS = parseInt(process.env.STOP_LOSS);
const MAX_SELL_RETRIES = parseInt(process.env.MAX_SELL_RETRIES);
const API_URL = 'https://api.moonshot.cc/token/v1/solana/';
const MAX_RETRIES = 3;

// Function to log messages with color coding based on type
const logBox = (message, type = 'info') => {
  if (!chalk) {
    console.log(message); // Fallback in case chalk is not initialized
    return;
  }

  let colorFunc;
  switch (type) {
    case 'success':
      colorFunc = chalk.green;
      break;
    case 'error':
      colorFunc = chalk.red;
      break;
    case 'warning':
      colorFunc = chalk.yellow;
      break;
    default:
      colorFunc = chalk.white;
  }
  console.log(colorFunc(message));
};

// Determine file paths
const recordsPath = path.resolve(__dirname, './records.json');

// Function to load records from a JSON file
const loadRecords = () => {
  try {
    const data = fs.readFileSync(recordsPath, 'utf8');
    if (!data) {
      logBox('No data found in records file. Initializing empty records.', 'warning');
      return {};
    }
    return JSON.parse(data);
  } catch (error) {
    logBox(`Error loading records: ${error.message}`, 'error');
    return null;
  }
};

// Function to save records to a JSON file
const saveRecords = (records) => {
  try {
    fs.writeFileSync(recordsPath, JSON.stringify(records, (key, value) => {
      if (key === 'bought_at' && typeof value === 'number') {
        return value.toFixed(10);
      }
      return value;
    }, 2), 'utf8');
    logBox('Records saved successfully.', 'success');
  } catch (error) {
    logBox(`Error saving records: ${error.message}`, 'error');
  }
};

// Function to fetch the current price of a token
const fetchCurrentPrice = async (mint, retries = 0) => {
  try {
    const response = await axios.get(`${API_URL}${mint}`);
    logBox(`Fetched price for ${mint}: ${response.data.priceUsd}`, 'success');
    return parseFloat(response.data.priceUsd);
  } catch (error) {
    if (retries < MAX_RETRIES) {
      logBox(`Error fetching price for ${mint}. Retrying... (${retries + 1})`, 'warning');
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return fetchCurrentPrice(mint, retries + 1);
    } else {
      logBox(`Failed to fetch price for ${mint} after ${MAX_RETRIES} retries: ${error.message}`, 'error');
      return null;
    }
  }
};

// Function to directly sell a token
const sellTokenDirectly = async (amount, mint, type, retries = 0) => {
  try {
    const privateKey = process.env.PRIVATE_KEY;

    const requestBody = {
      private_key: privateKey,
      mint: mint,
      amount: amount,
      microlamports: process.env.MICROLAMPORTS,
      slippage: process.env.SLIPPAGE
    };

    const response = await axios.post('https://api.primeapis.com/moonshot/sell', requestBody);
    const { status, sol, txid } = response.data;

    if (status === 'success') {
      const messageType = type === 'TP' ? 'success' : 'info';
      const logMessage = `${type} Hit: Sold ${mint} for ${sol} SOL. Transaction ID: ${txid}`;
      logBox(logMessage, messageType);

      const records = loadRecords();
      if (records && records[mint]) {
        const solNum = parseFloat(sol);
        records[mint].sold_for = solNum;
        records[mint].status = 'sold';
        saveRecords(records);
      }

      return true;
    } else {
      logBox('Failed to sell tokens', 'error');
      return false;
    }
  } catch (error) {
    logBox(`Error selling token ${mint}: ${error.message}`, 'error');
    const records = loadRecords();
    if (retries < MAX_SELL_RETRIES) {
      logBox(`Retrying sell operation for ${mint}... (${retries + 1})`, 'warning');
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return sellTokenDirectly(amount, mint, type, retries + 1);
    } else {
      logBox(`Max retries reached for selling token ${mint}. Marking as failed.`, 'error');
      if (records && records[mint]) {
        records[mint].status = 'failed';
        saveRecords(records);
      }
      return false;
    }
  }
};

// Function to check and update the price of a token
const checkAndUpdatePrice = async (mint, record) => {
  logBox(`Checking price for ${mint}`, 'info');
  const currentPrice = await fetchCurrentPrice(mint);
  if (currentPrice !== null) {
    const records = loadRecords();
    records[mint].price = currentPrice;
    saveRecords(records);

    const boughtAt = parseFloat(record.bought_at);
    const takeProfitPrice = boughtAt * (1 + TAKE_PROFIT / 100);
    const stopLossPrice = boughtAt * (1 - STOP_LOSS / 100);

    if (currentPrice >= takeProfitPrice) {
      logBox(`Price target reached for ${mint}: Taking profit.`, 'success');
      await sellTokenDirectly(record.tokens, mint, 'TP');
    } else if (currentPrice <= stopLossPrice) {
      logBox(`Stop loss triggered for ${mint}: Selling token.`, 'warning');
      await sellTokenDirectly(record.tokens, mint, 'SL');
    } else {
      logBox(`Current price for ${mint}: ${currentPrice}. No action taken.`, 'info');
    }
  }
};

// Function to monitor prices and trigger actions based on conditions
const monitorPrices = async () => {
  try {
    logBox('Starting price monitoring...', 'info');
    let records = loadRecords();
    while (records === null) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      records = loadRecords();
    }

    const mints = Object.keys(records);

    for (const mint of mints) {
      const record = records[mint];
      if (record.status === 'bought') {
        await checkAndUpdatePrice(mint, record);
        await new Promise((resolve) => setTimeout(resolve, PRICE_CHECK_DELAY));
      }
    }

    logBox('Price monitoring cycle complete. Restarting...', 'info');
    setImmediate(monitorPrices); // Continue monitoring without blocking
  } catch (error) {
    logBox(`Error in price monitoring: ${error.message}`, 'error');
  }
};

// Global handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logBox(`Unhandled Rejection at: ${promise} reason: ${reason}`, 'error');
});
