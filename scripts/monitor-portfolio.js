const { ethers } = require('ethers');
const config = require('./config');
const PortfolioABI = require('../reference-code/pollen-subgraph-v3/abis/Portfolio.json');
const checkPortfolioBalance = require('./check-portfolio-balance');

// How often to check the portfolio (in milliseconds)
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

async function monitorPortfolio(portfolioAddress) {
  try {
    const provider = new ethers.providers.JsonRpcProvider(config.RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    // Use provided address or from config
    const portfolioAddr = portfolioAddress || config.CONTRACTS.PORTFOLIO;
    
    if (!portfolioAddr) {
      throw new Error('No portfolio address provided and none found in config');
    }
    
    const portfolio = new ethers.Contract(portfolioAddr, PortfolioABI, wallet);
    
    console.log(`📊 Starting portfolio monitoring for: ${portfolioAddr}`);
    console.log(`   Checking every ${CHECK_INTERVAL/1000} seconds\n`);
    
    // Initial check
    await checkPortfolioBalance(portfolioAddr);
    
    // Set up interval for periodic checks
    const intervalId = setInterval(async () => {
      try {
        const currentBlock = await provider.getBlockNumber();
        console.log(`\n⏱️  ${new Date().toISOString()} (Block: ${currentBlock})`);
        await checkPortfolioBalance(portfolioAddr);
      } catch (error) {
        console.error('Error during periodic check:', error.message);
      }
    }, CHECK_INTERVAL);
    
    // Handle process termination
    process.on('SIGINT', () => {
      clearInterval(intervalId);
      console.log('\n🛑 Monitoring stopped');
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Error setting up portfolio monitoring:', error);
    process.exit(1);
  }
}

// Run with optional portfolio address from command line
const portfolioAddress = process.argv[2];
if (require.main === module) {
  monitorPortfolio(portfolioAddress).catch(console.error);
}

module.exports = monitorPortfolio;
