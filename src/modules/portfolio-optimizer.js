const axios = require('axios');
const { ethers } = require('ethers');
const logger = require('./logger');
const { sleep, randomInRange } = require('../utils/helpers');

class PortfolioOptimizer {
  constructor(provider, config = {}) {
    this.provider = provider;
    this.config = {
      riskFreeRate: 0.02, // 2% annual risk-free rate
      maxVolatility: 0.5, // 50% max volatility
      minWeight: 0.01,   // 1% minimum weight per asset
      maxWeight: 0.5,    // 50% maximum weight per asset
      cryptoCompareApiKey: '3824d60a86af05742b596e19b92c7590577c926a943ee4d35c3a518e612eee46',
      ...config
    };
    
    this.assetData = new Map();
    this.marketDataCache = new Map();
    this.marketDataCacheTTL = 5 * 60 * 1000; // 5 minutes cache TTL
    this.httpClient = axios.create({
      baseURL: 'https://min-api.cryptocompare.com/data',
      timeout: 10000,
      headers: {
        'Authorization': `Apikey ${this.config.cryptoCompareApiKey}`
      }
    });
  }

  /**
   * Initialize the optimizer with required data
   */
  async initialize() {
    logger.info('Initializing Portfolio Optimizer...');
    await this.loadMarketData();
  }

  /**
   * Load market data for all supported assets
   */
  async loadMarketData() {
    try {
      const symbols = ['BTC', 'ETH', 'AVAX', 'LINK', 'BNB'];
      const fsyms = symbols.join(',');
      
      // Get price and market cap data
      const [priceResponse, histoDayResponse] = await Promise.all([
        this.httpClient.get(`/pricemultifull?fsyms=${fsyms}&tsyms=USD`),
        this.httpClient.get(`/histoday?fsym=BTC&tsym=USD&limit=30`)
      ]);

      // Process price data
      const rawData = priceResponse.data.RAW;
      Object.entries(rawData).forEach(([symbol, data]) => {
        this.marketDataCache.set(symbol, {
          price: data.USD.PRICE,
          marketCap: data.USD.MKTCAP,
          change24h: data.USD.CHANGEPCT24HOUR / 100,
          lastUpdated: Date.now()
        });
      });

      logger.info('Market data loaded successfully');
      return true;
    } catch (error) {
      logger.error('Failed to load market data:', error.message);
      throw error;
    }
  }

  /**
   * Get current market data for an asset
   */
  async getAssetData(symbol) {
    const cachedData = this.marketDataCache.get(symbol);
    
    // Return cached data if still valid
    if (cachedData && (Date.now() - cachedData.lastUpdated) < this.marketDataCacheTTL) {
      return cachedData;
    }

    // Otherwise fetch fresh data
    try {
      const response = await this.httpClient.get(`/pricemultifull?fsyms=${symbol}&tsyms=USD`);
      const data = response.data.RAW[symbol].USD;
      
      const assetData = {
        symbol,
        price: data.PRICE,
        marketCap: data.MKTCAP,
        change24h: data.CHANGEPCT24HOUR / 100,
        volume24h: data.VOLUME24HOURTO,
        lastUpdated: Date.now()
      };
      
      this.marketDataCache.set(symbol, assetData);
      return assetData;
    } catch (error) {
      logger.error(`Failed to fetch data for ${symbol}:`, error.message);
      return cachedData || null; // Return cached data if available
    }
  }

