const { SMA, RSI, MACD, ATR } = require('technicalindicators');

class TradingStrategies {
  constructor(logger) {
    this.logger = logger;
  }

  /**
   * Momentum Strategy
   * Identifies assets with strong upward/downward price momentum
   */
  momentumStrategy(priceData, period = 14) {
    const prices = priceData.map(d => d.close);
    const returns = [];
    
    // Calculate returns
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    
    // Calculate momentum score (weighted average of recent returns)
    let momentumScore = 0;
    const weights = [];
    const weightSum = (period * (period + 1)) / 2; // Triangular number
    
    for (let i = 0; i < Math.min(period, returns.length); i++) {
      const weight = (i + 1) / weightSum;
      momentumScore += returns[returns.length - 1 - i] * weight * 100; // Convert to percentage
    }
    
    // Generate signal
    if (momentumScore > 5) return { action: 'strong_buy', score: momentumScore };
    if (momentumScore > 1) return { action: 'buy', score: momentumScore };
    if (momentumScore < -5) return { action: 'strong_sell', score: momentumScore };
    if (momentumScore < -1) return { action: 'sell', score: momentumScore };
    return { action: 'hold', score: momentumScore };
  }

  /**
   * Mean Reversion Strategy
   * Identifies assets that have deviated from their mean price
   */
  meanReversionStrategy(priceData, period = 20) {
    const prices = priceData.map(d => d.close);
    if (prices.length < period) return { action: 'hold', score: 0 };
    
    // Calculate SMA and standard deviation
    const sma = SMA.calculate({
      period,
      values: prices
    });
    
    const currentPrice = prices[prices.length - 1];
    const currentSMA = sma[sma.length - 1];
    const stdDev = this.calculateStdDev(prices.slice(-period), currentSMA);
    
    // Calculate z-score
    const zScore = stdDev !== 0 ? (currentPrice - currentSMA) / stdDev : 0;
    
    // Generate signal
    if (zScore > 2) return { action: 'sell', score: zScore };
    if (zScore < -2) return { action: 'buy', score: zScore };
    return { action: 'hold', score: zScore };
  }

  /**
   * Trend Following Strategy
   * Uses moving averages to identify and follow trends
   */
  trendFollowingStrategy(priceData, fastPeriod = 10, slowPeriod = 30) {
    const prices = priceData.map(d => d.close);
    if (prices.length < slowPeriod) return { action: 'hold', trend: 'neutral' };
    
    // Calculate moving averages
    const fastMA = SMA.calculate({ period: fastPeriod, values: prices });
    const slowMA = SMA.calculate({ period: slowPeriod, values: prices });
    
    const currentFast = fastMA[fastMA.length - 1];
    const previousFast = fastMA[fastMA.length - 2] || currentFast;
    const currentSlow = slowMA[slowMA.length - 1];
    
    // Determine trend
    const trend = currentFast > currentSlow ? 'bullish' : 'bearish';
    const momentum = currentFast - previousFast > 0 ? 'increasing' : 'decreasing';
    
    // Generate signal
    if (trend === 'bullish' && momentum === 'increasing') {
      return { action: 'buy', trend: 'strong_bullish' };
    }
    if (trend === 'bearish' && momentum === 'decreasing') {
      return { action: 'sell', trend: 'strong_bearish' };
    }
    return { action: 'hold', trend };
  }

  /**
   * Volatility Strategy
   * Adjusts position sizes based on market volatility
   */
  volatilityStrategy(priceData, period = 14) {
    const highs = priceData.map(d => d.high);
    const lows = priceData.map(d => d.low);
    const closes = priceData.map(d => d.close);
    
    // Calculate Average True Range (ATR)
    const atr = ATR.calculate({
      high: highs,
      low: lows,
      close: closes,
      period
    });
    
    if (atr.length === 0) return { volatility: 0, positionSize: 1 };
    
    const currentATR = atr[atr.length - 1];
    const currentPrice = closes[closes.length - 1];
    const volatility = (currentATR / currentPrice) * 100; // As percentage
    
    // Adjust position size based on volatility (inverse relationship)
    const basePositionSize = 1; // 100% of normal position
    const positionSize = Math.min(1, Math.max(0.1, 1 - (volatility / 10)));
    
    return { volatility, positionSize };
  }

  /**
   * Risk Parity Strategy
   * Allocates based on risk contribution rather than capital
   */
  riskParityStrategy(assets, lookbackPeriod = 90) {
    // Calculate risk contributions
    const riskContributions = assets.map(asset => {
      const returns = this.calculateReturns(asset.prices);
      const volatility = this.calculateVolatility(returns);
      const correlation = this.calculateCorrelation(asset.prices, assets[0].prices); // Against first asset
      
      return {
        symbol: asset.symbol,
        volatility,
        correlation,
        riskContribution: volatility * (1 - Math.abs(correlation))
      };
    });
    
    // Normalize to sum to 1
    const totalRisk = riskContributions.reduce((sum, rc) => sum + rc.riskContribution, 0);
    return riskContributions.map(rc => ({
      symbol: rc.symbol,
      weight: rc.riskContribution / totalRisk
    }));
  }

  // ===== HELPER METHODS =====
  
  calculateStdDev(values, mean) {
    const squareDiffs = values.map(value => Math.pow(value - mean, 2));
    const avgSquareDiff = squareDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(avgSquareDiff);
  }
  
  calculateReturns(prices) {
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    return returns;
  }
  
  calculateVolatility(returns) {
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const squareDiffs = returns.map(r => Math.pow(r - mean, 2));
    return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / returns.length);
  }
  
  calculateCorrelation(prices1, prices2) {
    const minLength = Math.min(prices1.length, prices2.length);
    const returns1 = this.calculateReturns(prices1.slice(-minLength));
    const returns2 = this.calculateReturns(prices2.slice(-minLength));
    
    const mean1 = returns1.reduce((a, b) => a + b, 0) / returns1.length;
    const mean2 = returns2.reduce((a, b) => a + b, 0) / returns2.length;
    
    let covariance = 0;
    let variance1 = 0;
    let variance2 = 0;
    
    for (let i = 0; i < returns1.length; i++) {
      const diff1 = returns1[i] - mean1;
      const diff2 = returns2[i] - mean2;
      covariance += diff1 * diff2;
      variance1 += diff1 * diff1;
      variance2 += diff2 * diff2;
    }
    
    covariance /= returns1.length;
    const stdDev1 = Math.sqrt(variance1 / returns1.length);
    const stdDev2 = Math.sqrt(variance2 / returns2.length);
    
    return covariance / (stdDev1 * stdDev2);
  }
}

module.exports = TradingStrategies;
