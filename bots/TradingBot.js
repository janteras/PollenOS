const { ethers } = require('ethers');
const logger = require('../utils/logger');
const VePlnContract = require('../contracts/VePlnContract');
const config = require('../config');

class TradingBot {
  constructor(id, strategy, wallet) {
    this.id = id;
    this.strategy = strategy;
    this.wallet = wallet;
    this.vePlnContract = new VePlnContract(wallet);
    this.intervalId = null;
    this.isRunning = false;
    this.lastAction = null;
    this.stats = {
      totalStakes: 0,
      totalUnstakes: 0,
      totalErrors: 0,
      lastError: null,
      lastSuccess: null,
      startTime: null,
      uptime: 0
    };
    
    // Bind methods
    this.start = this.start.bind(this);
    this.stop = this.stop.bind(this);
    this.executeStrategy = this.executeStrategy.bind(this);
  }

  async initialize() {
    try {
      logger.info(`Initializing bot ${this.id} (${this.strategy.name})`, {
        address: this.wallet.address,
        strategy: this.strategy.name,
        params: this.strategy.params
      });
      
      // Check initial staking status with enhanced error handling
      let lockInfo;
      try {
        lockInfo = await this.vePlnContract.getLockInfo(this.wallet.address);
        
        // Log any errors returned from getLockInfo
        if (lockInfo.error) {
          logger.warn(`Warning in getLockInfo for bot ${this.id}`, {
            address: this.wallet.address,
            error: lockInfo.error,
            code: lockInfo.code
          });
        }
        
        // Set last action based on lock status
        const hasActiveLock = lockInfo.hasLock || 
                            (lockInfo.amount > 0 && lockInfo.lockEnd > Math.floor(Date.now() / 1000));
        this.lastAction = hasActiveLock ? 'staked' : 'idle';
        
        // Log detailed lock info
        logger.debug(`Bot ${this.id} lock info`, {
          address: this.wallet.address,
          amount: lockInfo.amount,
          lockEnd: lockInfo.lockEnd,
          hasLock: lockInfo.hasLock,
          lockExpired: lockInfo.lockExpired,
          error: lockInfo.error
        });
        
      } catch (error) {
        logger.error(`Failed to get lock info for bot ${this.id}`, {
          address: this.wallet.address,
          error: error.message,
          code: error.code,
          stack: error.stack
        });
        // Default values if we can't get lock info
        lockInfo = { amount: '0', lockEnd: 0, hasLock: false };
        this.lastAction = 'idle';
      }
      
      // Initialize stats
      this.stats.startTime = new Date();
      
      // Format the lock end time for display
      const formattedLockEnd = lockInfo.lockEnd > 0 
        ? new Date(lockInfo.lockEnd * 1000).toISOString() 
        : 'Not staked';
      
      logger.info(`Bot ${this.id} initialized`, {
        address: this.wallet.address,
        staked: lockInfo.amount > 0 ? ethers.formatEther(lockInfo.amount) : '0',
        lockEnd: formattedLockEnd,
        hasActiveLock: lockInfo.hasLock,
        lockExpired: lockInfo.lockExpired
      });
      
      return true;
    } catch (error) {
      const errorMsg = `Failed to initialize bot ${this.id}`;
      logger.error(errorMsg, {
        error: error.message,
        stack: error.stack,
        address: this.wallet?.address || 'unknown'
      });
      throw new Error(`${errorMsg}: ${error.message}`);
    }
  }

  async checkStatus() {
    try {
      const lockInfo = await this.vePlnContract.getLockInfo(this.wallet.address);
      const now = Math.floor(Date.now() / 1000);
      
      const status = {
        hasLock: lockInfo.amount > 0n,
        amount: lockInfo.amount.toString(),
        lockEnd: lockInfo.lockEnd,
        timeRemaining: lockInfo.lockEnd > now ? lockInfo.lockEnd - now : 0,
        lockEndDate: lockInfo.lockEnd > 0 ? new Date(lockInfo.lockEnd * 1000).toISOString() : null
      };
      
      logger.info(`Bot ${this.id} status`, {
        address: this.wallet.address,
        ...status
      });
      
      return status;
    } catch (error) {
      logger.error(`Bot ${this.id} failed to check status`, {
        error: error.message,
        stack: error.stack,
        address: this.wallet.address
      });
      throw error;
    }
  }
  
