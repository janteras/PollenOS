/**
 * Mock data provider for Pollen Trading Bot testing
 * Generates realistic but simulated market data to avoid API rate limits
 */
const logger = require('./logger');

// Sample asset price ranges for testing
const PRICE_RANGES = {
  'BTC': { min: 45000, max: 65000 },
  'ETH': { min: 2000, max: 3500 },
  'AVAX': { min: 15, max: 40 },
  'SOL': { min: 40, max: 120 },
  'MATIC': { min: 0.5, max: 1.5 },
  'BNB': { min: 200, max: 400 },
  'LINK': { min: 5, max: 20 },
  'UNI': { min: 3, max: 10 },
  'AAVE': { min: 50, max: 150 },
  'SUSHI': { min: 0.5, max: 3 },
  'COMP': { min: 30, max: 100 }
};

// Cached mock data
let mockData = null;
let lastUpdate = 0;
const UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Get mock market data for testing
 * @returns {Object} Simulated market data
 */
function getMockMarketData() {
  const now = Date.now();
  
  // Generate new data if needed or use cached data
  if (!mockData || (now - lastUpdate) > UPDATE_INTERVAL) {
    logger.debug('Generating new mock market data');
    mockData = generateMockMarketData();
    lastUpdate = now;
  }
  
  return mockData;
}

/**
 * Generate simulated market data
 * @returns {Object} Simulated market data
 */
function generateMockMarketData() {
  const result = {
    timestamp: Date.now(),
    assets: {}
  };
  
  // Generate data for each asset
  Object.keys(PRICE_RANGES).forEach(asset => {
    const range = PRICE_RANGES[asset];
    
    // Generate price with some randomness but within range
    const basePrice = range.min + Math.random() * (range.max - range.min);
    const price = parseFloat(basePrice.toFixed(2));
    
    // Generate change with some trend bias (slightly positive)
    const change24h = parseFloat((Math.random() * 10 - 4).toFixed(2)); // -4% to +6%
    
    // Generate mock technical indicators based on price and change
    result.assets[asset] = generateMockIndicators(price, change24h);
  });
  
  return result;
}

/**
 * Generate mock technical indicators for an asset
 * @param {number} price Current price
 * @param {number} change24h 24-hour price change percentage
 * @returns {Object} Simulated technical indicators
 */
function generateMockIndicators(price, change24h) {
  // Create realistic indicator relationships
  const volatility = Math.abs(change24h) / 100;
  const trend = Math.sign(change24h);
  
  // Calculate RSI (higher for positive change, lower for negative)
  const rsi = 50 + trend * (Math.random() * 20 + 10);
  
  // EMAs with realistic relationships
  const ema20 = price * (1 - (trend * volatility * 0.02));
  const ema50 = price * (1 - (trend * volatility * 0.05));
  const ema200 = price * (1 - (trend * volatility * 0.1));
  
  // Bollinger bands
  const stdDev = price * volatility * 0.1;
  const bbUpper = price + (stdDev * 2);
  const bbLower = price - (stdDev * 2);
  
  // MACD (12,26,9)
  const ema12 = price * (1 - (trend * volatility * 0.01));
  const ema26 = price * (1 - (trend * volatility * 0.03));
  const macd = ema12 - ema26;
  const signal = macd * 0.9;
  const histogram = macd - signal;
  
  return {
    price,
    change24h,
    marketCap: price * 1000000 * (Math.random() * 10 + 1),
    volume: price * 10000 * (Math.random() * 5 + 1),
    RSI: rsi,
    EMA20: ema20,
    EMA50: ema50,
    EMA200: ema200,
    'BB.upper': bbUpper,
    'BB.lower': bbLower,
    MACD: macd,
    'MACD.signal': signal,
    'MACD.histogram': histogram
  };
}

module.exports = {
  getMockMarketData
};
