/**
 * Data Validator Module
 * Validates market data to protect against corrupted or anomalous data
 */
const logger = require('./logger');

/**
 * Validate if a value is a valid number within optional range
 * @param {any} value Value to validate
 * @param {string} fieldName Name of the field for error reporting
 * @param {number} min Minimum allowed value (optional)
 * @param {number} max Maximum allowed value (optional)
 * @returns {number} Validated number
 * @throws {Error} If validation fails
 */
function validateNumber(value, fieldName, min = null, max = null) {
  if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
    throw new Error(`Invalid ${fieldName}: must be a valid number, got ${typeof value}: ${value}`);
  }
  
  if (min !== null && value < min) {
    throw new Error(`Invalid ${fieldName}: ${value} is below minimum ${min}`);
  }
  
  if (max !== null && value > max) {
    throw new Error(`Invalid ${fieldName}: ${value} is above maximum ${max}`);
  }
  
  return value;
}

/**
 * Validate asset price data
 * @param {Object} priceData Price data to validate
 * @returns {Object} Validated and normalized data
 * @throws {Error} If data validation fails
 */
function validatePriceData(priceData) {
  if (!priceData) {
    throw new Error('Price data is null or undefined');
  }

  // Validate price is a positive number
  if (typeof priceData.price !== 'number' || isNaN(priceData.price) || priceData.price <= 0) {
    throw new Error(`Invalid price value: ${priceData.price}`);
  }

  // Validate change percentage is within reasonable range (-100% to +1000%)
  if (typeof priceData.change24h === 'number') {
    if (priceData.change24h < -100 || priceData.change24h > 1000) {
      logger.warn(`Suspicious change24h value detected: ${priceData.change24h}%, clamping to reasonable range`);
      priceData.change24h = Math.max(-100, Math.min(1000, priceData.change24h));
    }
  } else {
    // Set default if missing
    priceData.change24h = 0;
  }

  // Ensure all required fields exist
  const requiredFields = ['price', 'change24h', 'source'];
  const missingFields = requiredFields.filter(field => priceData[field] === undefined);

  if (missingFields.length > 0) {
    logger.warn(`Missing required fields in price data: ${missingFields.join(', ')}`);
    // Add missing fields with default values
    missingFields.forEach(field => {
      switch (field) {
      case 'source':
        priceData.source = 'unknown';
        break;
      case 'change24h':
        priceData.change24h = 0;
        break;
      default:
        // Cannot add default value for price
        if (field === 'price') {
          throw new Error('Price field is required but missing');
        }
      }
    });
  }

  return priceData;
}

/**
 * Validate technical indicators
 * @param {Object} indicators Technical indicators data
 * @returns {Object} Validated indicators
 */
function validateIndicators(indicators) {
  if (!indicators) {
    return {}; // Return empty object if no indicators
  }

  const validatedIndicators = {};
  const expectedIndicators = ['RSI', 'EMA20', 'EMA50', 'EMA200', 'BB.upper', 'BB.lower', 'MACD'];

  // Process each indicator
  for (const indicator in indicators) {
    const value = indicators[indicator];

    // Check if indicator is a valid number
    if (typeof value !== 'number' || isNaN(value)) {
      logger.warn(`Invalid indicator value for ${indicator}: ${value}`);
      continue;
    }

    // Validate specific indicators
    switch (indicator) {
    case 'RSI':
      // RSI should be between 0 and 100
      validatedIndicators[indicator] = Math.max(0, Math.min(100, value));
      break;

    case 'MACD':
    case 'MACD.signal':
    case 'MACD.histogram':
      // MACD can be any number, but we'll cap at reasonable limits
      validatedIndicators[indicator] = Math.max(-1000, Math.min(1000, value));
      break;

    default:
      // For other indicators, just ensure they're not extreme values
      if (Math.abs(value) > 1000000) {
        logger.warn(`Extreme value detected for ${indicator}: ${value}`);
        validatedIndicators[indicator] = value > 0 ? 1000000 : -1000000;
      } else {
        validatedIndicators[indicator] = value;
      }
    }
  }

  // Check for missing expected indicators
  const missingIndicators = expectedIndicators.filter(
    indicator => validatedIndicators[indicator] === undefined
  );

  if (missingIndicators.length > 0) {
    logger.debug(`Missing indicators: ${missingIndicators.join(', ')}`);
  }

  return validatedIndicators;
}

/**
 * Validate complete market data object
 * @param {Object} marketData Market data to validate
 * @returns {Object} Validated market data
 * @throws {Error} If market data is invalid
 */
function validateMarketData(marketData) {
  const validated = {
    timestamp: marketData.timestamp || Date.now(),
    assets: {}
  };

  for (const [asset, data] of Object.entries(marketData.assets || {})) {
    try {
      const cleanData = {
        source: data.source || 'unknown',
        price: validateNumber(data.price, `${asset} price`),
        change24h: validateNumber(data.change24h, `${asset} change24h`, -100, 1000),
        marketCap: validateNumber(data.marketCap, `${asset} marketCap`, 0),
        volume: validateNumber(data.volume, `${asset} volume`, 0)
      };

      // Apply reasonable limits to extreme values
      if (cleanData.marketCap > 10000000000000) { // 10T limit
        logger.debug(`Capping extreme market cap for ${asset}: ${cleanData.marketCap}`);
        cleanData.marketCap = Math.min(cleanData.marketCap, 10000000000000);
      }

      if (cleanData.volume > 1000000000000) { // 1T volume limit
        logger.debug(`Capping extreme volume for ${asset}: ${cleanData.volume}`);
        cleanData.volume = Math.min(cleanData.volume, 1000000000000);
      }

      // Add technical indicators if present
      if (data.RSI !== undefined) {
        cleanData.RSI = validateNumber(data.RSI, `${asset} RSI`, 0, 100);
      }

      validated.assets[asset] = cleanData;
    } catch (error) {
      logger.warn(`Skipping invalid data for ${asset}: ${error.message}`);
    }
  }

  return validated;
}

/**
 * Detect anomalies in market data
 * @param {Object} currentData Current market data
 * @param {Object} previousData Previous market data (if available)
 * @returns {Object} Anomaly report
 */
function detectAnomalies(currentData, previousData = null) {
  const anomalies = {
    detected: false,
    details: []
  };

  // Cannot detect anomalies without previous data
  if (!previousData) {
    return anomalies;
  }

  // Check for extreme price changes
  for (const assetSymbol in currentData.assets) {
    if (previousData.assets[assetSymbol]) {
      const currentPrice = currentData.assets[assetSymbol].price;
      const previousPrice = previousData.assets[assetSymbol].price;

      // Calculate price change percentage
      const priceChangePercent = ((currentPrice - previousPrice) / previousPrice) * 100;

      // Flag extreme changes (>20% in a short period)
      if (Math.abs(priceChangePercent) > 20) {
        anomalies.detected = true;
        anomalies.details.push({
          asset: assetSymbol,
          type: 'extreme_price_change',
          previous: previousPrice,
          current: currentPrice,
          changePercent: priceChangePercent
        });
      }
    }
  }

  return anomalies;
}

module.exports = {
  validatePriceData,
  validateIndicators,
  validateMarketData,
  detectAnomalies,
  validateNumber
};