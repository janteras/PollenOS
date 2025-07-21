const WebSocket = require('ws');
const { performance } = require('perf_hooks');
const localStorage = require('./local-storage');
const config = require('../config/web-config');

class PriceFeed {
  constructor() {
    this.prices = new Map();
    this.lastUpdate = 0;
    this.updateInterval = 1000; // 1 second
    this.marketData = {};
    this.ws = null;
    this.setupWebSocket();
  }

  setupWebSocket() {
    try {
      this.ws = new WebSocket(config.PRICE_FEED_URL);
      
      this.ws.on('open', () => {
        console.log('Connected to price feed service');
        this.startPriceUpdates();
      });
      
      this.ws.on('message', (data) => {
        this.handlePriceUpdate(JSON.parse(data));
      });
      
      this.ws.on('error', (error) => {
        console.error('Price feed error:', error);
        this.reconnect();
      });
      
      this.ws.on('close', () => {
        console.log('Price feed connection closed, attempting reconnect...');
        this.reconnect();
      });
    } catch (error) {
      console.error('Failed to setup WebSocket:', error);
      this.reconnect();
    }
  }

  reconnect() {
    setTimeout(() => {
      this.setupWebSocket();
    }, 5000); // Retry after 5 seconds
  }

  startPriceUpdates() {
    setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'subscribe',
          symbols: this.getWatchlist()
        }));
      }
    }, this.updateInterval);
  }

  getWatchlist() {
    // Get symbols from all active bots
    const symbols = new Set();
    const bots = localStorage.getActiveBots();
    
    bots.forEach(bot => {
      bot.strategies.forEach(strategy => {
        strategy.symbols.forEach(symbol => symbols.add(symbol));
      });
    });
    
    return Array.from(symbols);
  }

  handlePriceUpdate(data) {
    try {
      const { symbol, price, timestamp, volume } = data;
      
      if (!this.prices.has(symbol)) {
        this.prices.set(symbol, {
          current: price,
          history: [],
          volume: volume,
          timestamp: timestamp
        });
      }
      
      const priceData = this.prices.get(symbol);
      priceData.current = price;
      priceData.history.push({
        price,
        timestamp,
        volume
      });
      
      // Keep only last 1000 price points
      if (priceData.history.length > 1000) {
        priceData.history.shift();
      }
      
      // Update market data
      this.updateMarketData(symbol, priceData);
      
      // Broadcast price update
      this.broadcastPriceUpdate(symbol, priceData);
    } catch (error) {
      console.error('Error handling price update:', error);
    }
  }

  updateMarketData(symbol, priceData) {
    if (!this.marketData[symbol]) {
      this.marketData[symbol] = {
        returns: [],
        volatility: 0,
        correlation: {},
        liquidity: 0,
        volume: 0
      };
    }
    
    const marketData = this.marketData[symbol];
    
    // Calculate returns
    if (priceData.history.length > 1) {
      const lastPrice = priceData.history[priceData.history.length - 2].price;
      const returnRate = (priceData.current - lastPrice) / lastPrice;
      marketData.returns.push(returnRate);
      
      if (marketData.returns.length > 20) {
        marketData.returns.shift();
      }
      
      // Calculate volatility
      marketData.volatility = this.calculateVolatility(marketData.returns);
    }
    
    // Update volume
    marketData.volume = priceData.volume;
    
    // Update liquidity score
    marketData.liquidity = this.calculateLiquidity(
      priceData.history.length,
      priceData.volume
    );
  }

  broadcastPriceUpdate(symbol, priceData) {
    // TODO: Implement WebSocket broadcast to clients
    // This will be handled by the config-server
  }

  calculateVolatility(returns) {
    if (returns.length < 2) return 0;
    
    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => 
      sum + Math.pow(ret - mean, 2), 0
    ) / returns.length;
    
    return Math.sqrt(variance) * Math.sqrt(252); // Annualized volatility
  }

  calculateLiquidity(priceHistoryLength, volume) {
    // Simple liquidity score: (price history length * volume) / 10000
    return priceHistoryLength * volume / 10000;
  }

  getLatestPrice(symbol) {
    return this.prices.get(symbol)?.current;
  }

  getPriceHistory(symbol, lookback = 100) {
    const data = this.prices.get(symbol);
    if (!data) return [];
    return data.history.slice(-lookback);
  }

  getMarketData(symbol) {
    return this.marketData[symbol];
  }

  getCorrelation(symbol1, symbol2) {
    const data1 = this.marketData[symbol1];
    const data2 = this.marketData[symbol2];
    
    if (!data1 || !data2) return 0;
    
    return this.calculateCorrelation(
      data1.returns,
      data2.returns
    );
  }

  calculateCorrelation(returns1, returns2) {
    if (returns1.length !== returns2.length || returns1.length < 2) return 0;
    
    const n = returns1.length;
    const mean1 = returns1.reduce((sum, ret) => sum + ret, 0) / n;
    const mean2 = returns2.reduce((sum, ret) => sum + ret, 0) / n;
    
    const covariance = returns1.reduce((sum, ret1, i) => 
      sum + (ret1 - mean1) * (returns2[i] - mean2), 0
    ) / n;
    
    const variance1 = returns1.reduce((sum, ret) => 
      sum + Math.pow(ret - mean1, 2), 0
    ) / n;
    
    const variance2 = returns2.reduce((sum, ret) => 
      sum + Math.pow(ret - mean2, 2), 0
    ) / n;
    
    return covariance / (Math.sqrt(variance1) * Math.sqrt(variance2));
  }

  getVolatility(symbol, lookback = 20) {
    const data = this.marketData[symbol];
    if (!data || data.returns.length < lookback) return 0;
    
    return this.calculateVolatility(data.returns.slice(-lookback));
  }
}

module.exports = new PriceFeed();
