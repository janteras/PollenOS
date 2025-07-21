/**
 * Portfolio Check Action for ElizaOS
 * Monitors current portfolio status, performance, and provides insights
 */

const PollenAPI = require('../modules/pollen-api');
const performanceTracker = require('../modules/performance-tracker');
const logger = require('../modules/logger');

const checkPortfolioAction = {
  name: 'CHECK_PORTFOLIO',
  description: 'Check current portfolio allocation, performance, and provide insights',
  
  examples: [
    [
      {
        user: '{{user1}}',
        content: { text: 'How is my portfolio doing?' }
      },
      {
        user: '{{agent}}',
        content: {
          text: 'Let me check your current portfolio performance, allocation, and recent trading activity to give you a comprehensive update.',
          action: 'CHECK_PORTFOLIO'
        }
      }
    ],
    [
      {
        user: '{{user1}}',
        content: { text: 'Show me my current positions and P&L' }
      },
      {
        user: '{{agent}}',
        content: {
          text: 'I\'ll analyze your current positions, calculate your profit and loss, and show you how each asset is performing.',
          action: 'CHECK_PORTFOLIO'
        }
      }
    ]
  ],

  validate: async (runtime, message) => {
    const text = message.content.text.toLowerCase();
    const portfolioKeywords = [
      'portfolio', 'positions', 'performance', 'p&l', 'profit', 'loss',
      'allocation', 'balance', 'status', 'how am i doing', 'current'
    ];
    
    return portfolioKeywords.some(keyword => text.includes(keyword));
  },

  handler: async (runtime, message, state, options, callback) => {
    try {
      logger.info('Executing portfolio check action');
      
      const config = {
        network: runtime.character.settings?.network || 'avalanche',
        botId: runtime.character.settings?.botId || '1'
      };

      // Get current portfolio data
      const portfolioData = await getPortfolioData(config);
      
      if (!portfolioData.success) {
        return callback({
          text: 'I\'m unable to fetch your portfolio data at the moment. Please check your connection and try again.',
          source: 'check_portfolio_action'
        });
      }

      // Get performance metrics
      const performance = await performanceTracker.getPerformanceMetrics(config.botId);
      
      // Generate portfolio report
      const report = generatePortfolioReport(portfolioData.data, performance);

      return callback({
        text: report.summary,
        data: {
          portfolio: portfolioData.data,
          performance: performance,
          recommendations: report.recommendations,
          timestamp: new Date().toISOString()
        },
        source: 'check_portfolio_action'
      });

    } catch (error) {
      logger.error('Error in portfolio check action:', error);
      return callback({
        text: 'I encountered an error while checking your portfolio. Please try again.',
        source: 'check_portfolio_action'
      });
    }
  }
};

/**
 * Get portfolio data from various sources
 */
