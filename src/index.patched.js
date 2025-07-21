#!/usr/bin/env node

/**
 * Pollen Trading Bot - Base Sepolia Version
 * This version runs on Base Sepolia network with optional TradingView integration
 */

require('dotenv').config({ path: '.env.sepolia' });
const { ethers } = require('ethers');
const logger = require('./modules/logger');

// Import custom modules
const PollenTradingBot = require('./modules/pollen-trading-bot');
const PollenContractVerifier = require('./modules/pollen-verification');
const notificationManager = require('./modules/notification-manager');

// Load configuration
const config = require('./config');

// Make TradingView optional
const enableTradingView = process.env.ENABLE_TRADINGVIEW !== 'false';
let tradingView = null;

if (enableTradingView) {
  try {
    const TradingViewIntegration = require('./modules/tradingview-integration');
    tradingView = new TradingViewIntegration(config);
    logger.info('TradingView integration enabled');
  } catch (error) {
    logger.warn('Failed to initialize TradingView integration:', error.message);
    logger.warn('Continuing without TradingView integration');
  }
} else {
  logger.info('TradingView integration is disabled by configuration');
}

// Main function
async function main() {
  try {
    logger.info('🚀 Starting Pollen Trading Bot on Base Sepolia');
    
    // Verify network
    const provider = new ethers.JsonRpcProvider(config.network.rpcUrl);
    const network = await provider.getNetwork();
    logger.info(`Connected to network: ${network.name} (Chain ID: ${network.chainId})`);
    
    if (network.chainId !== 84532n) {
      throw new Error(`Incorrect network. Expected Base Sepolia (84532), got ${network.chainId}`);
    }
    
    // Initialize components
    const verifier = new PollenContractVerifier(config);
    await verifier.verifyAll();
    
    // Initialize bot
    const bot = new PollenTradingBot({
      ...config,
      provider,
      tradingView
    });
    
    // Start the bot
    await bot.initialize();
    await bot.start();
    
    logger.info('✅ Bot is running and ready to trade');
    
    // Handle graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down bot...');
      await bot.stop();
      process.exit(0);
    };
    
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    
  } catch (error) {
    logger.error('❌ Fatal error in main process:', error);
    process.exit(1);
  }
}

// Run the bot
main().catch(error => {
  logger.error('Unhandled error in main process:', error);
  process.exit(1);
});
