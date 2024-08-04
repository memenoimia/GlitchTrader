// Use CommonJS require statements for module imports
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Create a readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to prompt the user with a question and wait for an answer
const askQuestion = (question) => {
  return new Promise((resolve) => rl.question(question, resolve));
};

// Function to write environment variables to a .env file
const writeEnvFile = (content) => {
  const envPath = path.resolve(__dirname, '../.env');
  fs.writeFileSync(envPath, content);
};

// Immediately Invoked Function Expression (IIFE) to setup environment variables
(async () => {
  try {
    // Prompt user for various inputs
    const privateKey = await askQuestion('Enter your private key: ');
    const microlamports = await askQuestion('Enter fee lamports (e.g., 50000 or 500000): ');
    const slippage = await askQuestion('Enter slippage tolerance (e.g., 100 for 1%): ');
    const priceCheckDelay = await askQuestion('Enter delay for price check in milliseconds (1000 = 1 second): ');
    const takeProfit = await askQuestion('Enter take profit (just the number, e.g., 10 or 20): ');
    const stopLoss = await askQuestion('Enter stop loss (just the number, e.g., 10 or 20): ');
    const maxSellRetries = await askQuestion('Enter the number of retry attempts for failed sell operations (e.g., 5 for default): ');

    // Prepare content for the .env file
    const envContent = `
PRIVATE_KEY=${privateKey}
MICROLAMPORTS=${microlamports}
SLIPPAGE=${slippage}
PRICE_CHECK_DELAY=${priceCheckDelay}
TAKE_PROFIT=${takeProfit}
STOP_LOSS=${stopLoss}
MAX_SELL_RETRIES=${maxSellRetries}
`;

    // Write the .env file
    writeEnvFile(envContent.trim());

    console.log('.env is now configured');
  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    rl.close(); // Close the readline interface
  }
})();
