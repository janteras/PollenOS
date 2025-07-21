#!/usr/bin/env node

/**
 * Pollen Trading Bot using elizaOS framework
 * 
 * This bot connects to TradingView data sources and executes trades on Pollen app
 * on both Avalanche and Base networks.
 */

// Polyfill for AbortController in older Node.js versions
if (typeof globalThis.AbortController === 'undefined') {
  globalThis.AbortController = class AbortController {
    constructor() {
      this.signal = { aborted: false };
    }
    abort() {
      this.signal.aborted = true;
    }
  };
}

require('dotenv').config({ path: './config/.env' });
const axios = require('axios');
const schedule = require('node-schedule');
const winston = require('winston');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// Import custom modules
const ethers = require('ethers');
const logger = require('./modules/logger');
const PollenContractVerifier = require('./modules/pollen-verification');
const validateBaseSepoliaContracts = require('./actions/validate_base_sepolia_contracts');
const config = require('./config/index.js');

// Load required modules
const EnhancedTradingEngine = require('./modules/enhanced-trading-engine');
const PollenTradingBot = require('./modules/pollen-trading-bot');

// Make TradingView optional
let TradingViewIntegration = null;
if (process.env.ENABLE_TRADINGVIEW !== 'false') {
  try {
    TradingViewIntegration = require('./modules/tradingview-integration');
  } catch (error) {
    logger.warn('TradingView integration disabled - module not found');
  }
}

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('network', {
    alias: 'n',
    description: 'Blockchain network to use (avalanche, base, avalanche-testnet, base-testnet)',
    type: 'string',
  })
  .option('setup', {
    alias: 's',
    description: 'Run the setup wizard',
    type: 'boolean',
  })
  .option('thesis', {
    alias: 't',
    description: 'Trading thesis to use',
    type: 'string',
  })
  .option('verbose', {
    alias: 'v',
    description: 'Run with verbose logging',
    type: 'boolean',
  })
  .option('test', {
    alias: 'test-mode',
    description: 'Run in test mode with simulated data and transactions',
    type: 'boolean',
  })
  .help()
  .alias('help', 'h')
  .argv;

// If setup flag is provided, run the setup wizard
if (argv.setup) {
  logger.info('Starting setup wizard...');
  require('./setup').runSetup();
  process.exit(0);
}

// Set log level based on verbose flag
if (argv.verbose) {
  logger.setLevel('debug');
}

// Check for runtime flags
const testMode = process.argv.includes('--test');
if (testMode) {
  process.env.TEST_MODE = 'true';
  logger.info('Running in TEST MODE - using simulated data and transactions');
} else {
  process.env.LIVE_TRADING = 'true';
  logger.info('Running in LIVE TRADING MODE - executing real transactions');
}

const extendedBackoff = process.argv.includes('--extended-backoff');
if (extendedBackoff) {
  process.env.EXTENDED_BACKOFF = 'true';
  logger.info('Using EXTENDED BACKOFF for API requests');
}

class TradingBotManager {
  constructor() {
    this.config = config;
    this.bot = null;
    this.tradingView = null;
    this.optimizer = null;
    this.contract = null;
    this.isRunning = false;

    // Initialize TradingView if available
    if (TradingViewIntegration && process.env.ENABLE_TRADINGVIEW !== 'false') {
      try {
        this.tradingView = new TradingViewIntegration(this.config);
        logger.info('TradingView integration enabled');
      } catch (error) {
        logger.warn('Failed to create TradingView integration:', error.message);
        this.tradingView = null;
      }
    } else {
      logger.info('TradingView integration disabled');
      this.tradingView = null;
    }
  }

