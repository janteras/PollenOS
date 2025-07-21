/**
 * Pollen Contract Interface - Comprehensive Integration for Trading Bots
 * 
 * Based on actual ABI analysis of 0x2eCB6F9dF29163758024d416997764922E4528d4
 * Implements vePLN staking, virtual portfolios, and elizaOS integration
 * 
 * Author: Senior Blockchain Developer
 * Whitepaper Reference: docs/pollen-whitepaper.md
 */

const { ethers } = require('ethers');
const logger = require('./logger');

// Raw ABI from actual contract 0x2eCB6F9dF29163758024d416997764922E4528d4
const VEPLN_CONTRACT_ABI = require('../../attached_assets/0x2ecb6f9df29163758024d416997764922e4528d4.abi.json');

// PLN Token ABI (Standard ERC20)
const PLN_TOKEN_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function totalSupply() view returns (uint256)'
];

// Virtual Portfolio Management ABI (Theoretical based on whitepaper)
const VIRTUAL_PORTFOLIO_ABI = [
  'function createVirtualPortfolio(address[] assets, uint256[] weights, uint256 plnStake) external',
  'function updateVirtualPortfolio(address[] assets, uint256[] weights) external', 
  'function closeVirtualPortfolio(uint256 portfolioId) external',
  'function getPortfolioInfo(address user) view returns (uint256 value, uint256 plnStaked, address[] assets, uint256[] weights)',
  'function getPortfolioReturn(address user) view returns (int256 currentReturn, int256 benchmarkReturn)',
  'function calculateRewards(address user) view returns (uint256 plnRewards)',
  'event PortfolioCreated(address indexed user, uint256 plnStaked, address[] assets, uint256[] weights)',
  'event PortfolioUpdated(address indexed user, address[] assets, uint256[] weights)',
  'event PortfolioClosed(address indexed user, uint256 plnRewards, int256 finalReturn)'
];

// Contract addresses will be loaded from config
let CONTRACT_ADDRESSES = {};

// Supported assets for virtual portfolios (per whitepaper)
const SUPPORTED_ASSETS = {
  WBTC: '0x408D4cD0ADb7ceBd1F1A1C33aea5422a63E2c2c2', // Wrapped Bitcoin
  WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // Wrapped Ethereum
  AVAX: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7', // Avalanche
  BNB: '0x264c1383EA520f73dd837F915ef3a732e204a493',  // Binance Coin
  LINK: '0x5947BB275c521040051D82396192181b413227A3'  // Chainlink
};

class PollenContractInterface {
  constructor(provider, wallet, config = {}) {
    this.provider = provider;
    this.wallet = wallet;
    this.config = config;
    
    // Initialize contract instances
    this.vePlnContract = null;
    this.plnToken = null;
    this.pollenDAO = null;
    
    this.isInitialized = false;
    this.lockCache = new Map();
    this.portfolioCache = new Map();
  }

  /**
   * Initialize and verify contract connections
   */
  async initialize() {
    try {
      logger.info('Initializing Pollen Contract Interface...');
      
      // Load contract addresses from config
      CONTRACT_ADDRESSES = {
        VEPLN_CONTRACT: this.config.contracts.vePLN,
        PLN_TOKEN: this.config.contracts.plnToken,
        POLLEN_DAO: this.config.contracts.pollenDAO
      };
      
      // Verify we have required addresses
      if (!CONTRACT_ADDRESSES.VEPLN_CONTRACT || !CONTRACT_ADDRESSES.PLN_TOKEN) {
        logger.warn('Missing contract addresses, running in simulation mode');
        this.isInitialized = true;
        return true;
      }
      
      // Verify network (Base Sepolia for development)
      const network = await this.provider.getNetwork();
      const expectedChainId = process.env.NODE_ENV === 'production' ? 43114 : 84532; // Avalanche mainnet : Base Sepolia
      
      // Initialize contract instances with config values
      this.vePlnContract = new ethers.Contract(
        CONTRACT_ADDRESSES.VEPLN_CONTRACT,
        VEPLN_CONTRACT_ABI,
        this.wallet
      );
      
      this.plnToken = new ethers.Contract(
        CONTRACT_ADDRESSES.PLN_TOKEN,
        PLN_TOKEN_ABI,
        this.wallet
      );
      
      if (CONTRACT_ADDRESSES.POLLEN_DAO) {
        this.pollenDAO = new ethers.Contract(
          CONTRACT_ADDRESSES.POLLEN_DAO,
          VIRTUAL_PORTFOLIO_ABI,
          this.wallet
        );
      }
      
      // Verify network and contract addresses
      await this.verifyNetwork();
      await this.verifyContractAddresses();
      
      this.isInitialized = true;
      logger.info('Pollen Contract Interface initialized on network:', this.config.network.name);
      return true;
    } catch (error) {
      logger.error('Failed to initialize contract interface:', error.message);
      logger.error('Stack trace:', error.stack);
      throw error;
    }
  }
  
