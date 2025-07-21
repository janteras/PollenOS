/**
 * Trade Execution Action for ElizaOS
 * Executes trades on the Pollen platform based on analysis and user input
 */

const PollenAPI = require('../modules/pollen-api');
const EnhancedTradingEngine = require('../modules/enhanced-trading-engine');
const logger = require('../modules/logger');
const performanceTracker = require('../modules/performance-tracker');

const executeTradeAction = {
  name: 'EXECUTE_TRADE',
  description: 'Execute trades on the Pollen platform with risk management and validation',
  
  examples: [
    [
      {
        user: '{{user1}}',
        content: { text: 'Execute a trade to buy WBTC with 10% of my portfolio' }
      },
      {
        user: '{{agent}}',
        content: {
          text: 'I\'ll execute a trade to allocate 10% of your portfolio to WBTC. Let me validate the trade parameters and check risk limits before execution.',
          action: 'EXECUTE_TRADE'
        }
      }
    ],
    [
      {
        user: '{{user1}}',
        content: { text: 'Rebalance my portfolio based on current signals' }
      },
      {
        user: '{{agent}}',
        content: {
          text: 'I\'ll rebalance your portfolio based on the latest market analysis and trading signals. This will optimize your asset allocation according to your risk profile.',
          action: 'EXECUTE_TRADE'
        }
      }
    ]
  ],

  validate: async (runtime, message) => {
    const text = message.content.text.toLowerCase();
    const tradeKeywords = [
      'execute', 'trade', 'buy', 'sell', 'allocate', 'rebalance', 
      'portfolio', 'position', 'swap', 'invest'
    ];
    
    return tradeKeywords.some(keyword => text.includes(keyword));
  },

  handler: async (runtime, message, state, options, callback) => {
    try {
      logger.info('Executing trade action');
      
      // Initialize trading engine
      const config = {
        network: runtime.character.settings?.network || 'avalanche',
        strategy: runtime.character.settings?.strategy || 'momentum',
        riskLevel: runtime.character.settings?.riskLevel || 'moderate',
        maxAllocation: runtime.character.settings?.maxAllocation || 20,
        tradingThesis: runtime.character.settings?.thesis || 'Data-driven trading based on technical analysis'
      };

      const tradingEngine = new EnhancedTradingEngine(config);
      await tradingEngine.initialize();

      // Parse trade request from message
      const tradeRequest = parseTradeRequest(message.content.text);
      
      if (!tradeRequest.isValid) {
        return callback({
          text: `I couldn't understand your trade request. ${tradeRequest.error}. Please specify the asset and allocation clearly.`,
          source: 'execute_trade_action'
        });
      }

      // Validate trade against risk parameters
      const riskValidation = await validateTradeRisk(tradeRequest, config);
      
      if (!riskValidation.isValid) {
        return callback({
          text: `Trade validation failed: ${riskValidation.reason}. Please adjust your trade parameters.`,
          source: 'execute_trade_action'
        });
      }

      // Execute the trade
      const tradeResult = await executeTrade(tradingEngine, tradeRequest, config);
      
      if (tradeResult.success) {
        // Track performance
        await performanceTracker.recordTrade(config.botId, {
          ...tradeRequest,
          result: tradeResult,
          timestamp: new Date().toISOString()
        });

        return callback({
          text: formatTradeSuccessMessage(tradeResult),
          data: {
            trade: tradeResult,
            portfolioUpdate: tradeResult.portfolioUpdate,
            fees: tradeResult.fees,
            confirmation: tradeResult.transactionHash
          },
          source: 'execute_trade_action'
        });
      } else {
        return callback({
          text: `Trade execution failed: ${tradeResult.error}. Please try again or adjust your parameters.`,
          source: 'execute_trade_action'
        });
      }

    } catch (error) {
      logger.error('Error in trade execution action:', error);
      return callback({
        text: 'I encountered an error while executing the trade. Please check your configuration and try again.',
        source: 'execute_trade_action'
      });
    }
  }
};

/**
 * Parse trade request from user message
 */