  /**
   * Initialize the trading bot and all its components
   */
  async initialize() {
    try {
      logger.info('Initializing trading bot manager...');

      // Step 1: Initialize TradingView integration
      logger.info('Step 1: Initializing TradingView integration...');
      await this.initializeTradingView();
      logger.info('✅ TradingView integration completed');

      // Step 2: Validate Base Sepolia contracts
      logger.info('Step 2: Validating Base Sepolia contracts...');
      try {
        logger.info('Config being passed to validation:', JSON.stringify({
          network: this.config.network,
          wallet: this.config.wallet ? { address: this.config.wallet.address, hasPrivateKey: !!this.config.wallet.privateKey } : null,
          contracts: this.config.contracts
        }, null, 2));

        this.validationResults = await validateBaseSepoliaContracts(this.config);
        if (this.validationResults.error) {
          logger.warn('Contract validation completed with errors:', this.validationResults.error.message || this.validationResults.error);
        } else {
          logger.info('✅ Contract validation completed successfully');
        }
      } catch (validationError) {
        logger.error('Contract validation failed:', validationError.message || validationError);
        logger.error('Stack trace:', validationError.stack);
        this.validationResults = {
          network: null,
          wallet: null,
          contracts: {},
          error: {
            message: validationError.message,
            type: 'validation_failure',
            timestamp: new Date().toISOString()
          }
        };
      }

      // Step 3: Initialize Pollen contract interface
      logger.info('Step 3: Initializing Pollen contract interface...');
      try {
        await this.initializePollenContract();
        logger.info('✅ Pollen contract interface completed');
      } catch (contractError) {
        logger.warn('Contract interface initialization failed, continuing in simulation mode');
        logger.debug('Contract error details:', contractError.message);
      }

      // Step 4: Initialize enhanced trading engine
      logger.info('Step 4: Initializing enhanced trading engine...');
      await this.initializeTradingEngine();
      logger.info('✅ Enhanced trading engine completed');

      // Step 5: Initialize main trading bot
      logger.info('Step 5: Initializing main trading bot...');
      await this.initializeTradingBot();
      logger.info('✅ Main trading bot completed');

      logger.info('✅ Trading bot manager initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize trading bot manager:', error.message);
      logger.error('Full error details:', error);
      throw error;
    }
  }

  async initializeTradingView() {
    try {
      if (!this.tradingView) {
        logger.warn('TradingView integration not available - continuing without it');
        return;
      }
      await this.tradingView.initialize();
      logger.info('✅ TradingView integration completed');
    } catch (error) {
      logger.error('Error initializing TradingView integration:', error.message);
      logger.error('Stack trace:', error.stack);
      logger.warn('Continuing without TradingView integration');
      // Don't throw - allow bot to continue without TradingView
    }
  }

