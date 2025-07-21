const { performance } = require('perf_hooks');
const priceFeed = require('./price-feed');
const analyticsEngine = require('./analytics-engine');
const localStorage = require('./local-storage');

class VisualizationService {
  constructor() {
    this.charts = new Map();
    this.updates = new Map();
    this.setupWebSocket();
  }

  setupWebSocket() {
    // Create WebSocket server for real-time updates
    const WebSocket = require('ws');
    const wss = new WebSocket.Server({ noServer: true });
    
    wss.on('connection', (ws) => {
      console.log('New visualization client connected');
      
      ws.on('message', (data) => {
        const message = JSON.parse(data);
        this.handleClientMessage(ws, message);
      });
      
      ws.on('close', () => {
        console.log('Visualization client disconnected');
      });
    });

    // Add to config server
    const configServer = require('./config-server');
    configServer.server.on('upgrade', (request, socket, head) => {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    });
  }

  handleClientMessage(ws, message) {
    switch (message.type) {
      case 'subscribe':
        this.handleSubscribe(ws, message.data);
        break;
      case 'unsubscribe':
        this.handleUnsubscribe(ws, message.data);
        break;
      case 'request_chart_data':
        this.handleChartDataRequest(ws, message.data);
        break;
      case 'request_performance':
        this.handlePerformanceRequest(ws, message.data);
        break;
    }
  }

  handleSubscribe(ws, data) {
    const { chartId, symbols, timeframe } = data;
    
    if (!this.charts.has(chartId)) {
      this.charts.set(chartId, {
        ws,
        symbols,
        timeframe,
        lastUpdate: 0
      });
      
      // Send initial data
      this.sendChartData(ws, chartId);
    }
  }

  handleUnsubscribe(ws, chartId) {
    this.charts.delete(chartId);
  }

  handleChartDataRequest(ws, data) {
    const { chartId, symbols, timeframe, lookback } = data;
    
    if (this.charts.has(chartId)) {
      const chart = this.charts.get(chartId);
      chart.symbols = symbols;
      chart.timeframe = timeframe;
      
      this.sendChartData(ws, chartId, lookback);
    }
  }

  handlePerformanceRequest(ws, data) {
    const { botId, timeframe } = data;
    
    this.sendPerformanceData(ws, botId, timeframe);
  }

  sendChartData(ws, chartId, lookback = 100) {
    const chart = this.charts.get(chartId);
    if (!chart) return;
    
    const data = {};
    chart.symbols.forEach(symbol => {
      const history = priceFeed.getPriceHistory(symbol, lookback);
      const marketData = priceFeed.getMarketData(symbol);
      
      data[symbol] = {
        prices: history.map(h => h.price),
        timestamps: history.map(h => h.timestamp),
        volume: history.map(h => h.volume),
        volatility: marketData.volatility,
        liquidity: marketData.liquidity
      };
    });
    
    ws.send(JSON.stringify({
      type: 'chart_data',
      data: {
        chartId,
        timeframe: chart.timeframe,
        data
      }
    }));
  }

  sendPerformanceData(ws, botId, timeframe) {
    analyticsEngine.calculatePerformanceMetrics(botId).then(metrics => {
      ws.send(JSON.stringify({
        type: 'performance_data',
        data: {
          botId,
          timeframe,
          metrics
        }
      }));
    }).catch(error => {
      console.error('Error calculating performance:', error);
      ws.send(JSON.stringify({
        type: 'error',
        data: {
          error: 'Failed to calculate performance metrics'
        }
      }));
    });
  }

  createChartConfig() {
    return {
      type: 'line',
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'hour',
              displayFormats: {
                hour: 'HH:mm'
              }
            }
          },
          y: {
            beginAtZero: false
          }
        },
        plugins: {
          legend: {
            position: 'top'
          },
          tooltip: {
            mode: 'index',
            intersect: false
          }
        }
      }
    };
  }

  createPerformanceChartConfig() {
    return {
      type: 'bar',
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true
          }
        },
        plugins: {
          legend: {
            position: 'top'
          },
          tooltip: {
            mode: 'index',
            intersect: false
          }
        }
      }
    };
  }

  createRiskChartConfig() {
    return {
      type: 'radar',
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            beginAtZero: true
          }
        },
        plugins: {
          legend: {
            position: 'top'
          },
          tooltip: {
            mode: 'index',
            intersect: false
          }
        }
      }
    };
  }

  createHeatmapConfig() {
    return {
      type: 'heatmap',
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: 'category'
          },
          y: {
            type: 'category'
          }
        },
        plugins: {
          legend: {
            position: 'top'
          },
          tooltip: {
            mode: 'index',
            intersect: false
          }
        }
      }
    };
  }

  createCorrelationMatrix(symbols) {
    const matrix = {};
    symbols.forEach(symbol1 => {
      matrix[symbol1] = {};
      symbols.forEach(symbol2 => {
        matrix[symbol1][symbol2] = priceFeed.getCorrelation(symbol1, symbol2);
      });
    });
    return matrix;
  }

  createVolatilityHeatmap(symbols) {
    const heatmap = {};
    symbols.forEach(symbol => {
      heatmap[symbol] = {
        volatility: priceFeed.getVolatility(symbol),
        liquidity: priceFeed.getMarketData(symbol).liquidity
      };
    });
    return heatmap;
  }

  createPortfolioAllocationChart(data) {
    const labels = Object.keys(data);
    const values = Object.values(data);
    
    return {
      labels,
      datasets: [{
        data: values,
        backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'],
        borderWidth: 1
      }]
    };
  }
}

module.exports = new VisualizationService();
