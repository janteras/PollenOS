const { performance } = require('perf_hooks');
const localStorage = require('./local-storage');

class RiskCalculator {
  constructor() {
    this.riskMetrics = {
      volatility: 0,
      beta: 0,
      valueAtRisk: 0,
      conditionalValueAtRisk: 0,
      positionRisk: {},
      portfolioRisk: 0,
      drawdown: 0,
      maxDrawdown: 0
    };
  }

  async calculateRiskMetrics(data) {
    try {
      const startTime = performance.now();
      
      // Calculate individual position risks
      const positionRisks = await this.calculatePositionRisks(data.trades);
      
      // Calculate portfolio-level risks
      const portfolioMetrics = await this.calculatePortfolioRisks({
        trades: data.trades,
        performance: data.performance,
        portfolioValue: data.portfolioValue,
        marketData: data.marketData
      });
      
      const endTime = performance.now();
      console.log(`Risk calculation took ${endTime - startTime}ms`);
      
      return {
        positionRisks,
        portfolioMetrics,
        calculationTime: endTime - startTime
      };
    } catch (error) {
      console.error('Error calculating risk metrics:', error);
      throw error;
    }
  }

  calculatePositionRisks(trades) {
    const risks = {};
    trades.forEach(trade => {
      const symbol = trade.symbol;
      if (!risks[symbol]) {
        risks[symbol] = {
          positionSize: 0,
          volatility: 0,
          beta: 0,
          valueAtRisk: 0,
          drawdown: 0
        };
      }
      
      risks[symbol].positionSize += trade.quantity;
      risks[symbol].volatility += this.calculateVolatility(trade);
      risks[symbol].beta += this.calculateBeta(trade);
      risks[symbol].valueAtRisk += this.calculateValueAtRisk(trade);
      risks[symbol].drawdown = Math.max(
        risks[symbol].drawdown,
        this.calculateDrawdown(trade)
      );
    });
    
    return risks;
  }

  calculatePortfolioRisks(data) {
    const portfolioValue = data.portfolioValue;
    const marketData = data.marketData;
    const trades = data.trades;
    
    return {
      volatility: this.calculatePortfolioVolatility(trades, marketData),
      beta: this.calculatePortfolioBeta(trades, marketData),
      valueAtRisk: this.calculatePortfolioValueAtRisk(trades, portfolioValue),
      conditionalValueAtRisk: this.calculateConditionalValueAtRisk(trades, portfolioValue),
      drawdown: this.calculatePortfolioDrawdown(trades),
      maxDrawdown: this.calculateMaxDrawdown(trades)
    };
  }

