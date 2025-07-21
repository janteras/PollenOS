#!/usr/bin/env node

require('dotenv').config({ path: require('path').resolve(__dirname, '.wallets') });
const AdvancedTradingBot = require('./advanced-trading-bot');
const { ethers } = require('ethers');

// Initialize the bot
const bot = new AdvancedTradingBot();

// Set up logging
console.log('🚀 Initializing Trading Bot...');
console.log(`Network: ${process.env.NETWORK || 'mainnet'}`);
console.log(`Wallet: ${bot.wallet.address}`);
console.log('----------------------------------------');

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
  // Attempt to restart the bot after an error
  setTimeout(() => {
    console.log('🔄 Attempting to restart bot...');
    startBot();
  }, 10000);
});

process.on('uncaughtException', (error) => {
  console.error('⚠️ Uncaught Exception:', error);
  // Don't restart automatically for uncaught exceptions
  process.exit(1);
});

// Event handlers
function setupEventHandlers() {
  // Bot lifecycle events
  bot.on('start', () => {
    console.log('✅ Bot started successfully');
    console.log('----------------------------------------');
  });

  bot.on('stop', () => {
    console.log('🛑 Bot stopped');
  });

  bot.on('error', (error) => {
    console.error('❌ Bot error:', error);
  });

  // Trading events
  bot.on('trade', (trade) => {
    console.log('💰 Trade executed:', trade);
  });

  bot.on('rebalance', (portfolio) => {
    console.log('⚖️ Portfolio rebalanced:', portfolio);
  });
}

// Start the bot
async function startBot() {
  try {
    setupEventHandlers();
    await bot.start();
    console.log('🎯 Trading bot is now running...');
  } catch (error) {
    console.error('💥 Failed to start bot:', error);
    process.exit(1);
  }
}

// Start the application
startBot();
    console.error('❌ Bot error:', error);
  });

  // Trading events
  bot.on('strategy:start', (data) => {
    console.log(`\n📈 Strategy execution started (${data.strategy})`);
    console.log(`Block: ${data.blockNumber}`);
  });

  bot.on('strategy:complete', (data) => {
    console.log(`✅ Strategy execution completed in ${data.duration}ms`);
    if (data.error) {
      console.error('Strategy error:', data.error);
    }
    console.log('----------------------------------------');
  });

  bot.on('rebalance', (data) => {
    console.log('\n🔄 Portfolio Rebalanced');
    console.log('New Weights:', data.weights);
    console.log('Short Positions:', data.isShort);
    console.log(`Tx: ${data.txHash}`);
  });

  bot.on('deposit', (data) => {
    console.log('\n💵 Deposit Received');
    console.log(`From: ${data.user}`);
    console.log(`Amount: ${ethers.utils.formatEther(data.amount)} PLN`);
    console.log(`Tx: ${data.txHash}`);
  });

  bot.on('portfolio:update', (portfolio) => {
    console.log('\n📊 Portfolio Update');
    
    // Safely format portfolio balance
    const formatValue = (value) => {
      try {
        return value ? ethers.utils.formatEther(value) : '0.0';
      } catch (error) {
        console.error('Error formatting value:', error);
        return '0.0';
      }
    };
    
    console.log('Total Value:', formatValue(portfolio.balance), 'PLN');
    console.log('Open:', portfolio.isOpen ? 'Yes' : 'No');
    
    // Define asset symbols for display (update this based on your actual assets)
    const assetSymbols = ['WBTC', 'WETH', 'LINK', 'USDC', 'USDT', 'DAI', 'cbETH'];
    
    // Log positions if available
    if (portfolio.assetAmounts && Array.isArray(portfolio.assetAmounts)) {
      console.log('Positions:');
      portfolio.assetAmounts.forEach((amount, i) => {
        try {
          const amountBN = ethers.BigNumber.from(amount || '0');
          if (amountBN.gt(0)) {
            const symbol = assetSymbols[i] || `Asset ${i}`;
            const positionType = portfolio.isShort && portfolio.isShort[i] ? 'SHORT' : 'LONG';
            console.log(`- ${symbol}: ${ethers.utils.formatEther(amountBN)} (${positionType})`);
          }
        } catch (error) {
          console.error(`Error processing position ${i}:`, error);
        }
      });
    } else {
      console.log('No positions data available');
    }
  });

  // Market data events
  bot.on('market:update', (data) => {
    console.log(`\n📊 Market Data Updated (${new Date().toISOString()})`);
    
    if (!data || !data.prices) {
      console.log('No market data available');
      return;
    }
    
    console.log('Current Prices:');
    Object.entries(data.prices).forEach(([symbol, assetData]) => {
      try {
        if (assetData && typeof assetData === 'object') {
          // Handle object with price data
          const price = assetData.price || 0;
          const change24h = assetData.priceChange24h || 0;
          const changeStr = change24h >= 0 ? `+${change24h.toFixed(2)}%` : `${change24h.toFixed(2)}%`;
          console.log(`- ${symbol}: $${price.toFixed(2)} (${changeStr} 24h)`);
        } else if (typeof assetData === 'number') {
          // Handle simple number price
          console.log(`- ${symbol}: $${assetData.toFixed(2)}`);
        }
      } catch (error) {
        console.error(`Error processing ${symbol} price:`, error);
      }
    });
  });

  // Performance metrics
  bot.on('metrics:update', (metrics) => {
    console.log('\n📊 Performance Metrics');
    console.log(`Portfolio Return: ${(metrics.returns * 100).toFixed(2)}%`);
    console.log(`Volatility: ${(metrics.volatility * 100).toFixed(2)}%`);
    console.log(`Sharpe Ratio: ${metrics.sharpeRatio.toFixed(2)}`);
    console.log(`Max Drawdown: ${(metrics.maxDrawdown * 100).toFixed(2)}%`);
  });
}

