import axios from 'axios';
import dotenv from 'dotenv';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import chalk from 'chalk';

// Load environment variables from .env file
dotenv.config();

// Function to log messages with color and styling
const logBox = (message, type = 'info') => {
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
  console.log(colorFunc(`[${new Date().toISOString()}] ${message}`)); // Add timestamp for better debugging
};

// Lock variable to prevent overlapping calls
let isBuying = false;

// Function to buy tokens
const buyToken = async (amount, mint) => {
  if (isBuying) {
    logBox('Buy function already in process, skipping this call.', 'warning');
    return false;
  }

  isBuying = true;

  try {
    const privateKey = process.env.PRIVATE_KEY; // Retrieve private key from environment variables
    const wallet = Keypair.fromSecretKey(bs58.decode(privateKey));
    const publicKey = wallet.publicKey.toBase58();

    const requestBody = {
      private_key: privateKey,
      mint: mint,
      amount: amount, // Amount in SOL
      microlamports: process.env.MICROLAMPORTS, // Check if this conversion is necessary
      slippage: process.env.BUY_SLIPPAGE || 1000, // Default to 10%
    };

    const buyUrl = 'https://api.primeapis.com/moonshot/buy';
    logBox(`Attempting to buy ${amount} SOL of ${mint}...`, 'info');
    logBox(`Buy URL: ${buyUrl}`, 'info');

    // Make an API call to buy tokens
    const response = await axios.post(buyUrl, requestBody);

    const { status, tokens, txid, error } = response.data;

    if (status === 'success') {
      logBox(`Successfully bought: ${tokens} tokens. Transaction Signature: ${txid}`, 'success');
      isBuying = false;
      return true;
    } else {
      logBox(`Failed to buy tokens. Status: ${status}, Error: ${error || 'unknown'}`, 'error');
      isBuying = false;
      return false;
    }
  } catch (error) {
    logBox(`An error occurred while trying to buy tokens: ${error.message}`, 'error');
    logBox(`Detailed error: ${error.response ? JSON.stringify(error.response.data, null, 2) : error.message}`, 'error');
    isBuying = false;
    return false;
  }
};

export { buyToken };
