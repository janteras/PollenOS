const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const http = require('http');
const WebSocketHandler = require('./websocket-handler');
const config = require('../config/web-config');
const localStorage = require('./local-storage');
const strategyManager = require('./strategy-manager');
const portfolioOptimizer = require('./analytics/portfolio-optimizer');
const marketPredictor = require('./analytics/market-predictor');
const performanceBenchmark = require('./analytics/performance-benchmark');
const riskAssessor = require('./risk/risk-assessor');
const positionSizer = require('./risk/position-sizer');
const riskControls = require('./risk/risk-controls');
const AlertManager = require('./alerts/alert-manager');

// Initialize configuration
const PORT = process.env.PORT || config.PORT;
const HOST = process.env.HOST || config.HOST;
const INTERFACE_URL = process.env.INTERFACE_URL || config.INTERFACE_URL;
const WEBSOCKET_URL = process.env.WEBSOCKET_URL || config.WEBSOCKET_URL;

class PollenConfigServer {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.websocketHandler = new WebSocketHandler(this.server);
    this.strategies = new Map();
  }

  async initialize() {
    try {
      await strategyManager.initializeStrategies();
      this.setupMiddleware();
      this.setupRoutes();
      this.setupWebSocket();
      this.server.listen(PORT, HOST, () => {
        console.log(`🌐 Server running at ${INTERFACE_URL}`);
        console.log(`🔗 WebSocket URL: ${WEBSOCKET_URL}`);
      });
    } catch (error) {
      console.error('Error initializing server:', error);
      process.exit(1);
    }
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, '../public')));
  }

  setupRoutes() {
    // Serve main interface
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../public/index.html'));
    });

    // Analytics API
    this.app.post('/api/analytics/portfolio/optimization', (req, res) => {
      try {
        const { botId, assetReturns } = req.body;
        const optimization = portfolioOptimizer.optimizePortfolio(botId, assetReturns);
        res.json(optimization);
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/analytics/portfolio/latest', (req, res) => {
      try {
        const { botId } = req.query;
        const optimization = portfolioOptimizer.getLatestOptimization(botId);
        res.json(optimization);
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/analytics/market/predict', (req, res) => {
      try {
        const { symbol, prices } = req.body;
        const indicators = marketPredictor.calculateTechnicalIndicators(prices, symbol);
        const prediction = marketPredictor.makePrediction(symbol, indicators);
        res.json(prediction);
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/analytics/market/indicators', (req, res) => {
      try {
        const { symbol } = req.query;
        const indicators = marketPredictor.getLatestIndicators(symbol);
        res.json(indicators);
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/analytics/performance/metrics', (req, res) => {
      try {
        const { botId, returns, benchmarkReturns } = req.body;
        const metrics = performanceBenchmark.calculatePerformanceMetrics(botId, returns, benchmarkReturns);
        res.json(metrics);
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/analytics/performance/history', (req, res) => {
      try {
        const { botId, metricName } = req.query;
        const history = performanceBenchmark.getMetricHistory(botId, metricName);
        res.json(history);
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Risk Management API
    this.app.post('/api/risk/assess', (req, res) => {
      try {
        const { botId, portfolio } = req.body;
        const assessment = riskAssessor.assessRisk(botId, portfolio);
        res.json(assessment);
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/risk/assessment/latest', (req, res) => {
      try {
        const { botId } = req.query;
        const assessment = riskAssessor.getLatestAssessment(botId);
        res.json(assessment);
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/risk/position-size', (req, res) => {
      try {
        const { botId, portfolio, riskProfile } = req.body;
        const sizing = positionSizer.calculateOptimalPositions(botId, portfolio, riskProfile);
        res.json(sizing);
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/risk/control/create', (req, res) => {
      try {
        const { botId, controlType, parameters } = req.body;
        const control = riskControls.createControl(botId, controlType, parameters);
        res.json(control);
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/risk/control/evaluate', (req, res) => {
      try {
        const { botId, metrics } = req.body;
        const actions = riskControls.evaluateControls(botId, metrics);
        res.json(actions);
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Alert Management API
    this.app.post('/api/alerts/settings', async (req, res) => {
      try {
        const settings = await alertManager.updateSettings(req.body);
        res.json(settings);
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/alerts/settings', async (req, res) => {
      try {
        const settings = await alertManager.getSettings();
        res.json(settings);
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/alerts/risk', async (req, res) => {
      try {
        const { riskFactors } = req.body;
        const alerts = await alertManager.checkRiskAlerts(riskFactors);
        res.json(alerts);
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/alerts/trade', async (req, res) => {
      try {
        const { positionSize, stopLoss } = req.body;
        const alerts = await alertManager.checkTradeAlerts(positionSize, stopLoss);
        res.json(alerts);
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/alerts/market', async (req, res) => {
      try {
        const { priceChange, volume } = req.body;
        const alerts = await alertManager.checkMarketAlerts(priceChange, volume);
        res.json(alerts);
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Bot Configuration API
    this.app.post('/api/bots', (req, res) => {
      try {
        const botConfig = req.body;
        const result = localStorage.saveBotConfiguration(botConfig);
        res.json({ success: true, id: result.id });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/bots', (req, res) => {
      try {
        const bots = localStorage.getBotConfigurations();
        res.json(bots);
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.put('/api/bots/:id', (req, res) => {
      try {
        const id = req.params.id;
        const botConfig = req.body;
        localStorage.updateBotConfiguration(id, botConfig);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Trade History API
    this.app.get('/api/trades/:botId', (req, res) => {
      try {
        const botId = req.params.botId;
        const trades = localStorage.getTradeHistory(botId);
        res.json(trades);
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Performance Metrics API
    this.app.get('/api/performance/:botId', (req, res) => {
      try {
        const botId = req.params.botId;
        const metrics = localStorage.getLatestPerformanceMetrics(botId);
        res.json(metrics);
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Network Configuration API
    this.app.post('/api/network', (req, res) => {
      try {
        const network = req.body.network;
        const config = req.body.config;
        localStorage.saveNetworkConfig(network, config);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Strategy Management API
    this.app.post('/api/strategies', async (req, res) => {
      try {
        const strategy = req.body;
        const result = await strategyManager.saveStrategy(strategy);
        res.json(result);
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/strategies', async (req, res) => {
      try {
        const strategies = await strategyManager.getStrategies();
        res.json(strategies);
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/strategies/:id', async (req, res) => {
      try {
        const strategy = await strategyManager.getStrategy(req.params.id);
        res.json(strategy);
      } catch (error) {
        res.status(404).json({ success: false, error: error.message });
      }
    });

    this.app.delete('/api/strategies/:id', async (req, res) => {
      try {
        await strategyManager.deleteStrategy(req.params.id);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/strategies/validate', async (req, res) => {
      try {
        const strategy = req.body;
        const validation = await strategyManager.validateStrategy(strategy);
        res.json(validation);
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/api/strategies/test', async (req, res) => {
      try {
        const { strategy, testParams } = req.body;
        const results = await strategyManager.testStrategy(strategy, testParams);
        res.json(results);
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.get('/api/network/:network', (req, res) => {
      try {
        const network = req.params.network;
        const config = localStorage.getNetworkConfig(network);
        res.json(config);
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Get all bot configurations
    this.app.get('/api/bots', (req, res) => {
      try {
        const performanceDir = path.resolve(__dirname, '../../data/performance');

        const bots = {};
        const botFiles = [
          'bot1_performance.json',
          'bot2_performance.json',
          'bot3_performance.json',
          'bot4_performance.json',
          'bot5_performance.json',
        ];

        botFiles.forEach((file) => {
          const filePath = path.join(performanceDir, file);
          if (fs.existsSync(filePath)) {
            try {
              const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
              const botId = file.replace('_performance.json', '');
              bots[botId] = {
                name: this.getBotName(botId),
                strategy: data.strategy || 'unknown',
                riskLevel: data.riskLevel || 'moderate',
                status: 'active',
                portfolioValue:
                  data.portfolioHistory.length > 0
                    ? data.portfolioHistory[data.portfolioHistory.length - 1].value
                    : data.initialValue || 0,
                pnl24h:
                  data.portfolioHistory.length > 1
                    ? data.portfolioHistory[data.portfolioHistory.length - 1].dailyChangePercent ||
                      0
                    : 0,
                lastRebalance:
                  data.portfolioHistory.length > 0
                    ? data.portfolioHistory[data.portfolioHistory.length - 1].timestamp
                    : Date.now(),
                totalTrades: data.transactions ? data.transactions.length : 0,
                performance: data.overallStats ? data.overallStats.totalReturn : 0,
              };
            } catch (error) {
              console.error(`Error reading ${file}:`, error.message);
            }
          }
        });

        res.json(bots);
      } catch (error) {
        console.error('Error fetching bot data:', error);
        res.json({});
      }
    });

    // ... (rest of the code remains the same)

    // WebSocket setup
    this.setupWebSocket();
  }

  // WebSocket setup method
  setupWebSocket() {
    // Initialize AlertManager with WebSocket handler
    this.alertManager = new AlertManager(this.websocketHandler);
    
    // Set up alert broadcasting
    this.alertManager.on('new-alert', (alert) => {
      this.websocketHandler.broadcastMessage({
        type: 'alert',
        alert
      });
    });

    // Set up WebSocket connection handler
    this.websocketHandler.on('connection', this.handleWebSocketConnection.bind(this));
  }

  // Send real-time update
  sendRealTimeUpdate(ws) {
    try {
      const performanceDir = path.resolve(__dirname, '../../data/performance');
      const botFiles = [
        'bot1_performance.json',
        'bot2_performance.json',
        'bot3_performance.json',
        'bot4_performance.json',
        'bot5_performance.json',
      ];

      const realBotData = {};

      botFiles.forEach((file) => {
        const filePath = path.join(performanceDir, file);
        if (fs.existsSync(filePath)) {
          try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const botId = file.replace('_performance.json', '');

            realBotData[botId] = {
              name: this.getBotName(botId),
              strategy: data.strategy || 'unknown',
              riskLevel: data.riskLevel || 'moderate',
              status: 'active',
              portfolioValue:
                data.portfolioHistory.length > 0
                  ? data.portfolioHistory[data.portfolioHistory.length - 1].value
                  : data.initialValue || 0,
              pnl24h:
                data.portfolioHistory.length > 1
                  ? data.portfolioHistory[data.portfolioHistory.length - 1].dailyChangePercent || 0
                  : 0,
              lastRebalance:
                data.portfolioHistory.length > 0
                  ? data.portfolioHistory[data.portfolioHistory.length - 1].timestamp
                  : Date.now(),
              totalTrades: data.transactions ? data.transactions.length : 0,
            };
          } catch (error) {
            console.error(`Error reading ${file}:`, error.message);
          }
        }
      });

      // Send bot status update
      ws.send(
        JSON.stringify({
          type: 'bot_status',
          payload: Object.values(realBotData),
        })
      );

      // Calculate and send performance summary
      const totalValue = Object.values(realBotData).reduce(
        (sum, bot) => sum + (bot.portfolioValue || 0),
        0
      );
      const avgChange24h =
        Object.values(realBotData).reduce((sum, bot) => sum + (bot.pnl24h || 0), 0) /
        Object.keys(realBotData).length;
      const totalTrades = Object.values(realBotData).reduce(
        (sum, bot) => sum + (bot.totalTrades || 0),
        0
      );

      ws.send(
        JSON.stringify({
          type: 'performance',
          payload: {
            totalValue: totalValue,
            activeBots: Object.keys(realBotData).length,
            performance24h: avgChange24h,
            transactionsToday: totalTrades,
          },
        })
      );
    } catch (error) {
      console.error('Error in sendRealTimeUpdate:', error);
      ws.send(
        JSON.stringify({
          type: 'error',
          payload: {
            message: 'Failed to update real-time data',
            error: error.message,
          },
        })
      );
    }
  }

  // WebSocket connection handler
  handleWebSocketConnection(ws) {
    console.log('WebSocket client connected');
    
    // Send initial real-time data
    this.sendRealTimeUpdate(ws);
    
    // Send initial alerts
    this.alertManager.getRecentAlerts().then(alerts => {
      ws.send(JSON.stringify({
        type: 'initial-alerts',
        alerts
      }));
    });

    // Set up periodic updates every 5 seconds
    const updateInterval = setInterval(() => {
      this.sendRealTimeUpdate(ws);
    }, 5000);

    // Handle client disconnection
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      clearInterval(updateInterval);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clearInterval(updateInterval);
    });
  }

  // Helper method to get bot name
  getBotName(botId) {
    const botNames = {
      bot1: 'Conservative Bot',
      bot2: 'Momentum Bot',
      bot3: 'Technical Bot',
      bot4: 'Mean Reversion Bot',
      bot5: 'Breakout Bot',
    };
    return botNames[botId] || `Bot ${botId}`;
  }
}

module.exports = PollenConfigServer;

if (require.main === module) {
  const config = require('../config/web-config.js');
  const configServer = new PollenConfigServer();
  configServer.initialize();
}
