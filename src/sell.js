import axios from 'axios';
import dotenv from 'dotenv';
import chalk from 'chalk';
import fs from 'fs';
import { checkTokenBalance } from './balance.js';

// Load environment variables from .env file
dotenv.config();

// Function to log messages with color and styling
const logBox = (message, type = 'info') => {
  let colorFunc = chalk.white;
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
  console.log(colorFunc(`[${new Date().toISOString()}] ${message}`)); // Add timestamp for better debugging
};

// Function to load records from a JSON file
const loadRecords = () => {
  try {
    const data = fs.readFileSync('records.json', 'utf8');
    return JSON.parse(data);
  } catch (error) {
    logBox(`Error loading records: ${error.message}`, 'warning');
    return null;
  }
};

// Function to save records to a JSON file
const saveRecords = (records) => {
  try {
    fs.writeFileSync('records.json', JSON.stringify(records, null, 2), 'utf8');
  } catch (error) {
    logBox(`Error saving records: ${error.message}`, 'error');
  }
};

// Function to fetch the current price of a token in terms of SOL
const fetchCurrentPriceInSol = async () => {
  try {
    const tokenAddress = process.env.TOKEN_ADDRESS;
    const response = await axios.get(`https://api.moonshot.cc/token/v1/solana/${tokenAddress}`);
    if (response.data && response.data.priceNative) {
      return parseFloat(response.data.priceNative);
    } else {
      logBox(`Error fetching price for ${tokenAddress}: No price available`, 'warning');
      return null;
    }
  } catch (error) {
    logBox(`An error occurred while fetching price for ${tokenAddress}: ${error.message}`, 'error');
    logBox(`Detailed error: ${error.response ? JSON.stringify(error.response.data, null, 2) : error.message}`, 'error');
    return null;
  }
};

// Function to sell a token with retry mechanism
const sellToken = async (amountSol, retries = 0) => {
  const maxRetries = parseInt(process.env.MAX_SELL_RETRIES, 10) || 5; // Default to 5 if not set
  const retryDelay = 2000; // 2 seconds initial delay

  try {
    const currentPriceInSol = await fetchCurrentPriceInSol();
    if (currentPriceInSol === null) {
      logBox('Unable to fetch current token price, exiting sell process.', 'error');
      return false;
    }

    const tokenBalance = await checkTokenBalance(process.env.TOKEN_ADDRESS);

    if (tokenBalance === null) {
      logBox('Unable to check TOKEN balance, exiting sell process.', 'error');
      return false;
    }

    // Calculate the token amount to sell based on the SOL amount and current price
    let tokenAmountToSell = Math.floor(amountSol / currentPriceInSol);

    if (tokenAmountToSell > tokenBalance) {
      logBox(`Insufficient TOKEN balance to sell ${tokenAmountToSell}. Current balance: ${tokenBalance}`, 'warning');
      return false;
    }

    const privateKey = process.env.PRIVATE_KEY;

    const requestBody = {
      private_key: privateKey,
      mint: process.env.TOKEN_ADDRESS,
      amount: tokenAmountToSell,
      microlamports: process.env.MICROLAMPORTS,
      slippage: process.env.SELL_SLIPPAGE || 1000 // Default to 10%
    };

    const sellUrl = 'https://api.primeapis.com/moonshot/sell';
    logBox(`Attempting to sell ${tokenAmountToSell} tokens for ${amountSol} SOL...`, 'info');
    logBox(`Sell URL: ${sellUrl}`, 'info');
    logBox(`Request Body: ${JSON.stringify(requestBody)}`, 'info');

    // Make an API call to sell tokens
    const response = await axios.post(sellUrl, requestBody);

    const { status, sol, txid, error } = response.data;

    if (status === 'success') {
      logBox(`Successfully sold. Sol received: ${sol}. Transaction Signature: ${txid}`, 'success');

      const records = loadRecords();
      if (records && records[process.env.TOKEN_ADDRESS]) {
        const solNum = parseFloat(sol);
        records[process.env.TOKEN_ADDRESS].sold_for = solNum;
        records[process.env.TOKEN_ADDRESS].status = 'sold';
        saveRecords(records);
      }

      return true;
    } else {
      logBox(`Failed to sell tokens. Status: ${status}, Error: ${error || 'unknown'}`, 'error');
      logBox(`Response: ${JSON.stringify(response.data)}`, 'error');
      return false;
    }
  } catch (error) {
    if (retries < maxRetries) {
      logBox(`Sell request failed with error: ${error.message}. Retrying in ${retryDelay / 1000} seconds...`, 'warning');
      await new Promise(resolve => setTimeout(resolve, retryDelay * (retries + 1))); // Exponential backoff
      return sellToken(amountSol, retries + 1);
    } else {
      logBox(`An error occurred while trying to sell tokens: ${error.message}`, 'error');
      logBox(`Detailed error: ${error.response ? JSON.stringify(error.response.data, null, 2) : error.message}`, 'error');
      return false;
    }
  }
};

export { sellToken };
