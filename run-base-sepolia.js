require('dotenv').config();
const { ethers } = require('ethers');
const LivePollenTradingBot = require('./src/live-trading-bot');
const logger = require('./src/modules/logger');
const config = require('./src/config');

// Override config for Base Sepolia
config.network = {
  name: 'base-sepolia',
  chainId: 84532,
  rpcUrl: 'https://sepolia.base.org',
  explorerUrl: 'https://sepolia.basescan.org',
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18
  }
};

// Initialize and start the bot
async function startBot() {
  try {
    logger.info('🚀 Starting Pollen Trading Bot on Base Sepolia...');
    
    // Verify environment variables
    if (!process.env.WALLET_PRIVATE_KEY) {
      throw new Error('WALLET_PRIVATE_KEY is not set in .env file');
    }
    
    // Initialize provider and wallet
    const provider = new ethers.JsonRpcProvider(config.network.rpcUrl);
    const wallet = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, provider);
    
    // Verify wallet has ETH for gas
    const balance = await provider.getBalance(wallet.address);
    if (balance === 0n) {
      throw new Error('Wallet has 0 ETH. Please fund your wallet with testnet ETH from a Base Sepolia faucet');
    }
    
    logger.info(`💰 Wallet ${wallet.address} balance: ${ethers.formatEther(balance)} ETH`);
    
    // Create and start the bot
    const bot = new LivePollenTradingBot();
    await bot.initialize();
    await bot.start();
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('🛑 Shutting down bot...');
      await bot.stop();
      process.exit(0);
    });
    
  } catch (error) {
    logger.error(`❌ Failed to start bot: ${error.message}`);
    if (error.stack) {
      logger.debug(error.stack);
    }
    process.exit(1);
  }
}

// Start the bot
startBot();
