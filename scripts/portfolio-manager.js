require('dotenv').config({ path: require('path').resolve(__dirname, '.wallets') });
const { ethers } = require('ethers');

// Contract ABIs
const PORTFOLIO_ABI = [
  // Core Portfolio Functions
  'function createPortfolio(uint256[] calldata weights, uint256 amount, bool isVePLN) external',
  'function rebalance(uint256[] calldata newWeights, bool[] calldata isShort) external',
  'function getPortfolio(address owner, address delegator) view returns (uint256[] memory, uint256, uint256, uint256, bool, uint256)',
  'function getPortfolio1(address owner, address delegator) view returns (uint256[] memory, uint256, uint256, uint256, bool, uint256, uint256, bool[] memory)',
  
  // Token Functions
  'function balanceOf(address) view returns (uint256)',
  'function approve(address, uint256) returns (bool)',
  'function allowance(address, address) view returns (uint256)'
];

// Contract addresses (Base Sepolia)
const CONTRACTS = {
  PORTFOLIO: '0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7',
  PLN: '0x9E1c51E1fAa1381D8a7Dbdd19402c5fCce9274C6'
};

// Configuration
const CONFIG = {
  RPC_URL: 'https://sepolia.base.org',
  CHAIN_ID: 84532,
  GAS_LIMIT: 3000000,
  GAS_MULTIPLIER: 1.5,
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000 // ms
};