  async stake() {
    const operation = 'stake';
    const context = {
      botId: this.id,
      address: this.wallet?.address || 'unknown',
      amount: this.strategy.params.minStakeAmount,
      lockDuration: this.strategy.params.lockDuration,
      lockDurationFormatted: `${this.strategy.params.lockDuration / (24 * 60 * 60)} days`
    };
    
    try {
      // Log the start of the staking operation
      logger.info(`Bot ${this.id} initiating staking operation`, {
        ...context,
        operation,
        status: 'pending'
      });
      
      // Parse the amount with proper error handling
      let amount;
      try {
        amount = ethers.parseEther(this.strategy.params.minStakeAmount.toString());
      } catch (parseError) {
        throw new Error(`Invalid stake amount: ${this.strategy.params.minStakeAmount} - ${parseError.message}`);
      }
      
      // Get current network state for debugging
      const [blockNumber, feeData, balance, nonce] = await Promise.all([
        this.wallet.provider.getBlockNumber().catch(() => 'unknown'),
        this.wallet.provider.getFeeData().catch(() => ({ gasPrice: 'unknown' })),
        this.wallet.provider.getBalance(this.wallet.address).catch(() => 'unknown'),
        this.wallet.getTransactionCount('pending').catch(() => 'unknown')
      ]);
      
      // Log network state
      logger.debug('Current network state', {
        ...context,
        blockNumber,
        gasPrice: feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, 'gwei') + ' gwei' : 'unknown',
        maxFeePerGas: feeData.maxFeePerGas ? ethers.formatUnits(feeData.maxFeePerGas, 'gwei') + ' gwei' : 'n/a',
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? ethers.formatUnits(feeData.maxPriorityFeePerGas, 'gwei') + ' gwei' : 'n/a',
        balance: typeof balance === 'bigint' ? ethers.formatEther(balance) + ' ETH' : 'unknown',
        nonce
      });
      
      // Check if we have enough balance for gas
      if (typeof balance === 'bigint' && feeData.gasPrice) {
        const estimatedGasCost = feeData.gasPrice * 300000n; // 300k gas limit
        if (balance < estimatedGasCost) {
          throw new Error(`Insufficient ETH balance for gas. Need at least ${ethers.formatEther(estimatedGasCost)} ETH, have ${ethers.formatEther(balance)} ETH`);
        }
      }
      
      // Get current lock info to decide if we're staking or extending
      const lockInfo = await this.vePlnContract.getLockInfo(this.wallet.address);
      const isExtendOperation = lockInfo.hasLock && !lockInfo.isExpired;
      
      // Log the operation type
      logger.info(`Bot ${this.id} ${isExtendOperation ? 'extending lock' : 'staking new amount'}`, {
        ...context,
        operation: isExtendOperation ? 'extendLock' : 'stake',
        amount: ethers.formatEther(amount),
        lockDuration: context.lockDurationFormatted,
        currentLockInfo: {
          hasLock: lockInfo.hasLock,
          amount: lockInfo.amount.toString(),
          lockEnd: lockInfo.lockEnd.toString(),
          isExpired: lockInfo.isExpired,
          remainingTime: lockInfo.remainingTime.toString(),
          source: lockInfo.source
        }
      });
      
      // Calculate gas price with a small premium (10%)
      const gasPrice = feeData.gasPrice ? (feeData.gasPrice * 11n / 10n) : undefined; // 10% premium
      
      // Execute the stake operation with retry logic handled by VePlnContract
      const tx = await this.vePlnContract.stake(amount, context.lockDuration, {
        gasLimit: 300000, // Increased gas limit
        gasPrice: gasPrice,
        nonce: nonce !== 'unknown' ? nonce : undefined
      });
      
      // Log transaction submission
      logger.info(`Transaction submitted`, {
        ...context,
        txHash: tx.hash,
        operation: isExtendOperation ? 'extendLock' : 'stake',
        status: 'pending',
        nonce,
        gasPrice: gasPrice ? ethers.formatUnits(gasPrice, 'gwei') + ' gwei' : 'unknown'
      });
      
      // Wait for transaction confirmation with a timeout
      const receipt = await Promise.race([
        tx.wait(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Transaction confirmation timeout')), 120000) // 2 minute timeout
        )
      ]);
      
      // Log transaction confirmation
      const txInfo = {
        ...context,
        txHash: receipt.hash,
        operation: isExtendOperation ? 'extendLock' : 'stake',
        status: receipt.status === 1 ? 'success' : 'failed',
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.effectiveGasPrice ? ethers.formatUnits(receipt.effectiveGasPrice, 'gwei') + ' gwei' : 'unknown',
        cumulativeGasUsed: receipt.cumulativeGasUsed?.toString() || 'unknown',
        confirmations: receipt.confirmations || 0,
        logs: receipt.logs?.length || 0
      };
      
      if (receipt.status === 1) {
        logger.info(`Transaction confirmed successfully`, txInfo);
        
        // Update bot state
        this.lastAction = isExtendOperation ? 'extended' : 'staked';
        this.stats.totalStakes++;
        this.stats.lastSuccess = new Date().toISOString();
        
        // Get updated lock info
        const updatedLockInfo = await this.vePlnContract.getLockInfo(this.wallet.address);
        logger.info(`Lock info updated`, {
          ...context,
          operation: isExtendOperation ? 'extendLock' : 'stake',
          newLockInfo: {
            hasLock: updatedLockInfo.hasLock,
            amount: updatedLockInfo.amount.toString(),
            lockEnd: updatedLockInfo.lockEnd.toString(),
            lockEndDate: updatedLockInfo.lockEndDate,
            isExpired: updatedLockInfo.isExpired,
            remainingTime: updatedLockInfo.remainingTime.toString(),
            source: updatedLockInfo.source
          }
        });
        
        return {
          ...receipt,
          isExtendOperation,
          lockInfo: updatedLockInfo
        };
      } else {
        const error = new Error('Transaction reverted without a reason');
        error.txInfo = txInfo;
        throw error;
      }
      
    } catch (error) {
      // Prepare error information
      const errorInfo = {
        ...context,
        operation,
        status: 'failed',
        error: error.message,
        code: error.code || 'UNKNOWN_ERROR',
        reason: error.reason,
        method: error.method,
        transaction: error.transaction ? {
          hash: error.transaction.hash,
          from: error.transaction.from,
          to: error.transaction.to,
          nonce: error.transaction.nonce,
          gasLimit: error.transaction.gasLimit?.toString(),
          gasPrice: error.transaction.gasPrice ? ethers.formatUnits(error.transaction.gasPrice, 'gwei') + ' gwei' : undefined
        } : undefined,
        receipt: error.receipt ? {
          status: error.receipt.status,
          blockNumber: error.receipt.blockNumber,
          gasUsed: error.receipt.gasUsed?.toString(),
          effectiveGasPrice: error.receipt.effectiveGasPrice ? ethers.formatUnits(error.receipt.effectiveGasPrice, 'gwei') + ' gwei' : undefined
        } : undefined,
        stack: error.stack
      };
      
      // Update error stats
      this.stats.totalErrors++;
      this.stats.lastError = {
        time: new Date().toISOString(),
        message: error.message,
        code: error.code,
        operation
      };
      
      // Log the error
      if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
        logger.warn(`User rejected the transaction`, errorInfo);
      } else if (error.code === 'INSUFFICIENT_FUNDS') {
        logger.error(`Insufficient funds for transaction`, errorInfo);
      } else if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
        logger.error(`Gas estimation failed`, errorInfo);
      } else if (error.code === 'NETWORK_ERROR' || error.code === 'SERVER_ERROR') {
        logger.error(`Network error during transaction`, errorInfo);
      } else if (error.code === 'TIMEOUT') {
        logger.error(`Transaction timed out`, errorInfo);
      } else if (error.code === 'CALL_EXCEPTION') {
        logger.error(`Contract call reverted`, errorInfo);
      } else {
        logger.error(`Unexpected error during staking`, errorInfo);
      }
      
      // Remove undefined fields
      Object.keys(errorInfo).forEach(key => errorInfo[key] === undefined && delete errorInfo[key]);
      
      logger.error(`Bot ${this.id} staking failed`, errorInfo);
      
      this.stats.totalErrors++;
      this.stats.lastError = {
        time: new Date().toISOString(),
        message: error.message,
        code: error.code
      };
      
      throw error;
    }
  }
  
  async extendLock() {
    const operation = 'extendLock';
    const context = {
      botId: this.id,
      address: this.wallet?.address || 'unknown',
      lockDuration: this.strategy.params.lockDuration,
      lockDurationFormatted: `${this.strategy.params.lockDuration / (24 * 60 * 60)} days`
    };
    
    try {
      // Log the start of the lock extension operation
      logger.info(`Bot ${this.id} initiating lock extension`, {
        ...context,
        operation,
        status: 'pending'
      });
      
      // Get current network state for debugging
      const [blockNumber, feeData, balance, nonce, lockInfo] = await Promise.all([
        this.wallet.provider.getBlockNumber().catch(() => 'unknown'),
        this.wallet.provider.getFeeData().catch(() => ({ gasPrice: 'unknown' })),
        this.wallet.provider.getBalance(this.wallet.address).catch(() => 'unknown'),
        this.wallet.getTransactionCount('pending').catch(() => 'unknown'),
        this.vePlnContract.getLockInfo(this.wallet.address)
      ]);
      
      const now = Math.floor(Date.now() / 1000);
      const remainingLockTime = lockInfo.lockEnd > now ? lockInfo.lockEnd - now : 0;
      
      // Update context with lock info
      context.currentLockInfo = {
        hasLock: lockInfo.hasLock,
        amount: lockInfo.amount.toString(),
        lockEnd: lockInfo.lockEnd,
        lockEndDate: new Date(lockInfo.lockEnd * 1000).toISOString(),
        isExpired: lockInfo.isExpired,
        remainingTime: remainingLockTime,
        remainingTimeFormatted: `${Math.floor(remainingLockTime / (24 * 60 * 60))} days`,
        source: lockInfo.source
      };
      
      // Log network state and lock info
      logger.debug('Current network and lock state', {
        ...context,
        blockNumber,
        gasPrice: feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, 'gwei') + ' gwei' : 'unknown',
        maxFeePerGas: feeData.maxFeePerGas ? ethers.formatUnits(feeData.maxFeePerGas, 'gwei') + ' gwei' : 'n/a',
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? ethers.formatUnits(feeData.maxPriorityFeePerGas, 'gwei') + ' gwei' : 'n/a',
        balance: typeof balance === 'bigint' ? ethers.formatEther(balance) + ' ETH' : 'unknown',
        nonce,
        ...context.currentLockInfo
      });
      
      // Check if there's an active stake to extend
      if (!lockInfo.hasLock || lockInfo.amount === 0n || lockInfo.amount === '0') {
        const msg = `No active stake found to extend`;
        logger.warn(msg, context);
        return { 
          status: 'no_stake', 
          lockInfo: context.currentLockInfo,
          ...context
        };
      }
      
      // Check if lock is already expired
      if (lockInfo.isExpired) {
        const msg = `Cannot extend an expired lock. Please create a new stake.`;
        logger.warn(msg, context);
        return { 
          status: 'lock_expired',
          lockInfo: context.currentLockInfo,
          ...context
        };
      }
      
      // Log the lock extension details
      logger.info(`Bot ${this.id} extending lock`, {
        ...context,
        operation,
        status: 'preparing',
        newLockDuration: context.lockDurationFormatted,
        currentLockInfo: context.currentLockInfo
      });
      
      // Check if we have enough balance for gas
      if (typeof balance === 'bigint' && feeData.gasPrice) {
        const estimatedGasCost = feeData.gasPrice * 300000n; // 300k gas limit
        if (balance < estimatedGasCost) {
          throw new Error(`Insufficient ETH balance for gas. Need at least ${ethers.formatEther(estimatedGasCost)} ETH, have ${ethers.formatEther(balance)} ETH`);
        }
      }
      
      // Calculate gas price with a small premium (10%)
      const gasPrice = feeData.gasPrice ? (feeData.gasPrice * 11n / 10n) : undefined;
      
      // Execute the lock extension with retry logic handled by VePlnContract
      const tx = await this.vePlnContract.stake(
        0, // Extend with 0 amount to just extend the lock
        context.lockDuration,
        {
          gasLimit: 300000, // Increased gas limit
          gasPrice: gasPrice,
          nonce: nonce !== 'unknown' ? nonce : undefined
        }
      );
      
      // Log transaction submission
      logger.info(`Lock extension transaction submitted`, {
        ...context,
        txHash: tx.hash,
        operation,
        status: 'pending',
        nonce,
        gasPrice: gasPrice ? ethers.formatUnits(gasPrice, 'gwei') + ' gwei' : 'unknown'
      });
      
      // Wait for transaction confirmation with a timeout
      const receipt = await Promise.race([
        tx.wait(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Transaction confirmation timeout')), 120000) // 2 minute timeout
        )
      ]);
      
      // Log transaction confirmation
      const txInfo = {
        ...context,
        txHash: receipt.hash,
        operation,
        status: receipt.status === 1 ? 'success' : 'failed',
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.effectiveGasPrice ? ethers.formatUnits(receipt.effectiveGasPrice, 'gwei') + ' gwei' : 'unknown',
        cumulativeGasUsed: receipt.cumulativeGasUsed?.toString() || 'unknown',
        confirmations: receipt.confirmations || 0,
        logs: receipt.logs?.length || 0
      };
      
      if (receipt.status === 1) {
        logger.info(`Lock extension transaction confirmed successfully`, txInfo);
        
        // Update bot state
        this.lastAction = 'extended';
        this.stats.lastSuccess = new Date().toISOString();
        
        // Get updated lock info
        const updatedLockInfo = await this.vePlnContract.getLockInfo(this.wallet.address);
        logger.info(`Lock info updated after extension`, {
          ...context,
          operation,
          status: 'completed',
          newLockInfo: {
            hasLock: updatedLockInfo.hasLock,
            amount: updatedLockInfo.amount.toString(),
            lockEnd: updatedLockInfo.lockEnd.toString(),
            lockEndDate: updatedLockInfo.lockEndDate,
            isExpired: updatedLockInfo.isExpired,
            remainingTime: updatedLockInfo.remainingTime.toString(),
            source: updatedLockInfo.source
          }
        });
        
        return {
          ...receipt,
          status: 'extended',
          operation,
          lockInfo: updatedLockInfo,
          ...context
        };
      } else {
        const error = new Error('Transaction reverted without a reason');
        error.txInfo = txInfo;
        throw error;
      }
      
    } catch (error) {
      // Prepare error information
      const errorInfo = {
        ...context,
        operation,
        status: 'failed',
        error: error.message,
        code: error.code || 'UNKNOWN_ERROR',
        reason: error.reason,
        method: error.method,
        transaction: error.transaction ? {
          hash: error.transaction.hash,
          from: error.transaction.from,
          to: error.transaction.to,
          nonce: error.transaction.nonce,
          gasLimit: error.transaction.gasLimit?.toString(),
          gasPrice: error.transaction.gasPrice ? ethers.formatUnits(error.transaction.gasPrice, 'gwei') + ' gwei' : undefined
        } : undefined,
        receipt: error.receipt ? {
          status: error.receipt.status,
          blockNumber: error.receipt.blockNumber,
          gasUsed: error.receipt.gasUsed?.toString(),
          effectiveGasPrice: error.receipt.effectiveGasPrice ? 
            ethers.formatUnits(error.receipt.effectiveGasPrice, 'gwei') + ' gwei' : undefined
        } : undefined,
        stack: error.stack
      };
      
      // Update error stats
      this.stats.totalErrors++;
      this.stats.lastError = {
        time: new Date().toISOString(),
        message: error.message,
        code: error.code,
        operation
      };
      
      // Log the error with appropriate level
      if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
        logger.warn(`User rejected the lock extension transaction`, errorInfo);
      } else if (error.code === 'INSUFFICIENT_FUNDS') {
        logger.error(`Insufficient funds for lock extension transaction`, errorInfo);
      } else if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
        logger.error(`Gas estimation failed for lock extension`, errorInfo);
      } else if (error.code === 'NETWORK_ERROR' || error.code === 'SERVER_ERROR') {
        logger.error(`Network error during lock extension`, errorInfo);
      } else if (error.code === 'TIMEOUT') {
        logger.error(`Lock extension transaction timed out`, errorInfo);
      } else if (error.code === 'CALL_EXCEPTION') {
        logger.error(`Contract call reverted during lock extension`, errorInfo);
      } else {
        logger.error(`Unexpected error during lock extension`, errorInfo);
      }
      
      throw error;
    }
  }

  start(interval) {
    if (this.isRunning) {
      logger.warn(`Bot ${this.id} is already running`);
      return this;
    }

    this.isRunning = true;
    this.stats.startTime = this.stats.startTime || new Date();
    
    logger.info(`Starting bot ${this.id} (${this.strategy.name})`, {
      interval: `${interval}ms`,
      address: this.wallet.address
    });
    
    // Initial execution
    this.executeStrategy().catch(error => {
      logger.error(`Initial execution failed for bot ${this.id}`, {
        error: error.message,
        stack: error.stack
      });
    });
    
    // Set up interval
    this.intervalId = setInterval(() => {
      this.executeStrategy().catch(error => {
        logger.error(`Scheduled execution failed for bot ${this.id}`, {
          error: error.message,
          stack: error.stack
        });
      });
    }, interval);
    
    return this;
  }

  stop() {
    if (!this.isRunning) {
      logger.warn(`Bot ${this.id} is not running`);
      return this;
    }
    
    clearInterval(this.intervalId);
    this.intervalId = null;
    this.isRunning = false;
    
    // Update uptime
    if (this.stats.startTime) {
      this.stats.uptime += Date.now() - this.stats.startTime;
    }
    
    logger.info(`Stopped bot ${this.id}`, {
      address: this.wallet.address,
      uptime: this.stats.uptime
    });
    
    return this;
  }

  async executeStrategy() {
    const startTime = Date.now();
    let action = 'check';
    let success = false;
    
    try {
      // Get current lock status first
      const lockInfo = await this.vePlnContract.getLockInfo(this.wallet.address);
      const now = Math.floor(Date.now() / 1000);
      
      // Log current status for debugging
      logger.debug(`Bot ${this.id} strategy execution`, {
        address: this.wallet.address,
        hasLock: lockInfo.hasLock,
        amount: lockInfo.amount,
        lockEnd: lockInfo.lockEnd,
        lockExpired: lockInfo.lockExpired,
        now,
        timeRemaining: lockInfo.lockEnd > now ? lockInfo.lockEnd - now : 0
      });
      
      let action = 'check';
      let result;
      
      // If we have an active lock, decide whether to extend it
      if (lockInfo.hasLock && !lockInfo.lockExpired) {
        const timeRemaining = lockInfo.lockEnd - now;
        const lockDuration = this.strategy.params.lockDuration;
        const extendThreshold = lockDuration * 0.25; // 25% of lock duration
        
        // If lock is expiring soon, extend it
        if (timeRemaining < extendThreshold) {
          action = 'extend';
          logger.info(`Bot ${this.id} lock expiring soon, extending...`, {
            timeRemaining: `${timeRemaining / (24 * 60 * 60)} days`,
            extendThreshold: `${extendThreshold / (24 * 60 * 60)} days`
          });
        } else if (Math.random() < 0.1) {
          // 10% chance to check status
          action = 'check';
        } else {
          // Otherwise, do nothing (most common case for active locks)
          return { 
            success: true, 
            action: 'noop', 
            result: { status: 'active_lock', lockInfo } 
          };
        }
      } 
      // If we have an expired lock, decide whether to extend or create a new one
      else if (lockInfo.lockExpired) {
        // 70% chance to create a new lock, 30% to extend the expired one
        action = Math.random() < 0.7 ? 'stake' : 'extend';
        logger.info(`Bot ${this.id} has an ${action === 'stake' ? 'expired lock, creating a new one' : 'extending expired lock'}`);
      }
      // If no active lock, stake with a high probability
      else if (Math.random() < 0.8) {
        action = 'stake';
      }
      
      // Execute the chosen action
      logger.debug(`Bot ${this.id} executing action`, { action });
      
      switch (action) {
        case 'stake':
          result = await this.stake();
          this.stats.totalStakes++;
          break;
        case 'extend':
          result = await this.extendLock();
          break;
        default:
          result = await this.checkStatus();
      }
      
      // Update stats
      success = true;
      this.stats.lastAction = new Date().toISOString();
      this.stats.lastSuccess = this.stats.lastAction;
      this.stats.uptime = this.stats.uptime + (Date.now() - startTime);
      
      logger.info(`Bot ${this.id} ${action} completed`, {
        action,
        duration: `${Date.now() - startTime}ms`,
        address: this.wallet.address,
        result: result ? 'success' : 'no action'
      });
      
      return { success, action, result };
    } catch (error) {
      // Update error stats
      this.stats.totalErrors++;
      this.stats.lastError = {
        time: new Date().toISOString(),
        message: error.message,
        stack: error.stack
      };
      
      logger.error(`Bot ${this.id} ${action} failed`, {
        action,
        error: error.message,
        stack: error.stack,
        strategy: this.strategy.name,
        address: this.wallet?.address || 'unknown',
        duration: `${Date.now() - startTime}ms`
      });
      
      // Rethrow for the caller to handle
      throw error;
    }
  }
}

module.exports = TradingBot;
