/**
 * Performance Tracker Module
 * Tracks trading performance, implements risk management, and provides analytics
 */
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

// Performance data storage directory
const PERFORMANCE_DIR = path.resolve(__dirname, '../../data/performance');

// Ensure performance directory exists
if (!fs.existsSync(PERFORMANCE_DIR)) {
  fs.mkdirSync(PERFORMANCE_DIR, { recursive: true });
  logger.debug(`Created performance directory at ${PERFORMANCE_DIR}`);
}

/**
 * Initialize performance tracking for a bot
 * @param {string} botId The bot ID
 * @param {string} strategy The trading strategy name
 * @returns {Object} Performance tracking instance
 */
function initializeTracker(botId, strategy = 'momentum') {
  // Ensure strategy matches the bot's actual configuration
  const botStrategies = {
    '1': 'momentum',
    '2': 'mean_reversion', 
    '3': 'technical_conservative',
    '4': 'breakout',
    '5': 'multi_timeframe'
  };

  const actualStrategy = botStrategies[botId] || strategy;
  const performanceFile = path.join(PERFORMANCE_DIR, `bot${botId}_performance.json`);
  let performanceData = {};

  // Load existing performance data if available
  if (fs.existsSync(performanceFile)) {
    try {
      performanceData = JSON.parse(fs.readFileSync(performanceFile, 'utf8'));
      logger.debug(`Loaded existing performance data for Bot ${botId}`);
    } catch (error) {
      logger.warn(`Failed to load performance data for Bot ${botId}: ${error.message}`);
      performanceData = createInitialPerformanceData(botId, strategy);
    }
  } else {
    performanceData = createInitialPerformanceData(botId, strategy);
    savePerformanceData(botId, performanceData);
  }

  return {
    botId,
    strategy,

    /**
     * Record a portfolio update
     * @param {Object} portfolioData Current portfolio data
     * @param {Array} transactions Recent transactions
     */
    recordUpdate: function(portfolioData, transactions = []) {
      const timestamp = Date.now();

      // Calculate current portfolio value
      const totalValue = calculatePortfolioValue(portfolioData);

      // Calculate daily change
      const previousValue = performanceData.portfolioHistory.length > 0 
        ? performanceData.portfolioHistory[performanceData.portfolioHistory.length - 1].value 
        : totalValue;

      const dailyChangePercent = previousValue > 0 
        ? ((totalValue - previousValue) / previousValue) * 100 
        : 0;

      // Update portfolio history
      performanceData.portfolioHistory.push({
        timestamp,
        value: totalValue,
        dailyChangePercent
      });

      // Trim history if too long (keep last 90 days)
      if (performanceData.portfolioHistory.length > 90) {
        performanceData.portfolioHistory = performanceData.portfolioHistory.slice(-90);
      }

      // Record transactions
      if (transactions && transactions.length > 0) {
        performanceData.transactions = [
          ...performanceData.transactions,
          ...transactions.map(tx => ({
            ...tx,
            timestamp
          }))
        ];

        // Keep only last 100 transactions
        if (performanceData.transactions.length > 100) {
          performanceData.transactions = performanceData.transactions.slice(-100);
        }
      }

      // Update overall statistics
      updatePerformanceStats(performanceData);

      // Save updated performance data
      savePerformanceData(botId, performanceData);

      return {
        currentValue: totalValue,
        dailyChangePercent,
        performanceData
      };
    },

    /**
     * Check if stop-loss should be triggered
     * @param {Object} portfolioData Current portfolio data
     * @param {Object} options Stop-loss options
     * @returns {Object} Stop-loss status
     */
    checkStopLoss: function(portfolioData, options = {}) {
      const {
        stopLossPercent = 5,  // Default 5% loss triggers stop-loss
        timeWindow = 24 * 60 * 60 * 1000  // Default 24-hour window
      } = options;

      // Get current portfolio value
      const currentValue = calculatePortfolioValue(portfolioData);

      // Find portfolio value from timeWindow ago
      const timeWindowAgo = Date.now() - timeWindow;
      let previousValue = null;

      // Find closest historical value to our timeWindow
      for (let i = performanceData.portfolioHistory.length - 1; i >= 0; i--) {
        const historyItem = performanceData.portfolioHistory[i];
        if (historyItem.timestamp <= timeWindowAgo) {
          previousValue = historyItem.value;
          break;
        }
      }

      // If no previous value found, use initial value or current value
      if (previousValue === null) {
        previousValue = performanceData.initialValue || currentValue;
      }

      // Calculate loss percentage
      const changePercent = ((currentValue - previousValue) / previousValue) * 100;
      const stopLossTriggered = changePercent <= -stopLossPercent;

      if (stopLossTriggered) {
        logger.warn(`Stop-loss triggered for Bot ${botId}: ${changePercent.toFixed(2)}% loss detected (threshold: -${stopLossPercent}%)`);

        // Record stop-loss event
        if (!performanceData.stopLossEvents) {
          performanceData.stopLossEvents = [];
        }

        performanceData.stopLossEvents.push({
          timestamp: Date.now(),
          previousValue,
          currentValue,
          lossPercent: changePercent,
          timeWindowHours: timeWindow / (60 * 60 * 1000)
        });

        savePerformanceData(botId, performanceData);
      }

      return {
        triggered: stopLossTriggered,
        currentValue,
        previousValue,
        changePercent,
        timeWindowHours: timeWindow / (60 * 60 * 1000)
      };
    },

    /**
     * Generate performance report
     * @returns {Object} Performance report
     */
    generateReport: function() {
      // Calculate performance metrics
      const totalTrades = performanceData.transactions.length;
      const startValue = performanceData.initialValue;
      const currentValue = performanceData.portfolioHistory.length > 0
        ? performanceData.portfolioHistory[performanceData.portfolioHistory.length - 1].value
        : startValue;

      const totalReturn = startValue > 0
        ? ((currentValue - startValue) / startValue) * 100
        : 0;

      // Calculate win/loss ratio
      let winningTrades = 0;
      let losingTrades = 0;

      performanceData.transactions.forEach(tx => {
        if (tx.profitLoss > 0) winningTrades++;
        else if (tx.profitLoss < 0) losingTrades++;
      });

      const winLossRatio = losingTrades > 0
        ? winningTrades / losingTrades
        : winningTrades > 0 ? winningTrades : 0;

      return {
        botId: this.botId,
        strategy: this.strategy,
        startDate: performanceData.startDate,
        daysActive: Math.floor((Date.now() - performanceData.startDate) / (24 * 60 * 60 * 1000)),
        initialValue: startValue,
        currentValue,
        totalReturn,
        totalTrades,
        winningTrades,
        losingTrades,
        winLossRatio,
        stopLossEvents: performanceData.stopLossEvents || [],
        riskLevel: performanceData.riskLevel,
        dailyReturns: calculateDailyReturns(performanceData.portfolioHistory)
      };
    },

    /**
     * Update strategy risk level
     * @param {string} riskLevel New risk level
     */
    updateRiskLevel: function(riskLevel) {
      performanceData.riskLevel = riskLevel;
      savePerformanceData(botId, performanceData);
      logger.info(`Updated risk level for Bot ${botId} to ${riskLevel}`);
    },

    /**
     * Reset performance tracking
     */
    reset: function() {
      // Archive current performance data
      const archiveDir = path.join(PERFORMANCE_DIR, 'archive');
      if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
      }

      const archiveFile = path.join(
        archiveDir, 
        `bot${botId}_performance_${new Date().toISOString().replace(/:/g, '-')}.json`
      );

      fs.writeFileSync(archiveFile, JSON.stringify(performanceData, null, 2));

      // Create new performance data
      performanceData = createInitialPerformanceData(botId, strategy);
      savePerformanceData(botId, performanceData);

      logger.info(`Reset performance tracking for Bot ${botId}`);
    }
  };
}

