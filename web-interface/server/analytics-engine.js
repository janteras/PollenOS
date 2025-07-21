const { performance } = require('perf_hooks');
const localStorage = require('./local-storage');
const { calculateRiskMetrics } = require('./risk-calculator');

class AnalyticsEngine {
  constructor() {
    this.metrics = {
      portfolio: {},
      performance: {},
      risk: {},
      market: {}
    };
    this.initializeMetrics();
  }

  initializeMetrics() {
    // Portfolio metrics
    this.metrics.portfolio = {
      totalValue: 0,
      assetAllocation: {},
      diversificationScore: 0,
      rebalanceNeeded: false
    };

    // Performance metrics
    this.metrics.performance = {
      totalReturn: 0,
      annualizedReturn: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      maxDrawdown: 0,
      winRate: 0,
      avgWin: 0,
      avgLoss: 0
    };

    // Risk metrics
    this.metrics.risk = {
      volatility: 0,
      beta: 0,
      valueAtRisk: 0,
      conditionalValueAtRisk: 0,
      positionRisk: {},
      portfolioRisk: 0
    };

    // Market metrics
    this.metrics.market = {
      correlationMatrix: {},
      marketImpact: 0,
      liquidityScore: 0,
      volatilityIndex: 0
    };
  }

  async calculatePortfolioMetrics(botId) {
    try {
      const trades = await localStorage.getTradeHistory(botId);
      const performance = await localStorage.getLatestPerformanceMetrics(botId);
      
      // Calculate portfolio value
      const portfolioValue = this.calculatePortfolioValue(trades);
      
      // Calculate asset allocation
      const allocation = this.calculateAssetAllocation(trades);
      
      // Calculate diversification score
      const diversification = this.calculateDiversification(allocation);
      
      // Check rebalancing needed
      const rebalance = this.checkRebalanceNeeded(allocation);
      
      return {
        portfolioValue,
        assetAllocation: allocation,
        diversificationScore: diversification,
        rebalanceNeeded: rebalance
      };
    } catch (error) {
      console.error('Error calculating portfolio metrics:', error);
      throw error;
    }
  }

  calculatePortfolioValue(trades) {
    const currentPrices = this.getCurrentPrices();
    return trades.reduce((sum, trade) => {
      const price = currentPrices[trade.symbol] || trade.price;
      return sum + trade.quantity * price;
    }, 0);
  }

  calculateAssetAllocation(trades) {
    const allocation = {};
    trades.forEach(trade => {
      allocation[trade.symbol] = (allocation[trade.symbol] || 0) + trade.quantity;
    });
    return allocation;
  }

  calculateDiversification(allocation) {
    const total = Object.values(allocation).reduce((sum, qty) => sum + qty, 0);
    const weights = Object.entries(allocation).map(([symbol, qty]) => qty / total);
    return weights.reduce((score, weight) => score + Math.pow(weight, 2), 0);
  }

  checkRebalanceNeeded(allocation) {
    const weights = Object.values(allocation);
    const total = weights.reduce((sum, qty) => sum + qty, 0);
    const deviations = weights.map(qty => Math.abs(qty / total - 0.2));
    return deviations.some(deviation => deviation > 0.1);
  }

  async calculatePerformanceMetrics(botId) {
    try {
      const trades = await localStorage.getTradeHistory(botId);
      const performance = await localStorage.getLatestPerformanceMetrics(botId);
      
      return {
        totalReturn: this.calculateTotalReturn(trades),
        annualizedReturn: this.calculateAnnualizedReturn(performance),
        sharpeRatio: this.calculateSharpeRatio(performance),
        sortinoRatio: this.calculateSortinoRatio(performance),
        maxDrawdown: this.calculateMaxDrawdown(trades),
        winRate: this.calculateWinRate(trades),
        avgWin: this.calculateAvgWin(trades),
        avgLoss: this.calculateAvgLoss(trades)
      };
    } catch (error) {
      console.error('Error calculating performance metrics:', error);
      throw error;
    }
  }

  calculateTotalReturn(trades) {
    const initial = trades[0]?.price || 1;
    const final = trades[trades.length - 1]?.price || 1;
    return (final - initial) / initial;
  }

  calculateAnnualizedReturn(performance) {
    const days = (Date.now() - performance.timestamp) / (1000 * 60 * 60 * 24);
    return Math.pow(1 + performance.dailyChangePercent, 365/days) - 1;
  }

