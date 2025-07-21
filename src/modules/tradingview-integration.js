const axios = require('axios');
const logger = require('./logger');

class TradingViewIntegration {
  constructor(config) {
    this.config = config;
    this.baseUrl = 'https://scanner.tradingview.com/avalanche/scan';
    this.sessionId = null;
    this.isAuthenticated = false;
  }

  /**
   * Initialize TradingView integration
   */
  async initialize() {
    try {
      logger.info('Initializing TradingView integration...');

      // Set base URL for TradingView API
      this.baseUrl = this.config.baseUrl || 'https://scanner.tradingview.com/base/scan';

      // Try to authenticate if credentials provided
      if (this.config.username && this.config.password) {
        try {
          await this.authenticate();
          logger.info('✅ TradingView authentication successful');
        } catch (error) {
          logger.warn('TradingView authentication failed, using public API:', error.message);
        }
      } else {
        logger.warn('TradingView credentials not provided - using public API only');
      }

      // Test connection with timeout - continue even if it fails
      try {
        await this.testConnection();
        logger.info('✅ TradingView integration initialized');
      } catch (error) {
        logger.warn('TradingView test failed, continuing in offline mode:', error.message);
        logger.info('✅ TradingView integration initialized (offline mode)');
      }

      return true;
    } catch (error) {
      logger.error('Error initializing TradingView integration:', error);
      // Don't throw - allow bot to continue without TradingView
      logger.warn('Continuing without TradingView integration');
      return false;
    }
  }

  /**
   * Authenticate with TradingView
   */
  async authenticate() {
    try {
      const response = await axios.post('https://www.tradingview.com/accounts/signin/', {
        username: this.config.tradingviewUsername,
        password: this.config.tradingviewPassword,
        remember: 'on'
      });

      if (response.data && response.data.session) {
        this.sessionId = response.data.session;
        this.isAuthenticated = true;
        logger.info('Successfully authenticated with TradingView');
      } else {
        throw new Error('Authentication failed - invalid response');
      }
    } catch (error) {
      logger.error('TradingView authentication failed:', error.message);
      throw error;
    }
  }

