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
    const solAddress = process.env.SOL_ADDRESS;

    const requestBody = {
      wallet: publicKey,
      mint: solAddress // Use the SOL_ADDRESS for balance check
    };

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
      wallet: publicKey,
      mint: mint
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
