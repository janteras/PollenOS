
/**
 * Market Conditions Detection Module
 * Analyzes overall market sentiment and conditions
 */
const logger = require('./logger');

/**
 * Detect current market condition based on key indicators
 * @param {Object} marketData Market data from various sources
 * @returns {string} Market condition: 'bull', 'bear', or 'sideways'
 */
function detectMarketCondition(marketData) {
  try {
    // Analyze key metrics
    const btcChange24h = marketData.BTC?.change24h || 0;
    const ethChange24h = marketData.ETH?.change24h || 0;
    const avaxChange24h = marketData.AVAX?.change24h || 0;
    
    const avgChange = (btcChange24h + ethChange24h + avaxChange24h) / 3;
    
    // Simple condition detection logic
    if (avgChange > 5) {
      return 'bull';
    } else if (avgChange < -5) {
      return 'bear';
    } else {
      return 'sideways';
    }
  } catch (error) {
    logger.warn('Error detecting market condition:', error.message);
    return 'sideways'; // Default to sideways on error
  }
}

/**
 * Get recommended trading approach based on market condition
 * @param {string} condition Market condition
 * @returns {Object} Trading recommendations
 */
function getMarketStrategy(condition) {
  const strategies = {
    bull: {
      riskTolerance: 'high',
      rebalanceFrequency: 'high',
      preferredCategories: ['GAMING_NFT', 'EMERGING', 'DEFI'],
      allocation: { growth: 60, stable: 20, defensive: 20 }
    },
    bear: {
      riskTolerance: 'low',
      rebalanceFrequency: 'low',
      preferredCategories: ['STABLECOINS', 'BLUE_CHIP'],
      allocation: { growth: 20, stable: 50, defensive: 30 }
    },
    sideways: {
      riskTolerance: 'medium',
      rebalanceFrequency: 'medium',
      preferredCategories: ['DEFI', 'LAYER1', 'INFRASTRUCTURE'],
      allocation: { growth: 40, stable: 30, defensive: 30 }
    }
  };
  
  return strategies[condition] || strategies.sideways;
}

module.exports = {
  detectMarketCondition,
  getMarketStrategy
};
