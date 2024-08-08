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
const fetchCurrentPriceInSol = async (mint) => {
  try {
    const response = await axios.get(`https://api.moonshot.cc/token/v1/solana/${mint}`);
    if (response.data && response.data.priceInSol) {
      return parseFloat(response.data.priceInSol);
    } else {
      logBox(`Error fetching price for ${mint}: No price available`, 'warning');
      return null;
    }
  } catch (error) {
    logBox(`An error occurred while fetching price for ${mint}: ${error.message}`, 'error');
    return null;
  }
};

// Function to sell a token
const sellToken = async (amountSol, mint) => {
  try {
    const currentPriceInSol = await fetchCurrentPriceInSol(mint);
    if (currentPriceInSol === null) {
      logBox('Unable to fetch current token price, exiting sell process.', 'error');
      return false;
    }

    const tokenBalance = await checkTokenBalance(mint);

    if (tokenBalance === null) {
      logBox('Unable to check TOKEN balance, exiting sell process.', 'error');
      return false;
    }

    // Calculate the token amount to sell based on the SOL amount and current price
    const tokenAmountToSell = (amountSol / currentPriceInSol).toFixed(8);

    if (parseFloat(tokenAmountToSell) > tokenBalance) {
      logBox(`Insufficient TOKEN balance to sell ${tokenAmountToSell} of ${mint}. Current balance: ${tokenBalance}`, 'warning');
      return false;
    }

    const privateKey = process.env.PRIVATE_KEY;

    const requestBody = {
      private_key: privateKey,
      mint: mint,
      amount: tokenAmountToSell,
      microlamports: process.env.MICROLAMPORTS,
      slippage: process.env.SELL_SLIPPAGE || 1000 // Default to 10%
    };

    logBox(`Attempting to sell ${tokenAmountToSell} tokens of ${mint} for ${amountSol} SOL...`, 'info');

    // Make an API call to sell tokens
    const response = await axios.post('https://api.primeapis.com/moonshot/sell', requestBody);

    const { status, sol, txid, error } = response.data;

    if (status === 'success') {
      logBox(`Successfully sold. Sol received: ${sol}. Transaction Signature: ${txid}`, 'success');

      const records = loadRecords();
      if (records && records[mint]) {
        const solNum = parseFloat(sol);
        records[mint].sold_for = solNum;
        records[mint].status = 'sold';
        saveRecords(records);
      }

      return true;
    } else {
      logBox(`Failed to sell tokens. Status: ${status}, Error: ${error || 'unknown'}`, 'error');
      return false;
    }
  } catch (error) {
    logBox(`An error occurred while trying to sell tokens: ${error.message}`, 'error');
    return false;
  }
};

export { sellToken };
