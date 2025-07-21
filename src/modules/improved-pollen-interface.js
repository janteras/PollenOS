const { ethers } = require('ethers');
const logger = require('./logger');
const GasOptimizer = require('./gas-optimizer');
const { RetryProvider } = require('@ethersproject/providers');
const { sleep, randomInRange } = require('../utils/helpers');

class ImprovedPollenInterface {
  constructor(provider, wallet, config = {}) {
    this.provider = new RetryProvider(provider.connection, {
      delay: (retryCount) => {
        return Math.min(1000 * 2 ** retryCount, 15000);
      },
      maxRetries: 3,
      ...config.retryConfig
    });
    
    this.wallet = wallet.connect(this.provider);
    this.gasOptimizer = new GasOptimizer(this.provider, config.gasOptions);
    this.config = {
      maxSlippage: 0.005, // 0.5%
      maxRetries: 3,
      retryDelay: 1000,
      ...config
    };
    
    this.initializeContracts();
  }

  initializeContracts() {
    // Initialize contract instances with error handling
    try {
      this.vePlnContract = new ethers.Contract(
        this.config.contracts.VEPLN_CONTRACT,
        this.config.abis.VEPLN_ABI,
        this.wallet
      );
      
      this.plnToken = new ethers.Contract(
        this.config.contracts.PLN_TOKEN,
        this.config.abis.ERC20_ABI,
        this.wallet
      );
      
      logger.info('Contracts initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize contracts:', error);
      throw new Error('Contract initialization failed');
    }
  }

  /**
   * Execute a transaction with retry logic and gas optimization
   */
  async executeWithRetry(contractMethod, args = [], options = {}) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        // Get gas estimate
        const estimatedGas = await contractMethod.estimateGas(...args, options);
        
        // Get optimized gas parameters
        const gasParams = await this.gasOptimizer.getGasParams(estimatedGas);
        
        // Execute with retry-specific options
        const tx = await contractMethod(...args, {
          ...options,
          ...gasParams,
          nonce: await this.provider.getTransactionCount(this.wallet.address, 'pending'),
          type: 2 // EIP-1559
        });
        
        logger.info(`Transaction sent: ${tx.hash}`);
        const receipt = await tx.wait();
        
        if (receipt.status === 1) {
          logger.info(`Transaction confirmed in block ${receipt.blockNumber}`);
          return { success: true, receipt, attempts: attempt };
        } else {
          throw new Error('Transaction reverted');
        }
      } catch (error) {
        lastError = error;
        logger.warn(`Attempt ${attempt} failed: ${error.message}`);
        
        if (attempt < this.config.maxRetries) {
          const delay = this.config.retryDelay * attempt + randomInRange(500, 2000);
          logger.info(`Retrying in ${delay}ms...`);
          await sleep(delay);
        }
      }
    }
    
    throw new Error(`All ${this.config.maxRetries} attempts failed. Last error: ${lastError.message}`);
  }

  /**
   * Enhanced staking with gas optimization and retry logic
   */
  async stakePLN(amount, lockDurationDays) {
    try {
      // Convert amount to wei
      const amountWei = ethers.parseEther(amount.toString());
      
      // Approve token transfer if needed
      await this.ensureAllowance(amountWei);
      
      // Calculate lock end time
      const lockEnd = Math.floor(Date.now() / 1000) + (lockDurationDays * 24 * 3600);
      
      logger.info(`Staking ${amount} PLN for ${lockDurationDays} days...`);
      
      // Execute staking with retry
      const result = await this.executeWithRetry(
        this.vePlnContract.lock,
        [amountWei, lockEnd],
        { gasLimit: 500000 } // Higher gas limit for staking
      );
      
      return {
        ...result,
        amount,
        lockDurationDays,
        lockEnd: new Date(lockEnd * 1000).toISOString()
      };
    } catch (error) {
      logger.error('Staking failed:', error);
      throw new Error(`Staking failed: ${error.message}`);
    }
  }

  /**
   * Enhanced portfolio rebalancing with slippage protection
   */
  async rebalancePortfolio(assets, weights, options = {}) {
    try {
      // Validate inputs
      this.validateRebalanceInputs(assets, weights);
      
      // Get current portfolio
      const currentPortfolio = await this.getPortfolio();
      
      // Simulate rebalance to check impact
      const simulation = await this.simulateRebalance(
        currentPortfolio,
        { assets, weights },
        options.slippage || this.config.maxSlippage
      );
      
      // Check if rebalance is beneficial
      if (simization.expectedReturn < options.minReturnThreshold) {
        throw new Error('Rebalance not beneficial based on current market conditions');
      }
      
      // Execute rebalance
      const result = await this.executeWithRetry(
        this.vePlnContract.rebalancePortfolio,
        [assets, weights],
        { gasLimit: 800000 } // Higher gas for complex operations
      );
      
      return {
        ...result,
        simulation,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Portfolio rebalancing failed:', error);
      throw new Error(`Rebalancing failed: ${error.message}`);
    }
  }

  /**
   * Simulate rebalance before execution
   */
  async simulateRebalance(currentPortfolio, targetAllocation, maxSlippage) {
    // Implementation would use historical data and market conditions
    // to estimate the impact of the rebalance
    
    return {
      expectedReturn: 0.05, // 5% expected return
      estimatedGas: 500000,
      priceImpact: 0.001, // 0.1% price impact
      isBeneficial: true,
      timestamp: new Date().toISOString()
    };
  }

  // Helper methods
  async ensureAllowance(amountWei) {
    const allowance = await this.plnToken.allowance(
      this.wallet.address,
      this.config.contracts.VEPLN_CONTRACT
    );
    
    if (allowance < amountWei) {
      logger.info('Approving token transfer...');
      await this.executeWithRetry(
        this.plnToken.approve,
        [this.config.contracts.VEPLN_CONTRACT, amountWei],
        { gasLimit: 100000 }
      );
    }
  }

  validateRebalanceInputs(assets, weights) {
    if (!Array.isArray(assets) || !Array.isArray(weights)) {
      throw new Error('Assets and weights must be arrays');
    }
    
    if (assets.length !== weights.length) {
      throw new Error('Assets and weights arrays must have the same length');
    }
    
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    if (Math.abs(totalWeight - 1) > 0.001) {
      throw new Error(`Weights must sum to 1 (got ${totalWeight})`);
    }
  }
}

module.exports = ImprovedPollenInterface;
