const { performance } = require('perf_hooks');
const riskCalculator = require('./risk-calculator');
const analyticsEngine = require('./analytics-engine');
const config = require('../config/web-config');

class PositionSizing {
  constructor() {
    this.positionSizeMethods = {
      'fixed': this.calculateFixedPositionSize,
      'volatility': this.calculateVolatilityAdjusted,
      'risk': this.calculateRiskAdjusted,
      'optimal': this.calculateOptimalPositionSize
    };
    
    this.defaultMethod = 'risk';
    this.riskPerTrade = 0.01; // 1% risk per trade
    this.maxPositionSize = 0.1; // 10% max position size
    this.minPositionSize = 0.001; // 0.1% min position size
  }

  calculatePositionSize(botId, symbol, method = this.defaultMethod) {
    try {
      const methodFn = this.positionSizeMethods[method];
      if (!methodFn) {
        throw new Error(`Unknown position sizing method: ${method}`);
      }
      
      return methodFn.call(this, botId, symbol);
    } catch (error) {
      console.error('Error calculating position size:', error);
      throw error;
    }
  }

  calculateFixedPositionSize(botId, symbol) {
    // Simple fixed position size
    const portfolioValue = analyticsEngine.calculatePortfolioValue(botId);
    return portfolioValue * config.DEFAULT_POSITION_SIZE;
  }

  calculateVolatilityAdjusted(botId, symbol) {
    try {
      const portfolioValue = analyticsEngine.calculatePortfolioValue(botId);
      const volatility = riskCalculator.getVolatility(symbol);
      
      // Adjust position size based on volatility
      // Higher volatility = smaller position
      const adjustment = 1 / (1 + volatility);
      
      return portfolioValue * config.DEFAULT_POSITION_SIZE * adjustment;
    } catch (error) {
      console.error('Error calculating volatility-adjusted position size:', error);
      throw error;
    }
  }

  calculateRiskAdjusted(botId, symbol) {
    try {
      const portfolioValue = analyticsEngine.calculatePortfolioValue(botId);
      const riskMetrics = riskCalculator.calculateRiskMetrics({
        trades: [], // Empty array since we're calculating for a new trade
        performance: {},
        portfolioValue,
        marketData: {}
      });
      
      // Calculate position size based on risk tolerance
      const riskPerTrade = this.riskPerTrade;
      const stopLoss = this.calculateOptimalStopLoss(symbol);
      
      // Position size = (Risk per trade * Portfolio value) / Stop loss distance
      const positionSize = riskPerTrade * portfolioValue / stopLoss;
      
      // Apply size limits
      return Math.max(
        this.minPositionSize,
        Math.min(
          this.maxPositionSize,
          positionSize
        )
      );
    } catch (error) {
      console.error('Error calculating risk-adjusted position size:', error);
      throw error;
    }
  }

  calculateOptimalPositionSize(botId, symbol) {
    try {
      const portfolioValue = analyticsEngine.calculatePortfolioValue(botId);
      const marketData = riskCalculator.getMarketData(symbol);
      const volatility = marketData.volatility;
      const liquidity = marketData.liquidity;
      
      // Calculate optimal position size using Kelly Criterion
      // Adjusted for volatility and liquidity constraints
      const winRate = analyticsEngine.calculateWinRate(botId);
      const avgWin = analyticsEngine.calculateAvgWin(botId);
      const avgLoss = analyticsEngine.calculateAvgLoss(botId);
      
      const kellyFraction = winRate - (1 - winRate) * avgLoss / avgWin;
      
      // Apply volatility adjustment
      const volatilityAdjustment = 1 / (1 + volatility);
      
      // Apply liquidity adjustment
      const liquidityAdjustment = Math.min(1, liquidity);
      
      // Calculate final position size
      const positionSize = portfolioValue * 
        kellyFraction * 
        volatilityAdjustment * 
        liquidityAdjustment;
      
      // Apply size limits
      return Math.max(
        this.minPositionSize,
        Math.min(
          this.maxPositionSize,
          positionSize
        )
      );
    } catch (error) {
      console.error('Error calculating optimal position size:', error);
      throw error;
    }
  }

  calculateOptimalStopLoss(symbol) {
    try {
      const marketData = riskCalculator.getMarketData(symbol);
      const volatility = marketData.volatility;
      const liquidity = marketData.liquidity;
      
      // Calculate stop loss based on volatility and liquidity
      // Higher volatility = wider stop loss
      const volatilityAdjustment = volatility * 2; // 2x volatility as stop loss
      
      // Adjust for liquidity
      const liquidityAdjustment = 1 + (1 - liquidity) * 0.5; // Reduce stop loss width for lower liquidity
      
      return volatilityAdjustment * liquidityAdjustment;
    } catch (error) {
      console.error('Error calculating optimal stop loss:', error);
      throw error;
    }
  }

