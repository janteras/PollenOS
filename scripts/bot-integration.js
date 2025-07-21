require('dotenv').config({ path: require('path').resolve(__dirname, '.wallets') });
const { ethers } = require('ethers');
const PortfolioManager = require('./portfolio-manager');

// Supported assets in the portfolio
const ASSETS = {
  WBTC: 0,
  CBETH: 1,
  WETH: 2,
  USDC: 3,
  USDT: 4,
  DAI: 5,
  LINK: 6
};

class TradingBot {
  constructor() {
    this.portfolioManager = new PortfolioManager();
    this.wallet = this.portfolioManager.wallet;
    this.logger = this.portfolioManager.logger;
  }

  /**
   * Execute a trading strategy that adjusts the portfolio based on market conditions
   */
  async executeStrategy() {
    try {
      this.logger.info(`\n=== Starting trading strategy execution ===`);
      this.logger.info(`Executor: ${this.wallet.address}`);
      
      // 1. Get current portfolio state
      const portfolio = await this.portfolioManager.getPortfolioDetails(this.wallet.address);
      this.logger.info('Current portfolio state:', this.formatPortfolio(portfolio));
      
      // 2. Get market data and make trading decisions
      const { weights, isShort } = await this.analyzeMarket();
      
      // 3. Rebalance portfolio based on strategy
      this.logger.info('\nExecuting portfolio rebalance...');
      await this.portfolioManager.rebalancePortfolio(weights, isShort);
      
      // 4. Verify updated portfolio
      const updated = await this.portfolioManager.getPortfolioDetails(this.wallet.address);
      this.logger.info('\n✅ Portfolio rebalanced successfully');
      this.logger.info('Updated portfolio:', this.formatPortfolio(updated));
      
      return updated;
    } catch (error) {
      this.logger.error('Error executing strategy:', error);
      throw error;
    }
  }

  /**
   * Example market analysis function
   * In a real bot, this would connect to your market data sources
   * and implement your trading strategy
   */
  async analyzeMarket() {
    // This is a simplified example strategy
    // In a real bot, you would:
    // 1. Fetch current market data
    // 2. Run technical analysis
    // 3. Make trading decisions
    
    // Example: Simple momentum strategy
    return {
      weights: [
        3000, // WBTC - 30%
        2000, // cbETH - 20%
        1500, // WETH - 15%
        1500, // USDC - 15%
        1000, // USDT - 10%
        500,  // DAI - 5%
        500   // LINK - 5%
      ],
      isShort: [
        false, // WBTC - long
        true,  // cbETH - short
        false, // WETH - long
        false, // USDC - long (stablecoin)
        false, // USDT - long (stablecoin)
        true,  // DAI - short
        false  // LINK - long
      ]
    };
  }

  /**
   * Format portfolio data for display
   */
  formatPortfolio(portfolio) {
    const assets = Object.keys(ASSETS);
    const positions = assets.map((asset, index) => ({
      asset,
      weight: portfolio.assetAmounts ? 
        (portfolio.assetAmounts[index] / 100).toFixed(2) + '%' : 'N/A',
      amount: portfolio.assetAmounts ? 
        parseFloat(ethers.utils.formatEther(portfolio.assetAmounts[index] || '0')).toFixed(4) : '0',
      position: portfolio.isShort && portfolio.isShort[index] ? 'SHORT' : 'LONG'
    }));

    return {
      totalValue: parseFloat(ethers.utils.formatEther(portfolio.balance || '0')).toFixed(4) + ' PLN',
      isOpen: portfolio.isOpen ? 'Open' : 'Closed',
      positions
    };
  }
}

// Example usage
async function main() {
  try {
    const bot = new TradingBot();
    
    // Initial portfolio setup (if needed)
    const initialWeights = [
      2500, // WBTC
      2000, // cbETH
      1500, // WETH
      1500, // USDC
      1000, // USDT
      1000, // DAI
      500   // LINK
    ];
    const initialIsShort = Array(7).fill(false);
    const initialDeposit = ethers.utils.parseEther('10').toString(); // 10 PLN
    
    await bot.portfolioManager.ensurePortfolio(initialWeights, initialIsShort, initialDeposit);
    
    // Execute trading strategy
    await bot.executeStrategy();
    
  } catch (error) {
    console.error('Error in main execution:', error);
    process.exit(1);
  }
}

// Run the bot
if (require.main === module) {
  main().catch(console.error);
}

module.exports = TradingBot;
