/**
 * Market Analysis Action for ElizaOS
 * Analyzes market conditions using TradingView data for trading decisions
 */

const tradingview = require('../modules/tradingview');
const logger = require('../modules/logger');
const cacheManager = require('../modules/cache-manager');

const analyzeMarketAction = {
  name: 'ANALYZE_MARKET',
  description: 'Analyze current market conditions using TradingView data to generate trading signals',
  
  examples: [
    [
      {
        user: '{{user1}}',
        content: { text: 'What\'s the current market situation?' }
      },
      {
        user: '{{agent}}',
        content: {
          text: 'I\'m analyzing the current market conditions using TradingView data. Let me check the technical indicators and market trends for the supported assets.',
          action: 'ANALYZE_MARKET'
        }
      }
    ],
    [
      {
        user: '{{user1}}',
        content: { text: 'Should I buy WBTC right now?' }
      },
      {
        user: '{{agent}}',
        content: {
          text: 'Let me analyze WBTC\'s current market conditions including RSI, MACD, and price trends to provide you with a data-driven recommendation.',
          action: 'ANALYZE_MARKET'
        }
      }
    ]
  ],

  validate: async (runtime, message) => {
    // Check if the message is asking for market analysis
    const text = message.content.text.toLowerCase();
    const marketKeywords = [
      'market', 'price', 'buy', 'sell', 'trade', 'analysis', 
      'rsi', 'macd', 'trend', 'technical', 'indicator', 'signal'
    ];
    
    return marketKeywords.some(keyword => text.includes(keyword));
  },

  handler: async (runtime, message, state, options, callback) => {
    try {
      logger.info('Executing market analysis action');
      
      // Extract specific asset if mentioned
      const text = message.content.text.toLowerCase();
      const supportedAssets = [
        'wbtc', 'weth', 'wavax', 'usdt', 'aave', 'uni', 'sushi', 
        'comp', 'yfi', 'crv', 'mkr', 'cvx', 'snx', 'knc', 'fxs'
      ];
      
      let targetAsset = null;
      for (const asset of supportedAssets) {
        if (text.includes(asset)) {
          targetAsset = asset.toUpperCase();
          break;
        }
      }

      // Get market data configuration from runtime
      const config = {
        network: runtime.character.settings?.network || 'avalanche',
        strategy: runtime.character.settings?.strategy || 'momentum',
        riskLevel: runtime.character.settings?.riskLevel || 'moderate'
      };

      // Fetch market data
      const marketData = await tradingview.getMarketData(config);
      
      if (!marketData || marketData.length === 0) {
        return callback({
          text: 'I\'m unable to fetch market data at the moment. Please try again later.',
          source: 'analyze_market_action'
        });
      }

      // Analyze specific asset or provide general market overview
      let analysis;
      if (targetAsset) {
        analysis = analyzeSpecificAsset(marketData, targetAsset);
      } else {
        analysis = analyzeGeneralMarket(marketData);
      }

      // Cache the analysis for future reference
      await cacheManager.set(`market_analysis_${Date.now()}`, analysis, 300); // 5 minutes

      return callback({
        text: analysis.summary,
        data: {
          marketData: analysis.data,
          signals: analysis.signals,
          timestamp: new Date().toISOString(),
          confidence: analysis.confidence
        },
        source: 'analyze_market_action'
      });

    } catch (error) {
      logger.error('Error in market analysis action:', error);
      return callback({
        text: 'I encountered an error while analyzing the market. Please try again.',
        source: 'analyze_market_action'
      });
    }
  }
};

/**
 * Analyze a specific asset
 */
function analyzeSpecificAsset(marketData, asset) {
  const assetData = marketData.find(data => 
    data.asset && data.asset.toUpperCase().includes(asset)
  );

  if (!assetData) {
    return {
      summary: `I couldn't find data for ${asset}. Please check if it's one of the supported assets.`,
      data: null,
      signals: [],
      confidence: 0
    };
  }

  const signals = generateTradingSignals(assetData);
  const trend = determineTrend(assetData);
  
  return {
    summary: `${asset} Analysis: ${formatAssetAnalysis(assetData, signals, trend)}`,
    data: assetData,
    signals: signals,
    confidence: calculateConfidence(assetData, signals)
  };
}

/**
 * Analyze general market conditions
 */
function analyzeGeneralMarket(marketData) {
  const totalAssets = marketData.length;
  const bullishCount = marketData.filter(data => determineTrend(data) === 'bullish').length;
  const bearishCount = marketData.filter(data => determineTrend(data) === 'bearish').length;
  
  const marketSentiment = bullishCount > bearishCount ? 'bullish' : 
    bearishCount > bullishCount ? 'bearish' : 'neutral';
  
  const topPerformers = marketData
    .filter(data => data.change24h > 0)
    .sort((a, b) => b.change24h - a.change24h)
    .slice(0, 3);
    
  const topDecliners = marketData
    .filter(data => data.change24h < 0)
    .sort((a, b) => a.change24h - b.change24h)
    .slice(0, 3);

  return {
    summary: formatMarketOverview(marketSentiment, totalAssets, bullishCount, bearishCount, topPerformers, topDecliners),
    data: { marketSentiment, totalAssets, bullishCount, bearishCount },
    signals: generateMarketSignals(marketData),
    confidence: calculateMarketConfidence(marketData)
  };
}

/**
 * Generate trading signals for an asset
 */
