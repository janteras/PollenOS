require('dotenv').config({ path: require('path').resolve(__dirname, '../base-sepolia.env') });
const { ethers } = require('ethers');
const config = require('./config');
const PollenInteractor = require('./pollen-interaction');

class TradingBot {
  constructor(id, strategy, interactor) {
    this.id = id;
    this.strategy = strategy;
    this.interactor = interactor;
    this.isRunning = false;
    this.intervalId = null;
    this.lastAction = null;
    this.stats = {
      totalTrades: 0,
      successfulTrades: 0,
      failedTrades: 0,
      lastError: null
    };
  }

  async start() {
    if (this.isRunning) {
      console.log(`[Bot ${this.id}] Already running`);
      return;
    }

    console.log(`[Bot ${this.id}] Starting with ${this.strategy.name} strategy`);
    this.isRunning = true;
    
    // Initial setup
    await this.initializeBot();
    
    // Start the main trading loop
    this.runTradingLoop();
  }

  async initializeBot() {
    console.log(`[Bot ${this.id}] Initializing...`);
    
    // Check wallet balance
    const balance = await this.interactor.provider.getBalance(this.interactor.wallet.address);
    console.log(`[Bot ${this.id}] Wallet balance: ${ethers.formatEther(balance)} ETH`);
    
    // Check lock status
    try {
      const lockInfo = await this.interactor.getLockInfo();
      console.log(`[Bot ${this.id}] Lock status:`, {
        amount: ethers.formatEther(lockInfo.amount) + ' PLN',
        lockEnd: new Date(lockInfo.lockEnd * 1000).toISOString(),
        daysRemaining: Math.max(0, Math.ceil((lockInfo.lockEnd - Math.floor(Date.now() / 1000)) / 86400))
      });
    } catch (error) {
      console.error(`[Bot ${this.id}] Error checking lock status:`, error.message);
    }
    
    console.log(`[Bot ${this.id}] Initialization complete`);
  }

  async runTradingLoop() {
    if (!this.isRunning) return;
    
    try {
      console.log(`\n[Bot ${this.id}] Executing trading strategy: ${this.strategy.name}`);
      
      // Execute strategy
      await this.executeStrategy();
      
      // Update stats
      this.stats.totalTrades++;
      this.stats.successfulTrades++;
      this.lastAction = new Date().toISOString();
      
    } catch (error) {
      console.error(`[Bot ${this.id}] Error in trading loop:`, error);
      this.stats.totalTrades++;
      this.stats.failedTrades++;
      this.stats.lastError = {
        timestamp: new Date().toISOString(),
        message: error.message,
        stack: error.stack
      };
    } finally {
      // Schedule next run
      if (this.isRunning) {
        const delay = this.strategy.interval * 1000; // Convert to milliseconds
        console.log(`[Bot ${this.id}] Next execution in ${this.strategy.interval} seconds`);
        this.intervalId = setTimeout(() => this.runTradingLoop(), delay);
      }
    }
  }

  async executeStrategy() {
    // This is where the trading logic goes
    // For demonstration, we'll implement a simple staking strategy
    
    // Check current lock status
    const lockInfo = await this.interactor.getLockInfo();
    const now = Math.floor(Date.now() / 1000);
    
    if (lockInfo.amount === 0n) {
      // No active lock, create a new one
      console.log(`[Bot ${this.id}] No active lock found, creating new stake`);
      await this.interactor.lockPLN(
        this.strategy.stakingAmount, 
        this.strategy.lockDurationDays
      );
    } else if (lockInfo.lockEnd < now + (this.strategy.renewBeforeDays * 24 * 60 * 60)) {
      // Lock is expiring soon, extend it
      console.log(`[Bot ${this.id}] Lock expires soon, extending`);
      await this.interactor.extendLock(this.strategy.lockDurationDays);
    } else {
      console.log(`[Bot ${this.id}] Active lock is valid`);
    }
    
    // Example portfolio rebalancing logic
    if (this.strategy.rebalance) {
      console.log(`[Bot ${this.id}] Checking portfolio for rebalancing...`);
      await this.rebalancePortfolio();
    }
  }
  
