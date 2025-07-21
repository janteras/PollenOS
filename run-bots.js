require('dotenv').config({ path: require('path').resolve(__dirname, 'base-sepolia.env') });
const { ethers } = require('ethers');
const logger = require('./utils/logger');
const TradingBot = require('./bots/TradingBot');
const config = require('./config');
const wallets = require('./config/wallets');

// Error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { 
    error: error.message,
    stack: error.stack 
  });
  process.exit(1);
});

// Error handling for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { 
    promise, 
    reason: reason instanceof Error ? reason.message : reason 
  });
});

async function main() {
  try {
    logger.info('Starting Pollen Trading Bots', {
      network: config.NETWORK_NAME,
      version: '1.0.0',
      nodeVersion: process.version,
      platform: process.platform,
      pid: process.pid
    });

    // Initialize provider with just the RPC URL and chain ID
    const provider = new ethers.JsonRpcProvider(config.RPC_URL, {
      chainId: config.CHAIN_ID,
      name: 'base-sepolia'
    });
    
    // Log network info
    const network = await provider.getNetwork();
    logger.info('Connected to network', {
      name: network.name,
      chainId: network.chainId,
      rpcUrl: config.RPC_URL
    });

    // Define bot strategies with different intervals and parameters
    const strategies = wallets.BOTS.map(bot => ({
      id: bot.id,
      name: bot.name,
      privateKey: bot.privateKey,
      interval: getStrategyInterval(bot.name),
      params: getStrategyParams(bot.name)
    }));
    
    function getStrategyInterval(strategyName) {
      const intervals = {
        conservative: 300000,  // 5 minutes
        balanced: 180000,     // 3 minutes
        aggressive: 60000,    // 1 minute
        arbitrage: 120000,    // 2 minutes
        market_maker: 90000   // 1.5 minutes
      };
      return intervals[strategyName] || 120000; // Default to 2 minutes
    }
    
    function getStrategyParams(strategyName) {
      const params = {
        conservative: {
          stakeThreshold: 0.7,  // 70% chance to stake
          extendThreshold: 0.8,  // 80% chance to extend
          minStakeAmount: '1.0', // Minimum 1.0 PLN to stake
          lockDuration: 2 * 365 * 24 * 60 * 60 // 2 years
        },
        balanced: {
          stakeThreshold: 0.6,
          extendThreshold: 0.75,
          minStakeAmount: '0.5',
          lockDuration: 1 * 365 * 24 * 60 * 60 // 1 year
        },
        aggressive: {
          stakeThreshold: 0.5,
          extendThreshold: 0.7,
          minStakeAmount: '0.1',
          lockDuration: 4 * 365 * 24 * 60 * 60 // 4 years
        },
        arbitrage: {
          stakeThreshold: 0.65,
          extendThreshold: 0.8,
          minStakeAmount: '0.25',
          lockDuration: 3 * 365 * 24 * 60 * 60 // 3 years
        },
        market_maker: {
          stakeThreshold: 0.55,
          extendThreshold: 0.75,
          minStakeAmount: '0.2',
          lockDuration: 6 * 30 * 24 * 60 * 60 // 6 months
        }
      };
      return params[strategyName] || params.balanced; // Default to balanced
    }

    // Initialize and start bots
    const bots = [];
    for (const strategy of strategies) {
      try {
        // Create wallet from private key
        const wallet = new ethers.Wallet(strategy.privateKey, provider);
        
        // Log wallet info
        const balance = await provider.getBalance(wallet.address);
        logger.info(`Initializing bot ${strategy.id} (${strategy.name})`, {
          address: wallet.address,
          balance: ethers.formatEther(balance),
          interval: `${strategy.interval / 1000}s`
        });
        
        // Initialize bot
        const bot = new TradingBot(strategy.id, strategy, wallet);
        await bot.initialize();
        bot.start(strategy.interval);
        bots.push(bot);
      } catch (error) {
        logger.error(`Failed to initialize bot ${strategy.id} (${strategy.name})`, {
          error: error.message,
          stack: error.stack
        });
      }
    }

    // Filter out any failed bots
    const runningBots = bots.filter(bot => bot !== null);
    
    logger.info(`Successfully started ${runningBots.length}/${bots.length} bots`, {
      runningBots: runningBots.map(bot => ({
        id: bot.id,
        strategy: bot.strategy.name,
        wallet: bot.wallet.address,
        interval: bot.strategy.interval
      }))
    });

    // Handle graceful shutdown
    const shutdown = async (signal) => {
      logger.info(`Received ${signal}, shutting down...`, {
        timestamp: new Date().toISOString(),
        runningBots: runningBots.length
      });

      // Stop all bots
      await Promise.all(runningBots.map(bot => {
        try {
          bot.stop();
          logger.info(`Bot ${bot.id} stopped`, { strategy: bot.strategy.name });
        } catch (error) {
          logger.error(`Error stopping bot ${bot.id}`, {
            error: error.message,
            strategy: bot.strategy.name
          });
        }
      }));

      logger.info('Shutdown complete', { timestamp: new Date().toISOString() });
      process.exit(0);
    };

    // Handle signals
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (error) {
    logger.error('Fatal error in main process', { 
      error: error.message,
      stack: error.stack 
    });
    process.exit(1);
  }
}

// Start the application
main().catch(error => {
  logger.error('Unhandled error in main function', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});
