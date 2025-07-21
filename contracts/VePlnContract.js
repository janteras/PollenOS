const { ethers } = require('ethers');
const logger = require('../utils/logger');
const config = require('../config');
const vePLNABI = require('../abis/vePLN.json').abi;

class VePlnContract {
  constructor(signer) {
    this.contract = new ethers.Contract(
      config.CONTRACTS.VEPLN,
      vePLNABI,
      signer
    );
    this.defaultLockDuration = 4 * 365 * 24 * 60 * 60; // 4 years
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
    this.initialized = false;
    
    // Initialize contract metadata
    this._initContract();
  }
  
  async _initContract() {
    try {
      this.name = await this.contract.name();
      this.symbol = await this.contract.symbol();
      this.decimals = await this.contract.decimals();
      this.initialized = true;
      logger.info(`Initialized vePLN contract: ${this.name} (${this.symbol})`);
    } catch (error) {
      logger.error('Failed to initialize vePLN contract', { error: error.message });
      throw error;
    }
  }

  async getLockInfo(address) {
    try {
      // Validate address
      if (!ethers.isAddress(address)) {
        throw new Error(`Invalid address: ${address}`);
      }
      
      const result = {
        amount: 0n,
        lockEnd: 0n,
        hasLock: false,
        isExpired: true,
        remainingTime: 0n,
        formattedAmount: '0',
        lockEndDate: null,
        source: 'none',
        error: null
      };
      
      // Get current timestamp in seconds
      const now = BigInt(Math.floor(Date.now() / 1000));
      
      try {
        // Try to get lock info using getLockInfo method
        try {
          const [amount, lockEnd] = await this.contract.getLockInfo(address);
          result.amount = BigInt(amount.toString());
          result.lockEnd = BigInt(lockEnd.toString());
          result.source = 'getLockInfo';
        } catch (error) {
          // If getLockInfo fails, try the locked method (common in veToken implementations)
          if (error.code === 'CALL_EXCEPTION' || error.code === 'UNPREDICTABLE_GAS_LIMIT') {
            try {
              const [amount, end] = await this.contract.locked(address);
              result.amount = BigInt(amount.toString());
              result.lockEnd = BigInt(end.toString());
              result.source = 'locked';
            } catch (innerError) {
              // If locked fails, try to get lock end separately
              try {
                // Some veToken implementations have a locked__end function
                const end = await this.contract['locked__end(address)'](address);
                result.lockEnd = BigInt(end.toString());
                // Get the balance as the amount
                const balance = await this.contract.balanceOf(address);
                result.amount = BigInt(balance.toString());
                result.source = 'locked__end + balanceOf';
              } catch (endError) {
                // If all methods fail, just get the balance
                const balance = await this.contract.balanceOf(address);
                result.amount = BigInt(balance.toString());
                result.source = 'balanceOf only';
                result.error = `All lock info methods failed: ${endError.message}`;
              }
            }
          } else {
            // If it's not a CALL_EXCEPTION, rethrow the error
            throw error;
          }
        }
        
        // Process the results
        result.hasLock = result.amount > 0n && result.lockEnd > 0n;
        result.isExpired = result.hasLock ? now >= result.lockEnd : true;
        result.remainingTime = result.hasLock && !result.isExpired ? result.lockEnd - now : 0n;
        result.formattedAmount = ethers.formatUnits(result.amount, 18); // Assuming 18 decimals
        result.lockEndDate = result.lockEnd > 0n ? new Date(Number(result.lockEnd) * 1000).toISOString() : null;
        
        // Log the result for debugging
        logger.debug('Lock info retrieved', {
          address,
          amount: result.amount.toString(),
          formattedAmount: result.formattedAmount,
          lockEnd: result.lockEnd.toString(),
          lockEndDate: result.lockEndDate,
          hasLock: result.hasLock,
          isExpired: result.isExpired,
          remainingTime: result.remainingTime.toString(),
          source: result.source,
          error: result.error
        });
        
        return result;
        
      } catch (error) {
        const errorInfo = {
          address,
          error: error.message,
          code: error.code,
          reason: error.reason,
          data: error.data,
          stack: error.stack
        };
        
        logger.error('Failed to get lock info', errorInfo);
        
        // Return a default response with error information
        return {
          amount: 0n,
          lockEnd: 0n,
          hasLock: false,
          isExpired: true,
          remainingTime: 0n,
          formattedAmount: '0',
          lockEndDate: null,
          source: 'error',
          error: error.message
        };  
      }
    } catch (error) {
      throw error;
    }
  }

