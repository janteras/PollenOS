const { ethers } = require('ethers');
require('dotenv').config();

// Configuration
const RPC_URL = 'https://sepolia.base.org';
const PRIVATE_KEY = process.env.PRIVATE_KEY; // Make sure to set this in your .env file

// Pollen Protocol addresses on Base Sepolia
const POLLEN_DAO_ADDRESS = '0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7';
const VE_PLN_ADDRESS = '0x3a28AB567b661B3edaF9Ef0bDE9489558EDB3995';
const USER_ADDRESS = '0x561529036AB886c1FD3D112360383D79fBA9E71c';

// Portfolio configuration
const PORTFOLIO_CONFIG = {
  // Amount of vePLN to stake (in wei)
  amount: ethers.utils.parseEther('10'), // 10 vePLN
  
  // Weights for each asset (in basis points, e.g., 5000 = 50%)
  // Example with 7 assets, adjust based on the actual number of assets
  weights: [
    ethers.BigNumber.from('1600'), // 16%
    ethers.BigNumber.from('1400'), // 14%
    ethers.BigNumber.from('1400'), // 14%
    ethers.BigNumber.from('1400'), // 14%
    ethers.BigNumber.from('1400'), // 14%
    ethers.BigNumber.from('1400'), // 14%
    ethers.BigNumber.from('1400')  // 14%
  ],
  
  // Whether each position is short (false = long)
  shorts: [false, false, false, false, false, false, false],
  
  // Whether to use vePLN (true) or PLN (false)
  isVePln: false // Using PLN based on the transaction we saw
};

// ABI for PollenDAO
const POLLEN_DAO_ABI = [
  'function getPortfolio(address owner) external view returns (address, uint256[] memory, uint256, uint256)',
  'function getPortfolio1(address owner, address delegate) external view returns (address, uint256[] memory, uint256, uint256, bool[] memory, uint256)',
  'function createPortfolio(uint256 amount, uint256[] calldata weights, bool[] calldata shorts, bool tokenType)',
  'function rebalancePortfolio(uint256[] calldata newWeights, bool[] calldata newShorts, uint256 amount, bool tokenType)'
];

// ABI for vePLN token
const VE_PLN_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)'
];

class PortfolioManager {
  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    this.wallet = new ethers.Wallet(PRIVATE_KEY, this.provider);
    
    // Initialize contracts
    this.pollenDao = new ethers.Contract(POLLEN_DAO_ADDRESS, POLLEN_DAO_ABI, this.wallet);
    this.vePln = new ethers.Contract(VE_PLN_ADDRESS, VE_PLN_ABI, this.wallet);
    
