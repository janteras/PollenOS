const sqlite3 = require('sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/local/pollenos.db');
const db = new sqlite3.Database(dbPath);

class PerformanceBenchmark {
    constructor() {
        this.initializeTables();
    }

    initializeTables() {
        db.exec(`
            CREATE TABLE IF NOT EXISTS performance_benchmarks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                bot_id INTEGER NOT NULL,
                benchmark_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                benchmark_type TEXT NOT NULL,
                performance_metrics TEXT NOT NULL,
                FOREIGN KEY (bot_id) REFERENCES bot_configurations(id)
            );

            CREATE TABLE IF NOT EXISTS benchmark_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                benchmark_id INTEGER NOT NULL,
                metric_name TEXT NOT NULL,
                value DECIMAL(20,8),
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (benchmark_id) REFERENCES performance_benchmarks(id)
            );
        `);
    }

    async calculateSharpeRatio(returns, riskFreeRate = 0.02) {
        const meanReturn = this.calculateMean(returns);
        const volatility = this.calculateVolatility(returns);
        return (meanReturn - riskFreeRate) / volatility;
    }

    async calculateAlphaBeta(returns, benchmarkReturns) {
        const [alpha, beta] = this.calculateLinearRegression(returns, benchmarkReturns);
        return { alpha, beta };
    }

    async calculatePerformanceMetrics(botId, returns, benchmarkReturns) {
        try {
            const metrics = {
                sharpeRatio: await this.calculateSharpeRatio(returns),
                alphaBeta: await this.calculateAlphaBeta(returns, benchmarkReturns),
                volatility: this.calculateVolatility(returns),
                maxDrawdown: this.calculateMaxDrawdown(returns),
                correlation: this.calculateCorrelation(returns, benchmarkReturns)
            };

            await this.savePerformanceMetrics(botId, metrics);
            return metrics;
        } catch (error) {
            console.error('Performance calculation failed:', error);
            throw error;
        }
    }

    calculateMean(values) {
        return values.reduce((a, b) => a + b, 0) / values.length;
    }

    calculateVolatility(values) {
        const mean = this.calculateMean(values);
        const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
        return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
    }

    calculateMaxDrawdown(values) {
        let max = values[0];
        let maxDrawdown = 0;
        
        for (let i = 1; i < values.length; i++) {
            if (values[i] > max) {
                max = values[i];
            } else {
                const drawdown = (max - values[i]) / max;
                maxDrawdown = Math.max(maxDrawdown, drawdown);
            }
        }
        
        return maxDrawdown;
    }

    calculateCorrelation(values1, values2) {
        const mean1 = this.calculateMean(values1);
        const mean2 = this.calculateMean(values2);
        
        const covariance = values1.reduce((sum, val1, i) => {
            return sum + (val1 - mean1) * (values2[i] - mean2);
        }, 0) / values1.length;
        
        const stdDev1 = this.calculateVolatility(values1);
        const stdDev2 = this.calculateVolatility(values2);
        
        return covariance / (stdDev1 * stdDev2);
    }

    calculateLinearRegression(values1, values2) {
        const n = values1.length;
        const sumX = values1.reduce((a, b) => a + b, 0);
        const sumY = values2.reduce((a, b) => a + b, 0);
        const sumXY = values1.reduce((sum, val1, i) => sum + val1 * values2[i], 0);
        const sumX2 = values1.reduce((sum, val) => sum + Math.pow(val, 2), 0);
        
        const beta = (n * sumXY - sumX * sumY) / (n * sumX2 - Math.pow(sumX, 2));
        const alpha = (sumY - beta * sumX) / n;
        
        return [alpha, beta];
    }

    async savePerformanceMetrics(botId, metrics) {
        const benchmarkStmt = db.prepare(`
            INSERT INTO performance_benchmarks (
                bot_id, benchmark_type, performance_metrics
            ) VALUES (?, ?, ?)
        `);
        
        const benchmarkId = await benchmarkStmt.run(
            botId,
            'daily',
            JSON.stringify(metrics)
        ).lastID;

        const metricsStmt = db.prepare(`
            INSERT INTO benchmark_metrics (
                benchmark_id, metric_name, value
            ) VALUES (?, ?, ?)
        `);

        await Promise.all(Object.entries(metrics).map(([name, value]) =>
            metricsStmt.run(benchmarkId, name, value)
        ));
    }

    async getLatestMetrics(botId) {
        return db.prepare(`
            SELECT * FROM performance_benchmarks 
            WHERE bot_id = ? 
            ORDER BY benchmark_date DESC 
            LIMIT 1
        `).get(botId);
    }

    async getMetricHistory(botId, metricName) {
        return db.prepare(`
            SELECT m.timestamp, m.value 
            FROM benchmark_metrics m
            JOIN performance_benchmarks b ON m.benchmark_id = b.id
            WHERE b.bot_id = ? AND m.metric_name = ?
            ORDER BY m.timestamp DESC
            LIMIT 30
        `).all(botId, metricName);
    }
}

module.exports = new PerformanceBenchmark();
