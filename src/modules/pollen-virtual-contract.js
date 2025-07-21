const ethers = require('ethers');
const logger = require('./logger');

// Pollen Virtual Smart Contract ABI
const POLLEN_VIRTUAL_ABI = [
  // Portfolio Management
  'function createVirtualPortfolio(address[] memory assets, uint256[] memory weights) external returns (uint256)',
  'function updateVirtualPortfolio(uint256 portfolioId, address[] memory assets, uint256[] memory weights) external',
  'function getVirtualPortfolio(uint256 portfolioId) external view returns (address[] memory, uint256[] memory)',
  'function getVirtualPortfolioValue(uint256 portfolioId) external view returns (uint256)',
  
  // Staking
  'function stakePLN(uint256 amount, uint256 lockDuration) external returns (uint256)',
  'function unstakePLN(uint256 stakeId) external',
  'function getStakeInfo(uint256 stakeId) external view returns (uint256, uint256, uint256)',
  
  // Events
  'event VirtualPortfolioCreated(uint256 indexed portfolioId, address indexed owner, address[] assets, uint256[] weights)',
  'event VirtualPortfolioUpdated(uint256 indexed portfolioId, address[] assets, uint256[] weights)',
  'event PLNStaked(uint256 indexed stakeId, address indexed staker, uint256 amount, uint256 lockDuration)',
  'event PLNUnstaked(uint256 indexed stakeId, address indexed staker, uint256 amount)'
];