  calculateSharpeRatio(performance) {
    const riskFreeRate = 0.02; // 2% annual
    return (performance.dailyChangePercent - riskFreeRate) / performance.volatility;
  }

  calculateSortinoRatio(performance) {
    const riskFreeRate = 0.02;
    return (performance.dailyChangePercent - riskFreeRate) / performance.downsideVolatility;
  }

  calculateMaxDrawdown(trades) {
    let peak = 0;
    let drawdown = 0;
    trades.forEach(trade => {
      peak = Math.max(peak, trade.price);
      drawdown = Math.max(drawdown, (peak - trade.price) / peak);
    });
    return drawdown;
  }

  calculateWinRate(trades) {
    const wins = trades.filter(t => t.side === 'buy' && t.price > t.entryPrice).length;
    return wins / trades.length;
  }

  calculateAvgWin(trades) {
    const wins = trades.filter(t => t.side === 'buy' && t.price > t.entryPrice);
    return wins.reduce((sum, t) => sum + (t.price - t.entryPrice), 0) / wins.length;
  }

  calculateAvgLoss(trades) {
    const losses = trades.filter(t => t.side === 'buy' && t.price < t.entryPrice);
    return losses.reduce((sum, t) => sum + (t.entryPrice - t.price), 0) / losses.length;
  }

  async calculateRiskMetrics(botId) {
    try {
      const trades = await localStorage.getTradeHistory(botId);
      const performance = await localStorage.getLatestPerformanceMetrics(botId);
      
      return calculateRiskMetrics({
        trades,
        performance,
        portfolioValue: this.calculatePortfolioValue(trades),
        marketData: this.getMarketData()
      });
    } catch (error) {
      console.error('Error calculating risk metrics:', error);
      throw error;
    }
  }

  async calculateMarketMetrics() {
    try {
      const marketData = this.getMarketData();
      return {
        correlationMatrix: this.calculateCorrelationMatrix(marketData),
        marketImpact: this.calculateMarketImpact(marketData),
        liquidityScore: this.calculateLiquidityScore(marketData),
        volatilityIndex: this.calculateVolatilityIndex(marketData)
      };
    } catch (error) {
      console.error('Error calculating market metrics:', error);
      throw error;
    }
  }

  calculateCorrelationMatrix(marketData) {
    const symbols = Object.keys(marketData);
    const matrix = {};
    symbols.forEach(symbol1 => {
      matrix[symbol1] = {};
      symbols.forEach(symbol2 => {
        matrix[symbol1][symbol2] = this.calculateCorrelation(
          marketData[symbol1].prices,
          marketData[symbol2].prices
        );
      });
    });
    return matrix;
  }

  calculateCorrelation(prices1, prices2) {
    const n = prices1.length;
    const mean1 = prices1.reduce((sum, p) => sum + p, 0) / n;
    const mean2 = prices2.reduce((sum, p) => sum + p, 0) / n;
    
    const numerator = prices1.reduce((sum, p1, i) => 
      sum + (p1 - mean1) * (prices2[i] - mean2), 0
    );
    
    const denominator = Math.sqrt(
      prices1.reduce((sum, p1) => sum + Math.pow(p1 - mean1, 2), 0) *
      prices2.reduce((sum, p2) => sum + Math.pow(p2 - mean2, 2), 0)
    );
    
    return numerator / denominator;
  }

  calculateMarketImpact(marketData) {
    const volume = marketData.reduce((sum, data) => sum + data.volume, 0);
    const priceImpact = marketData.reduce((sum, data) => sum + data.priceImpact, 0);
    return priceImpact / volume;
  }

  calculateLiquidityScore(marketData) {
    const totalVolume = marketData.reduce((sum, data) => sum + data.volume, 0);
    const totalOrders = marketData.reduce((sum, data) => sum + data.orderCount, 0);
    return totalVolume / totalOrders * 100;
  }

  calculateVolatilityIndex(marketData) {
    const priceChanges = marketData.map(data => 
      (data.currentPrice - data.previousPrice) / data.previousPrice
    );
    const mean = priceChanges.reduce((sum, change) => sum + change, 0) / priceChanges.length;
    const variance = priceChanges.reduce((sum, change) => 
      sum + Math.pow(change - mean, 2), 0
    ) / priceChanges.length;
    return Math.sqrt(variance) * 100;
  }

  getCurrentPrices() {
    // TODO: Implement real-time price fetching
    return {};
  }

