const { ethers } = require('ethers');
const config = require('./config');
const PollenDAOABI = require('../reference-code/pollen-subgraph-v3/abis/IPollenDAO.json');

async function getUserPortfolio(userAddress) {
  try {
    const provider = new ethers.providers.JsonRpcProvider(config.RPC_URL);
    const wallet = userAddress ? 
      new ethers.Wallet(process.env.PRIVATE_KEY, provider).connect(provider) : 
      new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    const dao = new ethers.Contract(
      config.CONTRACTS.POLLEN_DAO, 
      PollenDAOABI, 
      wallet
    );
    
    const addressToCheck = userAddress || wallet.address;
    console.log(`🔍 Checking portfolio for user: ${addressToCheck}`);
    
    // Get portfolio details
    console.log('Fetching portfolio details...');
    
    // First, try to get the portfolio contract address if it's stored in the config
    let portfolioAddress = config.CONTRACTS.PORTFOLIO;
    
    if (!portfolioAddress) {
      console.log('No portfolio address found in config. Trying to get portfolio details directly...');
      // If we don't have a portfolio address, try to get it from the transaction receipt
      try {
        // This is a fallback - we'll need to find a better way to get the portfolio address
        console.log('Checking if there are any PortfolioCreated events...');
        
        // Get the latest 1000 blocks to search for the PortfolioCreated event
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 1000);
        
        // Get all PortfolioCreated events
        const events = await dao.queryFilter(
          dao.filters.PortfolioCreated(),
          fromBlock,
          'latest'
        );
        
        console.log(`Found ${events.length} PortfolioCreated events in the last 1000 blocks`);
        
        // Find the event where the creator matches our address
        const userEvent = events.find(event => 
          event.args.creator && 
          event.args.creator.toLowerCase() === addressToCheck.toLowerCase()
        );
        
        if (userEvent) {
          console.log('Found matching PortfolioCreated event:', userEvent);
          return userEvent.args.portfolio;
        }
        
        if (events && events.length > 0) {
          portfolioAddress = events[0].args.portfolio;
          console.log(`Found portfolio address from event: ${portfolioAddress}`);
          config.CONTRACTS.PORTFOLIO = portfolioAddress;
        } else {
          console.log('No PortfolioCreated events found. Cannot determine portfolio address.');
          return null;
        }
      } catch (error) {
        console.error('Error fetching portfolio address:', error);
        return null;
      }
    }
    
    // Now try to get portfolio details using the portfolio contract
    console.log(`Getting portfolio details for address: ${portfolioAddress}`);
    
    // First, get the portfolio contract ABI
    const portfolioABI = require('../reference-code/pollen-subgraph-v3/abis/Portfolio.json');
    const portfolio = new ethers.Contract(portfolioAddress, portfolioABI, wallet);
    
    // Get the portfolio owner to verify
    const owner = await portfolio.owner();
    console.log(`Portfolio owner: ${owner}`);
    
    if (owner.toLowerCase() !== addressToCheck.toLowerCase()) {
      console.log(`Warning: Portfolio owner (${owner}) does not match the requested address (${addressToCheck})`);
    }
    
    // Get the portfolio value and assets
    const totalValue = await portfolio.getPortfolioValue();
    const assets = await portfolio.getAssets();
    
    console.log('\n📊 Portfolio Summary:');
    console.log(`- Total Value: ${ethers.utils.formatEther(totalValue)} PLN`);
    console.log(`- Number of Assets: ${assets.length}`);
    
    // Get the balance of each asset
    console.log('\n📦 Asset Balances:');
    let totalPortfolioValue = ethers.BigNumber.from(0);
    
    for (const asset of assets) {
      try {
        const balance = await portfolio.getAssetBalance(asset);
        const price = await portfolio.getAssetPrice(asset);
        const value = balance.mul(price).div(ethers.constants.WeiPerEther);
        totalPortfolioValue = totalPortfolioValue.add(value);
        
        console.log(`\nAsset: ${asset}`);
        console.log(`- Balance: ${ethers.utils.formatEther(balance)}`);
        console.log(`- Price: ${ethers.utils.formatEther(price)} PLN`);
        console.log(`- Value: ${ethers.utils.formatEther(value)} PLN`);
      } catch (error) {
        console.error(`Error fetching data for asset ${asset}:`, error.message);
      }
    }
    
    console.log('\n📊 Portfolio Summary:');
    console.log(`- Total Portfolio Value: ${ethers.utils.formatEther(totalPortfolioValue)} PLN`);
    console.log(`- Number of Assets: ${assets.length}`);
    
    // Get the portfolio's PLN balance
    try {
      const plnBalance = await portfolio.getPLNBalance();
      console.log(`- Available PLN Balance: ${ethers.utils.formatEther(plnBalance)} PLN`);
    } catch (error) {
      console.log('- Could not fetch PLN balance:', error.message);
    }
    
    return { assetAmounts, balance, depositPLN };
    
  } catch (error) {
    console.error('Error fetching user portfolio:', error);
    throw error;
  }
}

// Run with optional user address from command line
const userAddress = process.argv[2];
if (require.main === module) {
  getUserPortfolio(userAddress).catch(console.error);
}

module.exports = getUserPortfolio;
