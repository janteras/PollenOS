class ErrorHandler {
  static isRetryableError(error) {
    // Network errors
    if (error.code === 'NETWORK_ERROR' || 
        error.code === 'ECONNRESET' || 
        error.code === 'ETIMEDOUT') {
      return true;
    }
    
    // Rate limiting
    if (error.statusCode === 429) {
      return true;
    }
    
    // Transaction errors that can be retried
    if (error.code === 'UNPREDICTABLE_GAS_LIMIT' ||
        error.code === 'SERVER_ERROR' ||
        error.code === 'TIMEOUT' ||
        error.message?.includes('replacement fee too low') ||
        error.message?.includes('nonce has already been used') ||
        error.message?.includes('already known')) {
      return true;
    }
    
    // Some CALL_EXCEPTION errors can be retried (network issues)
    if (error.code === 'CALL_EXCEPTION' && 
        (error.message?.includes('network') || 
         error.message?.includes('timeout') ||
         error.message?.includes('connection'))) {
      return true;
    }
    
    return false;
  }

  static parseCallException(error) {
    if (error.code !== 'CALL_EXCEPTION') {
      return null;
    }

    const result = {
      type: 'CALL_EXCEPTION',
      transactionHash: error.transactionHash,
      reason: error.reason,
      receipt: error.receipt,
      transaction: error.transaction
    };

    // Extract revert reason from receipt
    if (error.receipt && error.receipt.status === 0) {
      result.failed = true;
      result.gasUsed = error.receipt.gasUsed?.toString();
      result.blockNumber = error.receipt.blockNumber;
    }

    // Try to extract custom error data
    if (error.data) {
      result.errorData = error.data;
      
      // Check for common error signatures
      if (error.data.startsWith('0x08c379a0')) {
        try {
          const { ethers } = require('ethers');
          const reason = ethers.utils.defaultAbiCoder.decode(
            ['string'],
            '0x' + error.data.slice(10)
          )[0];
          result.decodedReason = reason;
        } catch (e) {
          result.decodedReason = 'Could not decode revert reason';
        }
      }
    }

    return result;
  }

  static getErrorSuggestion(error) {
    if (error.code === 'CALL_EXCEPTION') {
      const parsed = this.parseCallException(error);
      
      if (parsed?.failed) {
        const suggestions = [];
        
        // Check for common portfolio creation issues
        if (error.transactionHash && error.transaction?.data?.includes('215fea27')) { // createPortfolio selector
          suggestions.push('• Verify weight array sums to exactly 100');
          suggestions.push('• Check PLN token allowance is sufficient');
          suggestions.push('• Ensure minimum stake amount requirements are met');
          suggestions.push('• Verify all boolean arrays have correct length');
        }
        
        // Gas-related suggestions
        if (parsed.gasUsed) {
          const gasUsed = parseInt(parsed.gasUsed, 16);
          if (gasUsed > 400000) {
            suggestions.push('• Consider increasing gas limit for complex operations');
          }
        }
        
        // Generic suggestions
        suggestions.push('• Simulate transaction before sending');
        suggestions.push('• Check contract state and parameters');
        suggestions.push('• Verify sufficient ETH balance for gas');
        
        return suggestions;
      }
    }
    
    return ['• Check network connectivity and try again'];
  }

  static withRetry(fn, maxRetries = 3, delay = 1000) {
    return async function(...args) {
      let lastError;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          return await fn(...args);
        } catch (error) {
          lastError = error;
          
          if (!this.isRetryableError(error) || attempt === maxRetries) {
            throw error;
          }
          
          // Exponential backoff with jitter
          const backoff = Math.min(delay * Math.pow(2, attempt - 1), 30000);
          const jitter = Math.floor(Math.random() * 1000);
          await new Promise(resolve => setTimeout(resolve, backoff + jitter));
        }
      }
      
      throw lastError;
    }.bind(this);
  }

  static async executeWithCircuitBreaker(fn, options = {}) {
    const {
      failureThreshold = 5,
      successThreshold = 2,
      timeout = 30000,
      name = 'operation'
    } = options;

    let failures = 0;
    let successes = 0;
    let state = 'CLOSED';
    let nextAttempt = 0;

    return async (...args) => {
      if (state === 'OPEN') {
        if (Date.now() > nextAttempt) {
          state = 'HALF';
        } else {
          throw new Error(`Circuit breaker is OPEN for ${name}`);
        }
      }

      try {
        // Add timeout to the operation
        const result = await Promise.race([
          fn(...args),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`${name} timed out after ${timeout}ms`)), timeout)
          )
        ]);

        // Handle success
        if (state === 'HALF') {
          successes++;
          if (successes >= successThreshold) {
            state = 'CLOSED';
            failures = 0;
            successes = 0;
          }
        }

        return result;
      } catch (error) {
        // Handle failure
        if (state === 'HALF') {
          state = 'OPEN';
          nextAttempt = Date.now() + 60000; // 1 minute cooldown
        } else {
          failures++;
          if (failures >= failureThreshold) {
            state = 'OPEN';
            nextAttempt = Date.now() + 60000; // 1 minute cooldown
          }
        }

        throw error;
      }
    };
  }
}

module.exports = ErrorHandler;
