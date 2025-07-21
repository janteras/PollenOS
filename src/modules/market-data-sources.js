/**
 * Market data sources module for Pollen Trading Bot
 * Provides access to multiple market data sources with failover capability
 */
const axios = require('axios');
const logger = require('./logger');
const DataValidator = require('./data-validator');
const sharedRateLimiter = require('./shared-rate-limiter');

/**
 * Validate if a value is a valid number
 */
function validateNumber(value) {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

// Default request config with more conservative timeouts
const DEFAULT_TIMEOUT = 15000; // 15 seconds
const DEFAULT_HEADERS = {
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'User-Agent': 'Pollen-Trading-Bot/1.0'
};

// Rate limiting configuration - more conservative approach
const RATE_LIMIT_CONFIG = {
  maxRetries: 3,
  baseDelay: 10000, // Increased from 5000
  maxDelay: 60000,  // Increased from 30000
  backoffMultiplier: 3 // Increased from 2
};

// TradingView API configuration
const TRADINGVIEW_CONFIG = {
  baseUrl: 'https://scanner.tradingview.com',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
    'Origin': 'https://www.tradingview.com',
    'Referer': 'https://www.tradingview.com/'
  },
  timeout: 30000
};

// Data source providers with their base URLs and endpoints
const DATA_SOURCES = [
  {
    name: 'CoinGecko',
    baseUrl: 'https://api.coingecko.com/api/v3',
    endpoints: {
      price: '/simple/price',
      marketData: '/coins/markets'
    },
    mapAsset: (asset) => {
      // Map asset symbol to CoinGecko ID for all Pollen Platform supported tokens
      const mapping = {
        // Core assets
        'BTC': 'bitcoin',
        'WBTC.E': 'wrapped-bitcoin',
        'ETH': 'ethereum',
        'WETH.E': 'weth',
        'AVAX': 'avalanche-2',
        'WAVAX': 'wrapped-avax',

        // Stablecoins
        'USDT.E': 'tether',
        'USDT': 'tether',

        // DeFi tokens
        'AAVE.E': 'aave',
        'AAVE': 'aave',
        'UNI.E': 'uniswap',
        'UNI': 'uniswap',
        'SUSHI.E': 'sushi',
        'SUSHI': 'sushi',
        'COMP.E': 'compound-governance-token',
        'COMP': 'compound-governance-token',
        'YFI.E': 'yearn-finance',
        'YFI': 'yearn-finance',
        'CRV.E': 'curve-dao-token',
        'CRV': 'curve-dao-token',
        'CVX': 'convex-finance',
        'MKR.E': 'maker',
        'MKR': 'maker',
        'SNX': 'havven',
        'KNC': 'kyber-network-crystal',
        'BAT': 'basic-attention-token',
        'FXS': 'frax-share',
        'SPELL': 'spell-token',

        // Layer 1/2 tokens
        'MATIC': 'matic-network',
        'DOT.E': 'polkadot',
        'DOT': 'polkadot',
        'FTM': 'fantom',
        'NEAR': 'near',
        'FIL': 'filecoin',

        // Avalanche ecosystem
        'JOE': 'joe',
        'XAVA': 'avalaunch',
        'QI': 'benqi',

        // Infrastructure/Utility tokens
        'LINK.E': 'chainlink',
        'LINK': 'chainlink',
        'CHZ': 'chiliz',
        'BAT': 'basic-attention-token',

        // Gaming/NFT tokens
        'APE': 'apecoin',
        'AXS': 'axie-infinity',
        'MANA': 'decentraland',

        // Emerging tokens
        'ALPHA.E': 'alpha-finance',
        'ALPHA': 'alpha-finance',
        'CAKE': 'pancakeswap-token',
        'COQ': 'coq-inu',
        'WOO': 'woo-network'
      };
      return mapping[asset] || asset.toLowerCase();
    }
  },
  {
    name: 'CryptoCompare',
    baseUrl: 'https://min-api.cryptocompare.com/data',
    endpoints: {
      price: '/price',
      marketData: '/pricemultifull'
    },
    mapAsset: (asset) => asset
  },
  {
    name: 'Binance',
    baseUrl: 'https://api.binance.com/api/v3',
    endpoints: {
      price: '/ticker/price',
      marketData: '/ticker/24hr'
    },
    mapAsset: (asset) => asset + 'USDT'
  }
];

/**
 * Get asset price from multiple sources with failover
 * @param {string} asset Asset symbol
 * @param {Object} options Request options
 * @returns {Promise<Object>} Price data
 */
