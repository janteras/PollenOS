#!/usr/bin/env node

/**
 * Start script for Pollen Trading Bot on Base Sepolia
 * This script loads the correct configuration and starts the bot
 */

// Set environment variables
process.env.NODE_ENV = 'production';
process.env.NETWORK = 'base-sepolia';
process.env.CHAIN_ID = '84532';
process.env.RPC_URL = 'https://sepolia.base.org';
process.env.ENABLE_TRADINGVIEW = 'false';

// Load environment variables from base-sepolia.env if it exists
require('dotenv').config({ path: 'base-sepolia.env' });

// Import required modules
const { ethers } = require('ethers');
const logger = require('./src/modules/logger');
const config = require('./config/base-sepolia-config');

// Import bot components
const PollenTradingBot = require('./src/modules/pollen-trading-bot');
const PollenContractVerifier = require('./src/modules/pollen-verification');

async function startBot() {
  try {
    logger.info('🚀 Starting Pollen Trading Bot on Base Sepolia');
    
    // Initialize provider
    const provider = new ethers.JsonRpcProvider(config.network.rpcUrl);
    
    // Verify network
    const network = await provider.getNetwork();
    logger.info(`Connected to network: ${network.name} (Chain ID: ${network.chainId})`);
    
    if (network.chainId !== BigInt(config.network.chainId)) {
      throw new Error(`Incorrect network. Expected Base Sepolia (${config.network.chainId}), got ${network.chainId}`);
    }
    
    // Verify contracts
    const verifier = new PollenContractVerifier({
      ...config,
      provider
    });
    
    await verifier.verifyAll();
    
    // Initialize bot
    const bot = new PollenTradingBot({
      ...config,
      provider,
      tradingView: null // Disable TradingView for now
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
    logger.error('❌ Fatal error in bot:', error);
    process.exit(1);
  }
}

// Start the bot
startBot().catch(error => {
  logger.error('Unhandled error in bot startup:', error);
  process.exit(1);
});
