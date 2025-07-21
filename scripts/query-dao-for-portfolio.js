const { ethers } = require('ethers');
const config = require('./config');

async function queryDaoForPortfolio() {
  try {
    const provider = new ethers.providers.JsonRpcProvider(config.RPC_URL);
    
    // PollenDAO contract address on Base Sepolia
    const daoAddress = '0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7';
    
    // User's wallet address
    const userAddress = '0x561529036AB886c1FD3D112360383D79fBA9E71c';
    
    console.log(`🔍 Querying PollenDAO for portfolio of: ${userAddress}`);
    
    // Load the PollenDAO ABI with common functions that might return portfolio info
    const PollenDAOABI = [
      'function getPortfolio(address) external view returns (address, uint256[], uint256, uint256)',
      'function getPortfolioAddress(address) external view returns (address)',
      'function portfolios(address) external view returns (address)',
      'function getUserPortfolio(address) external view returns (address)'
    ];
    
    const daoContract = new ethers.Contract(daoAddress, PollenDAOABI, provider);
    
    // Try different methods to get the portfolio address
    console.log('\nAttempting to find portfolio using different methods...');
    
    // Method 1: getPortfolioAddress (if exists)
    try {
      const portfolioAddress1 = await daoContract.getPortfolioAddress(userAddress);
      if (portfolioAddress1 && portfolioAddress1 !== ethers.constants.AddressZero) {
        console.log('✅ Found portfolio address (getPortfolioAddress):', portfolioAddress1);
        await verifyAndSavePortfolio(portfolioAddress1);
        return;
      }
    } catch (e) {
      console.log('Method getPortfolioAddress not available or failed');
    }
    
    // Method 2: portfolios mapping (if exists)
    try {
      const portfolioAddress2 = await daoContract.portfolios(userAddress);
      if (portfolioAddress2 && portfolioAddress2 !== ethers.constants.AddressZero) {
        console.log('✅ Found portfolio address (portfolios mapping):', portfolioAddress2);
        await verifyAndSavePortfolio(portfolioAddress2);
        return;
      }
    } catch (e) {
      console.log('Method portfolios mapping not available or failed');
    }
    
    // Method 3: getUserPortfolio (if exists)
    try {
      const portfolioAddress3 = await daoContract.getUserPortfolio(userAddress);
      if (portfolioAddress3 && portfolioAddress3 !== ethers.constants.AddressZero) {
        console.log('✅ Found portfolio address (getUserPortfolio):', portfolioAddress3);
        await verifyAndSavePortfolio(portfolioAddress3);
        return;
      }
    } catch (e) {
      console.log('Method getUserPortfolio not available or failed');
    }
    
    // Method 4: getPortfolio (returns tuple with address as first element)
    try {
      const [portfolioAddress4] = await daoContract.getPortfolio(userAddress);
      if (portfolioAddress4 && portfolioAddress4 !== ethers.constants.AddressZero) {
        console.log('✅ Found portfolio address (getPortfolio):', portfolioAddress4);
        await verifyAndSavePortfolio(portfolioAddress4);
        return;
      }
    } catch (e) {
      console.log('Method getPortfolio not available or failed');
    }
    
    console.log('\n❌ Could not find portfolio address using standard methods');
    console.log('Try checking the transaction on the block explorer for internal transactions.');
    
  } catch (error) {
    console.error('Error querying DAO for portfolio:', error);
  }
}

async function verifyAndSavePortfolio(address) {
  const provider = new ethers.providers.JsonRpcProvider(config.RPC_URL);
  
  // Check if the address has code (is a contract)
  const code = await provider.getCode(address);
  if (code !== '0x') {
    console.log('✅ Verified: Contract exists at this address');
    
    // Update the config
    config.CONTRACTS.PORTFOLIO = address;
    console.log('💾 Updated config with portfolio address');
    
    // Save the config to disk
    const fs = require('fs');
    fs.writeFileSync(
      './scripts/config.js',
      `module.exports = ${JSON.stringify(config, null, 2)};`,
      'utf8'
    );
    console.log('💾 Saved config to disk');
  } else {
    console.log('⚠️ Warning: No code found at this address');
  }
}

// Run the function
queryDaoForPortfolio().catch(console.error);