  async rebalancePortfolio() {
    try {
      // Get current portfolio info
      const portfolio = await this.interactor.getPortfolioInfo();
      console.log(`[Bot ${this.id}] Current portfolio:`, {
        balance: portfolio.balance,
        assets: portfolio.assetAmounts.length
      });
      
      // Simple rebalancing logic - adjust based on your strategy
      const weights = this.strategy.assetWeights || [0.25, 0.25, 0.25, 0.25];
      const isShort = this.strategy.shortPositions || [false, false, false, false];
      
      console.log(`[Bot ${this.id}] Rebalancing with weights:`, weights);
      
      // Only rebalance if we have a balance
      if (parseFloat(portfolio.balance) > 0.01) { // Minimum 0.01 ETH
        await this.interactor.rebalancePortfolio(
          weights,
          isShort,
          portfolio.balance,
          false // use PLN, not vePLN
        );
        console.log(`[Bot ${this.id}] Portfolio rebalanced successfully`);
      } else {
        console.log(`[Bot ${this.id}] Insufficient balance for rebalancing`);
      }
    } catch (error) {
      console.error(`[Bot ${this.id}] Error rebalancing portfolio:`, error);
      throw error;
    }
  }

  stop() {
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log(`[Bot ${this.id}] Stopped`);
  }
  
  getStatus() {
    return {
      id: this.id,
      strategy: this.strategy.name,
      isRunning: this.isRunning,
      lastAction: this.lastAction,
      stats: this.stats
    };
  }
}

class BotManager {
  constructor() {
    this.bots = new Map();
    this.interactor = new PollenInteractor();
    this.interactor.logger = console; // Use console for logging
  }
  
  createBot(id, strategy) {
    const bot = new TradingBot(id, strategy, this.interactor);
    this.bots.set(id, bot);
    return bot;
  }
  
  startBot(id) {
    const bot = this.bots.get(id);
    if (bot) {
      bot.start();
    } else {
      console.error(`Bot ${id} not found`);
    }
  }
  
  stopBot(id) {
    const bot = this.bots.get(id);
    if (bot) {
      bot.stop();
    } else {
      console.error(`Bot ${id} not found`);
    }
  }
  
  startAll() {
    console.log('Starting all bots...');
    this.bots.forEach(bot => bot.start());
  }
  
  stopAll() {
    console.log('Stopping all bots...');
    this.bots.forEach(bot => bot.stop());
  }
  
  getStatus() {
    const status = {};
    this.bots.forEach((bot, id) => {
      status[id] = bot.getStatus();
    });
    return status;
  }
}

// Example usage
async function main() {
  const manager = new BotManager();
  
  // Define bot strategies
  const strategies = [
    {
      id: 1,
      name: 'conservative',
      stakingAmount: '100', // PLN
      lockDurationDays: 30,
      renewBeforeDays: 7,
      interval: 300, // 5 minutes
      rebalance: true,
      assetWeights: [0.4, 0.3, 0.2, 0.1],
      shortPositions: [false, false, false, false]
    },
    {
      id: 2,
      name: 'balanced',
      stakingAmount: '200', // PLN
      lockDurationDays: 60,
      renewBeforeDays: 14,
      interval: 600, // 10 minutes
      rebalance: true,
      assetWeights: [0.3, 0.3, 0.2, 0.2],
      shortPositions: [false, false, true, true]
    },
    {
      id: 3,
      name: 'aggressive',
      stakingAmount: '500', // PLN
      lockDurationDays: 90,
      renewBeforeDays: 30,
      interval: 900, // 15 minutes
      rebalance: true,
      assetWeights: [0.5, 0.3, 0.2, 0.0],
      shortPositions: [false, true, false, false]
    }
  ];
  
  // Create bots
  strategies.forEach(strategy => {
    manager.createBot(strategy.id, strategy);
  });
  
  // Start all bots
  manager.startAll();
  
  // Handle shutdown gracefully
  process.on('SIGINT', async () => {
    console.log('\nShutting down bots...');
    manager.stopAll();
    process.exit(0);
  });
  
  // Log status periodically
  setInterval(() => {
    console.log('\n=== Bot Status ===');
    console.log(JSON.stringify(manager.getStatus(), null, 2));
  }, 300000); // Every 5 minutes
}

// Run the bot manager
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { BotManager, TradingBot };
