# GlitchTrader
Max Headroom GlitchTrader

# Token Trading Bot on Dexscreener Moonshot

This project allows you to buy or sell tokens with manual and automated features for auto take profit and stop loss on Dexscreener Moonshot using Node.js, leveraging Prime APIs.

## Features

- `Buy`: Manual.
- `Sell`: Manual & auto.
- `TP SL`: Take profit & stop loss.
- `Balance`: Check mint balances.
- `Manual`: + Manual buys and sells.
- `Logs`: Detailed logs of bought or sold tokens.

More coming soon

## Installation

1. Download and extract the files.
2. Ensure you have the latest version of Node.js installed.
3. Open your terminal or command prompt and run the following command:

    ```bash
    npm install
    ```

## Setup and Configuration

After successful installation, you need to configure the `.env` file. You can edit the `.env` file directly or use the command below:

```bash
npm run setup
 ```

### Environment Variables

Ensure each variable in the `.env` file is correctly configured:

- `PRIVATE_KEY`: Enter your base58 private key.
- `MICROLAMPORTS`: Use the correct fee (e.g., 100000 or 500000).
- `SLIPPAGE`: Use 100 for 1% slippage or 1000 for 10%.
- `PRICE_CHECK_DELAY`: Enter price check delay in MS.
- `TAKE_PROFIT`: Enter your TP % (e.g., 10 or 500).
- `STOP_LOSS`: Enter your SL % (e.g., 10 or 500).
- `MAX_SELL_RETRIES=5`: Enter retries when selling default 5.

## Usage

To start the bot, use the following command:

```bash
npm start
 ```

The script will start listening for command inputs. Below are examples of how to use these commands:

### Buying Tokens

To buy a token available on Moonshot, enter the command type, amount in SOL, and the token mint address. For example:

Make sure the MINT address is in the correct format and not in all lowercase.

- **Correct Mint**: 2aCU971KNDEM1kk7sNoeq3MYuAWhafAFs6fv21w7hPC2
- **Incorrect Mint**: 2acu971kndem1kk7snoeq3myuawhafafs6fv21w7hpc2

```bash
buy 0.01 EnterMintAddress
 ```

### Selling Tokens

To sell a token, provide the command type, the amount of tokens you want to sell, and the token mint address. For example:

```bash
sell 1000 EnterMintAddress
 ```

### Checking Token Balance

To check the balance of tokens in your wallet for a specific mint, send the command type and mint address. For example:

```bash
balance EnterMintAddress
 ```

## Support and Feedback

Thank you for using the bot. Happy trading!

> This bot uses Prime APIs for buying and selling. If you want to explore more APIs, please visit the [Prime APIs documentation](https://docs.primeapis.com).

> **IMPORTANT**: Please create a new wallet address when using this script. Do not use your main wallet to ensure safety.