// Start the bot
async function startBot() {
  try {
    setupEventHandlers();
    
    // Start the bot with default strategy
    await bot.start();
    
        // Log initial portfolio state
    const portfolio = await bot.portfolioManager.getPortfolioDetails(bot.wallet.address);
    console.log('\n🏦 Initial Portfolio State');
    console.log('---------------------------');
    console.log('Owner:', bot.wallet.address);
    console.log('Total Value:', ethers.utils.formatEther(portfolio.balance || '0'), 'PLN');
    console.log('Open:', portfolio.isOpen);
    console.log('Positions:');
    
    // Define asset symbols for display (update this based on your actual assets)
    const assetSymbols = ['WBTC', 'WETH', 'LINK', 'USDC', 'USDT', 'DAI', 'cbETH'];
    
    // Log each position
    if (portfolio.assetAmounts && Array.isArray(portfolio.assetAmounts)) {
      portfolio.assetAmounts.forEach((amount, i) => {
        const amountBN = ethers.BigNumber.from(amount || '0');
        if (amountBN.gt(0)) {
          const symbol = assetSymbols[i] || `Asset ${i}`;
          const positionType = portfolio.isShort && portfolio.isShort[i] ? 'SHORT' : 'LONG';
          console.log(`- ${symbol}: ${ethers.utils.formatEther(amountBN)} (${positionType})`);
        }
      });
    } else {
      console.log('No positions found');
    }
    
  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT. Stopping bot...');
  try {
    await bot.stop();
    process.exit(0);
  } catch (error) {
    console.error('Error stopping bot:', error);
    process.exit(1);
  }
});

// Start the bot
startBot().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
#!/usr/bin/env node