  /**
   * Test connection to TradingView (with timeout)
   */
  async testConnection() {
    try {
      // Skip connection test in development mode to prevent hanging
      if (process.env.NODE_ENV !== 'production') {
        logger.warn('Skipping TradingView connection test in development mode');
        return false;
      }

      // Use shorter timeout for development to prevent hangs
      const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('TradingView connection timeout after 5 seconds')), 5000)
      );
      
      const connectionTest = this.getMarketSignals(['PLN']);  // Test with just one asset
      
      const signals = await Promise.race([connectionTest, timeout]);
      logger.info(`Successfully fetched signals for ${signals.length} assets`);
      return true;
    } catch (error) {
      logger.warn('TradingView connection test failed, continuing in fallback mode:', error.message);
      // Don't throw error - allow bot to continue without TradingView
      return false;
    }
  }

  /**
   * Get market signals for specified assets
   */
  async getMarketSignals(assets) {
    try {
      const signals = [];

      for (const asset of assets) {
        try {
          const signal = await this.getAssetSignal(asset);
          if (signal) {
            signals.push(signal);
          }
        } catch (error) {
          logger.warn(`Error getting signal for ${asset}:`, error.message);
        }
      }

      return signals;
    } catch (error) {
      logger.error('Error getting market signals:', error);
      throw error;
    }
  }

  /**
   * Get trading signal for a specific asset
   */
  async getAssetSignal(asset) {
    try {
      // Map asset symbols to TradingView symbols (Base Sepolia)
      const symbolMap = {
        'PLN': 'PLN/USD',
        'ETH': 'BINANCE:ETHUSD',
        'BTC': 'BINANCE:BTCUSD',
        'BASE': 'BASE/USD',
        'USDC': 'BINANCE:USDCUSD'
      };

      const tvSymbol = symbolMap[asset];
      if (!tvSymbol) {
        throw new Error(`Unsupported asset: ${asset}`);
      }

      // Get technical indicators
      const indicators = await this.getTechnicalIndicators(tvSymbol);
      
      // Calculate signal based on indicators
      const signal = this.calculateSignal(asset, indicators);

      return {
        asset,
        symbol: tvSymbol,
        timestamp: new Date().toISOString(),
        indicators,
        signal: signal.direction,
        confidence: signal.confidence,
        price: signal.price,
        volume: signal.volume
      };
    } catch (error) {
      logger.error(`Error getting signal for ${asset}:`, error);
      throw error;
    }
  }

  /**
   * Get technical indicators from TradingView
   */
  async getTechnicalIndicators(symbol) {
    try {
      const payload = {
        symbols: { tickers: [symbol] },
        columns: [
          'Recommend.Other',
          'Recommend.All',
          'Recommend.MA',
          'RSI',
          'RSI[1]',
          'Stoch.K',
          'Stoch.D',
          'Stoch.K[1]',
          'Stoch.D[1]',
          'MACD.macd',
          'MACD.signal',
          'BB.bands.upper',
          'BB.bands.lower',
          'volume',
          'close'
        ]
      };

      const response = await axios.post(this.baseUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          ...(this.sessionId && { 'Cookie': `sessionid=${this.sessionId}` })
        },
        timeout: 3000 // 3 second timeout for each API call
      });

      if (!response.data || !response.data.data || !response.data.data[0]) {
        throw new Error('Invalid response from TradingView');
      }

      const data = response.data.data[0];
      
      return {
        recommendation: {
          other: data[0],
          all: data[1],
          ma: data[2]
        },
        rsi: {
          current: data[3],
          previous: data[4]
        },
        stoch: {
          k: data[5],
          d: data[6],
          k_prev: data[7],
          d_prev: data[8]
        },
        macd: {
          macd: data[9],
          signal: data[10]
        },
        bollinger: {
          upper: data[11],
          lower: data[12]
        },
        volume: data[13],
        price: data[14]
      };
    } catch (error) {
      logger.error('Error getting technical indicators:', error);
      throw error;
    }
  }

  /**
   * Calculate trading signal based on technical indicators
   */
  calculateSignal(asset, indicators) {
    // This is a simplified signal calculation
    // In practice, you would implement more sophisticated analysis
    
    const {
      recommendation,
      rsi,
      stoch,
      macd,
      bollinger,
      price,
      volume
    } = indicators;

    // Calculate signal strength (-1 to 1)
    let signalStrength = 0;
    let signalCount = 0;

    // RSI analysis
    if (rsi.current < 30) {
      signalStrength += 1;
      signalCount++;
    } else if (rsi.current > 70) {
      signalStrength -= 1;
      signalCount++;
    }

    // MACD analysis
    if (macd.macd > macd.signal) {
      signalStrength += 1;
      signalCount++;
    } else if (macd.macd < macd.signal) {
      signalStrength -= 1;
      signalCount++;
    }

    // Bollinger Bands analysis
    if (price < bollinger.lower) {
      signalStrength += 1;
      signalCount++;
    } else if (price > bollinger.upper) {
      signalStrength -= 1;
      signalCount++;
    }

    // Stochastic analysis
    if (stoch.k < 20 && stoch.d < 20) {
      signalStrength += 1;
      signalCount++;
    } else if (stoch.k > 80 && stoch.d > 80) {
      signalStrength -= 1;
      signalCount++;
    }

    // Calculate final signal
    const avgSignal = signalCount > 0 ? signalStrength / signalCount : 0;
    const confidence = Math.abs(avgSignal);
    
    return {
      direction: avgSignal > 0 ? 'bullish' : avgSignal < 0 ? 'bearish' : 'neutral',
      confidence: Math.min(confidence, 1), // Normalize to 0-1
      price,
      volume
    };
  }
}

module.exports = TradingViewIntegration; 