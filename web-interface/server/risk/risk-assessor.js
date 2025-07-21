const sqlite3 = require('sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/local/pollenos.db');
const db = new sqlite3.Database(dbPath);

class RiskAssessor {
    constructor() {
        this.initializeTables();
    }

    initializeTables() {
        db.exec(`
            CREATE TABLE IF NOT EXISTS risk_assessments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                bot_id INTEGER NOT NULL,
                assessment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                risk_level INTEGER NOT NULL,
                risk_factors TEXT NOT NULL,
                recommendations TEXT,
                FOREIGN KEY (bot_id) REFERENCES bot_configurations(id)
            );

            CREATE TABLE IF NOT EXISTS risk_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                assessment_id INTEGER NOT NULL,
                metric_name TEXT NOT NULL,
                value DECIMAL(20,8),
                threshold DECIMAL(20,8),
                status TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (assessment_id) REFERENCES risk_assessments(id)
            );
        `);
    }

    async assessRisk(botId, portfolio) {
        try {
            const riskFactors = this.analyzeRiskFactors(portfolio);
            const riskLevel = this.calculateRiskLevel(riskFactors);
            const recommendations = this.generateRecommendations(riskFactors);

            const assessment = await this.saveRiskAssessment(
                botId,
                riskLevel,
                riskFactors,
                recommendations
            );

            return {
                riskLevel,
                factors: riskFactors,
                recommendations,
                assessmentId: assessment.id
            };
        } catch (error) {
            console.error('Risk assessment failed:', error);
            throw error;
        }
    }

    analyzeRiskFactors(portfolio) {
        return {
            volatility: this.calculatePortfolioVolatility(portfolio),
            concentration: this.calculateConcentrationRisk(portfolio),
            liquidity: this.calculateLiquidityRisk(portfolio),
            correlation: this.calculateCorrelationRisk(portfolio),
            marketImpact: this.calculateMarketImpact(portfolio)
        };
    }

    calculatePortfolioVolatility(portfolio) {
        const weights = Object.values(portfolio.weights);
        const covMatrix = portfolio.covarianceMatrix;
        
        let portfolioVariance = 0;
        for (let i = 0; i < weights.length; i++) {
            for (let j = 0; j < weights.length; j++) {
                portfolioVariance += weights[i] * weights[j] * covMatrix[i][j];
            }
        }
        
        return Math.sqrt(portfolioVariance);
    }

    calculateConcentrationRisk(portfolio) {
        const weights = Object.values(portfolio.weights);
        const giniIndex = this.calculateGiniIndex(weights);
        return giniIndex;
    }

    calculateGiniIndex(weights) {
        weights.sort((a, b) => a - b);
        const n = weights.length;
        const total = weights.reduce((a, b) => a + b, 0);
        
        let sum = 0;
        for (let i = 0; i < n; i++) {
            sum += (n - i) * weights[i];
        }
        
        return 1 - (2 * sum) / (n * total);
    }

    calculateLiquidityRisk(portfolio) {
        const dailyVolumes = Object.values(portfolio.dailyVolumes);
        const positions = Object.values(portfolio.positions);
        
        const liquidityRatios = positions.map((pos, i) => 
            pos / dailyVolumes[i]
        );
        
        return Math.max(...liquidityRatios);
    }

    calculateCorrelationRisk(portfolio) {
        const correlations = portfolio.correlationMatrix;
        const avgCorrelation = correlations.reduce(
            (sum, row) => sum + row.reduce((a, b) => a + b, 0),
            0
        ) / (correlations.length * correlations[0].length);
        
        return avgCorrelation;
    }

    calculateMarketImpact(portfolio) {
        const positions = Object.values(portfolio.positions);
        const totalMarketCap = portfolio.totalMarketCap;
        
        return positions.reduce((sum, pos) => 
            sum + Math.abs(pos / totalMarketCap),
            0
        );
    }

    calculateRiskLevel(factors) {
        const weights = {
            volatility: 0.3,
            concentration: 0.2,
            liquidity: 0.2,
            correlation: 0.15,
            marketImpact: 0.15
        };

        let riskScore = 0;
        for (const [factor, weight] of Object.entries(weights)) {
            riskScore += factors[factor] * weight;
        }

        // Map score to risk level (1-5)
        return Math.min(Math.floor(riskScore * 5) + 1, 5);
    }

    generateRecommendations(factors) {
        const recommendations = [];

        if (factors.volatility > 0.2) {
            recommendations.push('Consider reducing position sizes');
        }

        if (factors.concentration > 0.5) {
            recommendations.push('Diversify portfolio across more assets');
        }

        if (factors.liquidity > 0.1) {
            recommendations.push('Review liquidity constraints');
        }

        if (factors.correlation > 0.7) {
            recommendations.push('Consider adding uncorrelated assets');
        }

        if (factors.marketImpact > 0.05) {
            recommendations.push('Review market impact of trades');
        }

        return recommendations;
    }

    async saveRiskAssessment(botId, riskLevel, factors, recommendations) {
        const stmt = db.prepare(`
            INSERT INTO risk_assessments (
                bot_id, risk_level, risk_factors, recommendations
            ) VALUES (?, ?, ?, ?)
        `);
        
        const assessmentId = await stmt.run(
            botId,
            riskLevel,
            JSON.stringify(factors),
            JSON.stringify(recommendations)
        ).lastID;

        // Save individual metrics
        const metricsStmt = db.prepare(`
            INSERT INTO risk_metrics (
                assessment_id, metric_name, value, threshold, status
            ) VALUES (?, ?, ?, ?, ?)
        `);

        await Promise.all(Object.entries(factors).map(([name, value]) => {
            const threshold = this.getThreshold(name);
            const status = value > threshold ? 'HIGH' : 'NORMAL';
            return metricsStmt.run(
                assessmentId,
                name,
                value,
                threshold,
                status
            );
        }));

        return { id: assessmentId };
    }

    getThreshold(metricName) {
        const thresholds = {
            volatility: 0.2,
            concentration: 0.5,
            liquidity: 0.1,
            correlation: 0.7,
            marketImpact: 0.05
        };
        return thresholds[metricName] || 0.5;
    }

    async getLatestAssessment(botId) {
        return db.prepare(`
            SELECT * FROM risk_assessments 
            WHERE bot_id = ? 
            ORDER BY assessment_date DESC 
            LIMIT 1
        `).get(botId);
    }

    async getMetricHistory(botId, metricName) {
        return db.prepare(`
            SELECT m.timestamp, m.value, m.status 
            FROM risk_metrics m
            JOIN risk_assessments a ON m.assessment_id = a.id
            WHERE a.bot_id = ? AND m.metric_name = ?
            ORDER BY m.timestamp DESC
            LIMIT 30
        `).all(botId, metricName);
    }
}

module.exports = new RiskAssessor();