function parseTradeRequest(message) {
  const text = message.toLowerCase();
  
  // Extract action type
  let action = 'buy'; // default
  if (text.includes('sell') || text.includes('exit')) {
    action = 'sell';
  } else if (text.includes('rebalance')) {
    action = 'rebalance';
  }
  
  // Extract asset
  const supportedAssets = [
    'wbtc', 'weth', 'wavax', 'usdt', 'aave', 'uni', 'sushi', 
    'comp', 'yfi', 'crv', 'mkr', 'cvx', 'snx', 'knc', 'fxs'
  ];
  
  let asset = null;
  for (const supportedAsset of supportedAssets) {
    if (text.includes(supportedAsset)) {
      asset = supportedAsset.toUpperCase();
      break;
    }
  }
  
  // Extract allocation percentage
  let allocation = null;
  const percentageMatch = text.match(/(\d+(?:\.\d+)?)%/);
  if (percentageMatch) {
    allocation = parseFloat(percentageMatch[1]);
  }
  
  // Extract amount
  let amount = null;
  const amountMatch = text.match(/\$?(\d+(?:\.\d+)?)\s*(usd|dollars?)?/);
  if (amountMatch) {
    amount = parseFloat(amountMatch[1]);
  }
  
  // Validation
  if (action === 'rebalance') {
    return {
      isValid: true,
      action: 'rebalance',
      asset: null,
      allocation: null,
      amount: null
    };
  }
  
  if (!asset) {
    return {
      isValid: false,
      error: 'Please specify which asset you want to trade (e.g., WBTC, WETH, WAVAX)'
    };
  }
  
  if (!allocation && !amount) {
    return {
      isValid: false,
      error: 'Please specify either a percentage allocation (e.g., 10%) or an amount (e.g., $100)'
    };
  }
  
  return {
    isValid: true,
    action,
    asset,
    allocation,
    amount
  };
}

/**
 * Validate trade against risk parameters
 */
async function validateTradeRisk(tradeRequest, config) {
  // Check maximum allocation limits
  if (tradeRequest.allocation && tradeRequest.allocation > config.maxAllocation) {
    return {
      isValid: false,
      reason: `Allocation of ${tradeRequest.allocation}% exceeds maximum allowed allocation of ${config.maxAllocation}%`
    };
  }
  
  // Check minimum allocation
  if (tradeRequest.allocation && tradeRequest.allocation < 1) {
    return {
      isValid: false,
      reason: 'Minimum allocation is 1%'
    };
  }
  
  // Check amount limits (example: minimum $10, maximum $10000)
  if (tradeRequest.amount) {
    if (tradeRequest.amount < 10) {
      return {
        isValid: false,
        reason: 'Minimum trade amount is $10'
      };
    }
    if (tradeRequest.amount > 10000) {
      return {
        isValid: false,
        reason: 'Maximum trade amount is $10,000'
      };
    }
  }
  
  return { isValid: true };
}

/**
 * Execute the trade
 */
