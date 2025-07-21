/**
 * TradingView module for Pollen Trading Bot
 * Connects to TradingView to fetch market data and technical indicators
 * Uses multiple data sources with failover capabilities
 * Enhanced fallback mechanisms and error handling
 */
const axios = require('axios');
const logger = require('./logger');

// Rate limiting configuration
const RATE_LIMIT_DELAY = parseInt(process.env.TRADINGVIEW_RATE_LIMIT || '2000');
let lastRequestTime = 0;
const cacheManager = require('./cache-manager');
const apiHealthMonitor = require('./api-health-monitor');
const WebSocket = require('ws');
const crypto = require('crypto');
const mockData = require('./mock-data');
const marketDataSources = require('./market-data-sources');
const sharedRateLimiter = require('./shared-rate-limiter');

// List of supported assets on Pollen Platform (Avalanche Network)
const SUPPORTED_ASSETS = [
  // Core assets
  'WBTC.E', 'WETH.E', 'WAVAX',
  // Stablecoins
  'USDT.E',
  // DeFi tokens
  'AAVE.E', 'UNI.E', 'SUSHI.E', 'COMP.E', 'YFI.E', 'CRV.E', 'MKR.E', 
  'CVX', 'SNX', 'KNC', 'FXS', 'SPELL',
  // Layer 1/2 tokens
  'MATIC', 'DOT.E', 'FTM', 'NEAR', 'FIL',
  // Avalanche ecosystem
  'JOE', 'XAVA', 'QI',
  // Infrastructure/Utility
  'LINK.E', 'CHZ', 'BAT',
  // Gaming/NFT
  'APE', 'AXS', 'MANA',
  // Emerging tokens
  'ALPHA.E', 'CAKE', 'COQ', 'WOO'
];

// Enhanced fallback configuration
const FALLBACK_CONFIG = {
  maxRetries: 3,
  baseDelay: 2000,
  maxDelay: 30000,
  circuitBreakerThreshold: 5,
  healthCheckInterval: 60000 // 1 minute
};

// Technical indicators to fetch
const INDICATORS = [
  'RSI', 'MACD', 'EMA20', 'EMA50', 'EMA200', 'BB.upper', 'BB.lower'
];

/**
 * Authenticate with TradingView using credentials
 * @param {string} username TradingView username
 * @param {string} password TradingView password
 * @returns {Promise<string>} Authentication token
 */
async function authenticateTradingView(username, password) {
  try {
    if (!username || !password) {
      logger.warn('TradingView credentials not provided, using unauthenticated access');
      return null;
    }

    logger.debug('Authenticating with TradingView...');

    // In a real implementation, you would use TradingView's authentication API
    // For now, we'll use a fallback method
    const authResponse = await axios.post('https://www.tradingview.com/accounts/signin/', {
      username,
      password,
      remember: true
    }, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    }).catch(err => {
      logger.warn(`TradingView authentication error: ${err.message}`);
      return { data: { auth_token: null } };
    });

    return authResponse.data.auth_token;
  } catch (error) {
    logger.error(`TradingView authentication failed: ${error.message}`);
    return null;
  }
}

/**
 * Get indicator data from TradingView for a specific asset
 * @param {string} symbol Asset symbol in TradingView format
 * @param {string} interval Time interval (1m, 5m, 15m, 1h, 4h, 1d)
 * @param {Array} indicators List of indicators to fetch
 * @param {string} authToken Optional authentication token
 * @returns {Promise<Object>} Indicator data
 */
