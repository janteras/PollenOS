# Pollen Trading Bot - Base Sepolia Testnet Setup

This guide explains how to set up and run the Pollen trading bot on the Base Sepolia testnet.

## Prerequisites

1. Node.js (v16 or later)
2. npm or yarn
3. A wallet with testnet ETH on Base Sepolia
4. API keys for Alchemy and Infura
5. (Optional) Telegram bot token for notifications

## Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment Variables**
   Copy the example environment file and update it with your configuration:
   ```bash
   cp .env.sepolia .env
   ```
   
   Edit the `.env` file and set the following variables:
   - `PRIVATE_KEY`: Your wallet's private key with testnet ETH
   - `BOT_WALLET_ADDRESS`: Your wallet address
   - `ALCHEMY_API_KEY`: Your Alchemy API key
   - `INFURA_API_KEY`: Your Infura API key
   - (Optional) `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` for notifications

3. **Verify Setup**
   Run the verification script to check your configuration:
   ```bash
   npm run sepolia:verify
   ```

## Running the Bot

To start the bot on Base Sepolia testnet:

```bash
npm run sepolia:start
```

## Monitoring the Bot

- View logs:
  ```bash
  npm run sepolia:logs
  ```

- Monitor bot status:
  ```bash
  npm run sepolia:monitor
  ```

## Testing (Optional)

Run tests on Base Sepolia:
```bash
npm run sepolia:test
```

## Troubleshooting

1. **Connection Issues**
   - Verify your RPC URL is correct
   - Check if your node is synced
   - Ensure you have a stable internet connection

2. **Transaction Failures**
   - Check gas prices and adjust if necessary
   - Ensure your wallet has enough testnet ETH
   - Verify contract addresses are correct

3. **API Rate Limits**
   - If you hit rate limits, consider upgrading your API plan
   - Add more RPC endpoints for failover

## Security Notes

- Never commit your private keys or API keys to version control
- Use environment variables for sensitive information
- Regularly update your dependencies
- Monitor your bot's activity and set up alerts

## Support

For issues and feature requests, please open an issue on GitHub.
