#!/usr/bin/env node

/**
 * Pollen Trading Bot - Base Sepolia Network
 * This script starts the bot with Base Sepolia network configuration
 */

require('dotenv').config({ path: '.env.sepolia' });
const { ethers } = require('ethers');
const logger = require('../src/modules/logger');
const baseSepoliaConfig = require('../src/config/networks/base-sepolia');

// Force Base Sepolia network
process.env.NETWORK = 'base-sepolia';
process.env.CHAIN_ID = '84532';
process.env.RPC_URL = baseSepoliaConfig.rpcUrl;

// Set contract addresses from config
Object.entries(baseSepoliaConfig.contracts).forEach(([key, value]) => {
  process.env[`${key.toUpperCase()}_ADDRESS`] = value;
});

// Log startup info
logger.info(`Starting Pollen Trading Bot on ${baseSepoliaConfig.name}`);
logger.info(`RPC URL: ${baseSepoliaConfig.rpcUrl}`);
logger.info('Contract Addresses:', baseSepoliaConfig.contracts);

// Import and start the patched main bot
const main = require('../src/index.patched');

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the bot
main().catch(error => {
  logger.error('Failed to start bot:', error);
  process.exit(1);
});
