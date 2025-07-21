require('dotenv').config({ path: require('path').resolve(__dirname, '../base-sepolia.env') });
const { ethers } = require('ethers');
const config = require('./config');

class TradingBot {
  constructor(id, strategy) {
    this.id = id;
    this.strategy = strategy;
    this.provider = new ethers.JsonRpcProvider(config.RPC_URL);
    this.wallet = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, this.provider);
    this.isRunning = false;
    this.lastAction = null;
    
    // Initialize vePLN contract with verified working functions
    this.vePLN = new ethers.Contract(
      config.CONTRACTS.VEPLN,
      [
        'function name() view returns (string)',
        'function symbol() view returns (string)',
        'function stake(uint256 amount, uint256 lockDuration) external',
        'function getLockInfo(address) view returns (uint256 amount, uint256 lockEnd)'
      ],
      this.wallet
    );
    
    // Set default lock duration (4 years in seconds)
    this.defaultLockDuration = 4 * 365 * 24 * 60 * 60;
    
    console.log(`[Bot ${this.id}] Initialized with ${this.strategy.name} strategy`);
    console.log(`[Bot ${this.id}] Wallet: ${this.wallet.address}`);
  }

  async start() {
    if (this.isRunning) {
      console.log(`[Bot ${this.id}] Already running`);
      return;
    }
    
    this.isRunning = true;
    console.log(`[Bot ${this.id}] Starting with ${this.strategy.name} strategy`);
    
    // Initial setup
    await this.initializeBot();
    
    // Start the main loop
    this.runLoop();
  }
  
  async initializeBot() {
    try {
      console.log(`[Bot ${this.id}] Initializing...`);
      
      // Check wallet balance
      const balance = await this.provider.getBalance(this.wallet.address);
      console.log(`[Bot ${this.id}] Balance: ${ethers.formatEther(balance)} ETH`);
      
      // Check staking status
      await this.checkStakingStatus();
      
      console.log(`[Bot ${this.id}] Initialization complete`);
    } catch (error) {
      console.error(`[Bot ${this.id}] Initialization error:`, error.message);
      throw error;
    }
  }
  
  async checkStakingStatus() {
    try {
      // Get token info
      const name = await this.vePLN.name();
      const symbol = await this.vePLN.symbol();
      
      console.log(`[Bot ${this.id}] Token Info:`);
      console.log(`  - Name: ${name}`);
      console.log(`  - Symbol: ${symbol}`);
      
      // Try to get lock info (may fail if no lock exists)
      try {
        const [amount, lockEnd] = await this.vePLN.getLockInfo(this.wallet.address);
        const lockDate = new Date(Number(lockEnd) * 1000);
        const now = Math.floor(Date.now() / 1000);
        const timeRemaining = lockEnd > now ? lockEnd - now : 0;
        
        console.log(`[Bot ${this.id}] Staking Status:`);
        console.log(`  - Locked amount: ${ethers.formatEther(amount)} ${symbol}`);
        console.log(`  - Lock end timestamp: ${lockEnd} (${timeRemaining} seconds remaining)`);
        console.log(`  - Lock ends: ${lockDate}`);
        
        return { 
          amount: amount, 
          lockEnd: Number(lockEnd),
          hasLock: true
        };
      } catch (error) {
        console.log(`[Bot ${this.id}] No active lock found or error getting lock info`);
        return { hasLock: false };
      }
    } catch (error) {
      console.error(`[Bot ${this.id}] Error checking staking status:`, error);
      throw error;
    }
  }
  
  async executeStrategy() {
    console.log(`[Bot ${this.id}] Executing ${this.strategy.name} strategy...`);
    
    try {
      // Check current staking status
      const status = await this.checkStakingStatus();
      
      // Simulate strategy execution based on staking status
      const outcome = Math.random();
      
      if (status.hasLock) {
        // If already staked, decide whether to extend lock or take other actions
        if (outcome > 0.8) {
          console.log(`[Bot ${this.id}] ${this.strategy.name}: Extending lock`);
          // In a real implementation, this would extend the lock
        } else {
          console.log(`[Bot ${this.id}] ${this.strategy.name}: Lock active, no action needed`);
        }
      } else {
        // If not staked, decide whether to stake
        if (outcome > 0.5) {
          console.log(`[Bot ${this.id}] ${this.strategy.name}: Creating new lock`);
          // In a real implementation, this would create a new lock
          // await this.vePLN.stake(
          //   ethers.parseEther('1'), // 1 PLN
          //   this.defaultLockDuration,
          //   { gasLimit: 500000 }
          // );
        } else {
          console.log(`[Bot ${this.id}] ${this.strategy.name}: No staking action needed`);
        }
      }
      
      this.lastAction = new Date();
    } catch (error) {
      console.error(`[Bot ${this.id}] Error executing strategy:`, error.message);
    }
  }
  
  async runLoop() {
    if (!this.isRunning) return;
    
    try {
      await this.executeStrategy();
      
      // Schedule next execution
      const delay = 30000 + Math.random() * 30000; // 30-60 seconds
      setTimeout(() => this.runLoop(), delay);
      
    } catch (error) {
      console.error(`[Bot ${this.id}] Error in run loop:`, error.message);
      // Retry after error
      setTimeout(() => this.runLoop(), 60000);
    }
  }
  
  stop() {
    this.isRunning = false;
    console.log(`[Bot ${this.id}] Stopped`);
  }
}

// Create and start bots
async function main() {
  try {
    console.log('=== Starting Pollen Trading Bots ===');
    console.log(`Network: ${config.RPC_URL}`);
    
    // Create bots with different strategies
    const bots = [
      new TradingBot(1, { name: 'conservative', risk: 'low' }),
      new TradingBot(2, { name: 'balanced', risk: 'medium' }),
      new TradingBot(3, { name: 'aggressive', risk: 'high' }),
      new TradingBot(4, { name: 'arbitrage', risk: 'high' }),
      new TradingBot(5, { name: 'market_maker', risk: 'medium' })
    ];
    
    // Start all bots
    bots.forEach(bot => bot.start());
    
    // Handle shutdown
    process.on('SIGINT', () => {
      console.log('\nShutting down bots...');
      bots.forEach(bot => bot.stop());
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Error starting bots:', error);
    process.exit(1);
  }
}

// Run the script
main();
