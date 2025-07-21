
#!/usr/bin/env node

/**
 * Live Trading Engine for Base Sepolia
 * Executes real blockchain transactions for all bots
 */

require('dotenv').config({ path: './config/base-sepolia-pods-default.env' });
const { ethers } = require('ethers');
const logger = require('./src/modules/logger');

// Bot configurations
const BOTS = [
  {
    id: 1,
    name: 'Conservative Bot',
    privateKey: 'd74ae2c1a798042c9bbf56f15d2649df6d114e763f9444e2cddcde050900f1d0',
    address: '0x561529036AB886c1FD3D112360383D79fBA9E71c',
    strategy: 'conservative',
    riskLevel: 'low',
    maxAllocation: 15
  },
  {
    id: 2,
    name: 'Momentum Bot',
    privateKey: '241083ae625b93b41b555052840c09458c71704889b22774101d21b4d1482e62',
    address: '0x48B2353954496679CF7C73d239bc12098cB0C5B4',
    strategy: 'momentum',
    riskLevel: 'moderate',
    maxAllocation: 20
  },
  {
    id: 3,
    name: 'Technical Bot',
    privateKey: '0aa4b2f50b7efc44721b23a2ef7fc3ab11b658369af23381752c6d86b42628b1',
    address: '0x43f76157E9696302E287181828cB3B0C6B89d31e',
    strategy: 'technical',
    riskLevel: 'moderate',
    maxAllocation: 20
  },
  {
    id: 4,
    name: 'Mean Reversion Bot',
    privateKey: '7dde37bea0f47ea849c9a7a285f3a277acd81c908accdb501ca036db1a5b11da',
    address: '0xC02764913ce2F23B094F0338a711EFD984024A46',
    strategy: 'mean-reversion',
    riskLevel: 'moderate',
    maxAllocation: 20
  },
  {
    id: 5,
    name: 'Breakout Bot',
    privateKey: '64da71a2688d24c0f970ded84d2d744081e467ae493f4c3256c4f8ee9bb959ee',
    address: '0x00FfF703fa6837A1a46b3DF9B6a047404046379E',
    strategy: 'breakout',
    riskLevel: 'high',
    maxAllocation: 25
  },
  {
    id: 6,
    name: 'Scalping Bot',
    privateKey: '01c9ebbb878c20446425a726bd4d47f99620afa3cfcb3103866337054949f87c',
    address: '0xD5404dd1Af9701A5ba8C8064240529594849450D',
    strategy: 'scalping',
    riskLevel: 'moderate',
    maxAllocation: 15
  },
  {
    id: 7,
    name: 'Grid Trading Bot',
    privateKey: 'f56adb2c0b947f7d5f94c63b81a679dda6de49987bc99008779bb57827a600fe',
    address: '0x0E27bFe07Fb67497b093AFA6c94BF76a2A81ee13',
    strategy: 'grid-trading',
    riskLevel: 'low',
    maxAllocation: 18
  }
];

// Contract addresses
const CONTRACTS = {
  plnToken: '0x9E1c51E1fAa1381D8a7Dbdd19402c5fCce9274C6',
  pollenDAO: '0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7',
  leagues: '0x55F04Ee2775925b80125F412C05cF5214Fd1317a'
};

// Contract ABIs
const PLN_TOKEN_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
];

const POLLEN_DAO_ABI = [
  'function getUserPortfolio(address _user) view returns (address)',
  'function getPortfolioValue(address _portfolio) view returns (uint256)',
  'function rebalancePortfolio(address _portfolio, address[] calldata _assets, uint256[] calldata _weights) returns (bool)',
  'function withdrawFromPortfolio(address _portfolio, uint256 _amount) returns (bool)',
  'function depositToPortfolio(address _portfolio, uint256 _amount) returns (bool)'
];

const LEAGUES_ABI = [
  'function getPortfolioValue(address _portfolio) view returns (uint256)',
  'function rebalancePortfolio(address _portfolio, address[] calldata _assets, uint256[] calldata _weights) returns (bool)',
  'function executeArbitrage(address _portfolio, address _tokenIn, address _tokenOut, uint256 _amountIn) returns (bool)',
  'function getWhitelistedAssets() view returns (address[])',
  'function getAssetWeight(address _portfolio, address _asset) view returns (uint256)'
];

class LiveTradingEngine {
  constructor() {
    this.provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
    this.bots = new Map();
    this.running = false;
    this.tradeCount = 0;
  }