/**
 * Create initial performance data structure
 * @param {string} botId Bot ID
 * @param {string} strategy Strategy name
 * @returns {Object} Initial performance data
 */
function createInitialPerformanceData(botId, strategy) {
  return {
    botId,
    strategy,
    startDate: Date.now(),
    initialValue: 0,
    portfolioHistory: [],
    transactions: [],
    riskLevel: 'moderate',
    overallStats: {
      totalReturn: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      volatility: 0
    }
  };
}

/**
 * Calculate total portfolio value
 * @param {Object} portfolioData Portfolio data
 * @returns {number} Total portfolio value
 */
function calculatePortfolioValue(portfolioData) {
  if (!portfolioData || !portfolioData.assets) {
    return 0;
  }

  return Object.values(portfolioData.assets).reduce((total, asset) => {
    return total + (asset.value || 0);
  }, 0);
}

/**
 * Update performance statistics
 * @param {Object} performanceData Performance data object to update
 */
function updatePerformanceStats(performanceData) {
  const history = performanceData.portfolioHistory;

  if (history.length < 2) {
    return;
  }

  // Set initial value if not set
  if (performanceData.initialValue === 0 && history.length > 0) {
    performanceData.initialValue = history[0].value;
  }

  // Calculate total return
  const startValue = performanceData.initialValue;
  const currentValue = history[history.length - 1].value;

  performanceData.overallStats.totalReturn = startValue > 0
    ? ((currentValue - startValue) / startValue) * 100
    : 0;

  // Calculate maximum drawdown
  let maxValue = startValue;
  let maxDrawdown = 0;

  for (const item of history) {
    if (item.value > maxValue) {
      maxValue = item.value;
    } else {
      const drawdown = ((maxValue - item.value) / maxValue) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
  }

  performanceData.overallStats.maxDrawdown = maxDrawdown;

  // Calculate volatility (standard deviation of daily returns)
  const dailyReturns = calculateDailyReturns(history);

  if (dailyReturns.length > 0) {
    const mean = dailyReturns.reduce((sum, val) => sum + val, 0) / dailyReturns.length;
    const squaredDiffs = dailyReturns.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / squaredDiffs.length;
    performanceData.overallStats.volatility = Math.sqrt(variance);

    // Calculate Sharpe Ratio (assuming risk-free rate of 0%)
    const annualizedReturn = mean * 365;
    const annualizedVolatility = Math.sqrt(365) * performanceData.overallStats.volatility;

    performanceData.overallStats.sharpeRatio = annualizedVolatility > 0
      ? annualizedReturn / annualizedVolatility
      : 0;
  }
}

/**
 * Calculate daily returns from portfolio history
 * @param {Array} history Portfolio history
 * @returns {Array} Daily returns as percentages
 */
function calculateDailyReturns(history) {
  const returns = [];

  for (let i = 1; i < history.length; i++) {
    const previousValue = history[i - 1].value;
    const currentValue = history[i].value;

    if (previousValue > 0) {
      const dailyReturn = (currentValue - previousValue) / previousValue;
      returns.push(dailyReturn);
    }
  }

  return returns;
}

/**
 * Save performance data to disk
 * @param {string} botId Bot ID
 * @param {Object} performanceData Performance data to save
 */
function savePerformanceData(botId, performanceData) {
  const performanceFile = path.join(PERFORMANCE_DIR, `bot${botId}_performance.json`);

  try {
    fs.writeFileSync(performanceFile, JSON.stringify(performanceData, null, 2));
  } catch (error) {
    logger.error(`Failed to save performance data for Bot ${botId}: ${error.message}`);
  }
}

module.exports = {
  initializeTracker
};