/**
 * Pollen Trading Bot - Base Sepolia Network
 * Main entry point for running the bot as specified in requirements
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../base-sepolia.env') });
const { ethers } = require('ethers');
const logger = require('../src/modules/logger');
const PollenTradingBot = require('../src/modules/pollen-trading-bot');
const PollenContractVerifier = require('../src/modules/pollen-verification');
const config = require('../config/base-sepolia-config');

// Force Base Sepolia network configuration
process.env.NETWORK = 'base-sepolia';
process.env.CHAIN_ID = '84532';
process.env.RPC_URL = 'https://sepolia.base.org';

async function startBot() {
  try {
    logger.info('🚀 Starting Pollen Trading Bot on Base Sepolia...');
    logger.info(`Network: ${config.network.name} (Chain ID: ${config.network.chainId})`);
    logger.info(`RPC URL: ${config.network.rpcUrl}`);
    
    // Verify environment variables
    if (!process.env.WALLET_PRIVATE_KEY) {
      throw new Error('WALLET_PRIVATE_KEY is not set in base-sepolia.env');
    }
    
    // Initialize provider and verify network
    const provider = new ethers.JsonRpcProvider(config.network.rpcUrl);
    const network = await provider.getNetwork();
    
    if (Number(network.chainId) !== config.network.chainId) {
      throw new Error(`Wrong network. Expected Base Sepolia (${config.network.chainId}), got ${network.chainId}`);
    }
    
    logger.info(`✅ Connected to ${network.name} (Chain ID: ${network.chainId})`);
    
    // Initialize wallet and check balance
    const wallet = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, provider);
    const balance = await provider.getBalance(wallet.address);
    const ethBalance = ethers.formatEther(balance);
    
    logger.info(`💰 Wallet: ${wallet.address}`);
    logger.info(`💎 ETH Balance: ${ethBalance}`);
    
    if (parseFloat(ethBalance) < 0.01) {
      logger.warn('⚠️  Low ETH balance - may not cover gas fees');
      logger.info('💧 Get testnet ETH from: https://www.base.org/faucet');
    }
    
    // Verify contract connectivity
    logger.info('🔍 Verifying contract connectivity...');
    const verifier = new PollenContractVerifier({
      ...config,
      provider,
      wallet
    });
    
    await verifier.verifyAll();
    logger.info('✅ Contract verification completed');
    
    // Initialize and start the trading bot
    const bot = new PollenTradingBot({
      ...config,
      provider,
      wallet,
      privateKey: process.env.WALLET_PRIVATE_KEY
    });
    
    // Set up event handlers
    setupEventHandlers(bot);
    
    // Initialize bot
    await bot.initialize();
    logger.info('✅ Bot initialized successfully');
    
    // Start trading
    await bot.start();
    logger.info('🎯 Bot is running and ready to trade');
    
    // Log initial status
    await logInitialStatus(bot);
    
  } catch (error) {
    logger.error('❌ Failed to start bot:', error.message);
    if (error.stack) {
      logger.debug(error.stack);
    }
    process.exit(1);
  }
}

function setupEventHandlers(bot) {
  // Bot lifecycle events
  bot.on('initialized', () => {
    logger.info('🔧 Bot components initialized');
  });
  
  bot.on('started', () => {
    logger.info('▶️ Bot trading loop started');
  });
  
  bot.on('stopped', () => {
    logger.info('⏹️ Bot trading loop stopped');
  });
  
  bot.on('error', (error) => {
    logger.error('🚨 Bot error:', error);
  });
  
  // Trading events
  bot.on('rebalance', (data) => {
    logger.info('🔄 Portfolio rebalanced');
    logger.info(`Assets: ${data.assets?.join(', ') || 'N/A'}`);
    logger.info(`Weights: ${data.weights?.join(', ') || 'N/A'}`);
    if (data.txHash) {
      logger.info(`Transaction: ${data.txHash}`);
    }
  });
  
  bot.on('trade', (data) => {
    logger.info('💱 Trade executed');
    logger.info(`Type: ${data.type || 'Unknown'}`);
    logger.info(`Asset: ${data.asset || 'Unknown'}`);
    logger.info(`Amount: ${data.amount || 'Unknown'}`);
    if (data.txHash) {
      logger.info(`Transaction: ${data.txHash}`);
    }
  });
  
  // Market data events
  bot.on('marketUpdate', (data) => {
    logger.info('📊 Market data updated');
    if (data.timestamp) {
      logger.info(`Timestamp: ${new Date(data.timestamp).toISOString()}`);
    }
  });
  
  // Performance events
  bot.on('performanceUpdate', (metrics) => {
    logger.info('📈 Performance metrics updated');
    if (metrics.totalReturn) {
      logger.info(`Total Return: ${(metrics.totalReturn * 100).toFixed(2)}%`);
    }
    if (metrics.sharpeRatio) {
      logger.info(`Sharpe Ratio: ${metrics.sharpeRatio.toFixed(2)}`);
    }
  });
}

async function logInitialStatus(bot) {
  try {
    logger.info('📊 Initial Bot Status:');
    logger.info('-----------------------------');
    
    // Log bot configuration
    logger.info(`Strategy: ${bot.config?.trading?.strategy || 'Default'}`);
    logger.info(`Risk Level: ${bot.config?.trading?.riskLevel || 'Moderate'}`);
    logger.info(`Rebalance Interval: ${bot.config?.trading?.rebalanceInterval || 'Not set'}`);
    
    // Try to get portfolio status if available
    if (bot.pollenInterface) {
      try {
        const plnBalance = await bot.pollenInterface.getPLNBalance();
        logger.info(`PLN Balance: ${plnBalance || '0'}`);
      } catch (error) {
        logger.debug('Could not fetch PLN balance:', error.message);
      }
    }
    
    logger.info('-----------------------------');
    logger.info('🔄 Bot is now running and monitoring markets...');
    
  } catch (error) {
    logger.warn('Could not log initial status:', error.message);
  }
}

// Handle graceful shutdown
const shutdown = async () => {
  logger.info('🛑 Received shutdown signal. Stopping bot gracefully...');
  try {
    // Give the bot time to finish current operations
    setTimeout(() => {
      logger.info('✅ Bot stopped successfully');
      process.exit(0);
    }, 2000);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
};

// Process signal handlers
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Error handlers
process.on('unhandledRejection', (reason, promise) => {
  logger.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('⚠️ Uncaught Exception:', error);
  process.exit(1);
});

// Start the bot
startBot().catch(error => {
  logger.error('❌ Fatal error in bot startup:', error);
  process.exit(1);
});
#!/usr/bin/env node

/**
 * Debug Script for Pollen Trading Bot
 * Enhanced monitoring and debugging capabilities
 */

