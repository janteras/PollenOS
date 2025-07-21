
const logger = require('./logger');

/**
 * Pollen Platform Asset Configuration
 * Manages all supported assets on the Pollen Platform across different networks
 */

// Core asset categories for strategic allocation
const ASSET_CATEGORIES = {
  BLUE_CHIP: ['WBTC.E', 'WETH.E', 'WAVAX'],
  STABLECOINS: ['USDT.E'],
  DEFI: ['AAVE.E', 'UNI.E', 'SUSHI.E', 'COMP.E', 'YFI.E', 'CRV.E', 'MKR.E', 'CVX', 'SNX', 'KNC', 'FXS', 'SPELL'],
  LAYER1: ['MATIC', 'DOT.E', 'FTM', 'NEAR', 'FIL'],
  AVALANCHE_ECOSYSTEM: ['JOE', 'XAVA', 'QI'],
  INFRASTRUCTURE: ['LINK.E', 'CHZ', 'BAT'],
  GAMING_NFT: ['APE', 'AXS', 'MANA'],
  EMERGING: ['ALPHA.E', 'CAKE', 'COQ', 'WOO']
};

// Risk levels for different asset categories
const CATEGORY_RISK_LEVELS = {
  BLUE_CHIP: 'low',
  STABLECOINS: 'very_low',
  DEFI: 'medium',
  LAYER1: 'medium',
  AVALANCHE_ECOSYSTEM: 'medium-high',
  INFRASTRUCTURE: 'medium',
  GAMING_NFT: 'high',
  EMERGING: 'very_high'
};

// Default allocation limits based on risk categories
const DEFAULT_ALLOCATION_LIMITS = {
  very_low: 40,   // Stablecoins
  low: 25,        // Blue chip
  medium: 15,     // DeFi, Layer1, Infrastructure
  'medium-high': 10, // Avalanche ecosystem
  high: 8,        // Gaming/NFT
  very_high: 5    // Emerging tokens
};

/**
 * Get all supported assets on Pollen Platform
 * @returns {Array} Array of supported asset symbols
 */
function getAllSupportedAssets() {
  return Object.values(ASSET_CATEGORIES).flat();
}

/**
 * Get assets by category
 * @param {string} category Asset category
 * @returns {Array} Array of asset symbols in the category
 */
function getAssetsByCategory(category) {
  return ASSET_CATEGORIES[category] || [];
}

/**
 * Get asset category for a given asset
 * @param {string} asset Asset symbol
 * @returns {string|null} Category name or null if not found
 */
function getAssetCategory(asset) {
  for (const [category, assets] of Object.entries(ASSET_CATEGORIES)) {
    if (assets.includes(asset)) {
      return category;
    }
  }
  return null;
}

/**
 * Get risk level for an asset
 * @param {string} asset Asset symbol
 * @returns {string} Risk level
 */
function getAssetRiskLevel(asset) {
  const category = getAssetCategory(asset);
  return category ? CATEGORY_RISK_LEVELS[category] : 'high';
}

/**
 * Get recommended allocation limit for an asset based on its risk level
 * @param {string} asset Asset symbol
 * @param {string} userRiskProfile User's risk profile (conservative, moderate, aggressive)
 * @returns {number} Maximum allocation percentage
 */
function getRecommendedAllocationLimit(asset, userRiskProfile = 'moderate') {
  const assetRiskLevel = getAssetRiskLevel(asset);
  let baseLimit = DEFAULT_ALLOCATION_LIMITS[assetRiskLevel] || 5;
  
  // Adjust based on user risk profile
  switch (userRiskProfile) {
  case 'conservative':
    baseLimit *= 0.7;
    break;
  case 'aggressive':
    baseLimit *= 1.3;
    break;
  case 'moderate':
  default:
    // No adjustment
    break;
  }
  
  return Math.round(baseLimit);
}

/**
 * Get diversified asset selection based on risk profile
 * @param {string} riskProfile User's risk profile
 * @param {number} maxAssets Maximum number of assets to include
 * @returns {Array} Recommended assets for portfolio
 */