function generateTradingSignals(assetData) {
  const signals = [];
  
  // RSI signals
  if (assetData.RSI < 30) {
    signals.push({ type: 'buy', reason: 'RSI oversold', strength: 'strong' });
  } else if (assetData.RSI > 70) {
    signals.push({ type: 'sell', reason: 'RSI overbought', strength: 'strong' });
  }
  
  // MACD signals
  if (assetData.MACD > assetData['MACD.signal'] && assetData['MACD.histogram'] > 0) {
    signals.push({ type: 'buy', reason: 'MACD bullish crossover', strength: 'medium' });
  } else if (assetData.MACD < assetData['MACD.signal'] && assetData['MACD.histogram'] < 0) {
    signals.push({ type: 'sell', reason: 'MACD bearish crossover', strength: 'medium' });
  }
  
  // EMA trend signals
  if (assetData.price > assetData.EMA20 && assetData.EMA20 > assetData.EMA50) {
    signals.push({ type: 'buy', reason: 'Uptrend confirmed by EMAs', strength: 'medium' });
  } else if (assetData.price < assetData.EMA20 && assetData.EMA20 < assetData.EMA50) {
    signals.push({ type: 'sell', reason: 'Downtrend confirmed by EMAs', strength: 'medium' });
  }
  
  return signals;
}

/**
 * Determine overall trend for an asset
 */
function determineTrend(assetData) {
  const price = assetData.price;
  const ema20 = assetData.EMA20;
  const ema50 = assetData.EMA50;
  
  if (price > ema20 && ema20 > ema50 && assetData.change24h > 0) {
    return 'bullish';
  } else if (price < ema20 && ema20 < ema50 && assetData.change24h < 0) {
    return 'bearish';
  } else {
    return 'neutral';
  }
}

/**
 * Format asset analysis for human readable output
 */
function formatAssetAnalysis(assetData, signals, trend) {
  const price = assetData.price.toFixed(4);
  const change24h = assetData.change24h.toFixed(2);
  const rsi = assetData.RSI.toFixed(1);
  
  let analysis = `Current price: $${price} (${change24h > 0 ? '+' : ''}${change24h}% 24h)\n`;
  analysis += `RSI: ${rsi} | Trend: ${trend.toUpperCase()}\n`;
  
  if (signals.length > 0) {
    analysis += `Signals: ${signals.map(s => `${s.type.toUpperCase()} (${s.reason})`).join(', ')}`;
  } else {
    analysis += 'No clear signals at the moment - market is consolidating';
  }
  
  return analysis;
}

/**
 * Format market overview
 */
function formatMarketOverview(sentiment, total, bullish, bearish, performers, decliners) {
  let overview = `Market Sentiment: ${sentiment.toUpperCase()}\n`;
  overview += `${bullish}/${total} assets showing bullish signals, ${bearish}/${total} bearish\n\n`;
  
  if (performers.length > 0) {
    overview += `Top Performers: ${performers.map(p => `${p.asset} (+${p.change24h.toFixed(1)}%)`).join(', ')}\n`;
  }
  
  if (decliners.length > 0) {
    overview += `Top Decliners: ${decliners.map(d => `${d.asset} (${d.change24h.toFixed(1)}%)`).join(', ')}`;
  }
  
  return overview;
}

/**
 * Generate market-wide signals
 */
function generateMarketSignals(marketData) {
  // Implementation for market-wide signal generation
  const avgRSI = marketData.reduce((sum, data) => sum + data.RSI, 0) / marketData.length;
  const avgChange = marketData.reduce((sum, data) => sum + data.change24h, 0) / marketData.length;
  
  const signals = [];
  
  if (avgRSI < 35) {
    signals.push({ type: 'market_buy', reason: 'Market oversold', strength: 'medium' });
  } else if (avgRSI > 65) {
    signals.push({ type: 'market_sell', reason: 'Market overbought', strength: 'medium' });
  }
  
  return signals;
}

/**
 * Calculate confidence level for analysis
 */
function calculateConfidence(assetData, signals) {
  let confidence = 0.5; // Base confidence
  
  // Increase confidence based on signal strength and consistency
  const strongSignals = signals.filter(s => s.strength === 'strong').length;
  const mediumSignals = signals.filter(s => s.strength === 'medium').length;
  
  confidence += (strongSignals * 0.2) + (mediumSignals * 0.1);
  
  // Adjust based on volatility (lower volatility = higher confidence)
  const volatility = Math.abs(assetData.change24h) / 100;
  confidence -= volatility * 0.2;
  
  return Math.min(Math.max(confidence, 0), 1);
}

/**
 * Calculate market confidence
 */
function calculateMarketConfidence(marketData) {
  const consistency = calculateMarketConsistency(marketData);
  const avgVolatility = marketData.reduce((sum, data) => 
    sum + Math.abs(data.change24h), 0) / marketData.length / 100;
  
  return Math.max(0, Math.min(1, consistency - (avgVolatility * 0.5)));
}

/**
 * Calculate market consistency (how aligned the signals are)
 */
function calculateMarketConsistency(marketData) {
  const trends = marketData.map(data => determineTrend(data));
  const bullishCount = trends.filter(t => t === 'bullish').length;
  const bearishCount = trends.filter(t => t === 'bearish').length;
  const neutralCount = trends.filter(t => t === 'neutral').length;
  
  const maxCount = Math.max(bullishCount, bearishCount, neutralCount);
  return maxCount / trends.length;
}

module.exports = analyzeMarketAction; 