  async initializePollenContract() {
    try {
      // Check if we have required contract addresses
      if (!this.config.contracts || !this.config.contracts.plnToken || !this.config.contracts.vePLN) {
        logger.warn('Missing contract addresses, continuing with limited functionality');
        this.contract = null;
        return;
      }

      // Check if we have a valid RPC URL
      if (!this.config.network || !this.config.network.rpcUrl) {
        logger.warn('Missing network configuration, continuing without contract interface');
        this.contract = null;
        return;
      }

      // Check if we have a private key
      if (!this.config.wallet.privateKey) {
        logger.warn('Missing private key, continuing without contract interface');
        this.contract = null;
        return;
      }

      logger.info(`Connecting to Base Sepolia at ${this.config.network.rpcUrl}`);
      logger.info(`Network configuration: Chain ID ${this.config.network.chainId}`);

      // Create provider first
      const provider = new ethers.JsonRpcProvider(this.config.network.rpcUrl);
      const wallet = new ethers.Wallet(this.config.wallet.privateKey, provider);

      // Test connection with timeout
      const networkPromise = provider.getNetwork();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Network connection timeout')), 10000)
      );

      const network = await Promise.race([networkPromise, timeoutPromise]);
      logger.info(`✅ Connected to network: ${network.name} (Chain ID: ${network.chainId})`);

      // Validate we're connected to Base Sepolia per Developer Guide
      if (network.chainId !== 84532) {
        logger.warn(`⚠️ Expected Base Sepolia Chain ID 84532, got ${network.chainId}`);
      }

      // Test basic wallet functionality
      const balance = await provider.getBalance(wallet.address);
      logger.info(`Wallet balance: ${ethers.formatEther(balance)} ETH`);

      if (balance === 0n) {
        logger.warn('⚠️ Wallet has no ETH for gas fees. Get testnet ETH from Base Sepolia faucet.');
      }

      // Validate PLN token contract per Sepolia Developer Guide
      const plnTokenAddress = this.config.contracts.plnToken;
      const expectedPlnAddress = '0x9E1c51E1fAa1381D8a7Dbdd19402c5fCce9274C6';

      if (plnTokenAddress.toLowerCase() !== expectedPlnAddress.toLowerCase()) {
        logger.warn(`⚠️ PLN token address mismatch. Expected: ${expectedPlnAddress}, Got: ${plnTokenAddress}`);
      }

      // Test PLN token contract connectivity
      const plnTokenContract = new ethers.Contract(
        plnTokenAddress,
        ['function symbol() view returns (string)', 'function balanceOf(address) view returns (uint256)'],
        provider
      );

      try {
        const symbol = await plnTokenContract.symbol();
        const balance = await plnTokenContract.balanceOf(wallet.address);
        logger.info(`PLN Token: ${symbol}, Balance: ${ethers.formatEther(balance)} PLN`);
      } catch (tokenError) {
        logger.error('PLN token validation failed:', tokenError.message);
      }

      // Use the imported PollenContractVerifier for now
      this.contract = new PollenContractVerifier({
        rpcUrl: this.config.network.rpcUrl,
        privateKey: this.config.wallet.privateKey,
        virtualContractAddress: this.config.contracts.virtualContract,
        plnTokenAddress: this.config.contracts.plnToken,
        contracts: this.config.contracts
      });

      // Initialize with timeout
      const initTimeout = setTimeout(() => {
        throw new Error('Contract initialization timeout');
      }, 30000); // 30 second timeout

      await this.contract.initialize();
      clearTimeout(initTimeout);

      logger.info('✅ Pollen contract interface initialized');
    } catch (error) {
      logger.error('Error initializing Pollen contract interface:', error.message || error.toString());
      if (error.stack) {
        logger.error('Stack trace:', error.stack);
      }
      if (error.code) {
        logger.error('Error code:', error.code);
      }
      if (error.reason) {
        logger.error('Error reason:', error.reason);
      }
      if (error.data) {
        logger.error('Error data:', error.data);
      }
      logger.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));

      // Provide specific guidance based on error type
      if (error.message.includes('timeout') || error.message.includes('network')) {
        logger.warn('Network connectivity issue. Check RPC URL:', this.config.network.rpcUrl);
      } else if (error.message.includes('private key') || error.message.includes('wallet')) {
        logger.warn('Wallet configuration issue. Check WALLET_PRIVATE_KEY in base-sepolia.env');
      } else {
        logger.warn('Contract initialization failed. Running in simulation mode');
      }

      this.contract = null;
      // Don't throw the error, continue with limited functionality
    }
  }

  async initializeTradingEngine() {
    try {
      if (!EnhancedTradingEngine) {
        logger.warn('Enhanced trading engine not available - creating simple engine');
        this.engine = {
          initialize: async () => logger.info('Simple engine initialized'),
          start: async () => logger.info('Simple engine started'),
          stop: async () => logger.info('Simple engine stopped')
        };
        return;
      }

      this.engine = new EnhancedTradingEngine(this.config);
      await this.engine.initialize();
      logger.info('✅ Enhanced trading engine initialized');
    } catch (error) {
      logger.error('Error initializing trading engine:', error.message);
      logger.warn('Continuing with simple engine fallback');
      this.engine = {
        initialize: async () => logger.info('Simple engine initialized'),
        start: async () => logger.info('Simple engine started'),
        stop: async () => logger.info('Simple engine stopped')
      };
    }
  }

  async initializeTradingBot() {
    try {
      this.bot = new PollenTradingBot(this.config);
      await this.bot.initialize();
      logger.info('✅ Main trading bot initialized');
    } catch (error) {
      logger.error('Error initializing main trading bot:', error.message);
      throw error;
    }
  }

  /**
   * Start the trading bot
   */
  async start() {
    try {
      if (this.isRunning) {
        logger.warn('Trading bot is already running');
        return;
      }

      logger.info('Starting trading bot...');

      // Start the bot
      if (this.bot && typeof this.bot.start === 'function') {
        try {
          await this.bot.start();
        } catch (startError) {
          logger.error('Bot start method failed:', startError.message);
          logger.warn('Continuing in monitoring mode');
        }
      } else {
        logger.info('Bot running in simple monitoring mode');
      }

      this.isRunning = true;

      // Set up monitoring
      this.setupMonitoring();

      logger.info('✅ Trading bot started successfully');
    } catch (error) {
      logger.error('Error starting trading bot:', error.message || error.toString());
      if (error.stack) {
        logger.error('Stack trace:', error.stack);
      }
      if (error.code) {
        logger.error('Error code:', error.code);
      }
      if (error.reason) {
        logger.error('Error reason:', error.reason);
      }
      if (error.transaction) {
        logger.error('Failed transaction:', error.transaction);
      }
      logger.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      // Don't throw - allow bot to continue in monitoring mode
      this.isRunning = true;
      logger.warn('Bot started in monitoring mode due to startup error');
    }
  }

  /**
   * Stop the trading bot
   */
  async stop() {
    try {
      if (!this.isRunning) {
        logger.warn('Trading bot is not running');
        return;
      }

      logger.info('Stopping trading bot...');

      // Stop the bot
      await this.bot.stop();
      this.isRunning = false;

      logger.info('✅ Trading bot stopped successfully');
    } catch (error) {
      logger.error('Error stopping trading bot:', error);
      throw error;
    }
  }

  /**
   * Set up monitoring and alerts
   */
  setupMonitoring() {
    // Monitor portfolio performance
    setInterval(async () => {
      try {
        const status = await this.bot.getStatus();
        this.checkAlerts(status);
      } catch (error) {
        logger.error('Error in monitoring interval:', error.message);
      }
    }, this.config.monitoring.metricsInterval * 1000);

    // Monitor gas prices - only if contract is available
    if (this.contract && this.contract.provider) {
      setInterval(async () => {
        try {
          const gasPrice = await this.contract.provider.getGasPrice();
          if (gasPrice > this.config.trading.maxGasPrice) {
            logger.warn(`High gas price detected: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);
            this.sendAlert('High gas price detected', {
              gasPrice: ethers.formatUnits(gasPrice, 'gwei'),
              threshold: ethers.formatUnits(this.config.trading.maxGasPrice, 'gwei')
            });
          }
        } catch (error) {
          logger.error('Error monitoring gas prices:', error.message);
        }
      }, 60 * 1000); // Check every minute
    } else {
      // Alternative gas monitoring using Base Sepolia provider
      const provider = new ethers.providers.JsonRpcProvider(this.config.network.rpcUrl);
      setInterval(async () => {
        try {
          const gasPrice = await provider.getGasPrice();
          if (gasPrice > ethers.parseUnits('200', 'gwei')) { // 200 gwei threshold
            logger.warn(`High gas price detected: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);
          }
        } catch (error) {
          logger.debug('Gas price monitoring unavailable:', error.message);
        }
      }, 300 * 1000); // Check every 5 minutes when contract not available
    }
  }

  /**
   * Check for alerts based on bot status
   */
  checkAlerts(status) {
    try {
      const { portfolio, metrics } = status || {};

      // Only check metrics if they exist
      if (metrics) {
        // Check drawdown
        if (metrics.drawdown && metrics.drawdown > this.config.monitoring.alertThresholds.drawdown) {
          this.sendAlert('High drawdown detected', {
            drawdown: metrics.drawdown,
            threshold: this.config.monitoring.alertThresholds.drawdown
          });
        }

        // Check volatility
        if (metrics.volatility && metrics.volatility > this.config.monitoring.alertThresholds.volatility) {
          this.sendAlert('High volatility detected', {
            volatility: metrics.volatility,
            threshold: this.config.monitoring.alertThresholds.volatility
          });
        }
      }

      // Check portfolio deviation only if portfolio data exists
      if (portfolio && portfolio.allocations && portfolio.riskProfile) {
        try {
          const maxDeviation = Math.max(
            ...Object.entries(portfolio.allocations).map(([asset, allocation]) => {
              const targetWeight = this.config.trading.riskProfiles[portfolio.riskProfile]?.defaultAllocation?.[asset] || 0;
              return Math.abs(allocation.weight - targetWeight);
            })
          );

          if (maxDeviation > this.config.monitoring.alertThresholds.portfolioDeviation) {
            this.sendAlert('High portfolio deviation detected', {
              maxDeviation,
              threshold: this.config.monitoring.alertThresholds.portfolioDeviation
            });
          }
        } catch (error) {
          logger.debug('Portfolio deviation check failed:', error.message);
        }
      }
    } catch (error) {
      logger.error('Error in checkAlerts:', error.message);
    }
  }

  /**
   * Send alert through configured channels
   */
  async sendAlert(title, data) {
    const message = `${title}\n${JSON.stringify(data, null, 2)}`;

    // Log alert
    logger.warn(message);

    // Send email alert
    if (this.config.monitoring.notifications.enabled && this.config.monitoring.notifications.email) {
      try {
        await this.sendEmailAlert(title, message);
      } catch (error) {
        logger.error('Error sending email alert:', error);
      }
    }

    // Send Telegram alert
    if (this.config.monitoring.notifications.telegram.enabled) {
      try {
        await this.sendTelegramAlert(message);
      } catch (error) {
        logger.error('Error sending Telegram alert:', error);
      }
    }
  }

  /**
   * Send email alert
   */
  async sendEmailAlert(title, message) {
    // Implementation depends on your email service
    // This is a placeholder for the actual implementation
    logger.info(`Email alert: ${title}`);
  }

  /**
   * Send Telegram alert
   */
  async sendTelegramAlert(message) {
    // Implementation depends on your Telegram bot setup
    // This is a placeholder for the actual implementation
    logger.info(`Telegram alert: ${message}`);
  }
}

// Create and start the trading bot manager
async function main() {
  try {
    const manager = new TradingBotManager();
    await manager.initialize();
    await manager.start();

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT. Shutting down...');
      await manager.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM. Shutting down...');
      await manager.stop();
      process.exit(0);
    });

    process.on('uncaughtException', async (error) => {
      logger.error('Uncaught exception:', error);
      await manager.stop();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      logger.error('Unhandled rejection at:', promise, 'reason:', reason);
      await manager.stop();
      process.exit(1);
    });
  } catch (error) {
    logger.error('Error in main:', error);
    process.exit(1);
  }
}

// Run the bot
main();