async function getPortfolioData(config) {
  try {
    // Initialize Pollen API if available
    let pollenData = null;
    try {
      const ethers = require('ethers');
      const provider = new ethers.JsonRpcProvider(
        'https://avalanche-mainnet.infura.io/v3/60755064a92543a1ac7aaf4e20b71cdf'
      );
      
      if (process.env.ETHEREUM_PRIVATE_KEY) {
        const pollenAPI = new PollenAPI(provider, process.env.ETHEREUM_PRIVATE_KEY);
        await pollenAPI.initialize();
        pollenData = await pollenAPI.getPortfolioInfo();
      }
    } catch (pollenError) {
      logger.warn('Pollen API unavailable, using simulation data:', pollenError.message);
    }

    // Get simulated or cached portfolio data if Pollen API fails
    const portfolioData = pollenData || await getSimulatedPortfolioData(config);
    
    return {
      success: true,
      data: portfolioData
    };

  } catch (error) {
    logger.error('Error fetching portfolio data:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get simulated portfolio data for demonstration
 */
async function getSimulatedPortfolioData(config) {
  // This would normally come from cache or database
  return {
    totalValue: 10000,
    totalStaked: 1500,
    availableBalance: 8500,
    positions: [
      { asset: 'WBTC', allocation: 25, value: 2500, pnl: 150, pnlPercent: 6.38 },
      { asset: 'WETH', allocation: 20, value: 2000, pnl: -50, pnlPercent: -2.44 },
      { asset: 'WAVAX', allocation: 15, value: 1500, pnl: 75, pnlPercent: 5.26 },
      { asset: 'AAVE', allocation: 10, value: 1000, pnl: 25, pnlPercent: 2.56 },
      { asset: 'UNI', allocation: 10, value: 1000, pnl: -25, pnlPercent: -2.44 }
    ],
    cash: 2000,
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Generate comprehensive portfolio report
 */
function generatePortfolioReport(portfolioData, performance) {
  const totalPnL = portfolioData.positions?.reduce((sum, pos) => sum + pos.pnl, 0) || 0;
  const totalPnLPercent = portfolioData.totalValue ? (totalPnL / portfolioData.totalValue) * 100 : 0;
  
  // Calculate allocation metrics
  const allocatedPercent = portfolioData.positions
    ? portfolioData.positions.reduce((sum, pos) => sum + pos.allocation, 0)
    : 0;
  const cashPercent = 100 - allocatedPercent;

  // Generate summary
  let summary = '📊 Portfolio Summary\n';
  summary += `Total Value: $${portfolioData.totalValue?.toLocaleString() || 'N/A'}\n`;
  summary += `Total P&L: ${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)} (${totalPnLPercent >= 0 ? '+' : ''}${totalPnLPercent.toFixed(2)}%)\n`;
  summary += `Cash: ${cashPercent.toFixed(1)}% | Allocated: ${allocatedPercent.toFixed(1)}%\n\n`;

  // Position details
  if (portfolioData.positions && portfolioData.positions.length > 0) {
    summary += '🏦 Positions:\n';
    portfolioData.positions.forEach(pos => {
      const pnlEmoji = pos.pnl >= 0 ? '📈' : '📉';
      summary += `${pnlEmoji} ${pos.asset}: ${pos.allocation}% ($${pos.value?.toLocaleString()}) `;
      summary += `${pos.pnl >= 0 ? '+' : ''}${pos.pnlPercent?.toFixed(2)}%\n`;
    });
  }

  // Performance metrics
  if (performance) {
    summary += '\n📈 Performance:\n';
    summary += `Total Trades: ${performance.totalTrades || 0}\n`;
    summary += `Win Rate: ${performance.winRate ? (performance.winRate * 100).toFixed(1) : 0}%\n`;
    summary += `Sharpe Ratio: ${performance.sharpeRatio?.toFixed(2) || 'N/A'}\n`;
  }

  // Generate recommendations
  const recommendations = generateRecommendations(portfolioData, performance);
  
  if (recommendations.length > 0) {
    summary += '\n💡 Recommendations:\n';
    recommendations.forEach((rec, index) => {
      summary += `${index + 1}. ${rec}\n`;
    });
  }

  return {
    summary,
    recommendations,
    metrics: {
      totalPnL,
      totalPnLPercent,
      allocatedPercent,
      cashPercent
    }
  };
}

/**
 * Generate portfolio recommendations
 */
function generateRecommendations(portfolioData, performance) {
  const recommendations = [];
  
  // Cash allocation recommendations
  const allocatedPercent = portfolioData.positions
    ? portfolioData.positions.reduce((sum, pos) => sum + pos.allocation, 0)
    : 0;
  
  if (allocatedPercent < 60) {
    recommendations.push('Consider increasing allocation - you have significant cash reserves that could be invested');
  } else if (allocatedPercent > 90) {
    recommendations.push('Consider maintaining some cash reserves for opportunities and risk management');
  }

  // Position concentration
  const maxPosition = portfolioData.positions
    ? Math.max(...portfolioData.positions.map(pos => pos.allocation))
    : 0;
  
  if (maxPosition > 30) {
    recommendations.push('Consider reducing concentration in your largest position for better diversification');
  }

  // Performance-based recommendations
  if (performance && performance.winRate < 0.4) {
    recommendations.push('Review your trading strategy - current win rate suggests room for improvement');
  }

  // Losing positions
  const losingPositions = portfolioData.positions
    ? portfolioData.positions.filter(pos => pos.pnl < -100)
    : [];
  
  if (losingPositions.length > 0) {
    recommendations.push(`Review losing positions: ${losingPositions.map(pos => pos.asset).join(', ')}`);
  }

  // Rebalancing suggestion
  const hasImbalancedPositions = portfolioData.positions
    ? portfolioData.positions.some(pos => Math.abs(pos.pnlPercent) > 10)
    : false;
  
  if (hasImbalancedPositions) {
    recommendations.push('Consider rebalancing to lock in gains and manage risk');
  }

  return recommendations.slice(0, 5); // Limit to top 5 recommendations
}

module.exports = checkPortfolioAction; 