  async initializeBot(bot) {
    try {
      logger.info(`🔄 Initializing ${bot.name} (Bot ${bot.id})`);
      
      // Create wallet
      const wallet = new ethers.Wallet(bot.privateKey, this.provider);
      
      // Initialize contracts
      const plnToken = new ethers.Contract(CONTRACTS.plnToken, PLN_TOKEN_ABI, wallet);
      const pollenDAO = new ethers.Contract(CONTRACTS.pollenDAO, POLLEN_DAO_ABI, wallet);
      const leagues = new ethers.Contract(CONTRACTS.leagues, LEAGUES_ABI, wallet);

      // Get portfolio address
      const portfolioAddress = await pollenDAO.getUserPortfolio(wallet.address);
      
      if (portfolioAddress === ethers.ZeroAddress) {
        logger.warn(`⚠️ No portfolio found for ${bot.name}. Run create-live-portfolios.js first.`);
        return null;
      }

      // Get balances
      const ethBalance = await this.provider.getBalance(wallet.address);
      const plnBalance = await plnToken.balanceOf(wallet.address);
      const portfolioValue = await leagues.getPortfolioValue(portfolioAddress);

      const botInstance = {
        ...bot,
        wallet,
        plnToken,
        pollenDAO,
        leagues,
        portfolioAddress,
        ethBalance: ethers.formatEther(ethBalance),
        plnBalance: ethers.formatEther(plnBalance),
        portfolioValue: ethers.formatEther(portfolioValue),
        lastTrade: Date.now(),
        tradeCount: 0
      };

      this.bots.set(bot.id, botInstance);
      
      logger.info(`✅ ${bot.name} initialized successfully`);
      logger.info(`  📍 Portfolio: ${portfolioAddress}`);
      logger.info(`  💰 ETH: ${botInstance.ethBalance}`);
      logger.info(`  💎 PLN: ${botInstance.plnBalance}`);
      logger.info(`  📊 Portfolio Value: ${botInstance.portfolioValue}`);

      return botInstance;
    } catch (error) {
      logger.error(`❌ Failed to initialize ${bot.name}:`, error.message);
      return null;
    }
  }

  async executeRebalance(bot) {
    try {
      logger.info(`🔄 Executing rebalance for ${bot.name}`);

      // Get whitelisted assets
      const whitelistedAssets = await bot.leagues.getWhitelistedAssets();
      
      if (whitelistedAssets.length === 0) {
        logger.warn(`⚠️ No whitelisted assets found for ${bot.name}`);
        return false;
      }

      // Generate strategy-based allocation
      const allocation = this.generateAllocation(bot.strategy, whitelistedAssets);
      
      logger.info(`📊 ${bot.name} rebalancing to:`);
      allocation.assets.forEach((asset, index) => {
        logger.info(`  ${asset}: ${allocation.weights[index]}%`);
      });

      // Execute rebalance transaction
      const tx = await bot.leagues.rebalancePortfolio(
        bot.portfolioAddress,
        allocation.assets,
        allocation.weights,
        {
          gasLimit: 500000,
          gasPrice: ethers.parseUnits('0.1', 'gwei')
        }
      );

      logger.info(`📡 Rebalance transaction: ${tx.hash}`);
      logger.info(`🔗 Explorer: https://sepolia.basescan.org/tx/${tx.hash}`);

      // Wait for confirmation
      const receipt = await tx.wait();
      logger.info(`✅ Rebalance confirmed in block: ${receipt.blockNumber}`);

      // Update bot stats
      bot.tradeCount++;
      bot.lastTrade = Date.now();
      this.tradeCount++;

      return true;
    } catch (error) {
      logger.error(`❌ Rebalance failed for ${bot.name}:`, error.message);
      return false;
    }
  }

  async executeArbitrage(bot) {
    try {
      logger.info(`🔄 Executing arbitrage for ${bot.name}`);

      // Get whitelisted assets
      const whitelistedAssets = await bot.leagues.getWhitelistedAssets();
      
      if (whitelistedAssets.length < 2) {
        logger.warn(`⚠️ Need at least 2 assets for arbitrage on ${bot.name}`);
        return false;
      }

      // Select random assets for arbitrage
      const tokenIn = whitelistedAssets[Math.floor(Math.random() * whitelistedAssets.length)];
      let tokenOut = whitelistedAssets[Math.floor(Math.random() * whitelistedAssets.length)];
      
      // Ensure different tokens
      while (tokenOut === tokenIn) {
        tokenOut = whitelistedAssets[Math.floor(Math.random() * whitelistedAssets.length)];
      }

      // Calculate arbitrage amount (small percentage of portfolio)
      const portfolioValue = await bot.leagues.getPortfolioValue(bot.portfolioAddress);
      const arbitrageAmount = portfolioValue / BigInt(20); // 5% of portfolio

      logger.info(`🔀 ${bot.name} arbitrage: ${tokenIn} → ${tokenOut}`);
      logger.info(`💰 Amount: ${ethers.formatEther(arbitrageAmount)} tokens`);

      // Execute arbitrage transaction
      const tx = await bot.leagues.executeArbitrage(
        bot.portfolioAddress,
        tokenIn,
        tokenOut,
        arbitrageAmount,
        {
          gasLimit: 400000,
          gasPrice: ethers.parseUnits('0.1', 'gwei')
        }
      );

      logger.info(`📡 Arbitrage transaction: ${tx.hash}`);
      logger.info(`🔗 Explorer: https://sepolia.basescan.org/tx/${tx.hash}`);

      // Wait for confirmation
      const receipt = await tx.wait();
      logger.info(`✅ Arbitrage confirmed in block: ${receipt.blockNumber}`);

      // Update bot stats
      bot.tradeCount++;
      bot.lastTrade = Date.now();
      this.tradeCount++;

      return true;
    } catch (error) {
      logger.error(`❌ Arbitrage failed for ${bot.name}:`, error.message);
      return false;
    }
  }

