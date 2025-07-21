/**
 * Strategy module for Pollen Trading Bot
 * Implements trading strategies based on market data
 */
const logger = require('./logger');

/**
 * Generate trading signals based on market data and technical indicators
 */
async function generateSignals(marketData, config) {
  try {
    logger.debug(`Generating trading signals for ${Object.keys(marketData.assets).length} assets`);

    const signals = {};
    const riskLevel = config.riskLevel || 'medium';

    // Import asset metadata for risk-based filtering
    const { getAssetMetadata } = require('./pollen-assets');

    // Process each asset in the market data
    for (const [asset, data] of Object.entries(marketData.assets)) {
      // Get asset metadata for risk-aware signal generation
      const assetMeta = getAssetMetadata(asset, config.riskProfile || 'moderate');

      let signal = {
        asset,
        strength: 0,        // -10 to 10 scale, negative = sell, positive = buy
        confidence: 0,      // 0 to 1 scale
        recommended_allocation: 0,
        riskLevel: assetMeta?.riskLevel || 'high',
        maxAllocation: assetMeta?.maxAllocation || 5
      };

      // Example strategy: RSI + Moving Average crossover
      if (data.RSI < 30) {
        // Oversold condition - bullish signal
        signal.strength += 5;
        signal.confidence = calculateConfidence(data.RSI, 30, 20);
      } else if (data.RSI > 70) {
        // Overbought condition - bearish signal
        signal.strength -= 5;
        signal.confidence = calculateConfidence(data.RSI, 70, 80);
      }

      // Check if price is above EMA200 (bullish)
      if (data.price > data.EMA200) {
        signal.strength += 2;
      } else {
        signal.strength -= 2;
      }

      // Check for EMA crossover (EMA20 crossing EMA50)
      if (data.EMA20 > data.EMA50 && data.price > data.EMA20) {
        // Bullish crossover
        signal.strength += 3;
      } else if (data.EMA20 < data.EMA50 && data.price < data.EMA20) {
        // Bearish crossover
        signal.strength -= 3;
      }

      // Adjust strength based on 24-hour price change
      if (data.change24h > 5) {
        // Strong upward momentum
        signal.strength += 1;
      } else if (data.change24h < -5) {
        // Strong downward momentum
        signal.strength -= 1;
      }

      // Apply risk adjustment based on configured risk level
      signal.strength = adjustForRisk(signal.strength, riskLevel);

      // Calculate recommended allocation based on signal strength
      signal.recommended_allocation = calculateAllocation(signal.strength, signal.confidence, config.maxAllocationPercent);

      signals[asset] = signal;
    }

    logger.debug(`Generated signals for ${Object.keys(signals).length} assets`);
    return signals;
  } catch (error) {
    logger.error('Error generating trading signals:', error);
    throw error;
  }
}

/**
 * Determine portfolio allocation based on generated signals
 */
