/**
 * Helper functions for the Pollen Trading Bot
 */

/**
 * Sleep for a specified number of milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Generate a random number within a range
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @returns {number} Random number in range
 */
const randomInRange = (min, max) => {
  return Math.random() * (max - min) + min;
};

/**
 * Calculate exponential backoff delay
 * @param {number} attempt - Current attempt number
 * @param {number} baseDelay - Base delay in ms
 * @param {number} maxDelay - Maximum delay in ms
 * @returns {number} Calculated delay in ms
 */
const exponentialBackoff = (attempt, baseDelay = 1000, maxDelay = 30000) => {
  const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
  return delay + Math.random() * 1000; // Add jitter
};

/**
 * Format a number to a fixed number of decimal places
 * @param {number} value - Number to format
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted number string
 */
const toFixed = (value, decimals = 4) => {
  return parseFloat(value).toFixed(decimals);
};

/**
 * Parse a string or number to a BigNumber with the specified decimals
 * @param {string|number} value - Value to parse
 * @param {number} decimals - Number of decimal places
 * @returns {ethers.BigNumber} Parsed BigNumber
 */
const parseUnits = (value, decimals = 18) => {
  return ethers.utils.parseUnits(value.toString(), decimals);
};

/**
 * Format a BigNumber to a human-readable string
 * @param {ethers.BigNumber} value - Value to format
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted string
 */
const formatUnits = (value, decimals = 18) => {
  return ethers.utils.formatUnits(value, decimals);
};

/**
 * Validate an Ethereum address
 * @param {string} address - Address to validate
 * @returns {boolean} True if valid
 */
const isValidAddress = (address) => {
  return ethers.utils.isAddress(address);
};

/**
 * Calculate the percentage change between two values
 * @param {number} oldValue - Original value
 * @param {number} newValue - New value
 * @returns {number} Percentage change (0-1)
 */
const calculatePercentageChange = (oldValue, newValue) => {
  if (oldValue === 0) return 0;
  return (newValue - oldValue) / oldValue;
};

/**
 * Calculate portfolio weights based on market cap
 * @param {Array<{symbol: string, marketCap: number}>} assets - Array of assets with market caps
 * @returns {Object} Object mapping symbols to weights
 */
const calculateMarketCapWeights = (assets) => {
  const totalMarketCap = assets.reduce((sum, asset) => sum + asset.marketCap, 0);
  return assets.reduce((weights, asset) => {
    weights[asset.symbol] = asset.marketCap / totalMarketCap;
    return weights;
  }, {});
};

module.exports = {
  sleep,
  randomInRange,
  exponentialBackoff,
  toFixed,
  parseUnits,
  formatUnits,
  isValidAddress,
  calculatePercentageChange,
  calculateMarketCapWeights
};
