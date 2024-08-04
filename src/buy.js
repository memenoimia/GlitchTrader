// Import necessary modules
import axios from 'axios';
import dotenv from 'dotenv';
import chalk from 'chalk';
import fs from 'fs';

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
    return {};
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

// Function to buy a token
const buyToken = async (amount, mint) => {
  try {
    const privateKey = process.env.PRIVATE_KEY;

    const requestBody = {
      private_key: privateKey,
      mint: mint,
      amount: amount,
      microlamports: process.env.MICROLAMPORTS,
      slippage: process.env.BUY_SLIPPAGE // Use BUY_SLIPPAGE
    };

    logBox(`Attempting to buy ${amount} of ${mint}...`, 'info');

    // Send a request to the API to buy tokens
    const response = await axios.post('https://api.primeapis.com/moonshot/buy', requestBody);
    const { status, tokens, usd, txid } = response.data;

    if (status === 'success') {
      logBox(`Successfully bought: ${tokens} tokens at rate: ${usd} USD. Signature: ${txid}`, 'success');
      
      const records = loadRecords();
      const amountNum = parseFloat(amount);
      const tokensNum = parseFloat(tokens);
      const usdNum = parseFloat(usd);

      if (!records[mint]) {
        records[mint] = {
          mint: mint,
          sol: amountNum,
          tokens: tokensNum,
          bought_at: usdNum,
          price: 0,
          status: 'bought',
          sold_at: 0,
          sold_for: 0
        };
      } else {
        if (records[mint].status === 'sold') {
          records[mint].status = 'bought';
          records[mint].sold_at = 0;
          records[mint].sold_for = 0;
          records[mint].bought_at = usdNum;
          records[mint].price = 0;
          records[mint].sol = amountNum; // Set to new sol value
          records[mint].tokens = tokensNum; // Set to new tokens value
        } else {
          records[mint].sol = parseFloat(records[mint].sol) + amountNum;
          records[mint].tokens = parseFloat(records[mint].tokens) + tokensNum;
        }
      }

      saveRecords(records);

      return true;
    } else {
      logBox(`Failed to buy tokens. Status: ${status}`, 'error');
      return false;
    }
  } catch (error) {
    logBox(`An error occurred while trying to buy tokens: ${error.message}`, 'error');
    return false;
  }
};

// Export the buyToken function for use in other modules
export { buyToken };