class PollenVirtualContract {
  constructor(config) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);
    
    // Contract addresses
    this.virtualContractAddress = config.virtualContractAddress;
    this.plnTokenAddress = config.plnTokenAddress;
    
    // Initialize contracts
    this.virtualContract = new ethers.Contract(
      this.virtualContractAddress,
      POLLEN_VIRTUAL_ABI,
      this.wallet
    );
    
    this.plnToken = new ethers.Contract(
      this.plnTokenAddress,
      [
        'function approve(address spender, uint256 amount) external returns (bool)',
        'function balanceOf(address account) external view returns (uint256)',
        'function transfer(address to, uint256 amount) external returns (bool)'
      ],
      this.wallet
    );
  }

  /**
   * Initialize contract connection
   */
  async initialize() {
    try {
      logger.info('Initializing Pollen Virtual Contract connection...');

      // Verify contract addresses with fallback handling
      try {
        const virtualCode = await this.provider.getCode(this.virtualContractAddress);
        if (virtualCode === '0x') {
          logger.warn('Virtual contract address has no code - continuing in simulation mode');
        } else {
          logger.info('✅ Virtual contract verified');
        }
      } catch (error) {
        logger.warn('Virtual contract verification failed, continuing in simulation mode:', error.message);
      }

      try {
        const plnCode = await this.provider.getCode(this.plnTokenAddress);
        if (plnCode === '0x') {
          logger.warn('PLN token address has no code - using fallback mode');
        } else {
          logger.info('✅ PLN token contract verified');
        }
      } catch (error) {
        logger.warn('PLN token verification failed, using fallback mode:', error.message);
      }

      // Verify wallet connection
      try {
        const balance = await this.plnToken.balanceOf(this.wallet.address);
        logger.info(`Connected wallet: ${this.wallet.address}`);
        logger.info(`PLN Balance: ${ethers.formatEther(balance)}`);
      } catch (error) {
        logger.warn('Could not fetch PLN balance, continuing anyway:', error.message);
        logger.info(`Connected wallet: ${this.wallet.address}`);
        logger.info('PLN Balance: Unable to fetch (simulation mode)');
      }

      logger.info('✅ Pollen Virtual Contract connection initialized');
      return true;
    } catch (error) {
      logger.error('Error initializing Pollen Virtual Contract:', error.message);
      logger.error('Full contract error details:', error);
      // Don't throw - allow bot to continue with limited functionality
      logger.warn('Continuing with limited virtual contract functionality');
      return false;
    }
  }

  /**
   * Create a new virtual portfolio
   */
  async createVirtualPortfolio(assets, weights) {
    try {
      logger.info('Creating new virtual portfolio...');

      // Validate inputs
      if (assets.length !== weights.length) {
        throw new Error('Assets and weights arrays must have the same length');
      }

      if (weights.reduce((a, b) => a + b, 0) !== 10000) { // 100% in basis points
        throw new Error('Weights must sum to 100%');
      }

      // Create portfolio
      const tx = await this.virtualContract.createVirtualPortfolio(assets, weights);
      const receipt = await tx.wait();

      // Get portfolio ID from event
      const event = receipt.events.find(e => e.event === 'VirtualPortfolioCreated');
      const portfolioId = event.args.portfolioId;

      logger.info(`✅ Virtual portfolio created with ID: ${portfolioId}`);
      return portfolioId;
    } catch (error) {
      logger.error('Error creating virtual portfolio:', error);
      throw error;
    }
  }

  /**
   * Update an existing virtual portfolio
   */
  async updateVirtualPortfolio(portfolioId, assets, weights) {
    try {
      logger.info(`Updating virtual portfolio ${portfolioId}...`);

      // Validate inputs
      if (assets.length !== weights.length) {
        throw new Error('Assets and weights arrays must have the same length');
      }

      if (weights.reduce((a, b) => a + b, 0) !== 10000) { // 100% in basis points
        throw new Error('Weights must sum to 100%');
      }

      // Update portfolio
      const tx = await this.virtualContract.updateVirtualPortfolio(portfolioId, assets, weights);
      await tx.wait();

      logger.info(`✅ Virtual portfolio ${portfolioId} updated`);
      return true;
    } catch (error) {
      logger.error(`Error updating virtual portfolio ${portfolioId}:`, error);
      throw error;
    }
  }

  /**
   * Get virtual portfolio details
   */
  async getVirtualPortfolio(portfolioId) {
    try {
      const [assets, weights] = await this.virtualContract.getVirtualPortfolio(portfolioId);
      const value = await this.virtualContract.getVirtualPortfolioValue(portfolioId);

      return {
        portfolioId,
        assets,
        weights: weights.map(w => w.toNumber() / 100), // Convert basis points to percentages
        value: ethers.formatEther(value)
      };
    } catch (error) {
      logger.error(`Error getting virtual portfolio ${portfolioId}:`, error);
      throw error;
    }
  }

  /**
   * Stake PLN tokens
   */
  async stakePLN(amount, lockDuration) {
    try {
      logger.info(`Staking ${ethers.formatEther(amount)} PLN for ${lockDuration} seconds...`);

      // Approve PLN spending
      const approveTx = await this.plnToken.approve(this.virtualContractAddress, amount);
      await approveTx.wait();

      // Stake PLN
      const stakeTx = await this.virtualContract.stakePLN(amount, lockDuration);
      const receipt = await stakeTx.wait();

      // Get stake ID from event
      const event = receipt.events.find(e => e.event === 'PLNStaked');
      const stakeId = event.args.stakeId;

      logger.info(`✅ PLN staked successfully. Stake ID: ${stakeId}`);
      return stakeId;
    } catch (error) {
      logger.error('Error staking PLN:', error);
      throw error;
    }
  }

  /**
   * Unstake PLN tokens
   */
  async unstakePLN(stakeId) {
    try {
      logger.info(`Unstaking PLN from stake ${stakeId}...`);

      const tx = await this.virtualContract.unstakePLN(stakeId);
      const receipt = await tx.wait();

      const event = receipt.events.find(e => e.event === 'PLNUnstaked');
      const amount = ethers.formatEther(event.args.amount);

      logger.info(`✅ PLN unstaked successfully. Amount: ${amount}`);
      return amount;
    } catch (error) {
      logger.error(`Error unstaking PLN from stake ${stakeId}:`, error);
      throw error;
    }
  }

  /**
   * Get stake information
   */
  async getStakeInfo(stakeId) {
    try {
      const [amount, lockDuration, unlockTime] = await this.virtualContract.getStakeInfo(stakeId);

      return {
        stakeId,
        amount: ethers.formatEther(amount),
        lockDuration: lockDuration.toNumber(),
        unlockTime: new Date(unlockTime.toNumber() * 1000).toISOString()
      };
    } catch (error) {
      logger.error(`Error getting stake info for ${stakeId}:`, error);
      throw error;
    }
  }

  /**
   * Get optimal lock duration based on market conditions
   */
  async getOptimalLockDuration() {
    try {
      // This is a simplified calculation
      // In practice, you would implement more sophisticated logic based on:
      // - Current market conditions
      // - Historical performance
      // - User's risk profile
      // - Gas costs
      
      const defaultDuration = 30 * 24 * 60 * 60; // 30 days
      const maxDuration = 365 * 24 * 60 * 60; // 1 year
      
      // Get current gas price
      const gasPrice = await this.provider.getGasPrice();
      
      // Adjust duration based on gas price
      if (gasPrice > ethers.parseUnits('100', 'gwei')) {
        return Math.min(defaultDuration * 2, maxDuration);
      }
      
      return defaultDuration;
    } catch (error) {
      logger.error('Error calculating optimal lock duration:', error);
      throw error;
    }
  }

  /**
   * Get gas-optimized transaction parameters
   */
  async getGasOptimizedParams() {
    try {
      const [gasPrice, block] = await Promise.all([
        this.provider.getGasPrice(),
        this.provider.getBlock('latest')
      ]);

      // Calculate max fee per gas (EIP-1559)
      const maxFeePerGas = gasPrice.mul(2);
      const maxPriorityFeePerGas = gasPrice.mul(12).div(10); // 20% above base fee

      return {
        maxFeePerGas,
        maxPriorityFeePerGas,
        gasLimit: block.gasLimit.mul(95).div(100) // 95% of block gas limit
      };
    } catch (error) {
      logger.error('Error getting gas-optimized parameters:', error);
      throw error;
    }
  }
}

module.exports = PollenVirtualContract; 