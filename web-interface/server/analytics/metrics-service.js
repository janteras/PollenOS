const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { EventEmitter } = require('events');

class MetricsService extends EventEmitter {
  constructor(dbPath) {
    super();
    this.db = new sqlite3.Database(dbPath);
  }

  /**
   * Calculate win/loss ratio for a bot
   * @param {number} botId - The ID of the bot
   * @returns {Promise<number>} Win/loss ratio
   */
  async calculateWinLossRatio(botId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT 
          SUM(CASE WHEN profit_loss > 0 THEN 1 ELSE 0 END) as wins,
          SUM(CASE WHEN profit_loss < 0 THEN 1 ELSE 0 END) as losses
        FROM trade_history 
        WHERE bot_id = ? AND status = 'closed'`,
        [botId],
        (err, row) => {
          if (err) return reject(err);
          
          const wins = row?.wins || 0;
          const losses = row?.losses || 0;
          
          if (losses === 0) {
            resolve(wins > 0 ? wins : 0);
          } else {
            resolve(wins / losses);
          }
        }
      );
    });
  }

  /**
   * Calculate risk-adjusted metrics (Sharpe and Sortino ratios)
   * @param {number} botId - The ID of the bot
   * @param {number} riskFreeRate - Annual risk-free rate (default: 2%)
   * @returns {Promise<Object>} Object containing risk metrics
   */
  async calculateRiskAdjustedMetrics(botId, riskFreeRate = 0.02) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT daily_return FROM bot_returns WHERE bot_id = ? ORDER BY date`,
        [botId],
        async (err, rows) => {
          if (err) return reject(err);
          
          if (!rows || rows.length === 0) {
            return resolve({
              sharpeRatio: 0,
              sortinoRatio: 0,
              maxDrawdown: 0,
              volatility: 0
            });
          }
          
          const returns = rows.map(r => r.daily_return);
          const metrics = await this.calculateReturnMetrics(returns, riskFreeRate);
          resolve(metrics);
        }
      );
    });
  }

  /**
   * Calculate return metrics from an array of returns
   * @private
   */
  async calculateReturnMetrics(returns, riskFreeRate) {
    if (!returns || returns.length === 0) {
      return {
        sharpeRatio: 0,
        sortinoRatio: 0,
        maxDrawdown: 0,
        volatility: 0
      };
    }

    const dailyRiskFreeRate = Math.pow(1 + riskFreeRate, 1/365) - 1;
    const excessReturns = returns.map(r => r - dailyRiskFreeRate);
    const downsideReturns = returns.filter(r => r < 0);
    
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);
    
    const downsideVariance = downsideReturns.length > 0 
      ? downsideReturns.reduce((a, b) => a + Math.pow(b, 2), 0) / returns.length
      : 0;
    
    const sharpeRatio = volatility > 0 
      ? (Math.sqrt(252) * (meanReturn - dailyRiskFreeRate)) / volatility 
      : 0;
      
    const sortinoRatio = Math.sqrt(downsideVariance) > 0
      ? (Math.sqrt(252) * (meanReturn - dailyRiskFreeRate)) / Math.sqrt(downsideVariance)
      : 0;
    
    // Calculate max drawdown
    let peak = -Infinity;
    let maxDrawdown = 0;
    
    for (const ret of returns) {
      if (ret > peak) peak = ret;
      const drawdown = (peak - ret) / (1 + peak); // Using 1 + peak to handle negative returns
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
    
    return {
      sharpeRatio,
      sortinoRatio,
      maxDrawdown,
      volatility: volatility * Math.sqrt(252) // Annualized volatility
    };
  }

  /**
   * Record a new trade execution
   * @param {Object} trade - Trade object
   * @returns {Promise<Object>} Recorded trade metrics
   */
  async recordTradeExecution(trade) {
    return new Promise((resolve, reject) => {
      const metrics = {
        bot_id: trade.botId,
        slippage: this.calculateSlippage(trade),
        fill_rate: trade.filledQuantity / trade.quantity,
        execution_time_ms: trade.executionTime,
        trade_size_usd: trade.quantity * trade.avgFillPrice,
        trade_id: trade.id,
        status: trade.status || 'filled'
      };

      this.db.run(
        `INSERT INTO trade_execution_metrics 
         (bot_id, slippage, fill_rate, execution_time_ms, trade_size_usd, trade_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          metrics.bot_id, 
          metrics.slippage, 
          metrics.fill_rate, 
          metrics.execution_time_ms, 
          metrics.trade_size_usd,
          metrics.trade_id,
          metrics.status
        ],
        function(err) {
          if (err) return reject(err);
          
          // Update trade history if this is a closing trade
          if (trade.closePosition) {
            this.updateTradeHistory(trade).catch(console.error);
          }
          
          resolve({
            id: this.lastID,
            ...metrics
          });
        }
      );
    });
  }

  /**
   * Calculate slippage for a trade
   * @private
   */
  calculateSlippage(trade) {
    if (!trade.expectedPrice) return 0;
    return Math.abs((trade.avgFillPrice - trade.expectedPrice) / trade.expectedPrice);
  }

  /**
   * Update trade history with closing information
   * @private
   */
  async updateTradeHistory(trade) {
    return new Promise((resolve, reject) => {
      // Find the corresponding open trade
      this.db.get(
        `SELECT * FROM trade_history 
         WHERE bot_id = ? AND symbol = ? AND status = 'open' 
         ORDER BY timestamp ASC LIMIT 1`,
        [trade.botId, trade.symbol],
        (err, openTrade) => {
          if (err || !openTrade) return resolve(null);
          
          const profitLoss = this.calculateProfitLoss(openTrade, trade);
          
          this.db.run(
            `UPDATE trade_history 
             SET status = 'closed', 
                 close_price = ?,
                 close_time = ?,
                 profit_loss = ?
             WHERE id = ?`,
            [trade.avgFillPrice, new Date().toISOString(), profitLoss, openTrade.id],
            (err) => {
              if (err) return reject(err);
              resolve();
            }
          );
        }
      );
    });
  }

  /**
   * Calculate profit/loss for a closed trade
   * @private
   */
  calculateProfitLoss(openTrade, closeTrade) {
    const openValue = openTrade.price * openTrade.quantity;
    const closeValue = closeTrade.avgFillPrice * openTrade.quantity; // Use original quantity
    const fees = (openTrade.fee || 0) + (closeTrade.fee || 0);
    
    if (openTrade.side === 'buy') {
      return closeValue - openValue - fees;
    } else {
      return openValue - closeValue - fees;
    }
  }

  /**
   * Get execution quality metrics for a bot
   * @param {number} botId - The ID of the bot
   * @param {string} period - Time period (e.g., '30d', '7d', '24h')
   * @returns {Promise<Object>} Execution quality metrics
   */
  async getExecutionQuality(botId, period = '30d') {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT 
          AVG(slippage) as avg_slippage,
          AVG(fill_rate) as avg_fill_rate,
          AVG(execution_time_ms) as avg_execution_time,
          COUNT(*) as total_trades,
          SUM(CASE WHEN status = 'filled' THEN 1 ELSE 0) as filled_trades,
          SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0) as rejected_trades,
          AVG(trade_size_usd) as avg_trade_size
        FROM trade_execution_metrics
        WHERE bot_id = ?
        AND timestamp >= datetime('now', ?)`,
        [botId, `-${period}`],
        (err, row) => {
          if (err) return reject(err);
          
          resolve({
            avgSlippage: row?.avg_slippage || 0,
            avgFillRate: row?.avg_fill_rate || 0,
            avgExecutionTime: row?.avg_execution_time || 0,
            totalTrades: row?.total_trades || 0,
            filledTrades: row?.filled_trades || 0,
            rejectedTrades: row?.rejected_trades || 0,
            fillRate: row?.total_trades > 0 
              ? (row.filled_trades / row.total_trades) * 100 
              : 0,
            avgTradeSize: row?.avg_trade_size || 0
          });
        }
      );
    });
  }
}

// Create a singleton instance
const dbPath = process.env.SQLITE_PATH || path.join(__dirname, '../../data/local/pollenos.db');
const metricsService = new MetricsService(dbPath);

module.exports = metricsService;