require('dotenv').config({ path: './base-sepolia.env' });
const logger = require('../src/modules/logger');
const config = require('../src/config/index.js');

async function debugBotExecution() {
  try {
    console.log('🔍 DEBUGGING POLLEN TRADING BOT');
    console.log('='.repeat(50));
    
    // 1. Environment Check
    console.log('\n📋 Environment Configuration:');
    console.log(`Network: ${config.network.name}`);
    console.log(`RPC URL: ${config.network.rpcUrl}`);
    console.log(`Chain ID: ${config.network.chainId}`);
    console.log(`Has Private Key: ${!!config.wallet.privateKey}`);
    console.log(`PLN Token: ${config.contracts.plnToken}`);
    console.log(`vePLN Contract: ${config.contracts.vePLN}`);
    
    // 2. Network Connectivity Test
    console.log('\n🌐 Testing Network Connectivity:');
    const { ethers } = require('ethers');
    
    try {
      const provider = new ethers.JsonRpcProvider(config.network.rpcUrl);
      const network = await provider.getNetwork();
      console.log(`✅ Network Connected: ${network.name} (Chain ID: ${network.chainId})`);
      
      if (config.wallet.privateKey) {
        const wallet = new ethers.Wallet(config.wallet.privateKey, provider);
        const balance = await provider.getBalance(wallet.address);
        console.log(`💰 Wallet Balance: ${ethers.formatEther(balance)} ETH`);
        console.log(`📍 Wallet Address: ${wallet.address}`);
      }
    } catch (networkError) {
      console.log(`❌ Network Error: ${networkError.message}`);
    }
    
    // 3. Contract Validation
    console.log('\n🏛️ Contract Validation:');
    try {
      const validateContracts = require('../src/actions/validate_base_sepolia_contracts.js');
      const validation = await validateContracts(config);
      
      if (validation.error) {
        console.log(`❌ Validation Error: ${validation.error.message}`);
      } else {
        console.log('✅ Contract validation passed');
      }
    } catch (validationError) {
      console.log(`❌ Validation Failed: ${validationError.message}`);
    }
    
    // 4. Module Availability Check
    console.log('\n📦 Module Availability:');
    const modules = [
      '../src/modules/enhanced-trading-engine',
      '../src/modules/pollen-trading-bot',
      '../src/modules/tradingview-integration'
    ];
    
    modules.forEach(modulePath => {
      try {
        require(modulePath);
        console.log(`✅ ${modulePath.split('/').pop()}`);
      } catch (error) {
        console.log(`❌ ${modulePath.split('/').pop()}: ${error.message}`);
      }
    });
    
    // 5. Start Main Bot
    console.log('\n🤖 Starting Trading Bot Manager:');
    const TradingBotManager = require('../src/index.js');
    
  } catch (error) {
    console.error('Debug script failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  debugBotExecution();
}

module.exports = { debugBotExecution };