  calculatePositionAdjustments(botId) {
    try {
      const currentPositions = this.getCurrentPositions(botId);
      const adjustments = {};
      
      Object.entries(currentPositions).forEach(([symbol, position]) => {
        const optimalSize = this.calculatePositionSize(botId, symbol);
        const currentSize = position.size;
        
        if (Math.abs(optimalSize - currentSize) > config.MIN_SIZE_ADJUSTMENT) {
          adjustments[symbol] = {
            current: currentSize,
            optimal: optimalSize,
            adjustment: optimalSize - currentSize
          };
        }
      });
      
      return adjustments;
    } catch (error) {
      console.error('Error calculating position adjustments:', error);
      throw error;
    }
  }

  getCurrentPositions(botId) {
    try {
      const trades = analyticsEngine.getTradeHistory(botId);
      const positions = {};
      
      trades.forEach(trade => {
        if (!positions[trade.symbol]) {
          positions[trade.symbol] = {
            size: 0,
            averagePrice: 0,
            entryTime: 0
          };
        }
        
        if (trade.side === 'buy') {
          positions[trade.symbol].size += trade.quantity;
          positions[trade.symbol].averagePrice = (
            positions[trade.symbol].averagePrice * positions[trade.symbol].size +
            trade.quantity * trade.price
          ) / (positions[trade.symbol].size + trade.quantity);
        } else {
          positions[trade.symbol].size -= trade.quantity;
        }
      });
      
      return positions;
    } catch (error) {
      console.error('Error getting current positions:', error);
      throw error;
    }
  }

  rebalancePositions(botId) {
    try {
      const adjustments = this.calculatePositionAdjustments(botId);
      const trades = [];
      
      Object.entries(adjustments).forEach(([symbol, adjustment]) => {
        if (adjustment.adjustment > 0) {
          // Buy more
          trades.push({
            symbol,
            side: 'buy',
            quantity: Math.abs(adjustment.adjustment)
          });
        } else {
          // Sell
          trades.push({
            symbol,
            side: 'sell',
            quantity: Math.abs(adjustment.adjustment)
          });
        }
      });
      
      return trades;
    } catch (error) {
      console.error('Error rebalancing positions:', error);
      throw error;
    }
  }

  validatePositionSize(positionSize, portfolioValue) {
    try {
      if (positionSize < this.minPositionSize) {
        throw new Error(`Position size too small: ${positionSize}`);
      }
      
      if (positionSize > this.maxPositionSize * portfolioValue) {
        throw new Error(`Position size too large: ${positionSize}`);
      }
      
      return true;
    } catch (error) {
      console.error('Error validating position size:', error);
      throw error;
    }
  }

  optimizePortfolio(botId) {
    try {
      const portfolioValue = analyticsEngine.calculatePortfolioValue(botId);
      const marketData = riskCalculator.getMarketData();
      const symbols = Object.keys(marketData);
      
      // Calculate optimal allocation using mean-variance optimization
      const covarianceMatrix = this.calculateCovarianceMatrix(symbols);
      const expectedReturns = this.calculateExpectedReturns(symbols);
      
      // Solve optimization problem
      const allocation = this.solveOptimization(
        covarianceMatrix,
        expectedReturns,
        portfolioValue
      );
      
      return allocation;
    } catch (error) {
      console.error('Error optimizing portfolio:', error);
      throw error;
    }
  }

  calculateCovarianceMatrix(symbols) {
    const matrix = {};
    symbols.forEach(symbol1 => {
      matrix[symbol1] = {};
      symbols.forEach(symbol2 => {
        matrix[symbol1][symbol2] = riskCalculator.getCorrelation(symbol1, symbol2);
      });
    });
    return matrix;
  }

  calculateExpectedReturns(symbols) {
    const returns = {};
    symbols.forEach(symbol => {
      const marketData = riskCalculator.getMarketData(symbol);
      returns[symbol] = marketData.returns.reduce((sum, ret) => sum + ret, 0) / 
        marketData.returns.length;
    });
    return returns;
  }

  solveOptimization(covarianceMatrix, expectedReturns, portfolioValue) {
    try {
      // This is a simplified version of mean-variance optimization
      // In practice, you would use a more sophisticated optimization library
      const allocation = {};
      const symbols = Object.keys(expectedReturns);
      
      // Calculate weights based on expected returns and risk
      let totalWeight = 0;
      symbols.forEach(symbol => {
        const weight = expectedReturns[symbol] / 
          Math.sqrt(covarianceMatrix[symbol][symbol]);
        allocation[symbol] = weight;
        totalWeight += weight;
      });
      
      // Normalize weights
      symbols.forEach(symbol => {
        allocation[symbol] = allocation[symbol] / totalWeight * portfolioValue;
      });
      
      // Apply size constraints
      Object.entries(allocation).forEach(([symbol, size]) => {
        allocation[symbol] = Math.max(
          this.minPositionSize,
          Math.min(
            this.maxPositionSize * portfolioValue,
            size
          )
        );
      });
      
      return allocation;
    } catch (error) {
      console.error('Error solving optimization:', error);
      throw error;
    }
  }
}

module.exports = new PositionSizing();
