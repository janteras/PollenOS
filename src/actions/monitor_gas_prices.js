const { ethers } = require('ethers');
require('dotenv').config();

/**
 * Gas Price Monitor for Base Sepolia
 * Tracks gas prices and provides recommendations for optimal transaction timing
 */
class GasPriceMonitor {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(
      process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'
    );
        
    this.maxGasPriceGwei = parseFloat(process.env.MAX_GAS_PRICE_GWEI || '20');
    this.priceHistory = [];
    this.maxHistoryLength = 100;
  }

  /**
     * Get current gas price information
     */
  async getCurrentGasPrice() {
    try {
      const feeData = await this.provider.getFeeData();
      const blockNumber = await this.provider.getBlockNumber();
            
      const gasPrice = feeData.gasPrice ? Number(ethers.formatUnits(feeData.gasPrice, 'gwei')) : null;
      const maxFeePerGas = feeData.maxFeePerGas ? Number(ethers.formatUnits(feeData.maxFeePerGas, 'gwei')) : null;
      const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ? Number(ethers.formatUnits(feeData.maxPriorityFeePerGas, 'gwei')) : null;

      const gasPriceData = {
        timestamp: new Date().toISOString(),
        blockNumber,
        gasPrice,
        maxFeePerGas,
        maxPriorityFeePerGas,
        isEIP1559: feeData.maxFeePerGas !== null
      };

      // Add to history
      this.addToHistory(gasPriceData);

      return gasPriceData;
    } catch (error) {
      throw new Error(`Failed to get gas price: ${error.message}`);
    }
  }

  /**
     * Add gas price data to history
     */
  addToHistory(gasPriceData) {
    this.priceHistory.push(gasPriceData);
        
    // Keep only recent history
    if (this.priceHistory.length > this.maxHistoryLength) {
      this.priceHistory.shift();
    }
  }

  /**
     * Calculate gas price statistics
     */
  calculateStatistics() {
    if (this.priceHistory.length === 0) {
      return null;
    }

    const prices = this.priceHistory
      .filter(data => data.gasPrice !== null)
      .map(data => data.gasPrice);

    if (prices.length === 0) {
      return null;
    }

    const sorted = [...prices].sort((a, b) => a - b);
        
    return {
      count: prices.length,
      min: Math.min(...prices),
      max: Math.max(...prices),
      average: prices.reduce((sum, price) => sum + price, 0) / prices.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p25: sorted[Math.floor(sorted.length * 0.25)],
      p75: sorted[Math.floor(sorted.length * 0.75)]
    };
  }

  /**
     * Get trading recommendation based on current gas prices
     */
  getGasRecommendation(currentGasPrice) {
    const stats = this.calculateStatistics();
        
    if (!stats || !currentGasPrice) {
      return {
        recommendation: 'insufficient_data',
        message: 'Not enough gas price data for recommendation',
        canTrade: false
      };
    }

    const recommendation = {
      currentPrice: currentGasPrice,
      maxAllowed: this.maxGasPriceGwei,
      statistics: stats
    };

    if (currentGasPrice > this.maxGasPriceGwei) {
      return {
        ...recommendation,
        recommendation: 'wait',
        message: `Gas price too high (${currentGasPrice.toFixed(2)} gwei > ${this.maxGasPriceGwei} gwei max)`,
        canTrade: false
      };
    }

    if (currentGasPrice <= stats.p25) {
      return {
        ...recommendation,
        recommendation: 'excellent',
        message: `Excellent gas price (${currentGasPrice.toFixed(2)} gwei, bottom 25%)`,
        canTrade: true
      };
    }

    if (currentGasPrice <= stats.median) {
      return {
        ...recommendation,
        recommendation: 'good',
        message: `Good gas price (${currentGasPrice.toFixed(2)} gwei, below median)`,
        canTrade: true
      };
    }

    if (currentGasPrice <= stats.p75) {
      return {
        ...recommendation,
        recommendation: 'acceptable',
        message: `Acceptable gas price (${currentGasPrice.toFixed(2)} gwei, below 75th percentile)`,
        canTrade: true
      };
    }

    return {
      ...recommendation,
      recommendation: 'high',
      message: `High gas price (${currentGasPrice.toFixed(2)} gwei, above 75th percentile)`,
      canTrade: true
    };
  }

  /**
     * Monitor gas prices over time
     */
  async monitorGasPrices(duration = 300000) { // 5 minutes default
    console.log(`🔍 Starting gas price monitoring for ${duration/1000} seconds...`);
        
    const startTime = Date.now();
    const samples = [];

    while (Date.now() - startTime < duration) {
      try {
        const gasData = await this.getCurrentGasPrice();
        samples.push(gasData);
                
        console.log(`Gas Price: ${gasData.gasPrice?.toFixed(2) || 'N/A'} gwei at block ${gasData.blockNumber}`);
                
        // Wait 30 seconds before next sample
        await new Promise(resolve => setTimeout(resolve, 30000));
      } catch (error) {
        console.error('Error sampling gas price:', error.message);
      }
    }

    return {
      monitoringDuration: duration,
      totalSamples: samples.length,
      samples,
      statistics: this.calculateStatistics()
    };
  }
}

/**
 * ElizaOS Action Handler for Gas Price Monitoring
 */
async function monitorGasPricesAction(runtime, message, state) {
  try {
    console.log('⛽ Starting gas price monitoring...');
        
    const monitor = new GasPriceMonitor();
    const currentGasPrice = await monitor.getCurrentGasPrice();
    const recommendation = monitor.getGasRecommendation(currentGasPrice.gasPrice);
        
    console.log(`Current gas price: ${currentGasPrice.gasPrice?.toFixed(2) || 'N/A'} gwei`);
    console.log(`Recommendation: ${recommendation.recommendation} - ${recommendation.message}`);
        
    // Store gas price data in memory
    if (runtime.messageManager) {
      await runtime.messageManager.createMemory({
        id: `gas-price-${Date.now()}`,
        content: {
          text: `Gas price monitoring: ${recommendation.message}`,
          source: 'gas_monitor',
          timestamp: new Date().toISOString(),
          metadata: {
            gasPrice: currentGasPrice,
            recommendation
          }
        }
      });
    }

    return {
      success: true,
      message: `⛽ Gas monitoring complete. ${recommendation.message}`,
      data: {
        gasPrice: currentGasPrice,
        recommendation,
        canTrade: recommendation.canTrade
      }
    };
        
  } catch (error) {
    console.error('Gas price monitoring error:', error);
    return {
      success: false,
      message: '❌ Gas price monitoring failed: ' + error.message,
      error: error.message
    };
  }
}

module.exports = {
  GasPriceMonitor,
  monitorGasPricesAction
}; 