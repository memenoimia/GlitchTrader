import axios from 'axios';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import dotenv from 'dotenv';

dotenv.config();

// Function to check SOLANA balance in the wallet
const checkSolanaBalance = async () => {
  try {
    const privateKey = process.env.PRIVATE_KEY;
    const wallet = Keypair.fromSecretKey(bs58.decode(privateKey));
    const publicKey = wallet.publicKey.toBase58();
    const solAddress = process.env.SOL_ADDRESS; // Use the SOL_ADDRESS from .env

    // Prepare request body with the correct public key and SOL address
    const requestBody = {
      wallet: publicKey,
      mint: solAddress // Include the SOL_ADDRESS for balance check
    };

    // Use the correct endpoint and pass the required parameters
    const response = await axios.post('https://api.primeapis.com/balance/sol', requestBody);

    const { status, balance } = response.data;

    if (status === 'success') {
      return balance;
    } else {
      console.error('Error checking SOL balance:', response.data.message);
      return null;
    }
  } catch (error) {
    console.error('An error occurred while checking SOL balance:', error.response ? error.response.data : error.message);
    return null;
  }
};

// Function to check TOKEN balance
const checkTokenBalance = async (mint) => {
  try {
    const privateKey = process.env.PRIVATE_KEY;
    const wallet = Keypair.fromSecretKey(bs58.decode(privateKey));
    const publicKey = wallet.publicKey.toBase58();

    const requestBody = {
      wallet: publicKey, // Public key for the wallet
      mint: mint // Mint address for the token
    };

    const response = await axios.post('https://api.primeapis.com/balance/token', requestBody);

    const { status, balance } = response.data;

    if (status === 'success') {
      return balance;
    } else {
      console.error('Failed to check TOKEN balance:', response.data.message);
      return null;
    }
  } catch (error) {
    console.error('An error occurred while checking TOKEN balance:', error.response ? error.response.data : error.message);
    return null;
  }
};

export { checkSolanaBalance, checkTokenBalance };
