const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { EventEmitter } = require('events');

const dbPath = path.join(__dirname, '../../data/local/pollenos.db');
const db = new sqlite3.Database(dbPath);

class AgentScoring extends EventEmitter {
    constructor(options = {}) {
        super();
        this.initializeTables();
        this.weights = {
            riskAdjustedReturn: 0.2,
            consistency: 0.15,
            strategyAdherence: 0.15,
            transactionEfficiency: 0.1,
            drawdown: 0.1,
            pollenVirtual: 0.3  // 30% weight for Pollen Virtual performance
        };
        
        // Use injected service or require it by default
        this.pollenVirtualService = options.pollenVirtualService || require('../services/pollen-virtual-service');
    }

    initializeTables() {
        db.exec(`
            CREATE TABLE IF NOT EXISTS agent_scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                bot_id INTEGER NOT NULL UNIQUE,
                overall_score DECIMAL(5,2) NOT NULL,
                risk_adjusted_score DECIMAL(5,2) NOT NULL,
                consistency_score DECIMAL(5,2) NOT NULL,
                strategy_score DECIMAL(5,2) NOT NULL,
                efficiency_score DECIMAL(5,2) NOT NULL,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (bot_id) REFERENCES bots(id)
            );
        `);
    }

    async calculateRiskAdjustedScore(returns, riskFreeRate = 0.02) {
        const meanReturn = this.calculateMean(returns);
        const volatility = this.calculateVolatility(returns);
        return (meanReturn - riskFreeRate) / (volatility || 1);
    }

    async calculateConsistencyScore(returns) {
        const positiveReturns = returns.filter(r => r > 0);
        return positiveReturns.length / (returns.length || 1);
    }

    async calculateStrategyAdherence(botId) {
        return new Promise((resolve) => {
            db.get(
                'SELECT strategy_adherence FROM bot_performance WHERE bot_id = ?',
                [botId],
                (err, row) => {
                    if (err || !row) return resolve(0.5); // Default to neutral score
                    resolve(row.strategy_adherence);
                }
            );
        });
    }

    async calculateEfficiencyScore(botId) {
        return new Promise((resolve) => {
            db.get(
                `SELECT 
                    AVG(gas_used) as avg_gas,
                    AVG(execution_time) as avg_time
                FROM transactions 
                WHERE bot_id = ?`,
                [botId],
                (err, row) => {
                    if (err || !row) return resolve(0.5);
                    // Normalize and invert (lower gas and time is better)
                    const gasScore = Math.max(0, 1 - (row.avg_gas / 1000000));
                    const timeScore = Math.max(0, 1 - (row.avg_time / 1000));
                    resolve((gasScore + timeScore) / 2);
                }
            );
        });
    }

    async calculateMaxDrawdown(returns) {
        let peak = -Infinity;
        let maxDrawdown = 0;
        
        for (const ret of returns) {
            if (ret > peak) peak = ret;
            const drawdown = (peak - ret) / peak;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;
        }
        
        return maxDrawdown;
    }

    async updateAgentScore(botId) {
        try {
            // Get historical performance data
            const [returns, pollenVirtualScore] = await Promise.all([
                this.getHistoricalReturns(botId),
                this.getPollenVirtualScore(botId)
            ]);
            
            if (returns.length < 5) return; // Not enough data

            // Calculate component scores
            const riskAdjusted = await this.calculateRiskAdjustedScore(returns);
            const consistency = await this.calculateConsistencyScore(returns);
            const strategyAdherence = await this.calculateStrategyAdherence(botId);
            const efficiency = await this.calculateEfficiencyScore(botId);
            const drawdown = await this.calculateMaxDrawdown(returns);

            // Calculate overall score (0-100 scale)
            const baseScore = (
                (riskAdjusted * this.weights.riskAdjustedReturn) +
                (consistency * this.weights.consistency) +
                (strategyAdherence * this.weights.strategyAdherence) +
                (efficiency * this.weights.transactionEfficiency) +
                ((1 - drawdown) * this.weights.drawdown)
            ) * 0.7; // 70% weight for base metrics
            
            // Add Pollen Virtual score (30% weight)
            const overallScore = Math.min(100, baseScore + (pollenVirtualScore * this.weights.pollenVirtual));

            // Save to database
            db.run(
                `INSERT INTO agent_scores (
                    bot_id, overall_score, risk_adjusted_score, 
                    consistency_score, strategy_score, efficiency_score,
                    pollen_virtual_score, last_virtual_rank
                ) VALUES (?, ?, ?, ?, ?, ?, ?, (
                    SELECT rank FROM pollen_virtual_metrics 
                    WHERE bot_id = ? 
                    ORDER BY timestamp DESC LIMIT 1
                ))
                ON CONFLICT(bot_id) DO UPDATE SET
                    overall_score = excluded.overall_score,
                    risk_adjusted_score = excluded.risk_adjusted_score,
                    consistency_score = excluded.consistency_score,
                    strategy_score = excluded.strategy_score,
                    efficiency_score = excluded.efficiency_score,
                    pollen_virtual_score = excluded.pollen_virtual_score,
                    last_virtual_rank = excluded.last_virtual_rank,
                    last_updated = CURRENT_TIMESTAMP`,
                [botId, overallScore, riskAdjusted * 100, 
                 consistency * 100, strategyAdherence * 100, efficiency * 100,
                 pollenVirtualScore, botId],
                (err) => {
                    if (err) {
                        console.error('Error updating agent score:', err);
                        return;
                    }
                    this.emit('scoreUpdated', { botId, overallScore });
                }
            );
        } catch (error) {
            console.error('Error in updateAgentScore:', error);
        }
    }

    async getPollenVirtualScore(botId) {
        try {
            // Call the Pollen Virtual service to get the score
            return await this.pollenVirtualService.calculateVirtualScore(botId);
        } catch (error) {
            console.error('Error getting Pollen Virtual score:', error);
            return 0; // Default to 0 if there's an error
        }
    }

    async getAgentScores() {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT 
                    b.id as bot_id, 
                    b.name, 
                    s.*,
                    p.rank as current_rank,
                    p.total_participants as total_competitors,
                    p.pnl_30d as pnl_30d,
                    p.sharpe_ratio_30d as sharpe_ratio_30d
                 FROM bots b
                 LEFT JOIN agent_scores s ON b.id = s.bot_id
                 LEFT JOIN (
                     SELECT bot_id, rank, total_participants, pnl_30d, sharpe_ratio_30d
                     FROM pollen_virtual_metrics
                     WHERE (bot_id, timestamp) IN (
                         SELECT bot_id, MAX(timestamp)
                         FROM pollen_virtual_metrics
                         GROUP BY bot_id
                     )
                 ) p ON b.id = p.bot_id
                 ORDER BY s.overall_score DESC`,
                [],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    }

    // Helper methods
    calculateMean(array) {
        return array.reduce((a, b) => a + b, 0) / (array.length || 1);
    }

    calculateVolatility(returns) {
        const mean = this.calculateMean(returns);
        const squaredDiffs = returns.map(r => Math.pow(r - mean, 2));
        return Math.sqrt(this.calculateMean(squaredDiffs));
    }

    async getHistoricalReturns(botId, days = 30) {
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
}

// Export the class for testing and the singleton instance for runtime use
module.exports = {
  AgentScoring,
  agentScoring: new AgentScoring()
};