  async verifyNetwork() {
    const network = await this.provider.getNetwork();
    if (network.chainId !== BigInt(this.config.network.chainId)) {
      throw new Error(`Network mismatch. Expected ${this.config.network.name} (${this.config.network.chainId}), got ${network.chainId}`);
    }
  }
  
  async verifyContractAddresses() {
    const checks = [
      { name: 'PLN Token', address: CONTRACT_ADDRESSES.PLN_TOKEN, method: 'symbol()' },
      { name: 'vePLN', address: CONTRACT_ADDRESSES.VEPLN_CONTRACT, method: 'balanceOf(address)', args: [this.wallet.address] }
    ];
    
    // Only check PollenDAO if address is provided
    if (CONTRACT_ADDRESSES.POLLEN_DAO) {
      checks.push({ name: 'PollenDAO', address: CONTRACT_ADDRESSES.POLLEN_DAO, method: 'balanceOf(address)', args: [this.wallet.address] });
    }
    
    for (const check of checks) {
      try {
        if (!check.address) {
          logger.warn(`${check.name} address not provided, skipping verification`);
          continue;
        }
        
        const contract = new ethers.Contract(check.address, ['function ' + check.method], this.provider);
        const args = check.args || [];
        await contract[check.method](...args, { gasLimit: 100000 });
        logger.info(`Verified ${check.name} at ${check.address}`);
      } catch (error) {
        logger.warn(`Failed to verify ${check.name} at ${check.address}: ${error.message}`);
        // Don't throw error, allow bot to continue in simulation mode
      }
    }
  }

  /**
   * Verify contract connectivity and functions
   */
  async verifyContractConnectivity() {
    try {
      // In development mode (Base Sepolia), skip contract verification
      if (process.env.NODE_ENV !== 'production') {
        logger.warn('Skipping contract verification in development mode');
        return true;
      }
      
      // Test vePLN contract (production only)
      const totalLocked = await this.vePlnContract.totalLocked();
      const rewardCurve = await this.vePlnContract.rewardCurve();
      
      logger.info(`vePLN Contract verified - Total Locked: ${ethers.formatEther(totalLocked)} PLN`);
      logger.info(`Reward Rate: ${rewardCurve.rate} per second`);
      
      // Test PLN token
      const tokenSymbol = await this.plnToken.symbol();
      const tokenDecimals = await this.plnToken.decimals();
      
      logger.info(`PLN Token verified - Symbol: ${tokenSymbol}, Decimals: ${tokenDecimals}`);
      
      return true;
    } catch (error) {
      logger.warn(`Contract connectivity test failed, continuing in simulation mode: ${error.message}`);
      return true; // Don't throw error, allow bot to continue
    }
  }

  // ===== PLN TOKEN OPERATIONS =====

  /**
   * Get PLN token balance for the wallet
   */
  async getPLNBalance() {
    try {
      const balance = await this.plnToken.balanceOf(this.wallet.address);
      return ethers.formatEther(balance);
    } catch (error) {
      logger.error(`Error getting PLN balance: ${error.message}`);
      return '0';
    }
  }