  generateAllocation(strategy, assets) {
    const numAssets = Math.min(assets.length, 3); // Max 3 assets per portfolio
    const selectedAssets = assets.slice(0, numAssets);
    
    let weights;
    switch (strategy) {
      case 'conservative':
        weights = [5000, 3000, 2000]; // 50%, 30%, 20%
        break;
      case 'momentum':
        weights = [6000, 2500, 1500]; // 60%, 25%, 15%
        break;
      case 'technical':
        weights = [4000, 3500, 2500]; // 40%, 35%, 25%
        break;
      case 'mean-reversion':
        weights = [3500, 3500, 3000]; // 35%, 35%, 30%
        break;
      case 'breakout':
        weights = [7000, 2000, 1000]; // 70%, 20%, 10%
        break;
      case 'scalping':
        weights = [5500, 2750, 1750]; // 55%, 27.5%, 17.5%
        break;
      case 'grid-trading':
        weights = [3333, 3333, 3334]; // Equal weight
        break;
      default:
        weights = [4000, 3000, 3000]; // Default allocation
    }

    return {
      assets: selectedAssets,
      weights: weights.slice(0, numAssets)
    };
  }

  async startLiveTrading() {
    logger.info('🚀 Starting Live Trading Engine');
    logger.info('═'.repeat(60));

    // Initialize all bots
    const initResults = [];
    for (const bot of BOTS) {
      const initialized = await this.initializeBot(bot);
      if (initialized) {
        initResults.push(initialized);
      }
    }

    if (initResults.length === 0) {
      logger.error('❌ No bots initialized successfully');
      return;
    }

    logger.info(`✅ ${initResults.length}/${BOTS.length} bots initialized`);
    logger.info('🔥 Starting live trading operations...');

    this.running = true;

    // Start trading loops for each bot
    for (const [botId, bot] of this.bots) {
      this.startBotTradingLoop(bot);
    }

    // Status reporting
    this.startStatusReporting();
  }

  startBotTradingLoop(bot) {
    // Random trading interval between 2-8 minutes
    const tradingInterval = 120000 + Math.random() * 360000;
    
    const executeNextTrade = async () => {
      if (!this.running) return;

      try {
        // Choose random trading action
        const actions = ['rebalance', 'arbitrage'];
        const action = actions[Math.floor(Math.random() * actions.length)];

        let success = false;
        if (action === 'rebalance') {
          success = await this.executeRebalance(bot);
        } else if (action === 'arbitrage') {
          success = await this.executeArbitrage(bot);
        }

        if (success) {
          logger.info(`🎉 ${bot.name} executed ${action} successfully`);
        }

      } catch (error) {
        logger.error(`❌ Trading error for ${bot.name}:`, error.message);
      }

      // Schedule next trade
      setTimeout(executeNextTrade, tradingInterval + Math.random() * 60000);
    };

    // Start first trade after random delay
    setTimeout(executeNextTrade, Math.random() * 60000);
  }

  startStatusReporting() {
    setInterval(() => {
      if (!this.running) return;

      logger.info('\n📊 LIVE TRADING STATUS');
      logger.info('─'.repeat(40));
      logger.info(`🔄 Total Trades Executed: ${this.tradeCount}`);
      logger.info(`🤖 Active Bots: ${this.bots.size}`);
      
      this.bots.forEach((bot, id) => {
        const timeSinceLastTrade = Math.floor((Date.now() - bot.lastTrade) / 1000);
        logger.info(`  Bot ${id}: ${bot.tradeCount} trades, last: ${timeSinceLastTrade}s ago`);
      });
    }, 120000); // Every 2 minutes
  }

  async stop() {
    this.running = false;
    logger.info('🛑 Live Trading Engine stopped');
  }
}

// Main execution
async function main() {
  const engine = new LiveTradingEngine();

  try {
    await engine.startLiveTrading();

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT. Shutting down live trading engine...');
      await engine.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM. Shutting down live trading engine...');
      await engine.stop();
      process.exit(0);
    });

  } catch (error) {
    logger.error('❌ Live trading engine error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = LiveTradingEngine;
