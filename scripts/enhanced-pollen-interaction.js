require('dotenv').config({ path: require('path').resolve(__dirname, '../base-sepolia.env') });
const { ethers } = require('ethers');
const config = require('./config');
const monitoring = require('./utils/monitoring');
const { ErrorHandler } = require('./utils/errorHandlers');

// Contract ABIs with essential functions
const LOCKED_POLLEN_ABI = [
  'function lock(uint256 amount, uint256 lockEnd) external',
  'function extendLock(uint256 newLockEnd) external',
  'function increaseLock(uint256 amount) external',
  'function locks(address) view returns (uint256 lockStart, uint256 lockEnd, uint256 amount, uint256 offset, uint256 claimable)',
  'function getVotingPower(address) view returns (uint256)',
  'function claimRewards() external',
  'function balanceOf(address) view returns (uint256)',
  'event LockCreated(address indexed user, uint256 amount, uint256 lockEnd)',
  'event LockExtended(address indexed user, uint256 newLockEnd)',
  'event LockIncreased(address indexed user, uint256 amount)'
];

const PORTFOLIO_ABI = [
  'function rebalancePortfolio(uint256[] memory weights, bool[] memory isShort, uint256 amount, bool tokenType) external',
  'function rebalanceBenchMarkPortfolio(uint256[] memory weights) external',
  'function getPortfolio(address owner, address delegator, bool tokenType) view returns (uint256[] memory, uint256, uint256, uint256, bool, uint256, uint256, bool[] memory)',
  'event PortfolioRebalanced(address indexed user, uint256[] weights, bool[] isShort, uint256 amount, bool tokenType)'
];

class EnhancedPollenInteractor {
  constructor(options = {}) {
    // Initialize with options or defaults
    this.provider = options.provider || new ethers.JsonRpcProvider(config.RPC_URL);
    this.wallet = options.wallet || new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, this.provider);
    this.logger = options.logger || console;
    this.monitoring = options.monitoring || monitoring;
    this.errorHandler = new ErrorHandler({
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      logger: this.logger
    });
    
    // Initialize contracts with error handling
    this.initializeContracts();
    
