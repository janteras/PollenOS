
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3001;

// Performance data directory
const PERFORMANCE_DIR = path.resolve(__dirname, '../data/performance');

app.get('/dashboard', (req, res) => {
  try {
    const performanceFiles = fs.readdirSync(PERFORMANCE_DIR)
      .filter(file => file.endsWith('_performance.json'));
    
    const botPerformance = {};
    
    performanceFiles.forEach(file => {
      const data = JSON.parse(fs.readFileSync(path.join(PERFORMANCE_DIR, file), 'utf8'));
      const botId = data.botId;
      
      botPerformance[botId] = {
        strategy: data.strategy,
        totalReturn: data.overallStats.totalReturn,
        totalTrades: data.transactions.length,
        currentValue: data.portfolioHistory.length > 0 
          ? data.portfolioHistory[data.portfolioHistory.length - 1].value 
          : 0,
        lastUpdate: data.portfolioHistory.length > 0 
          ? new Date(data.portfolioHistory[data.portfolioHistory.length - 1].timestamp).toISOString()
          : 'Never'
      };
    });
    
    res.json({
      timestamp: new Date().toISOString(),
      totalBots: Object.keys(botPerformance).length,
      bots: botPerformance
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Performance dashboard running on port ${PORT}`);
  });
}

module.exports = app;