  async stake(amount, lockDuration = this.defaultLockDuration, options = {}) {
    return this._withRetry(async () => {
      try {
        // Validate inputs
        if (typeof amount !== 'bigint') {
          amount = BigInt(amount);
        }
        
        if (typeof lockDuration !== 'bigint') {
          lockDuration = BigInt(lockDuration);
        }
        
        // Get current gas price with a buffer
        const feeData = await this.contract.runner.provider.getFeeData();
        const gasPrice = options.gasPrice || (feeData.gasPrice ? feeData.gasPrice * 2n : undefined);
        
        // Set default transaction options
        const txOptions = {
          gasLimit: 500000,
          gasPrice: gasPrice,
          ...options // Allow overriding defaults
        };
        
        // For lock extension (amount = 0), we need to ensure we have an active stake
        if (amount === 0n) {
          const lockInfo = await this.getLockInfo(await this.contract.runner.getAddress());
          if (!lockInfo.hasLock) {
            throw new Error('Cannot extend lock: No active stake found');
          }
          
          // Ensure lock duration is valid
          if (lockDuration <= 0n) {
            throw new Error('Lock duration must be greater than 0');
          }
        }
        
        logger.debug('Executing stake transaction', {
          amount: amount.toString(),
          lockDuration: lockDuration.toString(),
          options: {
            ...txOptions,
            gasPrice: txOptions.gasPrice?.toString()
          }
        });
        
        // Execute the stake transaction
        const tx = await this.contract.stake(amount, lockDuration, txOptions);
        
        // Wait for the transaction to be mined with a timeout
        const receipt = await Promise.race([
          tx.wait(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Transaction timeout')), 60000) // 60 second timeout
          )
        ]);
        
        // Log the successful transaction
        logger.info('Stake transaction confirmed', {
          txHash: tx.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
          effectiveGasPrice: receipt.effectiveGasPrice?.toString(),
          status: receipt.status === 1 ? 'success' : 'failed',
          logs: receipt.logs?.length || 0
        });
        
        if (receipt.status !== 1) {
          throw new Error('Transaction reverted without a reason');
        }
        
        return {
          txHash: tx.hash,
          receipt,
          blockNumber: receipt.blockNumber
        };
      } catch (error) {
        // Enhance the error with more context
        const enhancedError = new Error(`Stake failed: ${error.message}`);
        enhancedError.originalError = error;
        enhancedError.code = error.code;
        enhancedError.reason = error.reason;
        enhancedError.data = error.data;
        enhancedError.transaction = error.transaction;
        enhancedError.receipt = error.receipt;
        
        logger.error('Stake transaction failed', {
          error: enhancedError.message,
          code: enhancedError.code,
          reason: enhancedError.reason,
          data: enhancedError.data,
          transaction: enhancedError.transaction?.hash,
          stack: enhancedError.stack
        });
        
        throw enhancedError;
      }
    });

  async _withRetry(operation, retryCount = 0, lastError = null) {
    try {
      const result = await operation();
      
      // If we had a previous error but now succeeded, log the recovery
      if (retryCount > 0) {
        logger.info(`Operation succeeded after ${retryCount} ${retryCount === 1 ? 'retry' : 'retries'}`, {
          retryCount,
          lastError: lastError?.message || 'None'
        });
      }
      
      return result;
      
    } catch (error) {
      const operationName = operation.name || 'anonymous operation';
      const errorCode = error.code || 'UNKNOWN_ERROR';
      const errorMessage = error.message || 'Unknown error';
      
      // If this is the first error, log it with more details
      if (retryCount === 0) {
        logger.warn(`Operation failed (${operationName}), starting retry sequence`, {
          operation: operationName,
          error: errorMessage,
          code: errorCode,
          reason: error.reason,
          data: error.data,
          transaction: error.transaction?.hash,
          receipt: error.receipt,
          stack: error.stack,
          retryCount,
          maxRetries: this.maxRetries
        });
      }
      
      // Check if we should retry
      const shouldRetry = (
        retryCount < this.maxRetries && 
        this._isRetryableError(error)
      );
      
      if (shouldRetry) {
        // Calculate exponential backoff with jitter
        const baseDelay = Math.min(
          this.retryDelay * Math.pow(2, retryCount),
          30000 // Max 30 seconds
        );
        const jitter = Math.random() * 1000; // Add up to 1 second of jitter
        const delay = Math.floor(baseDelay + jitter);
        
        // Log retry attempt
        const retryInfo = {
          operation: operationName,
          attempt: `${retryCount + 1}/${this.maxRetries}`,
          delayMs: delay,
          error: errorMessage,
          code: errorCode,
          nextRetryIn: `${(delay / 1000).toFixed(2)}s`,
          remainingRetries: this.maxRetries - retryCount - 1
        };
        
        if (retryCount > 0) {
          logger.warn(`Retry attempt ${retryCount + 1} for ${operationName}`, retryInfo);
        } else {
          logger.info(`First retry for ${operationName}`, retryInfo);
        }
        
        // Wait before retrying with a timeout
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            clearTimeout(timeout);
            resolve();
          }, delay);
        });
        