    // Set up event listeners
    this.setupEventListeners();
  }
  
  initializeContracts() {
    try {
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
      
      // Add error listeners to contracts
      this.addContractErrorHandling(this.lockedPollen, 'LockedPollen');
      this.addContractErrorHandling(this.portfolio, 'Portfolio');
      
    } catch (error) {
      this.monitoring.trackError(error, { context: 'Contract initialization' });
      throw new Error(`Failed to initialize contracts: ${error.message}`);
    }
  }
  
  addContractErrorHandling(contract, name) {
    contract.on('error', (error) => {
      this.monitoring.trackError(error, { 
        contract: name,
        event: 'contract_error'
      });
    });
  }
  
  setupEventListeners() {
    // Listen for lock events
    this.lockedPollen.on('LockCreated', (user, amount, lockEnd, event) => {
      this.monitoring.trackTransaction('lock', true, {
        user,
        amount: amount.toString(),
        lockEnd: new Date(lockEnd * 1000).toISOString(),
        txHash: event.transactionHash
      });
    });
    
    // Add more event listeners for other important events
  }
  
  // Wrapper for all contract interactions with error handling and monitoring
  async withMonitoring(operation, contractCall, metadata = {}) {
    const startTime = Date.now();
    const operationId = `${operation}_${Date.now()}`;
    
    try {
      this.monitoring.emit('operationStart', { operation, operationId, ...metadata });
      
      // Execute with retry logic
      const result = await this.errorHandler.withRetry(
        async () => {
          const tx = await contractCall();
          return tx;
        },
        this.errorHandler.options.maxRetries,
        this.errorHandler.options.retryDelay
      )();
      
      // Track successful operation
      this.monitoring.trackTransaction(operation, true, {
        ...metadata,
        operationId,
        duration: Date.now() - startTime,
        result: result?.hash ? { txHash: result.hash } : undefined
      });
      
      return result;
      
    } catch (error) {
      // Track failed operation
      this.monitoring.trackError(error, {
        operation,
        operationId,
        ...metadata,
        duration: Date.now() - startTime
      });
      
      throw error;
    }
  }
  
  // ===== Core Functions with Enhanced Error Handling =====
  
  async lockPLN(amount, lockDurationDays, options = {}) {
    return this.withMonitoring('lockPLN', async () => {
      const amountWei = ethers.parseEther(amount.toString());
      const lockEnd = Math.floor(Date.now() / 1000) + (lockDurationDays * 24 * 60 * 60);
      
      const gasSettings = await this.getGasSettings(options);
      
      const tx = await this.lockedPollen.lock(amountWei, lockEnd, {
        ...gasSettings,
        nonce: await this.getNonce()
      });
      
      const receipt = await tx.wait();
      return { ...receipt, txHash: tx.hash };
    }, { amount, lockDurationDays });
  }
  
  async extendLock(additionalDays, options = {}) {
    return this.withMonitoring('extendLock', async () => {
      const lockInfo = await this.getLockInfo();
      if (lockInfo.amount === 0n) {
        throw new Error('No active lock found');
      }
      
      const newLockEnd = Math.max(
        Number(lockInfo.lockEnd) + (additionalDays * 24 * 60 * 60),
        Math.floor(Date.now() / 1000) + (additionalDays * 24 * 60 * 60)
      );
      
      const gasSettings = await this.getGasSettings(options);
      
      const tx = await this.lockedPollen.extendLock(newLockEnd, {
        ...gasSettings,
        nonce: await this.getNonce()
      });
      
      const receipt = await tx.wait();
      return { ...receipt, txHash: tx.hash };
    }, { additionalDays });
  }
  
  async increaseLock(amount, options = {}) {
    return this.withMonitoring('increaseLock', async () => {
      const amountWei = ethers.parseEther(amount.toString());
      const gasSettings = await this.getGasSettings(options);
      
      const tx = await this.lockedPollen.increaseLock(amountWei, {
        ...gasSettings,
        nonce: await this.getNonce()
      });
      
      const receipt = await tx.wait();
      return { ...receipt, txHash: tx.hash };
    }, { amount });
  }
  
  async getLockInfo() {
    return this.withMonitoring('getLockInfo', async () => {
      const lockInfo = await this.lockedPollen.locks(this.wallet.address);
      return {
        lockStart: Number(lockInfo.lockStart),
        lockEnd: Number(lockInfo.lockEnd),
        amount: lockInfo.amount,
        offset: lockInfo.offset,
        claimable: lockInfo.claimable
      };
    });
  }
  
  async rebalancePortfolio(weights, isShort, amount, useVePLN = false, options = {}) {
    return this.withMonitoring('rebalancePortfolio', async () => {
      const amountWei = ethers.parseEther(amount.toString());
      const gasSettings = await this.getGasSettings(options);
      
      const tx = await this.portfolio.rebalancePortfolio(
        weights,
        isShort,
        amountWei,
        useVePLN,
        {
          ...gasSettings,
          nonce: await this.getNonce()
        }
      );
      
      const receipt = await tx.wait();
      return { ...receipt, txHash: tx.hash };
    }, { weights, isShort, amount, useVePLN });
  }
  
  async rebalanceBenchmarkPortfolio(weights, options = {}) {
    return this.withMonitoring('rebalanceBenchmarkPortfolio', async () => {
      const gasSettings = await this.getGasSettings(options);
      
      const tx = await this.portfolio.rebalanceBenchMarkPortfolio(
        weights,
        {
          ...gasSettings,
          nonce: await this.getNonce()
        }
      );
      
      const receipt = await tx.wait();
      return { ...receipt, txHash: tx.hash };
    }, { weights });
  }
  
  async claimRewards(options = {}) {
    return this.withMonitoring('claimRewards', async () => {
      const gasSettings = await this.getGasSettings(options);
      
      const tx = await this.lockedPollen.claimRewards({
        ...gasSettings,
        nonce: await this.getNonce()
      });
      
      const receipt = await tx.wait();
      return { ...receipt, txHash: tx.hash };
    });
  }
  
  async getVotingPower() {
    return this.withMonitoring('getVotingPower', async () => {
      const votingPower = await this.lockedPollen.getVotingPower(this.wallet.address);
      return votingPower.toString();
    });
  }
  
  async getPortfolioInfo(tokenType = false) {
    return this.withMonitoring('getPortfolioInfo', async () => {
      const portfolio = await this.portfolio.getPortfolio(
        this.wallet.address,
        ethers.ZeroAddress, // No delegator
        tokenType
      );
      
      return {
        weights: portfolio[0].map(w => w.toString()),
        balance: portfolio[1].toString(),
        totalValue: portfolio[2].toString(),
        timestamp: Number(portfolio[3]),
        isRebalancing: portfolio[4],
        lastRebalanceTime: Number(portfolio[5]),
        lastRebalanceBlock: Number(portfolio[6]),
        isShort: portfolio[7]
      };
    });
  }
  
  // ===== Utility Functions =====
  
  async getGasSettings(overrides = {}) {
    try {
      const feeData = await this.provider.getFeeData();
      
      return {
        maxFeePerGas: overrides.maxFeePerGas || feeData.maxFeePerGas || undefined,
        maxPriorityFeePerGas: overrides.maxPriorityFeePerGas || feeData.maxPriorityFeePerGas || undefined,
        gasPrice: overrides.gasPrice || feeData.gasPrice || undefined,
        gasLimit: overrides.gasLimit || 1_000_000 // Default gas limit
      };
    } catch (error) {
      this.logger.error('Failed to get gas settings:', error);
      return {
        gasLimit: 1_000_000
      };
    }
  }
  
  async getNonce() {
    try {
      return await this.provider.getTransactionCount(this.wallet.address, 'pending');
    } catch (error) {
      this.logger.error('Failed to get nonce:', error);
      throw error;
    }
  }
  
  // ===== Helper Functions =====
  
  formatEther(amount) {
    return ethers.formatEther(amount);
  }
  
  parseEther(amount) {
    return ethers.parseEther(amount.toString());
  }
}

module.exports = EnhancedPollenInteractor;
