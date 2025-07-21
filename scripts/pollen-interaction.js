require('dotenv').config({ path: require('path').resolve(__dirname, '../base-sepolia.env') });
const { ethers } = require('ethers');
const config = require('./config');

// Contract ABIs
const LOCKED_POLLEN_ABI = [
  'function lock(uint256 amount, uint256 lockEnd) external',
  'function extendLock(uint256 newLockEnd) external',
  'function increaseLock(uint256 amount) external',
  'function locks(address) view returns (uint256 lockStart, uint256 lockEnd, uint256 amount, uint256 offset, uint256 claimable)',
  'function getVotingPower(address) view returns (uint256)',
  'function claimRewards() external',
  'function balanceOf(address) view returns (uint256)'
];

const PORTFOLIO_ABI = [
  'function rebalancePortfolio(uint256[] memory weights, bool[] memory isShort, uint256 amount, bool tokenType) external',
  'function rebalanceBenchMarkPortfolio(uint256[] memory weights) external',
  'function getPortfolio(address owner, address delegator, bool tokenType) view returns (uint256[] memory, uint256, uint256, uint256, bool, uint256, uint256, bool[] memory)'
];

class PollenInteractor {
  constructor() {
    // Initialize provider and wallet
    this.provider = new ethers.JsonRpcProvider(config.RPC_URL);
    this.wallet = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, this.provider);
    
    // Initialize contracts
    this.lockedPollen = new ethers.Contract(
      config.CONTRACTS.VEPLN,
      LOCKED_POLLEN_ABI,
      this.wallet
    );
    
    this.portfolio = new ethers.Contract(
      config.CONTRACTS.PORTFOLIO,
      PORTFOLIO_ABI,
      this.wallet
    );
    