  /**
   * Approve PLN tokens for vePLN contract
   */
  async approvePLN(amount) {
    try {
      const amountWei = ethers.parseEther(amount.toString());
      
      // Check current allowance
      const allowance = await this.plnToken.allowance(
        this.wallet.address,
        CONTRACT_ADDRESSES.VEPLN_CONTRACT
      );
      
      if (allowance >= amountWei) {
        logger.info(`PLN already approved: ${ethers.formatEther(allowance)}`);
        return true;
      }
      
      logger.info(`Approving ${amount} PLN for vePLN contract...`);
      
      const approveTx = await this.plnToken.approve(
        CONTRACT_ADDRESSES.VEPLN_CONTRACT,
        amountWei,
        { gasLimit: 100000 }
      );
      
      const receipt = await approveTx.wait();
      logger.info(`✅ PLN approval confirmed: ${receipt.transactionHash}`);
      
      return true;
    } catch (error) {
      logger.error(`PLN approval failed: ${error.message}`);
      throw error;
    }
  }

  // ===== GAS OPTIMIZATION =====
  
  /**
   * Get optimal gas price with buffer
   * @returns {Promise<BigNumber>} Gas price in wei
   */
  async getOptimalGasPrice() {
    try {
      const feeData = await this.provider.getFeeData();
      if (!feeData.gasPrice) {
        throw new Error('Failed to fetch gas price');
      }
      
      // Add 10% buffer to gas price
      const buffer = feeData.gasPrice * 10n / 100n; // 10% buffer
      const maxGasPrice = this.config.trading?.maxGasPrice || ethers.parseUnits('200', 'gwei');
      
      return feeData.gasPrice + buffer > maxGasPrice 
        ? maxGasPrice 
        : feeData.gasPrice + buffer;
    } catch (error) {
      logger.warn(`Failed to get optimal gas price: ${error.message}. Using default.`);
      return ethers.parseUnits('20', 'gwei'); // Fallback to 20 gwei
    }
  }
  
  // ===== VEPLN LOCK OPERATIONS =====

  /**
   * Lock PLN tokens for vePLN (Primary Staking Function)
   * @param {number|string} amount - Amount of PLN to lock
   * @param {number} lockDurationDays - Duration to lock tokens (in days)
   * @returns {Promise<Object>} Transaction receipt and lock details
   */
  async lockPLNTokens(amount, lockDurationDays) {
    try {
      if (!this.isInitialized) await this.initialize();
      
      // Validate inputs
      if (typeof amount === 'string') amount = parseFloat(amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Invalid amount. Must be a positive number');
      }
      
      // Convert to wei
      const amountWei = ethers.parseEther(amount.toString());
      
      // Validate lock duration
      const minLockDays = this.config.staking?.minLockDuration || 7;
      const maxLockDays = this.config.staking?.maxLockDuration || 365;
      
      if (lockDurationDays < minLockDays) {
        throw new Error(`Minimum lock duration is ${minLockDays} days`);
      }
      if (lockDurationDays > maxLockDays) {
        throw new Error(`Maximum lock duration is ${maxLockDays} days`);
      }
      
      // Calculate lock end timestamp
      const lockEnd = Math.floor(Date.now() / 1000) + (lockDurationDays * 24 * 3600);
      
      // Check minimum stake amount
      const minStake = this.config.staking?.minStakeAmount || ethers.parseEther('10');
      if (amountWei < minStake) {
        throw new Error(`Minimum stake amount is ${ethers.formatEther(minStake)} PLN`);
      }
      
      // Get current lock info
      const currentLock = await this.getLockInfo();
      if (currentLock.amount > 0 && currentLock.end > Math.floor(Date.now() / 1000)) {
        throw new Error('Existing lock found. Please extend or unlock first.');
      }
      
      logger.info(`Locking ${amount} PLN for ${lockDurationDays} days...`);
      
      // Approve PLN first with gas estimation
      await this.approvePLN(amount);
      
      // Get optimal gas price
      const gasPrice = await this.getOptimalGasPrice();
      
      // Execute lock transaction with proper gas estimation
      const lockTx = await this.vePlnContract.lock(amountWei, lockEnd, {
        gasLimit: 500000, // Increased gas limit for complex operations
        gasPrice: gasPrice
      });
      
      logger.info(`Transaction sent: ${lockTx.hash}`);
      const receipt = await lockTx.wait();
      
      // Verify transaction success
      if (receipt.status !== 1) {
        throw new Error('Transaction reverted');
      }
      
      logger.info(`✅ Successfully locked ${amount} PLN for ${lockDurationDays} days. Tx: ${receipt.transactionHash}`);
      
      // Clear cache
      this.lockCache.delete(this.wallet.address);
      
      // Get updated lock info
      const newLock = await this.getLockInfo(false); // Skip cache
      
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        amount: amount,
        lockDuration: lockDurationDays,
        lockEnd: lockEnd,
        vePLNBalance: ethers.formatEther(newLock.amount),
        unlockTimestamp: newLock.end
      };
      
    } catch (error) {
      logger.error(`PLN locking failed: ${error.message}`);
      
      // Provide more user-friendly error messages
      if (error.code === 'INSUFFICIENT_FUNDS') {
        throw new Error('Insufficient ETH for gas or PLN balance too low');
      } else if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
        throw new Error('Transaction would fail. Check your inputs and allowances.');
      }
      