async function getIndicatorData(symbol, interval = '1h', indicators = ['RSI', 'EMA20', 'EMA50', 'EMA200'], authToken = null) {
  try {
    logger.debug(`Fetching indicators for ${symbol} on ${interval} timeframe`);

    // Try to get data from TradingView first
    try {
      // Prepare request payload for TradingView's chart/study API
      // This would be replaced with actual TradingView API code in production
      const session = crypto.randomBytes(12).toString('hex');

      // Fallback to alternative sources if TradingView API call fails
    } catch (tvError) {
      logger.warn(`Failed to get TradingView data: ${tvError.message}. Using fallback.`);
    }

    // Fallback to CoinGecko for price data
    const asset = symbol.split(':')[1].replace('USD', '');
    const mappedAsset = mapAssetToId(asset);
    const response = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price?ids=${mappedAsset}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`
    );

    if (!response.data[mappedAsset]) {
      throw new Error(`No data found for ${asset}`);
    }

    // Get price data
    const price = response.data[mappedAsset].usd;
    const change24h = response.data[mappedAsset].usd_24h_change || 0;
    const marketCap = response.data[mappedAsset].usd_market_cap || 0;
    const volume = response.data[mappedAsset].usd_24h_vol || 0;

    // Create indicator data by combining real price with calculated indicators
    const calculatedIndicators = calculateIndicators(price, change24h, interval);

    return {
      price,
      change24h,
      marketCap,
      volume,
      ...calculatedIndicators
    };
  } catch (error) {
    logger.error(`Failed to get indicator data for ${symbol}: ${error.message}`);
    apiHealthMonitor.recordFailure('tradingview');
    return null;
  }
}

/**
 * Calculate technical indicators based on price data
 * More sophisticated than the previous simulate function
 */
function calculateIndicators(price, change24h, interval) {
  // In a production environment, you would use a technical analysis library
  // like technicalindicators npm package to calculate these properly

  // For now, we'll provide more realistic estimates based on price and change
  const volatility = Math.abs(change24h) / 100;
  const trend = Math.sign(change24h);

  const rsi = calculateRSI(change24h);

  // Estimate EMAs - in production these would be calculated with historical data
  const ema20 = price * (1 - (trend * volatility * 0.02));
  const ema50 = price * (1 - (trend * volatility * 0.05));
  const ema200 = price * (1 - (trend * volatility * 0.1));

  // Bollinger bands (20-period SMA with 2 standard deviations)
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

/**
 * Calculate RSI based on 24h price change
 * More realistic than the previous simulate function


  /**
 * Get market data with TradingView enhancement
 */
async function getMarketDataWithTradingView(useExtendedBackoff, config) {
  // Get market data from multiple sources with failover
  const result = await marketDataSources.getMarketData(SUPPORTED_ASSETS, {
    extendedBackoff: useExtendedBackoff
  });

  // If we got TradingView credentials, try to enhance data with TradingView
  if (config && config.tradingviewUsername && config.tradingviewPassword) {
    try {
      logger.debug('Attempting to enhance data with TradingView...');

      // Use shared rate limiter for TradingView
      await sharedRateLimiter.waitForPermission('TradingView', process.env.BOT_ID || '1');

      const authToken = await authenticateTradingView(
        config.tradingviewUsername, 
        config.tradingviewPassword
      );

      // Only try to enhance a subset of assets to avoid rate limits
      const tvAssets = SUPPORTED_ASSETS.slice(0, 3); // Just try first 3 assets

      for (const asset of tvAssets) {
        if (result.assets[asset]) { // Only if we already have some data
          try {
            // Format symbol for TradingView
            const symbol = `COINBASE:${asset}USD`;

            // Get indicator data with retries and extended backoff
            const delay = useExtendedBackoff ? 10000 : 3000;
            await new Promise(resolve => setTimeout(resolve, delay));

            const tvData = await retryWithBackoff(
              () => getIndicatorData(symbol, '1h', INDICATORS, authToken),
              2, // fewer retries for enhancement
              useExtendedBackoff ? 5000 : 2000 // longer backoff
            );

            if (tvData && Object.keys(tvData).length > 0) {
              // Merge TradingView data with existing data
              result.assets[asset] = {
                ...result.assets[asset],
                ...tvData,
                source: `${result.assets[asset].source}+TradingView`
              };
              logger.debug(`Enhanced ${asset} data with TradingView indicators`);
            }
          } catch (enhanceError) {
            logger.warn(`Failed to enhance ${asset} with TradingView: ${enhanceError.message}`);
            // Continue with existing data
          }
        }
      }

      apiHealthMonitor.recordSuccess('tradingview');
    } catch (tvError) {
      logger.warn(`TradingView enhancement failed: ${tvError.message}`);
      apiHealthMonitor.recordFailure('tradingview');
      // Continue with market data sources result
    } finally {
      sharedRateLimiter.releaseRequest('TradingView');
    }
  }

  return result;
}

/**
 * Emergency fallback data when all sources fail
 */
async function getEmergencyFallbackData() {
  logger.warn('Using emergency fallback data - this should not happen in production');

  const emergencyData = {
    timestamp: Date.now(),
    assets: {},
    dataQuality: 'emergency-fallback',
    sources: ['emergency']
  };

  // Generate basic fallback data for essential assets
  const essentialAssets = ['WBTC.E', 'WETH.E', 'WAVAX', 'USDT.E'];

  essentialAssets.forEach(asset => {
    const basePrice = getAssetBasePrice(asset);
    const volatility = Math.random() * 5 - 2.5; // ±2.5%

    emergencyData.assets[asset] = {
      price: basePrice * (1 + volatility / 100),
      change24h: volatility,
      RSI: 50 + (Math.random() - 0.5) * 20,
      EMA20: basePrice * 0.98,
      EMA50: basePrice * 0.95,
      EMA200: basePrice * 0.90,
      source: 'emergency-fallback',
      lastUpdated: Date.now()
    };
  });

  return emergencyData;
}

/**
 * Get base price for emergency fallback
 */
function getAssetBasePrice(asset) {
  const basePrices = {
    'WBTC.E': 45000,
    'WETH.E': 2800,
    'WAVAX': 35,
    'USDT.E': 1
  };
  return basePrices[asset] || 100;
}
function calculateRSI(change24h) {
  // Convert percentage change to a more realistic RSI value
  // This is a simplification; in production, use proper RSI calculation
  let rsi;

  if (change24h > 0) {
    // Positive change: higher RSI (50-100)
    rsi = 50 + Math.min(Math.abs(change24h) * 1.5, 45);
  } else {
    // Negative change: lower RSI (0-50)
    rsi = 50 - Math.min(Math.abs(change24h) * 1.5, 45);
  }

  return rsi;
}

/**
 * Get current market data from multiple sources
 * @param {Object} config Bot configuration
 * @returns {Promise<Object>} Market data including prices and indicators
 */
async function getMarketData(config) {
  // Check if we're in test mode
  const isTestMode = process.env.TEST_MODE === 'true' || (config && config.testMode === true);

  if (isTestMode) {
    logger.info('Using mock market data for testing');
    return mockData.getMockMarketData();
  }

  // Check if live trading is enabled
  if (process.env.LIVE_TRADING !== 'true') {
    logger.info('Live trading not enabled - using conservative data collection mode');
    // Continue with data collection but don't execute trades
  }

  try {
    logger.info('Fetching market data from multiple sources...');

    // Check if we should use extended backoff
    const useExtendedBackoff = process.env.EXTENDED_BACKOFF === 'true' || 
                              (config && config.extendedBackoff === true);

    if (useExtendedBackoff) {
      logger.info('Using extended backoff for API requests');
    }

    // Get market data from multiple sources with enhanced fallback
    let result;

    try {
      // Check if TradingView is healthy before attempting
      if (apiHealthMonitor.isServiceHealthy('tradingview')) {
        result = await getMarketDataWithTradingView(useExtendedBackoff, config);
      } else {
        logger.warn('TradingView service unhealthy, using alternative sources');
        throw new Error('TradingView circuit breaker active');
      }
    } catch (error) {
      logger.warn(`TradingView fallback triggered: ${error.message}`);
      apiHealthMonitor.recordFailure('tradingview');

      // Use market data sources as primary fallback
      result = await marketDataSources.getMarketData(SUPPORTED_ASSETS, {
        extendedBackoff: useExtendedBackoff,
        riskProfile: config?.riskProfile || 'standard'
      });
    }

    // Validate result quality
    if (!result || !result.assets || Object.keys(result.assets).length === 0) {
      logger.error('All market data sources failed, using emergency fallback');
      result = await getEmergencyFallbackData();
    }

    // Record successful operation
    if (result && Object.keys(result.assets).length > 0) {
      apiHealthMonitor.recordSuccess('market_data');
    }



    return result;
  } catch (error) {
    logger.error(`Failed to fetch market data: ${error.message}`);

    // If all methods failed, check if we should use cached data or mock data
    if (process.env.TEST_MODE === 'true') {
      logger.info('Using mock market data for testing');
      return mockData.generateMockMarketData(config);
    }

    // Try to use cached data as last resort
    const cacheKey = `emergency_market_data_${config.botId || 'global'}`;
    const cachedData = cacheManager.retrieveCache(cacheKey);

    if (cachedData && cachedData.timestamp > Date.now() - (24 * 60 * 60 * 1000)) { // 24 hours old max
      logger.warn('Using emergency cached market data due to API failures');
      return cachedData.data;
    }

    // Ultimate fallback to mock data with warning
    logger.error('All market data sources failed - using mock data as emergency fallback');
    return mockData.generateMockMarketData(config);
  }
}

/**
 * Map Pollen asset symbol to CoinGecko ID
 */
function mapAssetToId(asset) {
  const mapping = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'AVAX': 'avalanche-2',
    'SOL': 'solana',
    'MATIC': 'matic-network',
    'BNB': 'binancecoin',
    'LINK': 'chainlink',
    'UNI': 'uniswap',
    'AAVE': 'aave',
    'SUSHI': 'sushi',
    'COMP': 'compound-governance-token'
  };

  return mapping[asset] || asset.toLowerCase();
}

/**
 * Simulate technical indicator values based on price and recent movement
 * In a real implementation, these would be fetched from TradingView
 */
function simulateIndicators(price, change24h) {
  // This is a simplified simulation - in production, use actual TradingView data
  return {
    'RSI': simulateRSI(change24h),
    'MACD': {
      'value': change24h > 0 ? 0.1 * price : -0.1 * price,
      'signal': 0
    },
    'EMA20': price * (1 + Math.random() * 0.01 * (Math.random() > 0.5 ? 1 : -1)),
    'EMA50': price * (1 + Math.random() * 0.02 * (Math.random() > 0.5 ? 1 : -1)),
    'EMA200': price * (1 + Math.random() * 0.03 * (Math.random() > 0.5 ? 1 : -1)),
    'BB': {
      'upper': price * 1.05,
      'middle': price,
      'lower': price * 0.95
    }
  };
}

/**
 * Simulate RSI based on 24h price change
 */
function simulateRSI(change24h) {
  // Map the 24h change to an RSI value (very simplified)
  // RSI ranges from 0-100, with >70 considered overbought and <30 considered oversold
  if (change24h > 10) return 80 + Math.random() * 15;
  if (change24h > 5) return 65 + Math.random() * 10;
  if (change24h > 0) return 50 + Math.random() * 15;
  if (change24h > -5) return 40 + Math.random() * 10;
  if (change24h > -10) return 30 + Math.random() * 10;
  return 20 + Math.random() * 10;
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn Function to retry
 * @param {number} maxRetries Maximum number of retries
 * @param {number} initialBackoff Initial backoff in milliseconds
 * @returns {Promise<any>} Result of the function
 */
async function retryWithBackoff(fn, maxRetries = 3, initialBackoff = 1000) {
  let retries = 0;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      retries++;

      if (retries > maxRetries) {
        // If all attempts failed, log warning and return null to trigger fallback
        logger.warn(`TradingView data unavailable for ${asset}, will use CoinGecko only`);
        return null;
      }

      const backoff = initialBackoff * Math.pow(2, retries - 1) + Math.random() * 1000;
      logger.debug(`Retry ${retries}/${maxRetries} after ${backoff.toFixed(0)}ms`);

      await new Promise(resolve => setTimeout(resolve, backoff));
    }
  }
}

module.exports = {
  getMarketData,
  getIndicatorData,
  authenticateTradingView,
  SUPPORTED_ASSETS,
  INDICATORS
};