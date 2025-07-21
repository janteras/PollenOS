const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { EventEmitter } = require('events');

const dbPath = path.join(__dirname, '../../data/local/pollenos.db');
const db = new sqlite3.Database(dbPath);

class ValidationFramework extends EventEmitter {
    constructor() {
        super();
        this.initializeTables();
        this.thresholds = {
            minSharpeRatio: 1.0,
            maxDrawdown: 0.2,
            minWinRate: 0.55,
            minTrades: 30,
            minDays: 30
        };
    }

    initializeTables() {
        db.exec(`
            CREATE TABLE IF NOT EXISTS validation_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                bot_id INTEGER NOT NULL,
                validation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_passed BOOLEAN NOT NULL,
                score DECIMAL(5,2) NOT NULL,
                metrics TEXT NOT NULL,
                recommendations TEXT,
                FOREIGN KEY (bot_id) REFERENCES bots(id),
                UNIQUE(bot_id, validation_date)
            );
        `);
    }

    async runValidation(botId) {
        try {
            const metrics = await this.calculateMetrics(botId);
            const results = this.evaluateMetrics(metrics);
            const validationResult = {
                isPassed: results.every(r => r.passed),
                score: this.calculateOverallScore(metrics),
                metrics,
                failedTests: results.filter(r => !r.passed).map(r => r.test)
            };

            await this.saveResults(botId, validationResult);
            this.emit('validationComplete', { botId, ...validationResult });
            
            return validationResult;
        } catch (error) {
            console.error('Error in runValidation:', error);
            throw error;
        }
    }

    async calculateMetrics(botId) {
        const [returns, trades, performance] = await Promise.all([
            this.getHistoricalReturns(botId, this.thresholds.minDays),
            this.getTradeStats(botId),
            this.getPerformanceMetrics(botId)
        ]);

        const sharpeRatio = await this.calculateSharpeRatio(returns);
        const maxDrawdown = await this.calculateMaxDrawdown(returns);
        const winRate = trades.total > 0 ? trades.wins / trades.total : 0;

        return {
            sharpeRatio,
            maxDrawdown,
            winRate,
            totalTrades: trades.total,
            daysTracked: returns.length,
            avgReturn: this.calculateMean(returns),
            ...performance
        };
    }

    evaluateMetrics(metrics) {
        return [
            {
                test: 'sharpe_ratio',
                passed: metrics.sharpeRatio >= this.thresholds.minSharpeRatio,
                actual: metrics.sharpeRatio,
                threshold: this.thresholds.minSharpeRatio
            },
            {
                test: 'max_drawdown',
                passed: metrics.maxDrawdown <= this.thresholds.maxDrawdown,
                actual: metrics.maxDrawdown,
                threshold: this.thresholds.maxDrawdown
            },
            {
                test: 'win_rate',
                passed: metrics.winRate >= this.thresholds.minWinRate,
                actual: metrics.winRate,
                threshold: this.thresholds.minWinRate
            },
            {
                test: 'min_trades',
                passed: metrics.totalTrades >= this.thresholds.minTrades,
                actual: metrics.totalTrades,
                threshold: this.thresholds.minTrades
            },
            {
                test: 'min_days',
                passed: metrics.daysTracked >= this.thresholds.minDays,
                actual: metrics.daysTracked,
                threshold: this.thresholds.minDays
            }
        ];
    }

    calculateOverallScore(metrics) {
        // Simple weighted average for demonstration
        // In production, you might want a more sophisticated scoring algorithm
        const weights = {
            sharpeRatio: 0.3,
            maxDrawdown: 0.25,
            winRate: 0.25,
            totalTrades: 0.1,
            daysTracked: 0.1
        };

        const normalizedScores = {
            sharpeRatio: Math.min(metrics.sharpeRatio / 2, 1), // Cap at 2.0
            maxDrawdown: 1 - Math.min(metrics.maxDrawdown / 0.5, 1), // Cap at 50% drawdown
            winRate: metrics.winRate,
            totalTrades: Math.min(metrics.totalTrades / 100, 1), // Cap at 100 trades
            daysTracked: Math.min(metrics.daysTracked / 90, 1) // Cap at 90 days
        };

        return Object.entries(weights).reduce((score, [metric, weight]) => {
            return score + (normalizedScores[metric] * weight * 100);
        }, 0);
    }

    async getValidationHistory(botId, limit = 10) {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM validation_results 
                 WHERE bot_id = ? 
                 ORDER BY validation_date DESC 
                 LIMIT ?`,
                [botId, limit],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    }

    // Helper methods
    async calculateSharpeRatio(returns, riskFreeRate = 0.02) {
        const meanReturn = this.calculateMean(returns);
        const volatility = this.calculateVolatility(returns);
        return (meanReturn - riskFreeRate) / (volatility || 1);
    }

    async calculateMaxDrawdown(returns) {
        let peak = -Infinity;
        let maxDrawdown = 0;
        
        for (const ret of returns) {
            if (ret > peak) peak = ret;
            const drawdown = (peak - ret) / (peak || 1);
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;
        }
        
        return maxDrawdown;
    }

    async getHistoricalReturns(botId, days) {
        return new Promise((resolve) => {
            db.all(
                `SELECT daily_return 
                 FROM bot_returns 
                 WHERE bot_id = ? 
                 AND date >= date('now', ? || ' days')
                 ORDER BY date`,
                [botId, -days],
                (err, rows) => {
                    if (err || !rows) return resolve([]);
                    resolve(rows.map(r => r.daily_return));
                }
            );
        });
    }

    async getTradeStats(botId) {
        return new Promise((resolve) => {
            db.get(
                `SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN profit > 0 THEN 1 ELSE 0 END) as wins
                FROM trades 
                WHERE bot_id = ?`,
                [botId],
                (err, row) => {
                    if (err || !row) return resolve({ total: 0, wins: 0 });
                    resolve(row);
                }
            );
        });
    }

    async getPerformanceMetrics(botId) {
        return new Promise((resolve) => {
            db.get(
                `SELECT 
                    strategy_adherence,
                    avg_execution_time as avgExecutionTime,
                    avg_slippage as avgSlippage
                FROM bot_performance 
                WHERE bot_id = ?`,
                [botId],
                (err, row) => {
                    if (err || !row) return resolve({});
                    resolve(row);
                }
            );
        });
    }

    async saveResults(botId, result) {
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO validation_results (
                    bot_id, is_passed, score, metrics, recommendations
                ) VALUES (?, ?, ?, ?, ?)`,
                [
                    botId,
                    result.isPassed,
                    result.score,
                    JSON.stringify(result.metrics),
                    result.failedTests.length > 0 
                        ? `Failed tests: ${result.failedTests.join(', ')}`
                        : 'All validation tests passed'
                ],
                function(err) {
                    if (err) return reject(err);
                    resolve(this.lastID);
                }
            );
        });
    }

    calculateMean(array) {
        if (!array.length) return 0;
        return array.reduce((a, b) => a + b, 0) / array.length;
    }

    calculateVolatility(returns) {
        if (returns.length < 2) return 0;
        const mean = this.calculateMean(returns);
        const squaredDiffs = returns.map(r => Math.pow(r - mean, 2));
        return Math.sqrt(this.calculateMean(squaredDiffs));
    }
}

module.exports = new ValidationFramework();
