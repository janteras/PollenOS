
/**
 * Backup data provider for when primary market data sources fail
 */
const logger = require('./logger');

class BackupDataProvider {
  constructor() {
    this.cachedData = new Map();
    this.lastUpdate = 0;
  }

  // Simulated market data based on asset patterns
  generateFallbackData(asset) {
    const basePrice = this.getBasePrice(asset);
    const volatility = this.getAssetVolatility(asset);
    
    // Generate realistic price movement
    const priceChange = (Math.random() - 0.5) * volatility * 2;
    const currentPrice = basePrice * (1 + priceChange / 100);
    
    return {
      source: 'Backup-Simulated',
      price: currentPrice,
      change24h: priceChange,
      marketCap: currentPrice * this.getCirculatingSupply(asset),
      volume: currentPrice * this.getDailyVolume(asset),
      RSI: 50 + (Math.random() - 0.5) * 40,
      EMA20: currentPrice * (1 + (Math.random() - 0.5) * 0.02),
      EMA50: currentPrice * (1 + (Math.random() - 0.5) * 0.05),
      EMA200: currentPrice * (1 + (Math.random() - 0.5) * 0.1)
    };
  }

  getBasePrice(asset) {
    const basePrices = {
      'WBTC.E': 45000,
      'WETH.E': 2800,
      'WAVAX': 35,
      'USDT.E': 1,
      'AAVE.E': 120,
      'UNI.E': 8,
      'COMP.E': 65
    };
    return basePrices[asset] || 100;
  }

  getAssetVolatility(asset) {
    const volatilities = {
      'WBTC.E': 4,
      'WETH.E': 5,
      'WAVAX': 8,
      'USDT.E': 0.1,
      'AAVE.E': 10,
      'UNI.E': 12,
      'COMP.E': 15
    };
    return volatilities[asset] || 8;
  }

  getCirculatingSupply(asset) {
    return Math.random() * 1000000 + 100000;
  }

  getDailyVolume(asset) {
    return Math.random() * 100000 + 10000;
  }
}

module.exports = new BackupDataProvider();
