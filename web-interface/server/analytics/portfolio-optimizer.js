const sqlite3 = require('sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/local/pollenos.db');
const db = new sqlite3.Database(dbPath);

class PortfolioOptimizer {
    constructor() {
        this.initializeTables();
    }

    initializeTables() {
        db.exec(`
            CREATE TABLE IF NOT EXISTS portfolio_optimization (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                bot_id INTEGER NOT NULL,
                optimization_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                weights TEXT NOT NULL,
                expected_return DECIMAL(10,6),
                volatility DECIMAL(10,6),
                sharpe_ratio DECIMAL(10,6),
                FOREIGN KEY (bot_id) REFERENCES bot_configurations(id)
            );
        `);
    }

    async optimizePortfolio(botId, assetReturns) {
        try {
            // Calculate covariance matrix
            const covariance = this.calculateCovarianceMatrix(assetReturns);
            
            // Calculate expected returns
            const expectedReturns = this.calculateExpectedReturns(assetReturns);
            
            // Run optimization
            const optimized = this.runMarkowitzOptimization(
                expectedReturns,
                covariance
            );
            
            // Save optimization results
            const weights = JSON.stringify(optimized.weights);
            const expectedReturn = optimized.expectedReturn;
            const volatility = optimized.volatility;
            const sharpeRatio = optimized.sharpeRatio;

            await this.saveOptimizationResult(
                botId,
                weights,
                expectedReturn,
                volatility,
                sharpeRatio
            );

            return {
                weights: optimized.weights,
                expectedReturn,
                volatility,
                sharpeRatio
            };
        } catch (error) {
            console.error('Portfolio optimization failed:', error);
            throw error;
        }
    }

    calculateCovarianceMatrix(returns) {
        const n = returns.length;
        const m = returns[0].length;
        const mean = new Array(m).fill(0);
        const covariance = Array(m).fill().map(() => Array(m).fill(0));

        // Calculate means
        for (let i = 0; i < m; i++) {
            for (let j = 0; j < n; j++) {
                mean[i] += returns[j][i];
            }
            mean[i] /= n;
        }

        // Calculate covariance
        for (let i = 0; i < m; i++) {
            for (let j = 0; j < m; j++) {
                for (let k = 0; k < n; k++) {
                    covariance[i][j] += 
                        (returns[k][i] - mean[i]) * 
                        (returns[k][j] - mean[j]);
                }
                covariance[i][j] /= (n - 1);
            }
        }

        return covariance;
    }

    calculateExpectedReturns(returns) {
        return returns.reduce((sums, row) => {
            return sums.map((sum, i) => sum + row[i]);
        }, new Array(returns[0].length).fill(0)).map(sum => sum / returns.length);
    }

    runMarkowitzOptimization(expectedReturns, covariance) {
        const n = expectedReturns.length;
        const weights = new Array(n).fill(1/n);
        let volatility = 0;
        let expectedReturn = 0;
        let sharpeRatio = 0;

        // Calculate portfolio metrics
        for (let i = 0; i < n; i++) {
            expectedReturn += weights[i] * expectedReturns[i];
            for (let j = 0; j < n; j++) {
                volatility += weights[i] * weights[j] * covariance[i][j];
            }
        }

        volatility = Math.sqrt(volatility);
        sharpeRatio = expectedReturn / volatility;

        return {
            weights,
            expectedReturn,
            volatility,
            sharpeRatio
        };
    }

    async saveOptimizationResult(botId, weights, expectedReturn, volatility, sharpeRatio) {
        const stmt = db.prepare(`
            INSERT INTO portfolio_optimization (
                bot_id, weights, expected_return, volatility, sharpe_ratio
            ) VALUES (?, ?, ?, ?, ?)
        `);
        
        await stmt.run(
            botId,
            weights,
            expectedReturn,
            volatility,
            sharpeRatio
        );
    }

    async getLatestOptimization(botId) {
        return db.prepare(`
            SELECT * FROM portfolio_optimization 
            WHERE bot_id = ? 
            ORDER BY optimization_date DESC 
            LIMIT 1
        `).get(botId);
    }
}

module.exports = new PortfolioOptimizer();