async function determineAllocation(signals, currentPortfolio, config) {
  try {
    logger.debug('Determining portfolio allocation based on signals');

    // Sort assets by signal strength (highest to lowest)
    const sortedAssets = Object.entries(signals)
      .sort(([, a], [, b]) => b.strength - a.strength);

    // Initialize allocation
    let allocation = {};
    let remainingAllocation = 100; // Total percentage to allocate

    // First pass: Allocate to assets with positive signals based on strength
    for (const [asset, signal] of sortedAssets) {
      if (signal.strength > 0 && remainingAllocation > 0) {
        // Calculate allocation for this asset
        const assetAllocation = Math.min(
          signal.recommended_allocation,
          config.maxAllocationPercent,
          remainingAllocation
        );

        allocation[asset] = assetAllocation;
        remainingAllocation -= assetAllocation;
      } else if (signal.strength <= 0) {
        // For negative or neutral signals, set allocation to 0
        allocation[asset] = 0;
      }
    }

    // Second pass: If we have remaining allocation, distribute proportionally
    if (remainingAllocation > 0 && Object.keys(allocation).filter(asset => allocation[asset] > 0).length > 0) {
      // Get assets with positive allocation
      const positiveAssets = Object.keys(allocation).filter(asset => allocation[asset] > 0);

      // Distribute remaining allocation proportionally
      const distributionPerAsset = remainingAllocation / positiveAssets.length;

      for (const asset of positiveAssets) {
        allocation[asset] += distributionPerAsset;
      }

      remainingAllocation = 0;
    }

    // If we still have remaining allocation (all signals were negative), put in stable asset
    if (remainingAllocation > 0) {
      // Default to a stable asset if everything has negative signals
      const stableAsset = 'USDC';
      allocation[stableAsset] = remainingAllocation;
    }

    // Round allocations to nearest 0.1%
    for (const asset in allocation) {
      allocation[asset] = Math.round(allocation[asset] * 10) / 10;
    }

    // Ensure total allocation is exactly 100%
    const totalAllocation = Object.values(allocation).reduce((sum, value) => sum + value, 0);
    if (totalAllocation !== 100) {
      // Adjust the highest allocation to make the total exactly 100%
      const highestAsset = Object.entries(allocation)
        .sort(([, a], [, b]) => b - a)[0][0];

      allocation[highestAsset] += (100 - totalAllocation);
    }

    logger.debug(`Determined allocation for ${Object.keys(allocation).length} assets`);
    return allocation;
  } catch (error) {
    logger.error('Error determining portfolio allocation:', error);
    throw error;
  }
}

/**
 * Determine if portfolio rebalancing is needed
 */
function shouldRebalance(currentPortfolio, newAllocation, threshold = 5) {
  try {
    logger.debug(`Checking if rebalance is needed (threshold: ${threshold}%)`);

    // If we don't have current portfolio data, rebalance is needed
    if (!currentPortfolio || !currentPortfolio.tokens) {
      logger.debug('No current portfolio data, rebalance needed');
      return true;
    }

    // Compare current and new allocations
    let maxDifference = 0;

    // For each asset in the new allocation, check the difference
    for (const [asset, allocation] of Object.entries(newAllocation)) {
      // Find the current allocation for this asset
      const currentIndex = currentPortfolio.tokens.findIndex(token => token === asset);
      const currentAllocation = currentIndex >= 0 ? currentPortfolio.allocations[currentIndex] : 0;

      // Calculate difference
      const difference = Math.abs(currentAllocation - allocation);
      maxDifference = Math.max(maxDifference, difference);

      if (difference >= threshold) {
        logger.debug(`Rebalance needed: ${asset} difference ${difference}% exceeds threshold`);
        return true;
      }
    }

    logger.debug(`Max allocation difference: ${maxDifference}%, threshold: ${threshold}%, no rebalance needed`);
    return false;
  } catch (error) {
    logger.error('Error checking if rebalance is needed:', error);
    // In case of error, default to not rebalancing
    return false;
  }
}

/**
 * Calculate confidence score based on RSI distance from boundaries
 */
function calculateConfidence(rsi, boundary, extreme) {
  // Calculate how close RSI is to extreme values
  const distance = Math.abs(rsi - boundary);
  const maxDistance = Math.abs(extreme - boundary);

  // Normalize to 0-1 range
  return Math.min(1, (maxDistance - distance) / maxDistance);
}

/**
 * Adjust signal strength based on risk level
 */
function adjustForRisk(strength, riskLevel) {
  switch (riskLevel.toLowerCase()) {
  case 'low':
    return strength * 0.7; // Reduce signal strength for lower risk
  case 'high':
    return strength * 1.3; // Increase signal strength for higher risk
  case 'medium':
  default:
    return strength; // No adjustment for medium risk
  }
}

/**
 * Calculate allocation percentage based on signal strength and confidence
 */
function calculateAllocation(strength, confidence, maxAllocation) {
  // Normalize strength to 0-1 scale
  const normalizedStrength = Math.max(0, (strength + 10) / 20);

  // Combine strength and confidence
  const score = normalizedStrength * confidence;

  // Calculate allocation (0 to maxAllocation)
  return Math.round(score * maxAllocation);
}



module.exports = {
  generateSignals,
  determineAllocation,
  shouldRebalance
};