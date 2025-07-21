const { ethers } = require('ethers');
const logger = require('./logger');

class GasOptimizer {
  constructor(provider, options = {}) {
    this.provider = provider;
    this.options = {
      maxFeePerGasGwei: 150, // Default max fee cap
      maxPriorityFeeGwei: 1.5, // Default priority fee
      gasLimitMultiplier: 1.2, // 20% buffer
      ...options
    };
    this.gasHistory = [];
    this.maxHistorySize = 100;
  }

  /**
   * Get optimized gas parameters
   */
  async getGasParams(estimatedGas) {
    try {
      // Get current base fee and suggested priority fee
      const [block, feeData] = await Promise.all([
        this.provider.getBlock('latest'),
        this.provider.getFeeData()
      ]);

      // Calculate max fee (base fee * 2 + priority fee)
      const baseFee = block?.baseFeePerGas || ethers.parseUnits('30', 'gwei');
      const maxPriorityFeePerGas = ethers.parseUnits(
        this.options.maxPriorityFeeGwei.toString(),
        'gwei'
      );
      
      // Calculate max fee with buffer
      const maxFeePerGas = baseFee * 2n + maxPriorityFeePerGas;
      
      // Apply gas limit multiplier with ceiling
      const gasLimit = Math.ceil(Number(estimatedGas) * this.options.gasLimitMultiplier);

      // Update gas history for analytics
      this._updateGasHistory({
        baseFee: ethers.formatUnits(baseFee, 'gwei'),
        maxPriorityFeePerGas: ethers.formatUnits(maxPriorityFeePerGas, 'gwei'),
        maxFeePerGas: ethers.formatUnits(maxFeePerGas, 'gwei'),
        gasLimit
      });

      return {
        maxFeePerGas,
        maxPriorityFeePerGas,
        gasLimit,
        type: 2 // EIP-1559
      };
    } catch (error) {
      logger.warn('Error optimizing gas, using fallback', error);
      return {
        gasLimit: estimatedGas,
        type: 0 // Legacy
      };
    }
  }

  /**
   * Update gas price history for analytics
   */
  _updateGasHistory(metrics) {
    this.gasHistory.unshift({
      timestamp: Date.now(),
      ...metrics
    });
    
    // Trim history
    if (this.gasHistory.length > this.maxHistorySize) {
      this.gasHistory = this.gasHistory.slice(0, this.maxHistorySize);
    }
  }

  /**
   * Get gas price statistics
   */
  getGasStats() {
    if (this.gasHistory.length === 0) return null;
    
    const fees = this.gasHistory.map(entry => parseFloat(entry.maxFeePerGas));
    const avgFee = fees.reduce((a, b) => a + b, 0) / fees.length;
    
    return {
      samples: this.gasHistory.length,
      avgMaxFeeGwei: avgFee.toFixed(2),
      currentFeeGwei: parseFloat(this.gasHistory[0].maxFeePerGas).toFixed(2),
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = GasOptimizer;