async function executeTrade(tradingEngine, tradeRequest, config) {
  try {
    if (tradeRequest.action === 'rebalance') {
      return await executeRebalance(tradingEngine, config);
    } else {
      return await executeSingleTrade(tradingEngine, tradeRequest, config);
    }
  } catch (error) {
    logger.error('Trade execution error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Execute portfolio rebalancing
 */
async function executeRebalance(tradingEngine, config) {
  // Get current market data
  const tradingview = require('../modules/tradingview');
  const marketData = await tradingview.getMarketData(config);
  
  if (!marketData || marketData.length === 0) {
    throw new Error('Unable to fetch market data for rebalancing');
  }
  
  // Generate signals and allocation
  const signals = generateRebalanceSignals(marketData, config);
  const newAllocation = calculateOptimalAllocation(signals, config);
  
  // Execute rebalancing through trading engine
  const result = await tradingEngine.updateVirtualPortfolio(newAllocation);
  
  return {
    success: true,
    action: 'rebalance',
    newAllocation,
    signals,
    portfolioUpdate: result,
    transactionHash: result.transactionHash || 'SIMULATED',
    fees: result.fees || 0
  };
}

/**
 * Execute single asset trade
 */
async function executeSingleTrade(tradingEngine, tradeRequest, config) {
  const allocation = {};
  
  if (tradeRequest.action === 'buy') {
    allocation[tradeRequest.asset] = tradeRequest.allocation || calculateAllocationFromAmount(tradeRequest.amount);
  } else {
    // For sell, reduce allocation
    allocation[tradeRequest.asset] = -(tradeRequest.allocation || calculateAllocationFromAmount(tradeRequest.amount));
  }
  
  const result = await tradingEngine.updateVirtualPortfolio(allocation);
  
  return {
    success: true,
    action: tradeRequest.action,
    asset: tradeRequest.asset,
    allocation: allocation[tradeRequest.asset],
    portfolioUpdate: result,
    transactionHash: result.transactionHash || 'SIMULATED',
    fees: result.fees || 0
  };
}

/**
 * Generate signals for rebalancing
 */
function generateRebalanceSignals(marketData, config) {
  const signals = [];
  
  for (const data of marketData) {
    if (!data.asset) continue;
    
    let signal = { asset: data.asset, action: 'hold', confidence: 0.5 };
    
    // RSI-based signals
    if (data.RSI < 30) {
      signal.action = 'buy';
      signal.confidence = 0.8;
      signal.reason = 'RSI oversold';
    } else if (data.RSI > 70) {
      signal.action = 'sell';
      signal.confidence = 0.8;
      signal.reason = 'RSI overbought';
    }
    
    // Trend-based signals
    if (data.price > data.EMA20 && data.EMA20 > data.EMA50) {
      signal.action = signal.action === 'sell' ? 'hold' : 'buy';
      signal.confidence = Math.min(signal.confidence + 0.2, 1.0);
    } else if (data.price < data.EMA20 && data.EMA20 < data.EMA50) {
      signal.action = signal.action === 'buy' ? 'hold' : 'sell';
      signal.confidence = Math.min(signal.confidence + 0.2, 1.0);
    }
    
    signals.push(signal);
  }
  
  return signals;
}

/**
 * Calculate optimal allocation based on signals
 */
function calculateOptimalAllocation(signals, config) {
  const allocation = {};
  const maxAllocation = config.maxAllocation || 20;
  const riskMultiplier = getRiskMultiplier(config.riskLevel);
  
  // Sort signals by confidence
  const sortedSignals = signals
    .filter(s => s.action === 'buy' && s.confidence > 0.6)
    .sort((a, b) => b.confidence - a.confidence);
  
  let totalAllocation = 0;
  
  for (const signal of sortedSignals) {
    if (totalAllocation >= 80) break; // Max 80% allocation
    
    const assetAllocation = Math.min(
      maxAllocation * riskMultiplier * signal.confidence,
      maxAllocation
    );
    
    if (totalAllocation + assetAllocation <= 80) {
      allocation[signal.asset] = assetAllocation;
      totalAllocation += assetAllocation;
    }
  }
  
  return allocation;
}

/**
 * Get risk multiplier based on risk level
 */
function getRiskMultiplier(riskLevel) {
  switch (riskLevel) {
  case 'low': return 0.5;
  case 'moderate': return 0.8;
  case 'high': return 1.2;
  default: return 0.8;
  }
}

/**
 * Calculate allocation from dollar amount (placeholder)
 */
function calculateAllocationFromAmount(amount) {
  // This would require current portfolio value
  // For now, return a reasonable percentage
  if (amount <= 100) return 5;
  if (amount <= 500) return 10;
  if (amount <= 1000) return 15;
  return 20;
}

/**
 * Format trade success message
 */
function formatTradeSuccessMessage(tradeResult) {
  if (tradeResult.action === 'rebalance') {
    const allocations = Object.entries(tradeResult.newAllocation)
      .map(([asset, pct]) => `${asset}: ${pct.toFixed(1)}%`)
      .join(', ');
    
    return `✅ Portfolio rebalanced successfully!\nNew allocation: ${allocations}\nTransaction: ${tradeResult.transactionHash}`;
  } else {
    const action = tradeResult.action.toUpperCase();
    const asset = tradeResult.asset;
    const allocation = Math.abs(tradeResult.allocation).toFixed(1);
    
    return `✅ ${action} order executed successfully!\n${asset}: ${allocation}% allocation\nTransaction: ${tradeResult.transactionHash}`;
  }
}

module.exports = executeTradeAction; 