  getMarketData() {
    // TODO: Implement market data fetching
    return {};
  }

  async optimizePortfolio(botId) {
    try {
      const portfolio = await this.calculatePortfolioMetrics(botId);
      const performance = await this.calculatePerformanceMetrics(botId);
      const risk = await this.calculateRiskMetrics(botId);
      
      return this.optimizeAllocation(
        portfolio.assetAllocation,
        performance.totalReturn,
        risk.volatility
      );
    } catch (error) {
      console.error('Error optimizing portfolio:', error);
      throw error;
    }
  }

  optimizeAllocation(currentAllocation, returnRate, volatility) {
    const targetVolatility = 0.15; // 15% target volatility
    const riskFreeRate = 0.02; // 2% annual
    
    const optimized = {};
    Object.entries(currentAllocation).forEach(([symbol, weight]) => {
      const optimalWeight = (returnRate - riskFreeRate) * weight / 
        (volatility * targetVolatility);
      optimized[symbol] = Math.max(0, Math.min(1, optimalWeight));
    });
    
    return optimized;
  }

  async predictMarketTrends() {
    try {
      const marketData = this.getMarketData();
      return this.analyzeTrends(marketData);
    } catch (error) {
      console.error('Error predicting market trends:', error);
      throw error;
    }
  }

  analyzeTrends(marketData) {
    const trends = {};
    Object.entries(marketData).forEach(([symbol, data]) => {
      const priceChanges = data.prices.map((p, i, arr) => 
        i === 0 ? 0 : (p - arr[i-1]) / arr[i-1]
      );
      
      const movingAverage = priceChanges.slice(-20).reduce((sum, change) => 
        sum + change, 0
      ) / 20;
      
      trends[symbol] = {
        trend: movingAverage > 0 ? 'up' : 'down',
        strength: Math.abs(movingAverage) * 100,
        volatility: this.calculateVolatility(data.prices)
      };
    });
    return trends;
  }

  calculateVolatility(prices) {
    const dailyReturns = prices.map((p, i, arr) => 
      i === 0 ? 0 : (p - arr[i-1]) / arr[i-1]
    );
    const mean = dailyReturns.reduce((sum, ret) => sum + ret, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((sum, ret) => 
      sum + Math.pow(ret - mean, 2), 0
    ) / dailyReturns.length;
    return Math.sqrt(variance) * Math.sqrt(252); // Annualized volatility
  }

  async benchmarkPerformance(botId) {
    try {
      const botPerformance = await this.calculatePerformanceMetrics(botId);
      const marketData = this.getMarketData();
      const benchmarks = this.calculateBenchmarks(marketData);
      
      return {
        relativePerformance: this.calculateRelativePerformance(
          botPerformance,
          benchmarks
        ),
        alpha: this.calculateAlpha(
          botPerformance.totalReturn,
          benchmarks.marketReturn,
          botPerformance.volatility,
          benchmarks.marketVolatility
        ),
        beta: this.calculateBeta(
          botPerformance,
          benchmarks
        )
      };
    } catch (error) {
      console.error('Error benchmarking performance:', error);
      throw error;
    }
  }

  calculateBenchmarks(marketData) {
    const returns = marketData.map(data => 
      (data.currentPrice - data.previousPrice) / data.previousPrice
    );
    const meanReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const volatility = this.calculateVolatility(returns);
    
    return {
      marketReturn: meanReturn,
      marketVolatility: volatility
    };
  }

  calculateRelativePerformance(bot, benchmark) {
    return bot.totalReturn - benchmark.marketReturn;
  }

  calculateAlpha(botReturn, marketReturn, botVolatility, marketVolatility) {
    const riskFreeRate = 0.02;
    return botReturn - (riskFreeRate + 
      (marketReturn - riskFreeRate) * (botVolatility / marketVolatility));
  }

  calculateBeta(botPerformance, benchmark) {
    const covariance = this.calculateCovariance(
      botPerformance.returns,
      benchmark.returns
    );
    return covariance / benchmark.volatility;
  }

  calculateCovariance(returns1, returns2) {
    const n = returns1.length;
    const mean1 = returns1.reduce((sum, ret) => sum + ret, 0) / n;
    const mean2 = returns2.reduce((sum, ret) => sum + ret, 0) / n;
    
    return returns1.reduce((sum, ret1, i) => 
      sum + (ret1 - mean1) * (returns2[i] - mean2), 0
    ) / n;
  }
}

module.exports = new AnalyticsEngine();