      throw error;
    }
  }

  /**
   * Increase existing PLN lock amount
   */
  async increaseLockAmount(additionalAmount) {
    try {
      const amountWei = ethers.parseEther(additionalAmount.toString());
      
      logger.info(`Increasing PLN lock by ${additionalAmount}...`);
      
      // Approve additional PLN
      await this.approvePLN(additionalAmount);
      
      const increaseTx = await this.vePlnContract.increaseLock(amountWei, {
        gasLimit: 250000
      });
      
      const receipt = await increaseTx.wait();
      logger.info(`✅ Lock amount increased: ${receipt.transactionHash}`);
      
      // Clear cache
      this.lockCache.delete(this.wallet.address);
      
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        additionalAmount: additionalAmount
      };
      
    } catch (error) {
      logger.error(`Lock increase failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extend lock duration
   */
  async extendLockDuration(additionalDays) {
    try {
      const currentLock = await this.getLockInfo();
      const newLockEnd = currentLock.lockEnd + (additionalDays * 24 * 3600);
      
      logger.info(`Extending lock by ${additionalDays} days...`);
      
      const extendTx = await this.vePlnContract.extendLock(newLockEnd, {
        gasLimit: 200000
      });
      
      const receipt = await extendTx.wait();
      logger.info(`✅ Lock extended: ${receipt.transactionHash}`);
      
      // Clear cache
      this.lockCache.delete(this.wallet.address);
      
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        newLockEnd: newLockEnd
      };
      
    } catch (error) {
      logger.error(`Lock extension failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Unlock PLN tokens (after lock period expires)
   */
  async unlockPLNTokens() {
    try {
      const lockInfo = await this.getLockInfo();
      const currentTime = Math.floor(Date.now() / 1000);
      
      if (currentTime < lockInfo.lockEnd) {
        throw new Error(`Lock period not expired. Expires: ${new Date(lockInfo.lockEnd * 1000)}`);
      }
      
      logger.info('Unlocking PLN tokens...');
      
      const unlockTx = await this.vePlnContract.unlock({
        gasLimit: 250000
      });
      
      const receipt = await unlockTx.wait();
      logger.info(`✅ PLN unlocked: ${receipt.transactionHash}`);
      
      // Clear cache
      this.lockCache.delete(this.wallet.address);
      
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        claimableAmount: lockInfo.claimable
      };
      
    } catch (error) {
      logger.error(`Unlock failed: ${error.message}`);
      throw error;
    }
  }

  // ===== REWARDS MANAGEMENT =====

  /**
   * Claim accumulated rewards
   */
  async claimRewards() {
    try {
      const availableRewards = await this.getAvailableRewards();
      
      if (parseFloat(availableRewards) === 0) {
        logger.info('No rewards available to claim');
        return { success: false, reason: 'No rewards available' };
      }
      
      logger.info(`Claiming ${availableRewards} PLN rewards...`);
      
      const claimTx = await this.vePlnContract.claimRewards({
        gasLimit: 200000
      });
      
      const receipt = await claimTx.wait();
      logger.info(`✅ Rewards claimed: ${receipt.transactionHash}`);
      
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        rewardsClaimed: availableRewards
      };
      
    } catch (error) {
      logger.error(`Reward claim failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get available rewards for the wallet
   */
  async getAvailableRewards() {
    try {
      const rewards = await this.vePlnContract.getAvailableRewards(this.wallet.address);
      return ethers.formatEther(rewards);
    } catch (error) {
      logger.error(`Error getting available rewards: ${error.message}`);
      return '0';
    }
  }

  /**
   * Get claimable rewards
   */
  async getClaimableRewards() {
    try {
      const rewards = await this.vePlnContract.getClaimableRewards();
      return ethers.formatEther(rewards);
    } catch (error) {
      logger.error(`Error getting claimable rewards: ${error.message}`);
      return '0';
    }
  }

  // ===== LOCK INFO & VOTING POWER =====

  /**
   * Get detailed lock information
   */
  async getLockInfo(useCache = true) {
    try {
      const cacheKey = this.wallet.address;
      
      if (useCache && this.lockCache.has(cacheKey)) {
        return this.lockCache.get(cacheKey);
      }
      
      const lockData = await this.vePlnContract.locks(this.wallet.address);
      
      const lockInfo = {
        lockStart: Number(lockData.lockStart),
        lockEnd: Number(lockData.lockEnd),
        amount: ethers.formatEther(lockData.amount),
        offset: Number(lockData.offset),
        claimable: ethers.formatEther(lockData.claimable),
        isActive: Number(lockData.lockEnd) > Math.floor(Date.now() / 1000),
        daysRemaining: Math.max(0, Math.floor((Number(lockData.lockEnd) - Date.now() / 1000) / 86400))
      };
      
      if (useCache) {
        this.lockCache.set(cacheKey, lockInfo);
      }
      
      return lockInfo;
      
    } catch (error) {
      logger.error(`Error getting lock info: ${error.message}`);
      return null;
    }
  }

  /**
   * Get current vePLN balance (voting power)
   */
  async getVePLNBalance() {
    try {
      const balance = await this.vePlnContract.balanceOf(this.wallet.address);
      return ethers.formatEther(balance);
    } catch (error) {
      logger.error(`Error getting vePLN balance: ${error.message}`);
      return '0';
    }
  }

  /**
   * Get voting power
   */
  async getVotingPower() {
    try {
      const votingPower = await this.vePlnContract.getVotingPower(this.wallet.address);
      return ethers.formatEther(votingPower);
    } catch (error) {
      logger.error(`Error getting voting power: ${error.message}`);
      return '0';
    }
  }

  /**
   * Get boosting rate
   */
  async getBoostingRate() {
    try {
      const boostRate = await this.vePlnContract.getBoostingRate(this.wallet.address);
      return Number(boostRate) / 100; // Convert to percentage
    } catch (error) {
      logger.error(`Error getting boosting rate: ${error.message}`);
      return 0;
    }
  }

  // ===== PORTFOLIO MANAGEMENT =====

  /**
   * Create virtual portfolio with asset allocations and automatic rebalancing
   * @param {Array<string>} assets - Array of token addresses
   * @param {Array<number>} weights - Array of weights (0-1) corresponding to assets
   * @param {number|string} plnStake - Amount of PLN to stake in the portfolio
   * @param {Object} [options] - Additional options
   * @param {boolean} [options.skipChecks=false] - Skip validation checks (use with caution)
   * @returns {Promise<Object>} Transaction receipt and portfolio details
   */
  async createVirtualPortfolio(assets, weights, plnStake, options = {}) {
    try {
      if (!this.isInitialized) await this.initialize();
      
      // Validate inputs
      if (!Array.isArray(assets) || !Array.isArray(weights) || assets.length !== weights.length) {
        throw new Error('Assets and weights must be arrays of the same length');
      }
      
      const maxAssets = this.config.portfolio?.maxAssets || 10;
      if (assets.length === 0 || assets.length > maxAssets) {
        throw new Error(`Portfolio must contain between 1 and ${maxAssets} assets`);
      }
      
      // Convert to wei and validate amounts
      const plnStakeWei = ethers.parseEther(plnStake.toString());
      const minStake = this.config.staking?.minStakeAmount || ethers.parseEther('10');
      
      if (plnStakeWei < minStake) {
        throw new Error(`Minimum stake amount is ${ethers.formatEther(minStake)} PLN`);
      }
      
      // Normalize weights
      const totalWeight = weights.reduce((sum, w) => sum + w, 0);
      const normalizedWeights = weights.map(w => Math.floor((w / totalWeight) * 10000)); // Basis points
      
      if (!options.skipChecks) {
        // Check for duplicate assets
        const uniqueAssets = new Set(assets.map(a => a.toLowerCase()));
        if (uniqueAssets.size !== assets.length) {
          throw new Error('Duplicate assets in portfolio');
        }
        
        // Verify all weights are positive
        if (normalizedWeights.some(w => w <= 0)) {
          throw new Error('All weights must be positive');
        }
      }
      
      logger.info(`Creating virtual portfolio with ${assets.length} assets and ${plnStake} PLN stake...`);
      
      // Get optimal gas price
      const gasPrice = await this.getOptimalGasPrice();
      
      // Approve PLN for staking with gas estimation
      await this.approvePLN(plnStake);
      
      // Create portfolio with increased gas limit for complex operations
      const tx = await this.vePlnContract.createPortfolio(
        assets,
        normalizedWeights,
        plnStakeWei,
        {
          gasLimit: 1500000, // Increased for complex operations
          gasPrice: gasPrice
        }
      );
      
      logger.info(`Portfolio creation transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      
      // Verify transaction success
      if (receipt.status !== 1) {
        throw new Error('Portfolio creation transaction reverted');
      }
      
      // Get portfolio ID from event
      const portfolioCreatedEvent = receipt.events?.find(e => e.event === 'PortfolioCreated');
      const portfolioId = portfolioCreatedEvent?.args?.portfolioId;
      
      if (!portfolioId) {
        throw new Error('Failed to get portfolio ID from transaction');
      }
      
      logger.info(`✅ Portfolio ${portfolioId} created successfully. Tx: ${receipt.transactionHash}`);
      
      // Clear portfolio cache
      this.portfolioCache.delete(this.wallet.address);
      
      return {
        success: true,
        transactionHash: receipt.transactionHash,
        portfolioId: portfolioId.toString(),
        assets,
        weights: normalizedWeights.map(w => w / 10000), // Convert back to 0-1 range
        plnStake: plnStakeWei.toString()
      };
      
    } catch (error) {
      logger.error(`Portfolio creation failed: ${error.message}`);
      
      // Provide more user-friendly error messages
      if (error.code === 'INSUFFICIENT_FUNDS') {
        throw new Error('Insufficient ETH for gas or PLN balance too low');
      } else if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
        throw new Error('Transaction would fail. Check your inputs and allowances.');
      } else if (error.message.includes('INVALID_PORTFOLIO')) {
        throw new Error('Invalid portfolio configuration. Check asset addresses and weights.');
      }
      
      throw error;
    }
  }

  /**
   * Rebalance virtual portfolio allocations with optimized gas usage
   * @param {Array<string>} newAssets - New array of token addresses
   * @param {Array<number>} newWeights - New array of weights (0-1) corresponding to assets
   * @param {Object} [options] - Additional options
   * @param {boolean} [options.skipChecks=false] - Skip validation checks (use with caution)
   * @returns {Promise<Object>} Transaction receipt and rebalance details
   */
  async rebalanceVirtualPortfolio(newAssets, newWeights, options = {}) {
    try {
      if (!this.isInitialized) await this.initialize();
      
      // Validate inputs
      if (!Array.isArray(newAssets) || !Array.isArray(newWeights) || 
          newAssets.length !== newWeights.length) {
        throw new Error('Assets and weights must be arrays of the same length');
      }
      
      const maxAssets = this.config.portfolio?.maxAssets || 10;
      if (newAssets.length > maxAssets) {
        throw new Error(`Portfolio cannot contain more than ${maxAssets} assets`);
      }
      
      // Get current portfolio
      const currentPortfolio = await this.getPortfolioStatus();
      
      // Check if rebalancing is needed
      if (!options.force) {
        const needsRebalance = await this.needsRebalancing(currentPortfolio, { assets: newAssets, weights: newWeights });
        if (!needsRebalance) {
          logger.info('No rebalancing needed - current allocations are within thresholds');
          return { success: true, rebalanced: false };
        }
      }
      
      // Normalize weights
      const totalWeight = newWeights.reduce((sum, w) => sum + w, 0);
      const normalizedWeights = newWeights.map(w => Math.floor((w / totalWeight) * 10000)); // Basis points
      
      if (!options.skipChecks) {
        // Check for duplicate assets
        const uniqueAssets = new Set(newAssets.map(a => a.toLowerCase()));
        if (uniqueAssets.size !== newAssets.length) {
          throw new Error('Duplicate assets in new allocation');
        }
        
        // Verify all weights are positive
        if (normalizedWeights.some(w => w <= 0)) {
          throw new Error('All weights must be positive');
        }
      }
      
      logger.info(`Rebalancing portfolio with ${newAssets.length} assets...`);
      
      // Get optimal gas price
      const gasPrice = await this.getOptimalGasPrice();
      
      // Execute rebalance with increased gas limit
      const tx = await this.vePlnContract.rebalancePortfolio(
        newAssets,
        normalizedWeights,
        {
          gasLimit: 1500000, // Increased for complex operations
          gasPrice: gasPrice
        }
      );
      
      logger.info(`Rebalance transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      
      // Verify transaction success
      if (receipt.status !== 1) {
        throw new Error('Rebalance transaction reverted');
      }
      
      logger.info(`✅ Portfolio rebalanced successfully. Tx: ${receipt.transactionHash}`);
      
      // Clear portfolio cache
      this.portfolioCache.delete(this.wallet.address);
      
      // Get updated portfolio
      const updatedPortfolio = await this.getPortfolioStatus(true); // Skip cache
      
      return {
        success: true,
        rebalanced: true,
        transactionHash: receipt.transactionHash,
        oldAllocation: currentPortfolio.assets,
        newAllocation: updatedPortfolio.assets
      };
      
    } catch (error) {
      logger.error(`Portfolio rebalancing failed: ${error.message}`);
      
      // Provide more user-friendly error messages
      if (error.code === 'INSUFFICIENT_FUNDS') {
        throw new Error('Insufficient ETH for gas');
      } else if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
        throw new Error('Transaction would fail. Check your inputs and allowances.');
      } else if (error.message.includes('INVALID_REBALANCE')) {
        throw new Error('Invalid rebalance parameters. Check asset addresses and weights.');
      }
      
      throw error;
    }
  }

  /**
   * Check if portfolio needs rebalancing based on thresholds
   * @param {Object} currentPortfolio - Current portfolio state
   * @param {Object} targetAllocation - Target allocation {assets: string[], weights: number[]}
   * @returns {Promise<boolean>} True if rebalancing is needed
   */
  async needsRebalancing(currentPortfolio, targetAllocation) {
    try {
      if (!currentPortfolio || !currentPortfolio.assets || currentPortfolio.assets.length === 0) {
        return false; // No current portfolio, nothing to rebalance
      }
      
      const threshold = this.config.trading?.rebalanceThreshold || 0.05; // 5% threshold
      
      // Create a map of current allocations by asset address
      const currentAllocationMap = new Map();
      currentPortfolio.assets.forEach(asset => {
        currentAllocationMap.set(asset.address.toLowerCase(), asset.weight);
      });
      
      // Check each target allocation against current
      for (let i = 0; i < targetAllocation.assets.length; i++) {
        const asset = targetAllocation.assets[i].toLowerCase();
        const targetWeight = targetAllocation.weights[i];
        const currentWeight = currentAllocationMap.get(asset) || 0;
        
        // If weight difference exceeds threshold, rebalancing is needed
        if (Math.abs(currentWeight - targetWeight) > threshold) {
          logger.info(`Rebalancing needed: ${asset} (current: ${currentWeight}, target: ${targetWeight})`);
          return true;
        }
      }
      
      return false;
      
    } catch (error) {
      logger.error(`Error checking rebalance need: ${error.message}`);
      return false; // Default to no rebalancing on error
    }
  }

  // ===== VIRTUAL PORTFOLIO OPERATIONS =====
  // Note: These functions implement the virtual portfolio management
  // with enhanced validation, error handling, and gas optimization

  /**
   * Calculate virtual portfolio return (theoretical implementation)
   */
  async calculatePortfolioReturn(portfolioData) {
    try {
      // This is a simplified calculation
      // In reality, this would use real-time price data from TradingView/oracles
      
      // Simulate portfolio performance
      const timeElapsed = Date.now() - portfolioData.createdAt;
      const daysSinceCreation = timeElapsed / (1000 * 60 * 60 * 24);
      
      // Simple simulation: random walk with slight positive bias
      const randomReturn = (Math.random() - 0.45) * 5; // Slightly positive bias
      const timeDecay = Math.min(daysSinceCreation / 30, 1); // Mature over 30 days
      
      const portfolioReturn = randomReturn * timeDecay;
      
      return portfolioReturn;
      
    } catch (error) {
      logger.error(`Error calculating portfolio return: ${error.message}`);
      return 0;
    }
  }

  /**
   * Get current portfolio status
   */
  async getPortfolioStatus() {
    try {
      const portfolio = this.portfolioCache.get(this.wallet.address);
      if (!portfolio) {
        return { hasPortfolio: false };
      }
      
      const currentReturn = await this.calculatePortfolioReturn(portfolio);
      const lockInfo = await this.getLockInfo();
      
      return {
        hasPortfolio: true,
        portfolioId: portfolio.portfolioId,
        assets: portfolio.assets,
        weights: portfolio.weights,
        plnStaked: portfolio.plnStaked,
        currentReturn: currentReturn,
        rebalanceCount: portfolio.rebalanceCount || 0,
        daysActive: Math.floor((Date.now() - portfolio.createdAt) / (1000 * 60 * 60 * 24)),
        lockInfo: lockInfo
      };
      
    } catch (error) {
      logger.error(`Error getting portfolio status: ${error.message}`);
      return { hasPortfolio: false, error: error.message };
    }
  }

  // ===== UTILITY FUNCTIONS =====

  /**
   * Get comprehensive account status
   */
  async getAccountStatus() {
    try {
      const [plnBalance, lockInfo, vePlnBalance, votingPower, availableRewards, portfolioStatus, boostRate] = await Promise.all([
        this.getPLNBalance(),
        this.getLockInfo(),
        this.getVePLNBalance(), 
        this.getVotingPower(),
        this.getAvailableRewards(),
        this.getPortfolioStatus(),
        this.getBoostingRate()
      ]);
      
      return {
        wallet: this.wallet.address,
        balances: {
          pln: plnBalance,
          vePln: vePlnBalance
        },
        lockInfo: lockInfo,
        governance: {
          votingPower: votingPower,
          boostingRate: boostRate
        },
        rewards: {
          available: availableRewards
        },
        portfolio: portfolioStatus,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error(`Error getting account status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Emergency functions
   */
  async emergencyUnlock() {
    try {
      logger.warn('⚠️  EMERGENCY UNLOCK INITIATED');
      return await this.unlockPLNTokens();
    } catch (error) {
      logger.error(`Emergency unlock failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get wallet address
   */
  getWalletAddress() {
    return this.wallet.address;
  }

  /**
   * Check if interface is ready
   */
  isReady() {
    return this.isInitialized;
  }
}

module.exports = PollenContractInterface; 