    this.logger = console;
  }

  // ========================
  // Staking/Locking Functions
  // ========================
  
  /**
   * Lock PLN tokens for a specified duration
   * @param {string} amount - Amount of PLN to lock (in wei or as a decimal string)
   * @param {number} lockDurationInDays - Lock duration in days
   */
  async lockPLN(amount, lockDurationInDays) {
    try {
      const amountWei = ethers.parseEther(amount.toString());
      const lockEnd = Math.floor(Date.now() / 1000) + (lockDurationInDays * 24 * 60 * 60);
      
      this.logger.log(`Locking ${ethers.formatEther(amountWei)} PLN for ${lockDurationInDays} days...`);
      
      const tx = await this.lockedPollen.lock(amountWei, lockEnd, {
        gasLimit: 300000,
      });
      
      this.logger.log(`Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      this.logger.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
      
      return receipt;
    } catch (error) {
      this.logger.error('Error locking PLN:', error);
      throw error;
    }
  }
  
  /**
   * Extend the lock duration for an existing lock
   * @param {number} additionalDays - Additional days to extend the lock
   */
  async extendLock(additionalDays) {
    try {
      const lockInfo = await this.getLockInfo();
      if (lockInfo.amount === 0n) {
        throw new Error('No active lock found');
      }
      
      const newLockEnd = Math.max(
        Number(lockInfo.lockEnd) + (additionalDays * 24 * 60 * 60),
        Math.floor(Date.now() / 1000) + (additionalDays * 24 * 60 * 60)
      );
      
      this.logger.log(`Extending lock by ${additionalDays} days until ${new Date(newLockEnd * 1000).toISOString()}`);
      
      const tx = await this.lockedPollen.extendLock(newLockEnd, {
        gasLimit: 300000,
      });
      
      this.logger.log(`Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      this.logger.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
      
      return receipt;
    } catch (error) {
      this.logger.error('Error extending lock:', error);
      throw error;
    }
  }
  
  /**
   * Add more tokens to an existing lock
   * @param {string} amount - Additional amount of PLN to lock (in wei or as a decimal string)
   */
  async increaseLock(amount) {
    try {
      const amountWei = ethers.parseEther(amount.toString());
      
      this.logger.log(`Adding ${ethers.formatEther(amountWei)} PLN to existing lock...`);
      
      const tx = await this.lockedPollen.increaseLock(amountWei, {
        gasLimit: 300000,
      });
      
      this.logger.log(`Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      this.logger.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
      
      return receipt;
    } catch (error) {
      this.logger.error('Error increasing lock amount:', error);
      throw error;
    }
  }
  
  /**
   * Get lock information for the current wallet
   */
  async getLockInfo() {
    try {
      const lockInfo = await this.lockedPollen.locks(this.wallet.address);
      return {
        lockStart: Number(lockInfo.lockStart),
        lockEnd: Number(lockInfo.lockEnd),
        amount: lockInfo.amount,
        offset: lockInfo.offset,
        claimable: lockInfo.claimable
      };
    } catch (error) {
      this.logger.error('Error getting lock info:', error);
      throw error;
    }
  }
  
  // ========================
  // Portfolio Rebalancing
  // ========================
  
  /**
   * Rebalance the portfolio with new weights
   * @param {number[]} weights - Array of weights (sum should be 100%)
   * @param {boolean[]} isShort - Array indicating if each position is short
   * @param {string} amount - Total amount to rebalance (in wei or as a decimal string)
   * @param {boolean} useVePLN - Whether to use vePLN (true) or PLN (false)
   */
  async rebalancePortfolio(weights, isShort, amount, useVePLN = false) {
    try {
      const amountWei = ethers.parseEther(amount.toString());
      
      this.logger.log(`Rebalancing portfolio with ${weights.length} assets...`);
      this.logger.log('Weights:', weights);
      this.logger.log('Short positions:', isShort);
      this.logger.log(`Amount: ${ethers.formatEther(amountWei)} ${useVePLN ? 'vePLN' : 'PLN'}`);
      
      const tx = await this.portfolio.rebalancePortfolio(
        weights.map(w => Math.floor(w * 100)), // Convert to basis points (e.g., 0.5 -> 50)
        isShort,
        amountWei,
        useVePLN,
        { gasLimit: 1000000 }
      );
      
      this.logger.log(`Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      this.logger.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
      
      return receipt;
    } catch (error) {
      this.logger.error('Error rebalancing portfolio:', error);
      throw error;
    }
  }
  
  /**
   * Rebalance the benchmark portfolio
   * @param {number[]} weights - Array of weights (sum should be 100%)
   */
  async rebalanceBenchmarkPortfolio(weights) {
    try {
      this.logger.log('Rebalancing benchmark portfolio with weights:', weights);
      
      const tx = await this.portfolio.rebalanceBenchMarkPortfolio(
        weights.map(w => Math.floor(w * 100)), // Convert to basis points
        { gasLimit: 1000000 }
      );
      
      this.logger.log(`Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      this.logger.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
      
      return receipt;
    } catch (error) {
      this.logger.error('Error rebalancing benchmark portfolio:', error);
      throw error;
    }
  }
  
  /**
   * Get current portfolio information
   */
  async getPortfolioInfo() {
    try {
      const result = await this.portfolio.getPortfolio(
        this.wallet.address, // owner
        ethers.ZeroAddress,  // delegator (zero address for self)
        false                // tokenType (false for PLN)
      );
      
      return {
        assetAmounts: result[0].map(amt => ethers.formatEther(amt)),
        balance: ethers.formatEther(result[1]),
        depositPLN: ethers.formatEther(result[2]),
        depositVePLN: ethers.formatEther(result[3]),
        isOpen: result[4],
        benchMarkRef: result[5],
        shortsValue: ethers.formatEther(result[6]),
        isShort: result[7]
      };
    } catch (error) {
      this.logger.error('Error getting portfolio info:', error);
      throw error;
    }
  }
  
  // ========================
  // Utility Functions
  // ========================
  
  /**
   * Get voting power for the current wallet
   */
  async getVotingPower() {
    try {
      const votingPower = await this.lockedPollen.getVotingPower(this.wallet.address);
      return {
        raw: votingPower,
        formatted: ethers.formatEther(votingPower)
      };
    } catch (error) {
      this.logger.error('Error getting voting power:', error);
      throw error;
    }
  }
  
  /**
   * Claim rewards from locked PLN
   */
  async claimRewards() {
    try {
      this.logger.log('Claiming rewards...');
      
      const tx = await this.lockedPollen.claimRewards({
        gasLimit: 300000,
      });
      
      this.logger.log(`Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      this.logger.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
      
      return receipt;
    } catch (error) {
      this.logger.error('Error claiming rewards:', error);
      throw error;
    }
  }
}

// Example usage
async function main() {
  const interactor = new PollenInteractor();
  
  try {
    // Example: Lock PLN for 30 days
    // await interactor.lockPLN('100', 30);
    
    // Example: Extend lock by 30 more days
    // await interactor.extendLock(30);
    
    // Example: Add more to existing lock
    // await interactor.increaseLock('50');
    
    // Example: Rebalance portfolio (50% asset 0, 50% asset 1, no short positions)
    // await interactor.rebalancePortfolio([0.5, 0.5], [false, false], '100', false);
    
    // Example: Get current lock info
    const lockInfo = await interactor.getLockInfo();
    console.log('Lock Info:', {
      ...lockInfo,
      amount: ethers.formatEther(lockInfo.amount) + ' PLN',
      lockEnd: new Date(lockInfo.lockEnd * 1000).toISOString(),
      lockStart: new Date(lockInfo.lockStart * 1000).toISOString()
    });
    
    // Example: Get voting power
    const votingPower = await interactor.getVotingPower();
    console.log('Voting Power:', votingPower.formatted, 'vePLN');
    
    // Example: Get portfolio info
    const portfolioInfo = await interactor.getPortfolioInfo();
    console.log('Portfolio Info:', JSON.stringify(portfolioInfo, null, 2));
    
  } catch (error) {
    console.error('Error in main:', error);
  }
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
}

module.exports = PollenInteractor;
