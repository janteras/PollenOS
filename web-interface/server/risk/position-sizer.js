const sqlite3 = require('sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/local/pollenos.db');
const db = new sqlite3.Database(dbPath);

class PositionSizer {
    constructor() {
        this.initializeTables();
    }

    initializeTables() {
        db.exec(`
            CREATE TABLE IF NOT EXISTS position_sizing (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                bot_id INTEGER NOT NULL,
                sizing_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                strategy TEXT NOT NULL,
                parameters TEXT NOT NULL,
                FOREIGN KEY (bot_id) REFERENCES bot_configurations(id)
            );

            CREATE TABLE IF NOT EXISTS position_allocations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sizing_id INTEGER NOT NULL,
                symbol TEXT NOT NULL,
                weight DECIMAL(10,6),
                position_size DECIMAL(20,8),
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (sizing_id) REFERENCES position_sizing(id)
            );
        `);
    }

    async calculateOptimalPositions(botId, portfolio, riskProfile) {
        try {
            const strategies = {
                'volatility-based': this.volatilityBasedSizing,
                'value-at-risk': this.valueAtRiskSizing,
                'equal-risk': this.equalRiskSizing
            };

            const sizingStrategy = strategies[riskProfile.sizingStrategy];
            const allocations = sizingStrategy.call(this, portfolio, riskProfile);

            const sizingId = await this.saveSizingResults(
                botId,
                riskProfile.sizingStrategy,
                allocations
            );

            return {
                strategy: riskProfile.sizingStrategy,
                allocations,
                sizingId
            };
        } catch (error) {
            console.error('Position sizing failed:', error);
            throw error;
        }
    }

    volatilityBasedSizing(portfolio, riskProfile) {
        const weights = Object.values(portfolio.weights);
        const volatilities = Object.values(portfolio.volatilities);
        const totalRisk = riskProfile.totalRiskBudget;

        const allocations = weights.map((weight, i) => {
            const riskContribution = weight * volatilities[i];
            const allocation = (riskContribution / totalRisk) * portfolio.totalValue;
            return allocation;
        });

        return allocations;
    }

    valueAtRiskSizing(portfolio, riskProfile) {
        const weights = Object.values(portfolio.weights);
        const returns = portfolio.returns;
        const confidenceLevel = riskProfile.confidenceLevel || 0.95;

        const varAllocations = weights.map((weight, i) => {
            const sortedReturns = returns[i].sort((a, b) => a - b);
            const varIndex = Math.floor(sortedReturns.length * (1 - confidenceLevel));
            const varValue = sortedReturns[varIndex];
            
            const allocation = weight * portfolio.totalValue * (1 + varValue);
            return allocation;
        });

        return varAllocations;
    }

    equalRiskSizing(portfolio, riskProfile) {
        const weights = Object.values(portfolio.weights);
        const volatilities = Object.values(portfolio.volatilities);
        const totalRisk = riskProfile.totalRiskBudget;

        const riskBudget = totalRisk / weights.length;
        const allocations = weights.map((weight, i) => {
            const allocation = (riskBudget / volatilities[i]) * portfolio.totalValue;
            return allocation;
        });

        return allocations;
    }

    async saveSizingResults(botId, strategy, allocations) {
        const stmt = db.prepare(`
            INSERT INTO position_sizing (
                bot_id, strategy, parameters
            ) VALUES (?, ?, ?)
        `);
        
        const sizingId = await stmt.run(
            botId,
            strategy,
            JSON.stringify({ allocations })
        ).lastID;

        // Save individual allocations
        const allocStmt = db.prepare(`
            INSERT INTO position_allocations (
                sizing_id, symbol, weight, position_size
            ) VALUES (?, ?, ?, ?)
        `);

        await Promise.all(allocations.map((alloc, i) => {
            const symbol = portfolio.symbols[i];
            const weight = portfolio.weights[symbol];
            return allocStmt.run(
                sizingId,
                symbol,
                weight,
                alloc
            );
        }));

        return sizingId;
    }

    async getLatestSizing(botId) {
        return db.prepare(`
            SELECT * FROM position_sizing 
            WHERE bot_id = ? 
            ORDER BY sizing_date DESC 
            LIMIT 1
        `).get(botId);
    }

    async getSizingHistory(botId, symbol) {
        return db.prepare(`
            SELECT a.timestamp, a.position_size 
            FROM position_allocations a
            JOIN position_sizing s ON a.sizing_id = s.id
            WHERE s.bot_id = ? AND a.symbol = ?
            ORDER BY a.timestamp DESC
            LIMIT 30
        `).all(botId, symbol);
    }
}

module.exports = new PositionSizer();
