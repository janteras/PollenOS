require('dotenv').config({ path: require('path').resolve(__dirname, '../base-sepolia.env') });
const { ethers } = require('ethers');
const LivePollenTradingBot = require('../src/live-trading-bot');
const logger = require('../src/modules/logger');
const config = require('../scripts/load-base-sepolia-config');

// Override the config with Base Sepolia settings
Object.assign(global.config, config);

// Initialize and start the bot
async function startBot() {
  try {
    logger.info('🚀 Starting Pollen Trading Bot on Base Sepolia Testnet...');
    
    // Verify environment variables
    if (!process.env.WALLET_PRIVATE_KEY) {
      throw new Error('WALLET_PRIVATE_KEY is not set in base-sepolia.env');
    }
    
    // Initialize provider and wallet
    const provider = new ethers.JsonRpcProvider(config.network.rpcUrl);
    const wallet = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, provider);
    
    // Verify wallet has ETH for gas
    const balance = await provider.getBalance(wallet.address);
    const minBalance = ethers.parseEther('0.01'); // Minimum 0.01 ETH for gas
    
    logger.info(`💰 Wallet ${wallet.address} balance: ${ethers.formatEther(balance)} ETH`);
    
    if (balance < minBalance) {
      logger.warn(`⚠️  Low balance: ${ethers.formatEther(balance)} ETH. You may need to get testnet ETH from a Base Sepolia faucet.`);
      logger.info('💧 Get testnet ETH from: https://www.base.org/faucet');
    }
    
    // Create and start the bot
    logger.info('Initializing trading bot...');
    const bot = new LivePollenTradingBot();
    
    // Handle process signals for graceful shutdown
    const shutdown = async () => {
      logger.info('🛑 Received shutdown signal. Stopping bot gracefully...');
      try {
        await bot.stop();
        logger.info('✅ Bot stopped successfully');
        process.exit(0);
      } catch (error) {
        logger.error(`❌ Error during shutdown: ${error.message}`);
        process.exit(1);
      }
    };
    
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    
    // Start the bot
    await bot.initialize();
    await bot.start();
    
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