  calculateVolatility(trade) {
    const returns = this.calculateReturns(trade);
    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => 
      sum + Math.pow(ret - mean, 2), 0
    ) / returns.length;
    return Math.sqrt(variance) * 100; // Convert to percentage
  }

  calculateBeta(trade) {
    const marketReturns = this.getMarketReturns(trade.symbol);
    const assetReturns = this.calculateReturns(trade);
    
    const covariance = this.calculateCovariance(marketReturns, assetReturns);
    const marketVariance = this.calculateVariance(marketReturns);
    
    return covariance / marketVariance;
  }

  calculateValueAtRisk(trade, confidence = 0.95) {
    const returns = this.calculateReturns(trade);
    const sortedReturns = returns.sort((a, b) => a - b);
    const index = Math.floor((1 - confidence) * sortedReturns.length);
    return -sortedReturns[index] * trade.quantity;
  }

  calculateConditionalValueAtRisk(trades, portfolioValue, confidence = 0.95) {
    const returns = trades.map(trade => this.calculateReturns(trade));
    const flattenedReturns = returns.flat();
    const sortedReturns = flattenedReturns.sort((a, b) => a - b);
    
    const index = Math.floor((1 - confidence) * sortedReturns.length);
    const varValue = -sortedReturns[index];
    
    const cvar = sortedReturns
      .filter(ret => ret <= varValue)
      .reduce((sum, ret) => sum + ret, 0) / sortedReturns.length;
    
    return -cvar * portfolioValue;
  }

  calculateDrawdown(trade) {
    const prices = this.getPriceHistory(trade);
    let peak = prices[0];
    let drawdown = 0;
    
    prices.forEach(price => {
      peak = Math.max(peak, price);
      drawdown = Math.max(drawdown, (peak - price) / peak);
    });
    
    return drawdown;
  }

  calculatePortfolioVolatility(trades, marketData) {
    const covMatrix = this.calculateCovarianceMatrix(trades, marketData);
    const weights = this.calculateWeights(trades);
    
    let portfolioVolatility = 0;
    Object.entries(weights).forEach(([symbol1, weight1]) => {
      Object.entries(weights).forEach(([symbol2, weight2]) => {
        portfolioVolatility += weight1 * weight2 * covMatrix[symbol1][symbol2];
      });
    });
    
    return Math.sqrt(portfolioVolatility);
  }

  calculatePortfolioBeta(trades, marketData) {
    const portfolioReturns = this.calculatePortfolioReturns(trades);
    const marketReturns = this.getMarketReturns();
    
    const covariance = this.calculateCovariance(portfolioReturns, marketReturns);
    const marketVariance = this.calculateVariance(marketReturns);
    
    return covariance / marketVariance;
  }

  calculatePortfolioValueAtRisk(trades, portfolioValue, confidence = 0.95) {
    const portfolioReturns = this.calculatePortfolioReturns(trades);
    const sortedReturns = portfolioReturns.sort((a, b) => a - b);
    const index = Math.floor((1 - confidence) * sortedReturns.length);
    return -sortedReturns[index] * portfolioValue;
  }

  calculatePortfolioDrawdown(trades) {
    const portfolioValues = this.calculatePortfolioValues(trades);
    let peak = portfolioValues[0];
    let maxDrawdown = 0;
    
    portfolioValues.forEach(value => {
      peak = Math.max(peak, value);
      maxDrawdown = Math.max(maxDrawdown, (peak - value) / peak);
    });
    
    return maxDrawdown;
  }

  calculateReturns(trade) {
    const prices = this.getPriceHistory(trade);
    return prices.map((p, i, arr) => 
      i === 0 ? 0 : (p - arr[i-1]) / arr[i-1]
    );
  }

  calculateCovarianceMatrix(trades, marketData) {
    const symbols = new Set(trades.map(t => t.symbol));
    const matrix = {};
    
    symbols.forEach(symbol1 => {
      matrix[symbol1] = {};
      symbols.forEach(symbol2 => {
        matrix[symbol1][symbol2] = this.calculateCovariance(
          this.getMarketReturns(symbol1),
          this.getMarketReturns(symbol2)
        );
      });
    });
    
    return matrix;
  }

  calculateWeights(trades) {
    const totalValue = trades.reduce((sum, t) => sum + t.quantity * t.price, 0);
    return trades.reduce((weights, t) => {
      weights[t.symbol] = t.quantity * t.price / totalValue;
      return weights;
    }, {});
  }

  calculatePortfolioReturns(trades) {
    const portfolioValues = this.calculatePortfolioValues(trades);
    return portfolioValues.map((v, i, arr) => 
      i === 0 ? 0 : (v - arr[i-1]) / arr[i-1]
    );
  }

  calculatePortfolioValues(trades) {
    const values = [];
    let currentValue = 0;
    
    trades.sort((a, b) => a.timestamp - b.timestamp).forEach(trade => {
      currentValue += trade.quantity * trade.price;
      values.push(currentValue);
    });
    
    return values;
  }

  calculateCovariance(returns1, returns2) {
    const n = returns1.length;
    const mean1 = returns1.reduce((sum, ret) => sum + ret, 0) / n;
    const mean2 = returns2.reduce((sum, ret) => sum + ret, 0) / n;
    
    return returns1.reduce((sum, ret1, i) => 
      sum + (ret1 - mean1) * (returns2[i] - mean2), 0
    ) / n;
  }

  calculateVariance(returns) {
    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    return returns.reduce((sum, ret) => 
      sum + Math.pow(ret - mean, 2), 0
    ) / returns.length;
  }

  getPriceHistory(trade) {
    // TODO: Implement real-time price history fetching
    return [];
  }

  getMarketReturns(symbol) {
    // TODO: Implement market returns calculation
    return [];
  }

  getMarketData() {
    // TODO: Implement market data fetching
    return {};
  }
}

module.exports = {
  calculateRiskMetrics: async (data) => {
    const calculator = new RiskCalculator();
    return calculator.calculateRiskMetrics(data);
  }
};