function getRecommendedAssets(riskProfile = 'moderate', maxAssets = 10) {
  let recommendedAssets = [];
  
  // Always include core stable assets
  recommendedAssets.push(...ASSET_CATEGORIES.STABLECOINS.slice(0, 1));
  recommendedAssets.push(...ASSET_CATEGORIES.BLUE_CHIP.slice(0, 3));
  
  // Add assets based on risk profile
  switch (riskProfile) {
  case 'conservative':
    recommendedAssets.push(...ASSET_CATEGORIES.DEFI.slice(0, 2));
    recommendedAssets.push(...ASSET_CATEGORIES.INFRASTRUCTURE.slice(0, 1));
    break;
      
  case 'moderate':
    recommendedAssets.push(...ASSET_CATEGORIES.DEFI.slice(0, 3));
    recommendedAssets.push(...ASSET_CATEGORIES.LAYER1.slice(0, 2));
    recommendedAssets.push(...ASSET_CATEGORIES.AVALANCHE_ECOSYSTEM.slice(0, 1));
    break;
      
  case 'aggressive':
    recommendedAssets.push(...ASSET_CATEGORIES.DEFI.slice(0, 4));
    recommendedAssets.push(...ASSET_CATEGORIES.LAYER1.slice(0, 2));
    recommendedAssets.push(...ASSET_CATEGORIES.AVALANCHE_ECOSYSTEM.slice(0, 2));
    recommendedAssets.push(...ASSET_CATEGORIES.GAMING_NFT.slice(0, 1));
    recommendedAssets.push(...ASSET_CATEGORIES.EMERGING.slice(0, 1));
    break;
  }
  
  // Remove duplicates and limit to maxAssets
  recommendedAssets = [...new Set(recommendedAssets)].slice(0, maxAssets);
  
  logger.debug(`Recommended ${recommendedAssets.length} assets for ${riskProfile} risk profile`);
  return recommendedAssets;
}

/**
 * Validate if an asset is supported by Pollen Platform
 * @param {string} asset Asset symbol
 * @returns {boolean} True if supported
 */
function isAssetSupported(asset) {
  return getAllSupportedAssets().includes(asset);
}

/**
 * Get assets suitable for current market conditions
 * @param {string} marketCondition Current market condition ('bull', 'bear', 'sideways')
 * @param {string} riskProfile User's risk profile
 * @returns {Array} Optimized asset selection
 */
function getMarketOptimizedAssets(marketCondition = 'sideways', riskProfile = 'moderate') {
  let baseAssets = getRecommendedAssets(riskProfile, 15);
  
  switch (marketCondition) {
  case 'bull':
    // Add more growth-oriented assets in bull markets
    baseAssets = baseAssets.concat(ASSET_CATEGORIES.GAMING_NFT.slice(0, 2));
    baseAssets = baseAssets.concat(ASSET_CATEGORIES.EMERGING.slice(0, 1));
    break;
  case 'bear':
    // Focus on safer assets in bear markets
    baseAssets = ASSET_CATEGORIES.STABLECOINS
      .concat(ASSET_CATEGORIES.BLUE_CHIP)
      .concat(ASSET_CATEGORIES.INFRASTRUCTURE.slice(0, 1));
    break;
  case 'sideways':
  default:
    // Use balanced approach
    break;
  }
  
  return [...new Set(baseAssets)].slice(0, 12);
}

/**
 * Get asset metadata including risk level and recommended allocation
 * @param {string} asset Asset symbol
 * @param {string} userRiskProfile User's risk profile
 * @returns {Object} Asset metadata
 */
function getAssetMetadata(asset, userRiskProfile = 'moderate') {
  if (!isAssetSupported(asset)) {
    return null;
  }
  
  return {
    symbol: asset,
    category: getAssetCategory(asset),
    riskLevel: getAssetRiskLevel(asset),
    maxAllocation: getRecommendedAllocationLimit(asset, userRiskProfile),
    isSupported: true
  };
}

module.exports = {
  ASSET_CATEGORIES,
  CATEGORY_RISK_LEVELS,
  DEFAULT_ALLOCATION_LIMITS,
  getAllSupportedAssets,
  getAssetsByCategory,
  getAssetCategory,
  getAssetRiskLevel,
  getRecommendedAllocationLimit,
  getRecommendedAssets,
  isAssetSupported,
  getAssetMetadata
};