class PortfolioManager {
  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL, CONFIG.CHAIN_ID);
    this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY_1, this.provider);
    
    // Initialize contracts
    this.portfolio = new ethers.Contract(
      CONTRACTS.PORTFOLIO,
      PORTFOLIO_ABI,
      this.wallet
    );
    
    this.plnToken = new ethers.Contract(
      CONTRACTS.PLN,
      PORTFOLIO_ABI, // Reusing ABI since it has the standard ERC20 functions we need
      this.wallet
    );
    
    this.logger = {
      info: (msg, data = '') => console.log(`[INFO] ${msg}`, data),
      error: (msg, error = '') => console.error(`[ERROR] ${msg}`, error),
      success: (msg) => console.log(`✅ ${msg}`)
    };
  }
  
  /**
   * Get portfolio details for a user
   * @param {string} owner - Portfolio owner address
   * @param {string} [delegator] - Optional delegator address
   * @returns {Promise<Object>} Portfolio details
   */
  async getPortfolioDetails(owner, delegator = null) {
    try {
      const delegate = delegator || owner;
      
      // Try the newer version first (with isShort support)
      let portfolioData;
      try {
        portfolioData = await this.portfolio.getPortfolio1(owner, delegate);
      } catch (e) {
        // Fallback to older version if newer fails
        portfolioData = await this.portfolio.getPortfolio(owner, delegate);
      }
      
      const [
        assetAmounts,
        balance,
        depositPLN,
        depositVePLN,
        isOpen,
        benchMarkRef,
        shortsValue,
        isShort = []
      ] = portfolioData;
      
      return {
        exists: assetAmounts.length > 0 || balance.gt(0) || depositPLN.gt(0) || depositVePLN.gt(0),
        assetAmounts: assetAmounts.map(a => a.toString()),
        balance: balance.toString(),
        depositPLN: depositPLN.toString(),
        depositVePLN: depositVePLN.toString(),
        isOpen,
        benchMarkRef: benchMarkRef.toString(),
        shortsValue: shortsValue ? shortsValue.toString() : '0',
        isShort: isShort.length > 0 ? isShort : Array(assetAmounts.length).fill(false)
      };
    } catch (error) {
      this.logger.error('Error getting portfolio details:', error.message);
      throw error;
    }
  }

  /**
   * Create a new portfolio with the specified weights and initial deposit
   * @param {number[]} weights - Array of weights in basis points (sum to 10000)
   * @param {string} amount - Initial deposit amount in wei
   * @param {boolean[]} isShort - Array indicating if position is short
   * @returns {Promise<Object>} Transaction receipt
   */
  async createPortfolio(weights, amount, isShort) {
    try {
      this.logger.info(`Creating portfolio with ${weights.length} assets`);
      
      // Approve token transfer if needed
      if (BigInt(amount) > 0n) {
        await this.approvePLN(amount);
      }
      
      // Create portfolio
      const tx = await this.portfolio.createPortfolio(
        weights,
        amount,
        false, // isVePLN
        {
          gasLimit: CONFIG.GAS_LIMIT,
          gasPrice: await this.getGasPrice()
        }
      );
      
      const receipt = await tx.wait();
      this.logger.success(`Portfolio created in tx: ${receipt.transactionHash}`);
      return receipt;
    } catch (error) {
      this.logger.error('Error creating portfolio:', error);
      throw error;
    }
  }

  /**
   * Rebalance portfolio with new weights and positions
   * @param {number[]} newWeights - New weights in basis points
   * @param {boolean[]} isShort - New short positions
   * @returns {Promise<Object>} Transaction receipt
   */
  async rebalancePortfolio(newWeights, isShort) {
    try {
      if (newWeights.length !== isShort.length) {
        throw new Error('Weights and isShort arrays must have the same length');
      }
      
      this.logger.info(`Rebalancing portfolio with ${newWeights.length} assets`);
      
      const tx = await this.portfolio.rebalance(
        newWeights,
        isShort,
        {
          gasLimit: CONFIG.GAS_LIMIT,
          gasPrice: await this.getGasPrice()
        }
      );
      
      const receipt = await tx.wait();
      this.logger.success(`Portfolio rebalanced in tx: ${receipt.transactionHash}`);
      return receipt;
    } catch (error) {
      this.logger.error('Error rebalancing portfolio:', error);
      throw error;
    }
  }
  
  /**
   * Ensure portfolio exists or create it
   * @param {number[]} weights - Array of weights in basis points (sum to 10000)
   * @param {boolean[]} isShort - Array indicating if position is short
   * @param {string} amount - Initial deposit amount in wei
   * @returns {Promise<Object>} Portfolio details
   */
  async ensurePortfolio(weights, isShort, amount = '0') {
    try {
      // Verify weights and isShort arrays match
      if (weights.length !== isShort.length) {
        throw new Error('Weights and isShort arrays must have the same length');
      }
      
      // Check if portfolio exists
      const portfolio = await this.getPortfolioDetails(this.wallet.address);
      
      if (!portfolio.exists) {
        this.logger.info('Portfolio does not exist, creating...');
        await this.createPortfolio(weights, amount, isShort);
        return this.getPortfolioDetails(this.wallet.address);
      }
      
      this.logger.info('Portfolio already exists');
      return portfolio;
    } catch (error) {
      this.logger.error('Error ensuring portfolio:', error);
      throw error;
    }
  }
  
  // ===== HELPER FUNCTIONS =====
  
  /**
   * Approve PLN token spending
   * @param {string} amount - Amount to approve in wei
   */
  async approvePLN(amount) {
    const allowance = await this.plnToken.allowance(
      this.wallet.address,
      CONTRACTS.PORTFOLIO
    );
    
    if (BigInt(allowance) < BigInt(amount)) {
      this.logger.info(`Approving ${ethers.utils.formatEther(amount)} PLN for spending...`);
      const tx = await this.plnToken.approve(
        CONTRACTS.PORTFOLIO,
        ethers.constants.MaxUint256,
        { gasLimit: CONFIG.GAS_LIMIT }
      );
      await tx.wait();
    }
  }
  
  /**
   * Get gas price with multiplier
   * @returns {Promise<string>} Gas price in wei
   */
  async getGasPrice() {
    const gasPrice = await this.provider.getGasPrice();
    return Math.floor(Number(gasPrice) * CONFIG.GAS_MULTIPLIER).toString();
  }
}

// Example usage
async function main() {
  const manager = new PortfolioManager();
  
  try {
    // Example weights (in basis points, e.g., 1000 = 10%)
    const weights = [4000, 3000, 2000, 1000]; // 40%, 30%, 20%, 10%
    const isShort = [false, true, false, true]; // Long, Short, Long, Short
    const initialDeposit = ethers.utils.parseEther('10').toString(); // 10 PLN
    
    // 1. Ensure portfolio exists or create it
    console.log('Ensuring portfolio exists...');
    const portfolio = await manager.ensurePortfolio(weights, isShort, initialDeposit);
    console.log('Portfolio state:', JSON.stringify(portfolio, null, 2));
    
    // 2. Rebalance with new weights
    console.log('\nRebalancing portfolio...');
    const newWeights = [3000, 4000, 2000, 1000]; // Adjusted weights
    const newIsShort = [false, true, true, false]; // Changed some positions
    
    await manager.rebalancePortfolio(newWeights, newIsShort);
    
    // 3. Get updated portfolio
    console.log('\nFetching updated portfolio...');
    const updated = await manager.getPortfolioDetails(manager.wallet.address);
    console.log('Updated portfolio state:', JSON.stringify(updated, null, 2));
    
  } catch (error) {
    console.error('❌ Error in main execution:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = PortfolioManager;