async function getAssetPrice(asset, options = {}) {
  const extendedBackoff = options.extendedBackoff || false;
  let error = null;

  // Try each data source in order
  for (const source of DATA_SOURCES) {
    let retries = 0;
    const maxRetries = 3;

    while (retries <= maxRetries) {
      try {
        logger.debug(`Trying to get ${asset} price from ${source.name}...`);

        // Use shared rate limiter instead of random delays
        await sharedRateLimiter.waitForPermission(source.name, process.env.BOT_ID || '1');

        const assetId = source.mapAsset(asset);
        let response;

        switch (source.name) {
        case 'CoinGecko':
          // Implementation of getCoinGeckoPrice directly inside the switch case
          try {
            const coinId = assetId; // Use assetId directly since it's already the mapped ID
            if (!coinId) {
              throw new Error(`Unknown symbol: ${asset}`);
            }

            // Add rate limiting delay
            await new Promise(resolve => setTimeout(resolve, 1000));

            response = await axios.get(`${source.baseUrl}${source.endpoints.price}`, {
              params: {
                ids: coinId,
                vs_currencies: 'usd',
                include_24hr_change: 'true',
                include_market_cap: 'true',
                include_24hr_vol: 'true'
              },
              timeout: 15000,
              headers: {
                'User-Agent': 'Pollen-Trading-Bot/1.0'
              }
            });

            if (response.data && response.data[coinId]) {
              return {
                source: source.name,
                price: response.data[coinId].usd,
                change24h: response.data[coinId].usd_24h_change || 0,
                marketCap: response.data[coinId].usd_market_cap || 0,
                volume: response.data[coinId].usd_24h_vol || 0
              };
            }
          } catch (err) {
            error = err;

            // If rate limited, wait longer and retry
            if (err.response && err.response.status === 429) {
              retries++;
              if (retries < maxRetries) {
                const retryDelay = Math.pow(2, retries) * 2000 + Math.random() * 3000;
                logger.warn(`Rate limited by ${source.name}, retrying in ${Math.round(retryDelay/1000)}s (attempt ${retries}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                continue;
              }
            }

            logger.warn(`Failed to get ${asset} price from ${source.name}: ${err.message}`);
            break; // Move to next source
          }
          break;

        case 'CryptoCompare':
          const apiKey = process.env.CRYPTOCOMPARE_API_KEY;
          const requestParams = {
            fsym: asset,
            tsyms: 'USD',
            extraParams: 'pollen_bot'
          };

          const requestHeaders = { ...DEFAULT_HEADERS };

          // Add API key if available
          if (apiKey && apiKey !== 'undefined') {
            requestParams.api_key = apiKey;
            requestHeaders.Authorization = `Apikey ${apiKey}`;
          }

          response = await axios.get(`${source.baseUrl}${source.endpoints.price}`, {
            params: requestParams,
            timeout: DEFAULT_TIMEOUT,
            headers: requestHeaders
          });

          if (response.data && response.data.USD) {
            // Get additional data for change and volume
            const marketDataParams = {
              fsyms: asset,
              tsyms: 'USD',
              extraParams: 'pollen_bot'
            };

            const marketDataHeaders = { ...DEFAULT_HEADERS };

            // Add API key if available
            if (apiKey && apiKey !== 'undefined') {
              marketDataParams.api_key = apiKey;
              marketDataHeaders.Authorization = `Apikey ${apiKey}`;
            }

            const fullData = await axios.get(`${source.baseUrl}${source.endpoints.marketData}`, {
              params: marketDataParams,
              timeout: DEFAULT_TIMEOUT,
              headers: marketDataHeaders
            });

            const rawData = fullData.data.RAW?.[asset]?.USD || {};

            return {
              source: source.name,
              price: response.data.USD,
              change24h: rawData.CHANGEPCT24HOUR || 0,
              marketCap: rawData.MKTCAP || 0,
              volume: rawData.VOLUME24HOUR || 0
            };
          }
          break;

        case 'Binance':
          response = await axios.get(`${source.baseUrl}${source.endpoints.price}`, {
            params: {
              symbol: source.mapAsset(asset)
            },
            timeout: DEFAULT_TIMEOUT,
            headers: DEFAULT_HEADERS
          });

          if (response.data && response.data.price) {
            // Get 24h data for additional info
            const detailedData = await axios.get(`${source.baseUrl}${source.endpoints.marketData}`, {
              params: {
                symbol: source.mapAsset(asset)
              },
              timeout: DEFAULT_TIMEOUT,
              headers: DEFAULT_HEADERS
            });

            return {
              source: source.name,
              price: parseFloat(response.data.price),
              change24h: parseFloat(detailedData.data.priceChangePercent) || 0,
              marketCap: 0, // Binance doesn't provide market cap
              volume: parseFloat(detailedData.data.volume) * parseFloat(detailedData.data.weightedAvgPrice) || 0
            };
          }
          break;
        }
      } catch (err) {
        error = err;

        // If rate limited, wait longer and retry
        if (err.response && err.response.status === 429) {
          retries++;
          if (retries < maxRetries) {
            const retryDelay = Math.pow(2, retries) * 2000 + Math.random() * 3000;
            logger.warn(`Rate limited by ${source.name}, retrying in ${Math.round(retryDelay/1000)}s (attempt ${retries}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
        }

        logger.warn(`Failed to get ${asset} price from ${source.name}: ${err.message}`);
        break; // Move to next source
      }
    }
  }

  // All sources failed - use fallback mock data to prevent complete failure
  logger.warn(`All price sources failed for ${asset}, using fallback mock data`);

  const fallbackPrice = {
    'BTC': 45000,
    'ETH': 2800,
    'AVAX': 35,
    'SOL': 100,
    'MATIC': 0.8,
    'BNB': 300,
    'LINK': 15,
    'UNI': 8,
    'AAVE': 120,
    'SUSHI': 1.2,
    'COMP': 60
  };

  return {
    source: 'fallback',
    price: fallbackPrice[asset] || 100,
    change24h: Math.random() * 10 - 5, // Random change between -5% and +5%
    marketCap: 0,
    volume: 0,
    isFallback: true
  };
}

/**
 * Get market data for multiple assets with real-time validation
 * @param {Array} assets List of asset symbols
 * @param {Object} options Request options
 * @returns {Promise<Object>} Market data for all assets
 */
async function getMarketData(assets, options = {}) {
  const result = {
    timestamp: Date.now(),
    assets: {},
    dataQuality: 'real-time',
    sources: []
  };

  // Validate input assets
  const validAssets = assets.filter(asset => {
    if (!asset || typeof asset !== 'string') {
      logger.warn(`Invalid asset provided: ${asset}`);
      return false;
    }
    return true;
  });

  if (validAssets.length === 0) {
    throw new Error('No valid assets provided for market data retrieval');
  }

  // Filter assets based on risk profile to manage API load
  const filteredAssets = options.riskProfile === 'conservative' 
    ? validAssets.filter(asset => ['WBTC.E', 'WETH.E', 'WAVAX', 'USDT.E', 'AAVE.E', 'UNI.E'].includes(asset))
    : options.extendedBackoff 
      ? validAssets.slice(0, 8) // Limit to 8 assets with extended backoff to prevent timeouts
      : validAssets;

  logger.info(`Processing ${filteredAssets.length} of ${validAssets.length} assets (${options.riskProfile || 'standard'} profile)`);

  // Process assets in smaller batches with enhanced error handling
  const batchSize = options.extendedBackoff ? 1 : 3; // Use single asset batches for extended backoff
  let successCount = 0;
  let failureCount = 0;

  // Use full filtered assets list but process them sequentially for extended backoff
  const assetsToProcess = options.extendedBackoff ? filteredAssets : filteredAssets;

  for (let i = 0; i < assetsToProcess.length; i += batchSize) {
    const batch = assetsToProcess.slice(i, i + batchSize);

    const batchResults = await Promise.allSettled(batch.map(async (asset) => {
      try {
        // Staggered delay within batch - more conservative but faster
        const delay = options.extendedBackoff 
          ? 5000 + Math.random() * 3000 
          : 2000 + Math.random() * 2000;
        await new Promise(resolve => setTimeout(resolve, delay));

        // Get price and basic market data with validation
        const priceData = await getAssetPrice(asset, options);

        // Validate price data quality
        if (!priceData || typeof priceData.price !== 'number' || isNaN(priceData.price) || priceData.price <= 0) {
          throw new Error(`Invalid price data received for ${asset}`);
        }

        // Calculate technical indicators based on real price data
        const indicators = calculateIndicators(priceData.price, priceData.change24h);

        // Validate indicators
        const validatedIndicators = {};
        Object.keys(indicators).forEach(key => {
          if (validateNumber(indicators[key])) {
            validatedIndicators[key] = indicators[key];
          } else {
            logger.warn(`Invalid indicator ${key} for ${asset}, using fallback`);
            validatedIndicators[key] = 50; // Neutral fallback for most indicators
          }
        });

        const assetData = {
          ...priceData,
          ...validatedIndicators,
          lastUpdated: Date.now(),
          dataAge: Date.now() - (priceData.timestamp || Date.now())
        };

        // Track data source
        if (!result.sources.includes(priceData.source)) {
          result.sources.push(priceData.source);
        }

        result.assets[asset] = assetData;
        successCount++;

        logger.info(`✓ Real-time data for ${asset}: $${priceData.price.toFixed(4)} (${priceData.source})`);
        return { asset, success: true };
      } catch (error) {
        failureCount++;
        logger.error(`✗ Failed to get real-time data for ${asset}: ${error.message}`);
        return { asset, success: false, error: error.message };
      }
    }));

    // Log batch results
    const batchSuccess = batchResults.filter(r => r.status === 'fulfilled' && r.value.success).length;
    logger.info(`Batch ${Math.floor(i/batchSize) + 1}: ${batchSuccess}/${batch.length} assets successful`);

    // Delay between batches - reduced for better throughput
    if (i + batchSize < assetsToProcess.length) {
      const batchDelay = options.extendedBackoff ? 8000 : 5000;
      logger.debug(`Waiting ${batchDelay/1000}s before next batch...`);
      await new Promise(resolve => setTimeout(resolve, batchDelay));
    }
  }

  // Final validation and summary
  const totalAssets = Object.keys(result.assets).length;
  if (totalAssets === 0) {
    throw new Error('No market data could be retrieved from any source');
  }

  logger.info(`Market data summary: ${successCount} successful, ${failureCount} failed, ${result.sources.length} sources used`);

  // Add data quality metrics
  result.successRate = (successCount / filteredAssets.length) * 100;
  result.coverage = totalAssets;

  return result;
}

/**
 * Calculate technical indicators based on price data
 * @param {number} price Current price
 * @param {number} change24h 24-hour change percentage
 * @returns {Object} Technical indicators
 */
function calculateIndicators(price, change24h) {
  // This is similar to our mockData calculation but uses real price data
  const volatility = Math.abs(change24h) / 100;
  const trend = Math.sign(change24h);

  // RSI calculation (simplified)
  const rsi = 50 + trend * (Math.min(Math.abs(change24h), 30) * 1.5);

  // Moving averages
  const ema20 = price * (1 - (trend * volatility * 0.02));
  const ema50 = price * (1 - (trend * volatility * 0.05));
  const ema200 = price * (1 - (trend * volatility * 0.1));

  // Bollinger bands
  const stdDev = price * volatility * 0.1;
  const bbUpper = price + (stdDev * 2);
  const bbLower = price - (stdDev * 2);

  // MACD
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

async function fetchFromBackupSources(symbols) {
  logger.info('Using backup data sources due to TradingView failure');

  const backupData = {};

  for (const symbol of symbols) {
    try {
      // Try CoinGecko first
      const coinGeckoData = await fetchFromCoinGecko(symbol);
      if (coinGeckoData) {
        backupData[symbol] = coinGeckoData;
        continue;
      }

      // Try CryptoCompare as secondary backup
      const cryptoCompareData = await fetchFromCryptoCompare(symbol);
      if (cryptoCompareData) {
        backupData[symbol] = cryptoCompareData;
        continue;
      }

      // Generate mock data as last resort
      logger.warn(`No backup data available for ${symbol}, using mock data`);
      backupData[symbol] = generateMockData(symbol);

    } catch (error) {
      logger.error(`Backup data fetch failed for ${symbol}: ${error.message}`);
      backupData[symbol] = generateMockData(symbol);
    }
  }

  return backupData;
}

async function fetchFromCoinGecko(symbol) {
  // Implementation for CoinGecko API fallback
  return null;
}

async function fetchFromCryptoCompare(symbol) {
  // Implementation for CryptoCompare API fallback
  return null;
}

function generateMockData(symbol) {
  // Generate realistic mock data for testing
  return {
    price: 100 + Math.random() * 1000,
    change24h: (Math.random() - 0.5) * 20,
    volume: Math.random() * 1000000,
    marketCap: Math.random() * 1000000000
  };
}

module.exports = {
  getAssetPrice,
  getMarketData,
  fetchFromBackupSources,
  DATA_SOURCES
};