  /**
   * Get historical price data for an asset
   */
  async getHistoricalData(symbol, days = 30, interval = 'day') {
    try {
      const response = await this.httpClient.get(
        `/v2/histo${interval}?fsym=${symbol}&tsym=USD&limit=${days}`
      );
      
      return response.data.Data.map(item => ({
        time: item.time,
        close: item.close,
        high: item.high,
        low: item.low,
        open: item.open,
        volume: item.volumefrom
      }));
    } catch (error) {
      logger.error(`Failed to fetch historical data for ${symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Calculate volatility for an asset
   */
  async calculateVolatility(symbol, days = 30) {
    try {
      const historicalData = await this.getHistoricalData(symbol, days);
      if (historicalData.length < 2) return 0;
      
      // Calculate daily returns
      const returns = [];
      for (let i = 1; i < historicalData.length; i++) {
        const prevClose = historicalData[i-1].close;
        const currentClose = historicalData[i].close;
        returns.push((currentClose - prevClose) / prevClose);
      }
      
      // Calculate standard deviation of returns (volatility)
      const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
      return Math.sqrt(variance) * Math.sqrt(365); // Annualized volatility
    } catch (error) {
      logger.error(`Error calculating volatility for ${symbol}:`, error.message);
      return 0.3; // Default to 30% if calculation fails
    }
  }

  /**
   * Calculate correlation between two assets
   */
  async calculateCorrelation(symbol1, symbol2, days = 90) {
    try {
      const [data1, data2] = await Promise.all([
        this.getHistoricalData(symbol1, days),
        this.getHistoricalData(symbol2, days)
      ]);
      
      // Align the data by date
      const alignedData = [];
      const dataMap1 = new Map(data1.map(d => [d.time, d.close]));
      const dataMap2 = new Map(data2.map(d => [d.time, d.close]));
      
      for (const time of data1.map(d => d.time)) {
        if (dataMap2.has(time)) {
          alignedData.push({
            time,
            close1: dataMap1.get(time),
            close2: dataMap2.get(time)
          });
        }
      }
      
      if (alignedData.length < 2) return 0;
      
      // Calculate returns
      const returns1 = [];
      const returns2 = [];
      
      for (let i = 1; i < alignedData.length; i++) {
        const prev1 = alignedData[i-1].close1;
        const curr1 = alignedData[i].close1;
        const prev2 = alignedData[i-1].close2;
        const curr2 = alignedData[i].close2;
        
        returns1.push((curr1 - prev1) / prev1);
        returns2.push((curr2 - prev2) / prev2);
      }
      
      // Calculate correlation coefficient
      const mean1 = returns1.reduce((a, b) => a + b, 0) / returns1.length;
      const mean2 = returns2.reduce((a, b) => a + b, 0) / returns2.length;
      
      let covariance = 0;
      let variance1 = 0;
      let variance2 = 0;
      
      for (let i = 0; i < returns1.length; i++) {
        const dev1 = returns1[i] - mean1;
        const dev2 = returns2[i] - mean2;
        
        covariance += dev1 * dev2;
        variance1 += dev1 * dev1;
        variance2 += dev2 * dev2;
      }
      
      const stdDev1 = Math.sqrt(variance1);
      const stdDev2 = Math.sqrt(variance2);
      
      if (stdDev1 === 0 || stdDev2 === 0) return 0;
      
      return covariance / (stdDev1 * stdDev2);
    } catch (error) {
      logger.error(`Error calculating correlation between ${symbol1} and ${symbol2}:`, error.message);
      return 0; // Return 0 correlation if calculation fails
    }
  }

  /**
   * Optimize portfolio allocation based on market conditions
   */
  async optimizePortfolio(assets, currentWeights, strategy = 'market_cap') {
    try {
      // Get latest market data for all assets
      const assetDataPromises = assets.map(symbol => this.getAssetData(symbol));
      const assetsData = await Promise.all(assetDataPromises);
      
      // Calculate target weights based on strategy
      let targetWeights;
      switch (strategy) {
        case 'market_cap':
          targetWeights = this.calculateMarketCapWeights(assets, assetsData);
          break;
        case 'risk_parity':
          targetWeights = await this.calculateRiskParityWeights(assets);
          break;
        case 'min_variance':
          targetWeights = await this.calculateMinVarianceWeights(assets);
          break;
        case 'equal_weight':
        default:
          targetWeights = this.calculateEqualWeights(assets);
      }

      // Apply weight constraints
      targetWeights = this.applyWeightConstraints(targetWeights);
      
      // Calculate portfolio metrics
      const metrics = await this.calculatePortfolioMetrics(assets, targetWeights);
      
      return {
        assets,
        currentWeights,
        targetWeights,
        metrics,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Portfolio optimization failed:', error);
      throw error;
    }
  }

  /**
   * Calculate market cap weighted allocation
   */
  calculateMarketCapWeights(assets, assetsData) {
    const marketCaps = assetsData.map(data => data.marketCap);
    const totalMarketCap = marketCaps.reduce((sum, mc) => sum + mc, 0);
    
    return assets.reduce((weights, symbol, index) => {
      weights[symbol] = assetsData[index].marketCap / totalMarketCap;
      return weights;
    }, {});
  }

  /**
   * Calculate risk parity weights
   */
  async calculateRiskParityWeights(assets) {
    // Get volatilities for all assets
    const volatilities = await Promise.all(
      assets.map(symbol => this.calculateVolatility(symbol))
    );
    
    // Calculate inverse volatility weights
    const invVolatilities = volatilities.map(v => 1 / (v || 0.0001)); // Avoid division by zero
    const sumInvVol = invVolatilities.reduce((sum, iv) => sum + iv, 0);
    
    return assets.reduce((weights, symbol, index) => {
      weights[symbol] = invVolatilities[index] / sumInvVol;
      return weights;
    }, {});
  }

  /**
   * Calculate minimum variance portfolio weights
   */
  async calculateMinVarianceWeights(assets) {
    try {
      // Get historical returns for all assets
      const historicalData = await Promise.all(
        assets.map(symbol => this.getHistoricalData(symbol, 90))
      );
      
      // Align historical data by date
      const alignedReturns = this.alignHistoricalReturns(assets, historicalData);
      if (alignedReturns.length < 30) {
        throw new Error('Insufficient historical data for minimum variance optimization');
      }
      
      // Calculate covariance matrix
      const covMatrix = this.calculateCovarianceMatrix(alignedReturns);
      
      // Solve for minimum variance portfolio
      return this.solveMinVarianceWeights(covMatrix, assets);
    } catch (error) {
      logger.error('Minimum variance optimization failed, falling back to risk parity:', error);
      return this.calculateRiskParityWeights(assets);
    }
  }

  /**
   * Align historical returns by date
   */
  alignHistoricalReturns(assets, historicalData) {
    // Find common dates across all assets
    const dateSets = historicalData.map(data => new Set(data.map(d => d.time)));
    const commonDates = dateSets.reduce((common, dates) => {
      return new Set([...common].filter(date => dates.has(date)));
    }, dateSets[0]);
    
    // Create aligned returns array
    const alignedReturns = [];
    
    // For each common date, get the close price for each asset
    for (const date of commonDates) {
      const returns = {};
      let hasAllData = true;
      
      assets.forEach((symbol, i) => {
        const dataPoint = historicalData[i].find(d => d.time === date);
        if (!dataPoint) {
          hasAllData = false;
          return;
        }
        returns[symbol] = dataPoint.close;
      });
      
      if (hasAllData && Object.keys(returns).length === assets.length) {
        alignedReturns.push(returns);
      }
    }
    
    return alignedReturns;
  }

  /**
   * Calculate covariance matrix from aligned returns
   */
  calculateCovarianceMatrix(alignedReturns) {
    const assets = Object.keys(alignedReturns[0]);
    const n = assets.length;
    const returns = [];
    
    // Calculate returns for each asset
    for (let i = 1; i < alignedReturns.length; i++) {
      const dailyReturns = {};
      assets.forEach(symbol => {
        const prevPrice = alignedReturns[i-1][symbol];
        const currPrice = alignedReturns[i][symbol];
        dailyReturns[symbol] = (currPrice - prevPrice) / prevPrice;
      });
      returns.push(dailyReturns);
    }
    
    // Calculate means
    const means = {};
    assets.forEach(symbol => {
      const sum = returns.reduce((s, r) => s + r[symbol], 0);
      means[symbol] = sum / returns.length;
    });
    
    // Calculate covariance matrix
    const covMatrix = Array(n).fill().map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        const sym1 = assets[i];
        const sym2 = assets[j];
        let covariance = 0;
        
        for (const r of returns) {
          covariance += (r[sym1] - means[sym1]) * (r[sym2] - means[sym2]);
        }
        
        covariance /= (returns.length - 1); // Sample covariance
        covMatrix[i][j] = covariance;
        if (i !== j) {
          covMatrix[j][i] = covariance; // Symmetric matrix
        }
      }
    }
    
    return covMatrix;
  }

  /**
   * Solve for minimum variance portfolio weights
   */
  solveMinVarianceWeights(covMatrix, assets) {
    const n = assets.length;
    
    // Create system of equations: covMatrix * weights = 1 (with sum(weights) = 1)
    const A = covMatrix.map(row => [...row, 1]);
    A.push(Array(n).fill(1).concat(0)); // Sum constraint
    
    const b = Array(n).fill(0).concat(1);
    
    // Solve using Gaussian elimination
    const weights = this.solveLinearSystem(A, b);
    
    // Normalize weights to sum to 1
    const sum = weights.reduce((s, w) => s + w, 0);
    const normalizedWeights = weights.map(w => w / sum);
    
    // Create weights object
    return assets.reduce((result, symbol, i) => {
      result[symbol] = Math.max(0, normalizedWeights[i]); // No short selling
      return result;
    }, {});
  }

  /**
   * Solve system of linear equations using Gaussian elimination
   */
  solveLinearSystem(A, b) {
    const n = A.length;
    
    // Forward elimination
    for (let i = 0; i < n; i++) {
      // Find pivot row
      let maxRow = i;
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(A[j][i]) > Math.abs(A[maxRow][i])) {
          maxRow = j;
        }
      }
      
      // Swap rows
      [A[i], A[maxRow]] = [A[maxRow], A[i]];
      [b[i], b[maxRow]] = [b[maxRow], b[i]];
      
      // Eliminate column below current row
      for (let j = i + 1; j < n; j++) {
        const factor = A[j][i] / A[i][i];
        b[j] -= factor * b[i];
        for (let k = i; k < n; k++) {
          A[j][k] -= factor * A[i][k];
        }
      }
    }
    
    // Back substitution
    const x = Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = 0;
      for (let j = i + 1; j < n; j++) {
        sum += A[i][j] * x[j];
      }
      x[i] = (b[i] - sum) / A[i][i];
    }
    
    return x;
  }

  /**
   * Calculate equal weights allocation
   */
  calculateEqualWeights(assets) {
    const weight = 1 / assets.length;
    return assets.reduce((weights, symbol) => {
      weights[symbol] = weight;
      return weights;
    }, {});
  }

  /**
   * Apply weight constraints (min/max weights)
   */
  applyWeightConstraints(weights) {
    const result = { ...weights };
    const symbols = Object.keys(weights);
    
    // First pass: Apply minimum weights
    let remainingWeight = 1;
    let flexibleAssets = 0;
    
    symbols.forEach(symbol => {
      if (result[symbol] < this.config.minWeight) {
        remainingWeight -= this.config.minWeight - result[symbol];
        result[symbol] = this.config.minWeight;
      } else if (result[symbol] > this.config.maxWeight) {
        remainingWeight -= this.config.maxWeight - result[symbol];
        result[symbol] = this.config.maxWeight;
      } else {
        flexibleAssets++;
      }
    });
    
    // Redistribute remaining weight proportionally
    if (flexibleAssets > 0 && remainingWeight > 0) {
      const scale = remainingWeight / symbols.reduce((sum, symbol) => {
        if (result[symbol] >= this.config.minWeight && result[symbol] <= this.config.maxWeight) {
          return sum + result[symbol];
        }
        return sum;
      }, 0);
      
      symbols.forEach(symbol => {
        if (result[symbol] >= this.config.minWeight && result[symbol] <= this.config.maxWeight) {
          result[symbol] *= scale;
        }
      });
    }
    
    return result;
  }

  /**
   * Calculate portfolio metrics
   */
  async calculatePortfolioMetrics(assets, weights) {
    try {
      // Get asset data and volatilities
      const [assetsData, volatilities] = await Promise.all([
        Promise.all(assets.map(symbol => this.getAssetData(symbol))),
        Promise.all(assets.map(symbol => this.calculateVolatility(symbol)))
      ]);
      
      // Calculate weighted return and risk
      let expectedReturn = 0;
      let portfolioVariance = 0;
      
      // Calculate individual contributions
      assets.forEach((symbol, i) => {
        const weight = weights[symbol];
        const assetReturn = assetsData[i].change24h * 365; // Annualized
        const assetVolatility = volatilities[i];
        
        expectedReturn += weight * assetReturn;
        portfolioVariance += Math.pow(weight * assetVolatility, 2);
      });
      
      // Add covariance terms for portfolio variance
      for (let i = 0; i < assets.length; i++) {
        for (let j = i + 1; j < assets.length; j++) {
          const correlation = await this.calculateCorrelation(assets[i], assets[j]);
          portfolioVariance += 2 * weights[assets[i]] * weights[assets[j]] * 
                              volatilities[i] * volatilities[j] * correlation;
        }
      }
      
      const portfolioVolatility = Math.sqrt(portfolioVariance);
      const sharpeRatio = (expectedReturn - this.config.riskFreeRate) / (portfolioVolatility || 0.0001);
      
      return {
        expectedReturn,
        volatility: portfolioVolatility,
        sharpeRatio,
        riskFreeRate: this.config.riskFreeRate,
        assets: assets.reduce((acc, symbol, i) => ({
          ...acc,
          [symbol]: {
            weight: weights[symbol],
            expectedReturn: assetsData[i].change24h * 365,
            volatility: volatilities[i]
          }
        }), {})
      };
    } catch (error) {
      logger.error('Error calculating portfolio metrics:', error);
      throw error;
    }
  }

  /**
   * Analyze portfolio performance metrics
   */
  async analyzePortfolioPerformance(portfolio) {
    try {
      const { assets, weights } = portfolio;
      
      // Get current market data and calculate metrics
      const metrics = await this.calculatePortfolioMetrics(assets, weights);
      
      // Calculate turnover from previous allocation (if available)
      let turnover = 0;
      if (portfolio.previousWeights) {
        turnover = this.calculateTurnover(weights, portfolio.previousWeights);
      }
      
      // Calculate performance attribution
      const attribution = await this.calculatePerformanceAttribution(portfolio, metrics);
      
      return {
        ...metrics,
        turnover,
        attribution,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error analyzing portfolio performance:', error);
      throw error;
    }
  }

  /**
   * Calculate turnover between two weight vectors
   */
  calculateTurnover(weightsA, weightsB) {
    const symbols = new Set([...Object.keys(weightsA), ...Object.keys(weightsB)]);
    let turnover = 0;
    
    for (const symbol of symbols) {
      const weightA = weightsA[symbol] || 0;
      const weightB = weightsB[symbol] || 0;
      turnover += Math.abs(weightA - weightB);
    }
    
    return turnover / 2; // Divide by 2 because we're double-counting the buys and sells
  }

  /**
   * Calculate performance attribution
   */
  async calculatePerformanceAttribution(portfolio, metrics) {
    const { assets, weights } = portfolio;
    const attribution = {};
    
    // Get asset returns
    const assetReturns = await this.getAssetReturns(assets);
    
    // Calculate contribution to return
    for (const symbol of assets) {
      const weight = weights[symbol];
      const assetReturn = assetReturns[symbol] || 0;
      
      attribution[symbol] = {
        weight,
        return: assetReturn,
        contribution: weight * assetReturn,
        activeReturn: assetReturn - metrics.expectedReturn
      };
    }
    
    return attribution;
  }

  /**
   * Get asset returns for performance attribution
   */
  async getAssetReturns(assets) {
    const returns = {};
    
    for (const symbol of assets) {
      try {
        const data = await this.getHistoricalData(symbol, 2); // Get last 2 data points for return
        if (data.length >= 2) {
          const prevPrice = data[0].close;
          const currPrice = data[1].close;
          returns[symbol] = (currPrice - prevPrice) / prevPrice;
        } else {
          returns[symbol] = 0;
        }
      } catch (error) {
        logger.error(`Error getting returns for ${symbol}:`, error.message);
        returns[symbol] = 0;
      }
    }
    
    return returns;
  }

  /**
   * Generate rebalancing suggestions based on current portfolio and market conditions
   */
  async generateRebalancingSuggestions(portfolio, targetAllocation) {
    try {
      const { assets, weights: currentWeights } = portfolio;
      const targetWeights = targetAllocation.weights;
      
      // Calculate necessary trades to reach target allocation
      const trades = [];
      let totalTradingVolume = 0;
      
      for (const symbol of assets) {
        const currentWeight = currentWeights[symbol] || 0;
        const targetWeight = targetWeights[symbol] || 0;
        const weightDiff = targetWeight - currentWeight;
        
        if (Math.abs(weightDiff) > 0.001) { // Ignore very small differences
          trades.push({
            symbol,
            currentWeight,
            targetWeight,
            weightDiff,
            action: weightDiff > 0 ? 'BUY' : 'SELL',
            amount: Math.abs(weightDiff)
          });
          
          totalTradingVolume += Math.abs(weightDiff);
        }
      }
      
      // Sort trades by priority (largest absolute difference first)
      trades.sort((a, b) => Math.abs(b.weightDiff) - Math.abs(a.weightDiff));
      
      // Calculate estimated transaction costs
      const transactionCost = this.estimateTransactionCost(trades);
      
      return {
        trades,
        totalTradingVolume,
        transactionCost,
        expectedImprovement: this.calculateExpectedImprovement(portfolio, targetAllocation),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error generating rebalancing suggestions:', error);
      throw error;
    }
  }

  /**
   * Estimate transaction costs for a set of trades
   */
  estimateTransactionCost(trades) {
    // Simple implementation - in practice, this would use exchange-specific fee structures
    const baseFeeRate = 0.001; // 0.1% trading fee
    let totalCost = 0;
    
    for (const trade of trades) {
      totalCost += trade.amount * baseFeeRate;
    }
    
    return totalCost;
  }

  /**
   * Calculate expected improvement from rebalancing
   */
  calculateExpectedImprovement(currentPortfolio, targetAllocation) {
    // Calculate expected return improvement
    const returnImprovement = targetAllocation.metrics.expectedReturn - 
                            (currentPortfolio.metrics?.expectedReturn || 0);
    
    // Calculate risk reduction (if any)
    const riskReduction = (currentPortfolio.metrics?.volatility || 0) - 
                         targetAllocation.metrics.volatility;
    
    // Calculate improvement in Sharpe ratio
    const sharpeImprovement = targetAllocation.metrics.sharpeRatio - 
                             (currentPortfolio.metrics?.sharpeRatio || 0);
    
    return {
      returnImprovement,
      riskReduction,
      sharpeImprovement,
      isImprovement: sharpeImprovement > 0
    };
  }

  /**
   * Check if portfolio needs rebalancing based on thresholds
   */
  needsRebalancing(portfolio, targetAllocation, thresholds = {}) {
    const {
      minWeightDeviation = 0.05,    // 5% minimum weight deviation
      minSharpeImprovement = 0.1,   // 0.1 improvement in Sharpe ratio
      maxTurnover = 0.3,            // 30% maximum turnover
      checkCorrelation = true       // Check for high correlation changes
    } = thresholds;
    
    const { assets, weights: currentWeights } = portfolio;
    const { weights: targetWeights, metrics: targetMetrics } = targetAllocation;
    
    // Check weight deviations
    let maxDeviation = 0;
    for (const symbol of assets) {
      const currentWeight = currentWeights[symbol] || 0;
      const targetWeight = targetWeights[symbol] || 0;
      const deviation = Math.abs(currentWeight - targetWeight);
      maxDeviation = Math.max(maxDeviation, deviation);
    }
    
    // Check if any threshold is breached
    const weightThresholdBreached = maxDeviation >= minWeightDeviation;
    const sharpeThresholdBreached = targetMetrics.sharpeRatio - (portfolio.metrics?.sharpeRatio || 0) >= minSharpeImprovement;
    
    // Check correlation changes if needed
    let correlationCheckPassed = true;
    if (checkCorrelation && portfolio.metrics?.assets) {
      correlationCheckPassed = this.checkCorrelationChanges(portfolio, targetAllocation);
    }
    
    return {
      needsRebalance: (weightThresholdBreached || sharpeThresholdBreached) && correlationCheckPassed,
      weightThresholdBreached,
      sharpeThresholdBreached,
      correlationCheckPassed,
      maxDeviation,
      sharpeImprovement: targetMetrics.sharpeRatio - (portfolio.metrics?.sharpeRatio || 0)
    };
  }

  /**
   * Check for significant changes in asset correlations
   */
  checkCorrelationChanges(portfolio, targetAllocation) {
    // This is a simplified implementation
    // In practice, you'd compare the current correlation matrix with historical data
    // and check for significant changes that might affect portfolio risk
    return true;
  }

  /**
   * Generate a rebalancing plan with transaction details
   */
  async generateRebalancingPlan(currentPortfolio, targetAllocation, constraints = {}) {
    try {
      const { assets } = currentPortfolio;
      const currentWeights = { ...currentPortfolio.weights };
      const targetWeights = { ...targetAllocation.weights };
      
      // Apply constraints
      const constrainedWeights = this.applyRebalancingConstraints(
        assets, 
        currentWeights, 
        targetWeights, 
        constraints
      );
      
      // Generate trades to reach constrained target
      const trades = [];
      let totalBuy = 0;
      let totalSell = 0;
      
      for (const symbol of assets) {
        const currentWeight = currentWeights[symbol] || 0;
        const targetWeight = constrainedWeights[symbol] || 0;
        const weightDiff = targetWeight - currentWeight;
        
        if (Math.abs(weightDiff) > 0.0001) { // Ignore very small differences
          const trade = {
            symbol,
            currentWeight,
            targetWeight,
            weightDiff,
            action: weightDiff > 0 ? 'BUY' : 'SELL',
            amount: Math.abs(weightDiff)
          };
          
          trades.push(trade);
          
          if (trade.action === 'BUY') {
            totalBuy += trade.amount;
          } else {
            totalSell += trade.amount;
          }
        }
      }
      
      // Sort trades by priority (largest absolute difference first)
      trades.sort((a, b) => Math.abs(b.weightDiff) - Math.abs(a.weightDiff));
      
      // Calculate estimated transaction costs and slippage
      const transactionCost = this.estimateTransactionCost(trades);
      const slippage = this.estimateSlippage(trades);
      
      // Calculate portfolio metrics after rebalancing
      const metrics = await this.calculatePortfolioMetrics(assets, constrainedWeights);
      
      return {
        trades,
        totalBuy,
        totalSell,
        netFlow: totalBuy - totalSell,
        transactionCost,
        slippage,
        metrics,
        timestamp: new Date().toISOString(),
        constraintsApplied: Object.keys(constraints).length > 0
      };
    } catch (error) {
      logger.error('Error generating rebalancing plan:', error);
      throw error;
    }
  }

  /**
   * Apply constraints to target weights during rebalancing
   */
  applyRebalancingConstraints(assets, currentWeights, targetWeights, constraints) {
    const result = { ...targetWeights };
    
    // Apply minimum trade size
    if (constraints.minTradeSize) {
      for (const symbol of assets) {
        const weightDiff = result[symbol] - (currentWeights[symbol] || 0);
        if (Math.abs(weightDiff) < constraints.minTradeSize) {
          // Don't trade if below minimum size
          result[symbol] = currentWeights[symbol] || 0;
        }
      }
    }
    
    // Apply maximum position size
    if (constraints.maxPositionSize) {
      for (const symbol of assets) {
        if (result[symbol] > constraints.maxPositionSize) {
          result[symbol] = constraints.maxPositionSize;
        }
      }
    }
    
    // Ensure weights sum to 1 (accounting for rounding errors)
    const totalWeight = Object.values(result).reduce((sum, w) => sum + w, 0);
    if (Math.abs(totalWeight - 1) > 0.0001) {
      const scale = 1 / totalWeight;
      for (const symbol of assets) {
        result[symbol] *= scale;
      }
    }
    
    return result;
  }

  /**
   * Estimate slippage for a set of trades
   */
  estimateSlippage(trades) {
    // Simple implementation - in practice, this would use order book data
    const baseSlippage = 0.001; // 0.1% base slippage
    let totalSlippage = 0;
    
    for (const trade of trades) {
      // Larger trades have higher slippage
      const sizeFactor = Math.min(1, trade.amount / 0.1); // Cap at 10% of volume
      const slippage = baseSlippage * (1 + sizeFactor);
      totalSlippage += trade.amount * slippage;
    }
    
    return totalSlippage;
  }
}

module.exports = PortfolioOptimizer; 