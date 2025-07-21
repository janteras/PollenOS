require('dotenv').config({ path: require('path').resolve(__dirname, '../base-sepolia.env') });
const express = require('express');
const { ethers } = require('ethers');
const config = require('./config');

class BotMonitor {
  constructor() {
    this.app = express();
    this.provider = new ethers.JsonRpcProvider(config.RPC_URL);
    this.botData = {};
    this.setupServer();
  }

  setupServer() {
    // Middleware
    this.app.use(express.json());
    this.app.use(express.static('public'));
    
    // API Endpoints
    this.app.get('/api/bots', (req, res) => {
      res.json(this.botData);
    });
    
    this.app.get('/api/portfolio', async (req, res) => {
      try {
        const portfolio = await this.getPortfolioData();
        res.json(portfolio);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Serve the dashboard
    this.app.get('/', (req, res) => {
      res.sendFile(__dirname + '/public/index.html');
    });
  }
  
  async updateBotData(botId, data) {
    this.botData[botId] = {
      ...this.botData[botId],
      ...data,
      lastUpdated: new Date().toISOString()
    };
  }
  
  async getPortfolioData() {
    try {
      const portfolio = new ethers.Contract(
        config.CONTRACTS.PORTFOLIO,
        ['function getPortfolioDetails() view returns (address[], uint256[], uint256)'],
        this.provider
      );
      
      const [assets, weights, totalValue] = await portfolio.getPortfolioDetails();
      
      return {
        assets: assets.map((a, i) => ({
          address: a,
          weight: weights[i],
          percentage: weights[i] / 100 // Assuming weights are in basis points
        })),
        totalValue: ethers.formatEther(totalValue),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching portfolio data:', error);
      throw error;
    }
  }
  
  start(port = 3000) {
    this.server = this.app.listen(port, () => {
      console.log(`Monitor dashboard running on http://localhost:${port}`);
    });
    
    // Periodically update portfolio data
    this.updateInterval = setInterval(async () => {
      try {
        const portfolioData = await this.getPortfolioData();
        this.portfolioData = portfolioData;
      } catch (error) {
        console.error('Error updating portfolio data:', error);
      }
    }, 60000); // Update every minute
  }
  
  stop() {
    if (this.server) {
      clearInterval(this.updateInterval);
      this.server.close();
      console.log('Monitor dashboard stopped');
    }
  }
}

// Create a simple HTML dashboard
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir);
}

// Create a basic HTML dashboard
fs.writeFileSync(
  path.join(publicDir, 'index.html'),
  `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pollen Trading Bots Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; }
    .dashboard { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
    .card { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .card h2 { margin-top: 0; color: #333; }
    .bot-status { margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #eee; }
    .status-online { color: green; }
    .status-offline { color: red; }
    canvas { width: 100% !important; height: 300px !important; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Pollen Trading Bots Dashboard</h1>
    
    <div class="dashboard">
      <div class="card">
        <h2>Bot Status</h2>
        <div id="bot-status"></div>
      </div>
      
      <div class="card">
        <h2>Portfolio Allocation</h2>
        <canvas id="portfolio-chart"></canvas>
      </div>
      
      <div class="card">
        <h2>Performance</h2>
        <canvas id="performance-chart"></canvas>
      </div>
    </div>
  </div>

  <script>
    // Update bot status
    async function updateBotStatus() {
      try {
        const response = await axios.get('/api/bots');
        const bots = response.data;
        const statusDiv = document.getElementById('bot-status');
        statusDiv.innerHTML = '';
        
        for (const [id, bot] of Object.entries(bots)) {
          const botDiv = document.createElement('div');
          botDiv.className = 'bot-status';
          botDiv.innerHTML = `
            <h3>Bot ${id} - ${bot.strategy || 'N/A'}</h3>
            <p>Status: <span class="status-${bot.isRunning ? 'online' : 'offline'}">
              ${bot.isRunning ? 'Online' : 'Offline'}
            </span></p>
            <p>Last Action: ${bot.lastAction || 'N/A'}</p>
            <p>Staked: ${bot.staked || '0'} PLN</p>
          `;
          statusDiv.appendChild(botDiv);
        }
      } catch (error) {
        console.error('Error updating bot status:', error);
      }
    }
    
    // Initialize charts
    let portfolioChart, performanceChart;
    
    function initCharts() {
      // Portfolio Allocation Chart
      const portfolioCtx = document.getElementById('portfolio-chart').getContext('2d');
      portfolioChart = new Chart(portfolioCtx, {
        type: 'doughnut',
        data: {
          labels: ['WETH', 'USDC', 'DAI', 'WBTC'],
          datasets: [{
            data: [40, 30, 20, 10],
            backgroundColor: ['#627EEA', '#2775CA', '#F5AC37', '#F7931A']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false
        }
      });
      
      // Performance Chart
      const perfCtx = document.getElementById('performance-chart').getContext('2d');
      performanceChart = new Chart(perfCtx, {
        type: 'line',
        data: {
          labels: Array(24).fill().map((_, i) => `${i}:00`),
          datasets: [{
            label: 'Portfolio Value (ETH)',
            data: Array(24).fill().map(() => Math.random() * 10 + 5),
            borderColor: '#627EEA',
            tension: 0.1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: false
            }
          }
        }
      });
    }
    
    // Update charts with real data
    async function updateCharts() {
      try {
        // Update portfolio allocation
        const portfolioRes = await axios.get('/api/portfolio');
        const portfolioData = portfolioRes.data;
        
        if (portfolioData.assets) {
          portfolioChart.data.datasets[0].data = portfolioData.assets.map(a => a.percentage);
          portfolioChart.update();
        }
        
        // In a real app, you would update performance data here
        
      } catch (error) {
        console.error('Error updating charts:', error);
      }
    }
    
    // Initialize the dashboard
    document.addEventListener('DOMContentLoaded', () => {
      initCharts();
      updateBotStatus();
      updateCharts();
      
      // Update data every 30 seconds
      setInterval(updateBotStatus, 30000);
      setInterval(updateCharts, 30000);
    });
  </script>
</body>
</html>`
);

// Start the monitor if this file is run directly
if (require.main === module) {
  const monitor = new BotMonitor();
  monitor.start(3000);
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('Shutting down monitor...');
    monitor.stop();
    process.exit(0);
  });
}

module.exports = { BotMonitor };
