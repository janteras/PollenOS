require('dotenv').config({ path: require('path').resolve(__dirname, '../base-sepolia.env') });
const { ethers } = require('ethers');
const config = require('./config');
const logger = require('../utils/logger');

class TradingBot {
  constructor(id, strategy) {
    this.id = id;
    this.strategy = strategy;
    this.provider = new ethers.JsonRpcProvider(config.RPC_URL);
    this.wallet = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, this.provider);
    this.isRunning = false;
    this.lastAction = null;
    this.stats = {
      totalStakes: 0,
      totalUnstakes: 0,
      totalErrors: 0,
      lastError: null,
      lastSuccess: null,
      startTime: null,
      uptime: 0
    };
    
    // Initialize vePLN contract
    this.vePLN = new ethers.Contract(
      config.CONTRACTS.VEPLN,
      [
        'function name() view returns (string)',
        'function symbol() view returns (string)',
        'function stake(uint256 amount, uint256 lockDuration) external',
        'function getLockInfo(address) view returns (uint256 amount, uint256 lockEnd)',
        'function balanceOf(address) view returns (uint256)'
      ],
      this.wallet
    );
    
    // Set default lock duration (4 years in seconds)
    this.defaultLockDuration = 4 * 365 * 24 * 60 * 60;
    
    logger.info(`Bot ${this.id} initialized with ${this.strategy.name} strategy`, {
      address: this.wallet.address,
      strategy: this.strategy
    });
  }

  async start() {
    if (this.isRunning) {
      logger.warn(`Bot ${this.id} is already running`);
      return;
    }
    
    this.isRunning = true;
    this.stats.startTime = new Date();
    logger.info(`Starting bot ${this.id} with ${this.strategy.name} strategy`);
    
    // Initial setup
    await this.initializeBot();
    
    // Start the main loop
    this.runLoop();
  }
  
  async initializeBot() {
    try {
      // Check wallet balance
      const ethBalance = await this.provider.getBalance(this.wallet.address);
      logger.info(`Bot ${this.id} wallet balance`, {
        ethBalance: ethers.formatEther(ethBalance),
        address: this.wallet.address
      });
      
      // Check current lock status
      await this.checkStakingStatus();
      
    } catch (error) {
      logger.error(`Bot ${this.id} initialization failed`, {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
  
  async checkStakingStatus() {
    try {
      const [amount, lockEnd] = await this.vePLN.getLockInfo(this.wallet.address);
      const now = Math.floor(Date.now() / 1000);
      const isLocked = amount > 0n && lockEnd > now;
      
      logger.info(`Bot ${this.id} staking status`, {
        hasActiveLock: isLocked,
        lockedAmount: amount.toString(),
        lockEnd: new Date(Number(lockEnd) * 1000).toISOString(),
        remainingTime: lockEnd > now ? `${Math.floor((lockEnd - now) / 86400)} days` : 'expired'
      });
      
      return { amount, lockEnd, isLocked };
      
    } catch (error) {
      logger.error(`Bot ${this.id} failed to check staking status`, {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
  
  async executeStrategy() {
    try {
      logger.info(`Bot ${this.id} executing ${this.strategy.name} strategy`);
      
      // Check current lock status
      const { isLocked, amount } = await this.checkStakingStatus();
      
      if (!isLocked) {
        // If no active lock, create a new one
        logger.info(`Bot ${this.id} no active lock found, creating new stake`);
        await this.stake();
      } else {
        // If active lock exists, check if we should extend
        logger.info(`Bot ${this.id} has active lock, checking if extension is needed`);
        await this.extendLock();
      }
      
      this.stats.lastSuccess = new Date();
      
    } catch (error) {
      this.stats.totalErrors++;
      this.stats.lastError = {
        time: new Date(),
        message: error.message,
        code: error.code
      };
      
      logger.error(`Bot ${this.id} strategy execution failed`, {
        error: error.message,
        code: error.code,
        stack: error.stack
      });
    }
  }
  
  async stake() {
    try {
      const amount = ethers.parseEther('1.0'); // 1 PLN for testing
      const lockDuration = this.defaultLockDuration;
      
      logger.info(`Bot ${this.id} staking ${ethers.formatEther(amount)} PLN`, {
        lockDuration: `${lockDuration / (24 * 60 * 60)} days`
      });
      
      const tx = await this.vePLN.stake(amount, lockDuration, {
        gasLimit: 300000,
        gasPrice: await this.provider.getFeeData().then(feeData => feeData.gasPrice * 2n)
      });
      
      logger.info(`Bot ${this.id} staking transaction sent`, {
        txHash: tx.hash
      });
      
      const receipt = await tx.wait();
      
      logger.info(`Bot ${this.id} staking successful`, {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      });
      
      this.stats.totalStakes++;
      this.lastAction = 'staked';
      
      return receipt;
      
    } catch (error) {
      logger.error(`Bot ${this.id} staking failed`, {
        error: error.message,
        code: error.code,
        reason: error.reason,
        data: error.data,
        stack: error.stack
      });
      throw error;
    }
  }
  
  async extendLock() {
    try {
      const lockDuration = this.defaultLockDuration;
      logger.info(`Bot ${this.id} extending lock`, {
        lockDuration: `${lockDuration / (24 * 60 * 60)} days`
      });
      
      // Extend lock by staking 0 amount
      const tx = await this.vePLN.stake(0, lockDuration, {
        gasLimit: 300000,
        gasPrice: await this.provider.getFeeData().then(feeData => feeData.gasPrice * 2n)
      });
      
      logger.info(`Bot ${this.id} lock extension transaction sent`, {
        txHash: tx.hash
      });
      
      const receipt = await tx.wait();
      
      logger.info(`Bot ${this.id} lock extension successful`, {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber
      });
      
      this.lastAction = 'extended';
      return receipt;
      
    } catch (error) {
      logger.error(`Bot ${this.id} lock extension failed`, {
        error: error.message,
        code: error.code,
        reason: error.reason,
        data: error.data,
        stack: error.stack
      });
      throw error;
    }
  }
  
  async runLoop() {
    if (!this.isRunning) return;
    
    try {
      await this.executeStrategy();
    } catch (error) {
      logger.error(`Bot ${this.id} error in main loop`, {
        error: error.message,
        stack: error.stack
      });
    }
    
    // Schedule next run (5 minutes)
    setTimeout(() => this.runLoop(), 5 * 60 * 1000);
  }
  
  stop() {
    this.isRunning = false;
    logger.info(`Bot ${this.id} stopped`);
  }
}

// Create and start a single bot instance
async function main() {
  try {
    logger.info('=== Starting Pollen Trading Bot ===', {
      network: config.RPC_URL,
      chainId: config.CHAIN_ID,
      version: '1.0.0'
    });
    
    // Create a single bot with balanced strategy
    const bot = new TradingBot(1, { 
      name: 'balanced',
      risk: 'medium',
      interval: '5m'
    });
    
    // Start the bot
    await bot.start();
    
    // Handle shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down bot...');
      bot.stop();
      process.exit(0);
    });
    
  } catch (error) {
    logger.error('Failed to start bot', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Run the script
main();
