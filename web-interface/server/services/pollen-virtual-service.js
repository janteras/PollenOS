const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { EventEmitter } = require('events');
const axios = require('axios');

const dbPath = path.join(__dirname, '../../data/local/pollenos.db');
const db = new sqlite3.Database(dbPath);

class PollenVirtualService extends EventEmitter {
    constructor() {
        super();
        this.baseUrl = 'https://api.pollen.virtual';
        this.apiKey = process.env.POLLEN_VIRTUAL_API_KEY;
    }

    async fetchBotPerformance(botId) {
        try {
            const response = await axios.get(`${this.baseUrl}/api/v1/bots/${botId}/performance`, {
                headers: { 'Authorization': `Bearer ${this.apiKey}` }
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching Pollen Virtual performance:', error);
            throw error;
        }
    }

    async updateBotMetrics(botId) {
        try {
            const performance = await this.fetchBotPerformance(botId);
            await this.saveMetrics(botId, performance);
            this.emit('metricsUpdated', { botId, metrics: performance });
            return performance;
        } catch (error) {
            console.error('Error updating bot metrics:', error);
            throw error;
        }
    }

    async saveMetrics(botId, metrics) {
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO pollen_virtual_metrics (
                    bot_id, competition_id, rank, total_participants,
                    pnl_30d, sharpe_ratio_30d, max_drawdown_30d,
                    win_rate_30d, risk_adjusted_return_30d
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(bot_id, competition_id) DO UPDATE SET
                    rank = excluded.rank,
                    total_participants = excluded.total_participants,
                    pnl_30d = excluded.pnl_30d,
                    sharpe_ratio_30d = excluded.sharpe_ratio_30d,
                    max_drawdown_30d = excluded.max_drawdown_30d,
                    win_rate_30d = excluded.win_rate_30d,
                    risk_adjusted_return_30d = excluded.risk_adjusted_return_30d,
                    timestamp = CURRENT_TIMESTAMP`,
                [
                    botId,
                    metrics.competitionId,
                    metrics.rank,
                    metrics.totalParticipants,
                    metrics.pnl30d,
                    metrics.sharpeRatio30d,
                    metrics.maxDrawdown30d,
                    metrics.winRate30d,
                    metrics.riskAdjustedReturn30d
                ],
                function(err) {
                    if (err) return reject(err);
                    resolve(this.lastID);
                }
            );
        });
    }

    async getBotRank(botId) {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT rank, total_participants as totalParticipants
                 FROM pollen_virtual_metrics
                 WHERE bot_id = ?
                 ORDER BY timestamp DESC
                 LIMIT 1`,
                [botId],
                (err, row) => {
                    if (err) return reject(err);
                    resolve(row || null);
                }
            );
        });
    }

    async getHistoricalPerformance(botId, days = 30) {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT 
                    timestamp,
                    pnl_30d as pnl,
                    sharpe_ratio_30d as sharpeRatio,
                    max_drawdown_30d as maxDrawdown,
                    win_rate_30d as winRate,
                    rank,
                    total_participants as totalParticipants
                FROM pollen_virtual_metrics
                WHERE bot_id = ?
                AND timestamp >= date('now', ? || ' days')
                ORDER BY timestamp`,
                [botId, -days],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                }
            );
        });
    }

    async calculateVirtualScore(botId) {
        try {
            const [rank, performance] = await Promise.all([
                this.getBotRank(botId),
                this.getHistoricalPerformance(botId, 90) // Last 90 days
            ]);

            if (!rank || performance.length === 0) {
                return 0; // No data available
            }

            // Calculate weighted score (0-100)
            const rankScore = (1 - (rank.rank / rank.totalParticipants)) * 40; // 40% weight
            
            const avgSharpe = performance.reduce((sum, p) => sum + p.sharpeRatio, 0) / performance.length;
            const sharpeScore = Math.min(avgSharpe * 10, 30); // Max 30 points
            
            const avgWinRate = performance.reduce((sum, p) => sum + p.winRate, 0) / performance.length;
            const winRateScore = (avgWinRate - 0.5) * 40; // 0.5 win rate = 0, 1.0 = 20
            
            const avgDrawdown = performance.reduce((sum, p) => sum + p.maxDrawdown, 0) / performance.length;
            const drawdownScore = (1 - Math.min(avgDrawdown / 0.5, 1)) * 30; // 50% drawdown = 0, 0% = 30

            const totalScore = rankScore + sharpeScore + winRateScore + drawdownScore;
            return Math.max(0, Math.min(100, totalScore)); // Ensure score is between 0-100
        } catch (error) {
            console.error('Error calculating virtual score:', error);
            return 0;
        }
    }
}

module.exports = new PollenVirtualService();