        // Retry the operation with the same context
        return this._withRetry(operation, retryCount + 1, error);
      }
      
      // If we're not retrying, log the final error with all available context
      const failureContext = {
        operation: operationName,
        error: errorMessage,
        code: errorCode,
        reason: error.reason,
        data: error.data,
        transaction: error.transaction?.hash,
        receipt: error.receipt,
        stack: error.stack,
        retryAttempts: retryCount,
        maxRetries: this.maxRetries,
        totalTimeMs: retryCount * this.retryDelay,
        isFinalAttempt: true
      };
      
      // Remove undefined values
      Object.keys(failureContext).forEach(key => 
        failureContext[key] === undefined && delete failureContext[key]
      );
      
      if (retryCount > 0) {
        logger.error(`Operation failed after ${retryCount} ${retryCount === 1 ? 'retry' : 'retries'}`, failureContext);
      } else {
        logger.error(`Operation failed on first attempt`, failureContext);
      }
      
      // Enhance the error with additional context before throwing
      const enhancedError = new Error(`Operation failed after ${retryCount} ${retryCount === 1 ? 'retry' : 'retries'}: ${errorMessage}`);
      enhancedError.originalError = error;
      enhancedError.code = errorCode;
      enhancedError.reason = error.reason;
      enhancedError.data = error.data;
      enhancedError.transaction = error.transaction;
      enhancedError.receipt = error.receipt;
      enhancedError.retryCount = retryCount;
      enhancedError.isFinalAttempt = true;
      
      throw enhancedError;
    }
  }
  
  _isRetryableError(error) {
    // List of error codes that are safe to retry
    const retryableErrors = [
      'NETWORK_ERROR',
      'SERVER_ERROR',
      'TIMEOUT',
      'TIMEOUT_ERROR',
      'UNKNOWN_ERROR',
      'CALL_EXCEPTION', // Sometimes transient
      'UNPREDICTABLE_GAS_LIMIT', // Gas estimation can be flaky
      'REPLACEMENT_UNDERPRICED', // Can happen with multiple transactions
      'NONCE_EXPIRED', // Can happen with multiple transactions
      'INSUFFICIENT_FUNDS', // Sometimes temporary if balance is pending
      'INSUFFICIENT_FUNDS_FOR_GAS',
      'INSUFFICIENT_FUNDS_FOR_TRANSACTION',
      'GAS_PRICE_TOO_LOW',
      'GAS_LIMIT_EXCEEDED',
      'GAS_REQUIRED_EXCEEDS_ALLOWANCE',
      'TRANSACTION_REPLACED',
      'TRANSACTION_REPLACEMENT_UNDERPRICED',
      'TOO_MANY_CONCURRENT_REQUESTS',
      'RATE_LIMIT_EXCEEDED',
      'PROVIDER_DISCONNECTED',
      'WEBSOCKET_ERROR',
      'PENDING_TRANSACTION',
      'REVERTED', // Sometimes the node might be in an inconsistent state
      'BAD_DATA', // Sometimes nodes return bad data
      'BAD_RLP', // Sometimes nodes have RLP issues
      'INTERNAL_ERROR',
      'INVALID_INPUT',
      'RESOURCE_UNAVAILABLE',
      'RESOURCE_EXHAUSTED',
      'RPC_ERROR',
      'RPC_METHOD_NOT_FOUND',
      'RPC_INVALID_PARAMS',
      'RPC_INTERNAL_ERROR',
      'RPC_INVALID_REQUEST',
      'RPC_PARSE_ERROR',
      'RPC_METHOD_NOT_SUPPORTED',
      'RPC_INVALID_MESSAGE',
      'RPC_REQUEST_TOO_LARGE',
      'RPC_RESPONSE_TOO_LARGE',
      'RPC_UPSTREAM_ERROR',
      'RPC_UNKNOWN_ERROR',
      'RPC_NODE_NOT_READY',
      'RPC_NODE_SYNCING',
      'RPC_NODE_NOT_CONNECTED',
      'RPC_NODE_NOT_AVAILABLE',
      'RPC_NODE_BEHIND',
      'RPC_NODE_NOT_SYNCED',
      'RPC_NODE_ERROR',
      'RPC_NODE_TIMEOUT',
      'RPC_NODE_UNREACHABLE',
      'RPC_NODE_BUSY',
      'RPC_NODE_OVERLOADED',
      'RPC_NODE_RATE_LIMITED',
      'RPC_NODE_CAPACITY_REACHED',
      'RPC_NODE_SHUTTING_DOWN',
      'RPC_NODE_MAINTENANCE',
      'RPC_NODE_UPGRADE_REQUIRED',
      'RPC_NODE_DEPRECATED',
      'RPC_NODE_UNSUPPORTED',
      'RPC_NODE_INCOMPATIBLE',
      'RPC_NODE_UNAUTHORIZED',
      'RPC_NODE_FORBIDDEN',
      'RPC_NODE_NOT_FOUND',
      'RPC_NODE_CONFLICT',
      'RPC_NODE_GONE',
      'RPC_NODE_PRECONDITION_FAILED',
      'RPC_NODE_REQUEST_ENTITY_TOO_LARGE',
      'RPC_NODE_REQUEST_HEADER_FIELDS_TOO_LARGE',
      'RPC_NODE_REQUEST_TIMEOUT',
      'RPC_NODE_TOO_MANY_REQUESTS',
      'RPC_NODE_REQUEST_HEADER_FIELDS_TOO_LARGE',
      'RPC_NODE_UNAVAILABLE_FOR_LEGAL_REASONS',
      'RPC_NODE_INTERNAL_SERVER_ERROR',
      'RPC_NODE_NOT_IMPLEMENTED',
      'RPC_NODE_BAD_GATEWAY',
      'RPC_NODE_SERVICE_UNAVAILABLE',
      'RPC_NODE_GATEWAY_TIMEOUT',
      'RPC_NODE_HTTP_VERSION_NOT_SUPPORTED',
      'RPC_NODE_VARIANT_ALSO_NEGOTIATES',
      'RPC_NODE_INSUFFICIENT_STORAGE',
      'RPC_NODE_LOOP_DETECTED',
      'RPC_NODE_NOT_EXTENDED',
      'RPC_NODE_NETWORK_AUTHENTICATION_REQUIRED',
      'RPC_NODE_NETWORK_CONNECT_TIMEOUT_ERROR'
    ];
    
    // List of error codes that should never be retried
    const nonRetryableErrors = [
      'ACTION_REJECTED', // User rejected the transaction
      'INVALID_ARGUMENT', // Invalid input parameters
      'MISSING_ARGUMENT', // Missing required parameters
      'UNSUPPORTED_OPERATION', // Operation not supported
      'UNKNOWN_ACCOUNT', // Account not found
      'NOT_IMPLEMENTED', // Method not implemented
      'UNSUPPORTED_OPERATION', // Operation not supported
      'NUMERIC_FAULT', // Numeric overflow/underflow
      'BUFFER_OVERRUN', // Buffer overflow
      'ARRAY_ACCESS_VIOLATION', // Array index out of bounds
      'OUT_OF_GAS', // Transaction ran out of gas
      'REVERT', // Transaction reverted
      'CALL_EXCEPTION', // Call reverted (but we'll handle this specially below)
      'INSUFFICIENT_FUNDS', // Not enough funds (but we'll handle this specially below)
      'NONCE_EXPIRED', // Nonce too low (but we'll handle this specially below)
      'REPLACEMENT_UNDERPRICED', // Replacement transaction underpriced (but we'll handle this specially below)
      'UNPREDICTABLE_GAS_LIMIT' // Gas estimation failed (but we'll handle this specially below)
    ];
    
    // Check for non-retryable error codes first
    if (nonRetryableErrors.includes(error.code)) {
      // Special handling for CALL_EXCEPTION - only retry if it's a network issue
      if (error.code === 'CALL_EXCEPTION') {
        // If there's a revert reason, don't retry
        if (error.reason || (error.data && error.data.message)) {
          return false;
        }
        // If it's a call exception without a reason, it might be a network issue
        return true;
      }
      
      // Special handling for INSUFFICIENT_FUNDS - might be temporary due to pending transactions
      if (error.code === 'INSUFFICIENT_FUNDS') {
        // Only retry if we don't have a specific error message
        return !error.reason && !(error.data && error.data.message);
      }
      
      // Special handling for NONCE_EXPIRED - might be due to a pending transaction
      if (error.code === 'NONCE_EXPIRED') {
        return true;
      }
      
      // Special handling for REPLACEMENT_UNDERPRICED - might be due to gas price issues
      if (error.code === 'REPLACEMENT_UNDERPRICED') {
        return true;
      }
      
      // Special handling for UNPREDICTABLE_GAS_LIMIT - might be due to network conditions
      if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
        return true;
      }
      
      // For all other non-retryable errors, don't retry
      return false;
    }
    
    // Check if the error has a revert reason or data
    if (error.reason || (error.data && error.data.message)) {
      // Don't retry if the transaction was reverted with a reason
      return false;
    }
    
    // Check if the error is in our retryable list
    if (retryableErrors.includes(error.code)) {
      return true;
    }
    
    // If we don't have an error code, it might be a network issue
    if (!error.code) {
      // Check if it's a network-related error
      const networkErrorPatterns = [
        'network',
        'connection',
        'timeout',
        'disconnected',
        'socket',
        'fetch',
        'request',
        'response',
        'server',
        'service',
        'unavailable',
        'failed',
        'error',
        'exception',
        'reject',
        'denied',
        'refused',
        'reset',
        'aborted',
        'cancel',
        'close',
        'end',
        'hang',
        'hang up',
        'hangup',
        'interrupt',
        'terminate',
        'terminated',
        'termination',
        'abandon',
        'aborted',
        'aborting',
        'abort',
        'aborts',
        'aborted',
        'aborting',
        'abort',
        'aborts'
      ];
      
      const errorMessage = (error.message || '').toLowerCase();
      return networkErrorPatterns.some(pattern => errorMessage.includes(pattern));
    }
    
    // Default to not retrying for unknown error codes
    return false;
  }
}

module.exports = VePlnContract;
