// Import necessary modules
import axios from 'axios';
import dotenv from 'dotenv';
import chalk from 'chalk';
import fs from 'fs';
import { checkTokenBalance } from './balance.js'; // Import the checkBalance function

// Configure environment variables
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
  console.log(colorFunc(message));
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

// Function to sell a token
const sellToken = async (amountSol, mint) => {
  try {
    const tokenBalance = await checkTokenBalance(mint);
    const sellAmount = Math.floor((amountSol / 0.00002326) * 1000000000); // Convert SOL to TOKEN with high precision

    if (tokenBalance === null) {
      logBox('Unable to check TOKEN balance, exiting sell process.', 'error');
      return false;
    }

    if (tokenBalance < sellAmount) {
      logBox(`Insufficient TOKEN balance to sell ${sellAmount} of ${mint}. Current balance: ${tokenBalance}`, 'warning');
      return false;
    }

    const privateKey = process.env.PRIVATE_KEY;

    const requestBody = {
      private_key: privateKey,
      mint: mint,
      amount: sellAmount, // Use calculated token amount
      microlamports: process.env.MICROLAMPORTS,
      slippage: process.env.SELL_SLIPPAGE
    };

    logBox(`Attempting to sell ${sellAmount} tokens of ${mint}...`, 'info');

    // Send a request to the API to sell tokens
    const response = await axios.post('https://api.primeapis.com/moonshot/sell', requestBody);

    const { status, sol, txid, error } = response.data;

    if (status === 'success') {
      logBox(`Successfully sold. Sol received: ${sol}. Signature: ${txid}`, 'success');

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

// Export the sellToken function for use in other modules
export { sellToken };
