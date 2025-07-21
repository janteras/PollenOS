const { ethers } = require('ethers');
const PollenTradingBot = require('./modules/pollen-trading-bot');
const TradingViewIntegration = require('./modules/tradingview-integration');
const PortfolioOptimizer = require('./modules/portfolio-optimizer');
const PollenVirtualContract = require('./modules/pollen-virtual-contract');
const logger = require('./modules/logger');
const config = require('./config');

/**
 * Live Trading Bot for Pollen Protocol
 * PRODUCTION MODE - NO SIMULATION
 * Executes real PLN staking and portfolio rebalancing on Avalanche Mainnet
 */
class LivePollenTradingBot {
  constructor() {
    this.config = config;
    this.isRunning = false;
    this.tradingBot = null;
    this.tradingView = null;
    this.optimizer = null;
    this.virtualContract = null;
    this.positions = new Map();
    this.lastRebalance = null;
    
    // Production settings - NO SIMULATION
    this.LIVE_MODE = true;
    this.MIN_PLN_STAKE = 1; // Minimum 1 PLN to stake on testnet
    this.REBALANCE_THRESHOLD = 0.05; // 5% threshold for rebalancing
    this.MAX_POSITION_SIZE = 10; // Maximum 10 PLN per position on testnet
  }

  /**
   * Initialize live trading bot with real wallet and contracts
   */
  async initialize() {
    try {
      logger.info('🚀 Initializing LIVE Pollen Trading Bot on Base Sepolia...');
      
      // Validate required environment variables
      this.validateEnvironment();
      
      // Initialize wallet with real private key
      const provider = new ethers.JsonRpcProvider(this.config.network.rpcUrl);
      const wallet = new ethers.Wallet(this.config.wallet.privateKey, provider);
      
      logger.info(`Connected wallet: ${wallet.address}`);
      
      // Verify network is Base Sepolia (Chain ID 84532)
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== 84532) {
        throw new Error(`❌ This bot is configured for Base Sepolia (Chain ID: 84532). Connected to Chain ID: ${network.chainId}`);
      }
      
      logger.info(`✅ Connected to Base Sepolia (Chain ID: ${network.chainId})`);
      
      // Initialize core components
      await this.initializeComponents(provider, wallet);
      
      // Verify PLN balance
      await this.verifyPlnBalance();
      
      // Initialize portfolio if needed
      await this.initializePortfolio();
      
      logger.info('✅ Live Trading Bot initialized successfully');
      return true;
      
    } catch (error) {
      logger.error('❌ Failed to initialize live trading bot:', error);
      throw error;
    }
  }

  /**
   * Validate required environment variables for live trading
   */
  validateEnvironment() {
    const required = [
      'WALLET_PRIVATE_KEY',
      'AVALANCHE_RPC_URL'
    ];
    
    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    
    logger.info('✅ Environment variables validated');
  }

  /**
   * Initialize all trading components
   */
  async initializeComponents(provider, wallet) {
    // Initialize Pollen Virtual Contract for staking and portfolio management
    this.virtualContract = new PollenVirtualContract({
      rpcUrl: this.config.network.rpcUrl,
      privateKey: this.config.wallet.privateKey,
      virtualContractAddress: this.config.contracts.virtualContract,
      plnTokenAddress: this.config.contracts.plnToken
    });
    
    await this.virtualContract.initialize();
    logger.info('✅ Pollen Virtual Contract initialized');
    
    // Initialize TradingView integration for market signals
    this.tradingView = new TradingViewIntegration({
      username: this.config.tradingView.username,
      password: this.config.tradingView.password,
      baseUrl: this.config.tradingView.baseUrl,
      updateInterval: this.config.tradingView.updateInterval
    });
    
    if (this.config.tradingView.username) {
      await this.tradingView.initialize();
      logger.info('✅ TradingView integration initialized');
    }
    
    // Initialize Portfolio Optimizer
    this.optimizer = new PortfolioOptimizer({
      rpcUrl: this.config.network.rpcUrl,
      minRebalanceThreshold: this.REBALANCE_THRESHOLD,
      maxSlippage: this.config.trading.maxSlippage,
      optimizationWindow: 24 * 60 * 60 * 1000 // 24 hours
    });
    
    logger.info('✅ Portfolio Optimizer initialized');
    
    // Initialize main trading bot
    this.tradingBot = new PollenTradingBot({
      network: this.config.network,
      wallet: this.config.wallet,
      contracts: this.config.contracts,
      trading: this.config.trading,
      riskProfile: 'moderate' // Default risk profile
    });
    
    await this.tradingBot.initialize();
    logger.info('✅ Main Trading Bot initialized');
  }

  /**
   * Verify sufficient PLN balance for trading
   */
  async verifyPlnBalance() {
    try {
      const provider = new ethers.JsonRpcProvider(this.config.network.rpcUrl);
      const plnToken = new ethers.Contract(
        this.config.contracts.plnToken,
        ['function balanceOf(address) view returns (uint256)'],
        provider
      );
      
      const balance = await plnToken.balanceOf(this.config.wallet.address);
      const balanceFormatted = ethers.utils.formatEther(balance);
      
      logger.info(`PLN Balance: ${balanceFormatted} PLN`);
      
      if (parseFloat(balanceFormatted) < this.MIN_PLN_STAKE) {
        throw new Error(`Insufficient PLN balance. Need at least ${this.MIN_PLN_STAKE} PLN, have ${balanceFormatted} PLN`);
      }
      
      logger.info('✅ Sufficient PLN balance verified');
      
    } catch (error) {
      logger.error('❌ PLN balance verification failed:', error);
      throw error;
    }
  }

  /**
   * Initialize portfolio if this is the first run
   */
  async initializePortfolio() {
    try {
      // Create initial portfolio with default allocation
      const defaultAssets = [
        this.config.trading.defaultAllocations.conservative.WBTC.address,
        this.config.trading.defaultAllocations.conservative.WETH.address,
        this.config.trading.defaultAllocations.conservative.AVAX.address
      ];
      
      const defaultWeights = [
        4000, // 40% WBTC
        3000, // 30% WETH
        3000  // 30% AVAX
      ];
      
      logger.info('Creating initial portfolio...');
      const portfolioId = await this.virtualContract.createVirtualPortfolio(defaultAssets, defaultWeights);
      
      this.portfolioId = portfolioId;
      logger.info(`✅ Portfolio created with ID: ${portfolioId}`);
      
    } catch (error) {
      logger.error('Portfolio initialization failed:', error);
      // Continue without portfolio if creation fails
      logger.warn('Continuing without portfolio creation');
    }
  }

  /**
   * Start live trading operations
   */
  async startTrading() {
    try {
      if (this.isRunning) {
        logger.warn('Trading bot is already running');
        return;
      }
      
      this.isRunning = true;
      logger.info('🚀 Starting LIVE trading operations...');
      
      // Start main trading loop
      this.tradingLoop();
      
      // Start portfolio monitoring
      this.portfolioMonitoringLoop();
      
      logger.info('✅ Live trading started successfully');
      
    } catch (error) {
      logger.error('❌ Failed to start trading:', error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Main trading loop - executes real trades
   */
  async tradingLoop() {
    while (this.isRunning) {
      try {
        logger.info('🔄 Executing trading cycle...');
        
        // Get market signals from TradingView
        const marketSignals = await this.getMarketSignals();
        
        // Execute trades based on signals
        if (marketSignals && marketSignals.length > 0) {
          await this.executeTrades(marketSignals);
        }
        
        // Wait for next cycle
        await this.sleep(this.config.tradingView.updateInterval);
        
      } catch (error) {
        logger.error('Error in trading loop:', error);
        await this.sleep(60000); // Wait 1 minute before retry
      }
    }
  }

  /**
   * Portfolio monitoring and rebalancing loop
   */
  async portfolioMonitoringLoop() {
    while (this.isRunning) {
      try {
        logger.info('📊 Checking portfolio for rebalancing...');
        
        // Analyze current portfolio
        const analysis = await this.optimizer.analyzeOnChainData(
          this.portfolioId,
          this.config.trading.defaultAllocations.moderate
        );
        
        // Check if rebalancing is needed
        if (analysis.suggestions && analysis.suggestions.rebalanceNeeded) {
          await this.rebalancePortfolio(analysis.suggestions);
        }
        
        // Wait 1 hour before next check
        await this.sleep(60 * 60 * 1000);
        
      } catch (error) {
        logger.error('Error in portfolio monitoring:', error);
        await this.sleep(60000); // Wait 1 minute before retry
      }
    }
  }

  /**
   * Get market signals from TradingView
   */
  async getMarketSignals() {
    try {
      if (!this.tradingView) {
        logger.warn('TradingView not configured, using default signals');
        return this.getDefaultSignals();
      }
      
      const assets = ['WBTC', 'WETH', 'AVAX', 'BNB', 'LINK'];
      const signals = await this.tradingView.getMarketSignals(assets);
      
      logger.info(`Received ${signals.length} market signals`);
      return signals;
      
    } catch (error) {
      logger.error('Error getting market signals:', error);
      return this.getDefaultSignals();
    }
  }

  /**
   * Execute real trades based on market signals
   */
  async executeTrades(signals) {
    try {
      logger.info('💰 Executing LIVE trades...');
      
      for (const signal of signals) {
        if (signal.confidence < 0.7) {
          logger.info(`Skipping ${signal.asset} - low confidence: ${signal.confidence}`);
          continue;
        }
        
        // Calculate position size
        const positionSize = Math.min(
          signal.amount || 10,
          this.MAX_POSITION_SIZE
        );
        
        // Execute real PLN staking
        await this.executePlnStaking(signal, positionSize);
        
        // Rate limiting between trades
        await this.sleep(5000);
      }
      
    } catch (error) {
      logger.error('Error executing trades:', error);
    }
  }

  /**
   * Execute real PLN staking on portfolio
   */
  async executePlnStaking(signal, amount) {
    try {
      logger.info(`🔒 STAKING ${amount} PLN on ${signal.asset} (${signal.direction})`);
      
      // Calculate lock duration based on signal confidence
      const lockDuration = Math.floor(signal.confidence * 90 * 24 * 60 * 60); // Up to 90 days
      
      // Execute real staking transaction
      const stakeId = await this.virtualContract.stakePLN(
        ethers.utils.parseEther(amount.toString()),
        lockDuration
      );
      
      // Track position
      this.positions.set(stakeId, {
        asset: signal.asset,
        amount: amount,
        direction: signal.direction,
        confidence: signal.confidence,
        lockDuration: lockDuration,
        timestamp: new Date(),
        stakeId: stakeId
      });
      
      logger.info(`✅ PLN staked successfully. Stake ID: ${stakeId}`);
      
    } catch (error) {
      logger.error(`❌ PLN staking failed for ${signal.asset}:`, error);
    }
  }

  /**
   * Rebalance portfolio based on optimizer suggestions
   */
  async rebalancePortfolio(suggestions) {
    try {
      logger.info('⚖️ REBALANCING portfolio...');
      
      if (!this.portfolioId) {
        logger.warn('No portfolio ID available for rebalancing');
        return;
      }
      
      // Extract new allocation from suggestions
      const newAssets = suggestions.newAllocation.map(item => item.address);
      const newWeights = suggestions.newAllocation.map(item => Math.floor(item.weight * 100));
      
      // Execute real portfolio rebalancing
      await this.virtualContract.updateVirtualPortfolio(
        this.portfolioId,
        newAssets,
        newWeights
      );
      
      this.lastRebalance = new Date();
      logger.info('✅ Portfolio rebalanced successfully');
      
    } catch (error) {
      logger.error('❌ Portfolio rebalancing failed:', error);
    }
  }

  /**
   * Get default trading signals when TradingView is not available
   */
  getDefaultSignals() {
    return [
      {
        asset: 'WBTC',
        direction: 'bullish',
        confidence: 0.75,
        amount: 15,
        price: 45000
      },
      {
        asset: 'WETH',
        direction: 'bullish',
        confidence: 0.8,
        amount: 12,
        price: 2800
      }
    ];
  }

  /**
   * Stop trading operations
   */
  async stopTrading() {
    logger.info('🛑 Stopping live trading operations...');
    this.isRunning = false;
    
    // Log final positions
    logger.info(`Final positions: ${this.positions.size}`);
    for (const [stakeId, position] of this.positions.entries()) {
      logger.info(`Position ${stakeId}: ${position.amount} PLN on ${position.asset}`);
    }
  }

  /**
   * Get current trading status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      mode: 'LIVE',
      portfolioId: this.portfolioId,
      activePositions: this.positions.size,
      lastRebalance: this.lastRebalance,
      positions: Array.from(this.positions.values())
    };
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export for use
module.exports = LivePollenTradingBot;

// If run directly, start the bot
if (require.main === module) {
  const bot = new LivePollenTradingBot();
  
  bot.initialize()
    .then(() => bot.startTrading())
    .catch(error => {
      logger.error('Failed to start live trading bot:', error);
      process.exit(1);
    });
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    await bot.stopTrading();
    process.exit(0);
  });
} 