    // Portfolio state
    this.portfolioAddress = null;
    this.portfolioExists = false;
  }

  // Check if a portfolio exists for the user
  async checkPortfolio() {
    try {
      console.log('🔍 Checking for existing portfolio...');
      
      // Try the newer getPortfolio1 function first
      try {
        const portfolio = await this.pollenDao.getPortfolio1(USER_ADDRESS, USER_ADDRESS);
        if (portfolio && portfolio[0] !== ethers.constants.AddressZero) {
          console.log('✅ Found portfolio using getPortfolio1:');
          console.log('- Address:', portfolio[0]);
          console.log('- Amounts:', portfolio[1].map(a => a.toString()));
          console.log('- Total Value:', portfolio[2].toString());
          console.log('- Timestamp:', new Date(portfolio[3].toNumber() * 1000).toISOString());
          console.log('- Shorts:', portfolio[4]);
          console.log('- Short Value:', portfolio[5].toString());
          
          this.portfolioAddress = portfolio[0];
          this.portfolioExists = true;
          return true;
        }
      } catch (e) {
        console.log('ℹ️ getPortfolio1 not available, trying getPortfolio...');
      }
      
      // Fall back to the older getPortfolio function
      try {
        const portfolio = await this.pollenDao.getPortfolio(USER_ADDRESS);
        if (portfolio && portfolio[0] !== ethers.constants.AddressZero) {
          console.log('✅ Found portfolio using getPortfolio:');
          console.log('- Address:', portfolio[0]);
          console.log('- Amounts:', portfolio[1].map(a => a.toString()));
          console.log('- Total Value:', portfolio[2].toString());
          console.log('- Timestamp:', new Date(portfolio[3].toNumber() * 1000).toISOString());
          
          this.portfolioAddress = portfolio[0];
          this.portfolioExists = true;
          return true;
        }
      } catch (e) {
        console.log('⚠️ Error querying portfolio:', e.message);
      }
      
      console.log('ℹ️ No active portfolio found');
      return false;
      
    } catch (error) {
      console.error('❌ Error checking portfolio:', error);
      throw error;
    }
  }

  // Approve PollenDAO to spend vePLN
  async approvePollenDao(amount) {
    try {
      const allowance = await this.vePln.allowance(USER_ADDRESS, POLLEN_DAO_ADDRESS);
      
      if (allowance.lt(amount)) {
        console.log(`🔄 Approving PollenDAO to spend ${ethers.utils.formatEther(amount)} vePLN...`);
        const tx = await this.vePln.approve(POLLEN_DAO_ADDRESS, amount);
        await tx.wait();
        console.log('✅ Approval successful');
      } else {
        console.log('ℹ️ Sufficient allowance already set');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Error approving vePLN:', error);
      throw error;
    }
  }

  // Create a new portfolio
  async createPortfolio() {
    try {
      console.log('🚀 Creating new portfolio...');
      
      // Check if portfolio already exists
      if (this.portfolioExists) {
        console.log('ℹ️ Portfolio already exists, use rebalance instead');
        return false;
      }
      
      // Check vePLN balance first
      const balance = await this.vePln.balanceOf(USER_ADDRESS);
      console.log('💰 vePLN Balance:', ethers.utils.formatEther(balance), 'vePLN');
      
      if (balance.lt(PORTFOLIO_CONFIG.amount)) {
        throw new Error(`Insufficient vePLN balance. Required: ${ethers.utils.formatEther(PORTFOLIO_CONFIG.amount)} vePLN, Available: ${ethers.utils.formatEther(balance)} vePLN`);
      }
      
      // Approve tokens if needed
      await this.approvePollenDao(PORTFOLIO_CONFIG.amount);
      
      console.log('📊 Portfolio configuration:');
      console.log('- Amount:', ethers.utils.formatEther(PORTFOLIO_CONFIG.amount), PORTFOLIO_CONFIG.isVePln ? 'vePLN' : 'PLN');
      console.log('- Weights:', PORTFOLIO_CONFIG.weights.map(w => w.toString()));
      console.log('- Shorts:', PORTFOLIO_CONFIG.shorts);
      
      // Estimate gas first
      console.log('⏳ Estimating gas...');
      const estimatedGas = await this.pollenDao.estimateGas.createPortfolio(
        PORTFOLIO_CONFIG.amount,
        PORTFOLIO_CONFIG.weights,
        PORTFOLIO_CONFIG.shorts,
        PORTFOLIO_CONFIG.isVePln
      );
      
      console.log('⛽ Estimated gas:', estimatedGas.toString());
      
      // Get current gas price
      const gasPrice = await this.provider.getGasPrice();
      console.log('⛽ Current gas price:', ethers.utils.formatUnits(gasPrice, 'gwei'), 'gwei');
      
      // Create portfolio with higher gas limit
      console.log('⏳ Sending transaction...');
      const tx = await this.pollenDao.createPortfolio(
        PORTFOLIO_CONFIG.amount,
        PORTFOLIO_CONFIG.weights,
        PORTFOLIO_CONFIG.shorts,
        PORTFOLIO_CONFIG.isVePln,
        { 
          gasLimit: estimatedGas.mul(15).div(10), // 50% more than estimated
          gasPrice: gasPrice.mul(12).div(10) // 20% higher gas price
        }
      );
      
      console.log('⏳ Waiting for transaction confirmation...');
      console.log('Transaction hash:', tx.hash);
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        console.log('✅ Portfolio created successfully!');
        console.log('Transaction hash:', receipt.transactionHash);
        
        // Try to find the portfolio address in the transaction receipt
        await this.findPortfolioAddress(receipt);
        return true;
      } else {
        throw new Error('Transaction reverted!');
      }
    } catch (error) {
      console.error('❌ Error creating portfolio:', error);
      throw error;
    }
  }

  // Rebalance an existing portfolio
  async rebalancePortfolio() {
    try {
      console.log('🔄 Rebalancing portfolio...');
      
      // Check if portfolio exists
      if (!this.portfolioExists || !this.portfolioAddress) {
        console.log('ℹ️ No existing portfolio found, creating a new one...');
        return this.createPortfolio();
      }
      
      console.log('📊 New portfolio configuration:');
      console.log('- Weights:', PORTFOLIO_CONFIG.weights.map(w => w.toString()));
      console.log('- Shorts:', PORTFOLIO_CONFIG.shorts);
      
      // Rebalance portfolio
      console.log('⏳ Sending transaction...');
      const tx = await this.pollenDao.rebalancePortfolio(
        PORTFOLIO_CONFIG.weights,
        PORTFOLIO_CONFIG.shorts,
        ethers.BigNumber.from('0'), // No additional amount
        PORTFOLIO_CONFIG.isVePln,
        { gasLimit: 1000000 }
      );
      
      console.log('⏳ Waiting for transaction confirmation...');
      const receipt = await tx.wait();
      
      console.log('✅ Portfolio rebalanced successfully!');
      console.log('Transaction hash:', receipt.transactionHash);
      
      return true;
    } catch (error) {
      console.error('❌ Error rebalancing portfolio:', error);
      throw error;
    }
  }

  // Find portfolio address in transaction receipt
  async findPortfolioAddress(receipt) {
    try {
      // Check if any contracts were created in this transaction
      if (receipt.contractAddress) {
        console.log('✅ Contract created at:', receipt.contractAddress);
        const code = await this.provider.getCode(receipt.contractAddress);
        if (code !== '0x') {
          console.log('✅ Contract has code, saving to config...');
          await this.updateConfigWithPortfolio(receipt.contractAddress);
          return receipt.contractAddress;
        }
      }
      
      // If no direct contract creation, try to find in logs
      console.log('🔍 Looking for PortfolioCreated event in logs...');
      const iface = new ethers.utils.Interface([
        'event PortfolioCreated(address indexed creator, uint256 amount, uint256[] weights, bool tokenType)'
      ]);
      
      for (const log of receipt.logs) {
        try {
          const parsedLog = iface.parseLog(log);
          if (parsedLog && parsedLog.name === 'PortfolioCreated') {
            console.log('🎉 Found PortfolioCreated event:');
            console.log('- Creator:', parsedLog.args.creator);
            console.log('- Amount:', ethers.utils.formatEther(parsedLog.args.amount));
            console.log('- Token Type:', parsedLog.args.tokenType ? 'vePLN' : 'PLN');
            
            // The portfolio address isn't in the event, so we'll need to find it another way
            // Try to get it from the contract
            const portfolio = await this.pollenDao.getPortfolio(USER_ADDRESS).catch(() => null) ||
                             await this.pollenDao.getPortfolio1(USER_ADDRESS, USER_ADDRESS).catch(() => null);
            
            if (portfolio && portfolio[0] !== ethers.constants.AddressZero) {
              console.log('✅ Found portfolio address:', portfolio[0]);
              await this.updateConfigWithPortfolio(portfolio[0]);
              return portfolio[0];
            }
          }
        } catch (e) {
          // Not the log we're looking for
          continue;
        }
      }
      
      console.log('⚠️ Could not find portfolio address in transaction receipt');
      return null;
    } catch (error) {
      console.error('❌ Error finding portfolio address:', error);
      return null;
    }
  }

  // Update the config file with the portfolio address
  async updateConfigWithPortfolio(address) {
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Update the config object
      if (!config.CONTRACTS) config.CONTRACTS = {};
      config.CONTRACTS.PORTFOLIO = address;
      
      // Save the config to disk
      const configPath = path.join(__dirname, 'config.js');
      fs.writeFileSync(
        configPath,
        `module.exports = ${JSON.stringify(config, null, 2)};`,
        'utf8'
      );
      
      console.log('✅ Updated config with portfolio address:', address);
      console.log(`📝 Config saved to: ${configPath}`);
      
      return true;
    } catch (error) {
      console.error('❌ Error updating config:', error);
      return false;
    }
  }
}

// Main function
async function main() {
  try {
    const manager = new PortfolioManager();
    
    // Check if a portfolio already exists
    const portfolioExists = await manager.checkPortfolio();
    
    if (portfolioExists) {
      console.log('\n🔄 Portfolio exists, rebalancing...');
      await manager.rebalancePortfolio();
    } else {
      console.log('\n🚀 No portfolio found, creating a new one...');
      await manager.createPortfolio();
    }
    
    console.log('\n✅ Done!');
  } catch (error) {
    console.error('❌ Error in main:', error);
    process.exit(1);
  }
}

// Run the main function
if (require.main === module) {
  main().catch(console.error);
}

module.exports = PortfolioManager;
