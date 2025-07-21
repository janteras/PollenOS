const sqlite3 = require('sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/local/pollenos.db');
const db = new sqlite3.Database(dbPath);

class MarketPredictor {
    constructor() {
        this.initializeTables();
    }

    initializeTables() {
        db.exec(`
            CREATE TABLE IF NOT EXISTS market_predictions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT NOT NULL,
                prediction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                prediction_type TEXT NOT NULL,
                value DECIMAL(20,8),
                confidence DECIMAL(5,2)
            );

            CREATE TABLE IF NOT EXISTS technical_indicators (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT NOT NULL,
                indicator_type TEXT NOT NULL,
                value DECIMAL(20,8),
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
    }

    async calculateTechnicalIndicators(prices, symbol) {
        try {
            const indicators = {
                macd: this.calculateMACD(prices),
                rsi: this.calculateRSI(prices),
                bollinger: this.calculateBollinger(prices)
            };

            await this.saveIndicators(symbol, indicators);
            return indicators;
        } catch (error) {
            console.error('Technical indicator calculation failed:', error);
            throw error;
        }
    }

    calculateMACD(prices) {
        const shortEMA = this.calculateEMA(prices, 12);
        const longEMA = this.calculateEMA(prices, 26);
        const macdLine = shortEMA - longEMA;
        const signalLine = this.calculateEMA(macdLine, 9);
        return macdLine - signalLine;
    }

    calculateRSI(prices, period = 14) {
        const gains = [];
        const losses = [];
        
        for (let i = 1; i < prices.length; i++) {
            const change = prices[i] - prices[i - 1];
            if (change > 0) gains.push(change);
            else losses.push(-change);
        }

        const avgGain = gains.reduce((a, b) => a + b, 0) / period;
        const avgLoss = losses.reduce((a, b) => a + b, 0) / period;
        
        return 100 - (100 / (1 + (avgGain / avgLoss)));
    }

    calculateBollinger(prices, period = 20) {
        const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
        const stdDev = Math.sqrt(
            prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length
        );
        
        return {
            upper: mean + (2 * stdDev),
            lower: mean - (2 * stdDev)
        };
    }

    calculateEMA(prices, period) {
        const multiplier = 2 / (period + 1);
        let ema = prices[0];
        
        for (let i = 1; i < prices.length; i++) {
            ema = (prices[i] - ema) * multiplier + ema;
        }
        
        return ema;
    }

    async saveIndicators(symbol, indicators) {
        const stmt = db.prepare(`
            INSERT INTO technical_indicators (
                symbol, indicator_type, value
            ) VALUES (?, ?, ?)
        `);
        
        await Promise.all([
            stmt.run(symbol, 'macd', indicators.macd),
            stmt.run(symbol, 'rsi', indicators.rsi),
            stmt.run(symbol, 'bollinger', JSON.stringify(indicators.bollinger))
        ]);
    }

    async getLatestIndicators(symbol) {
        return db.prepare(`
            SELECT * FROM technical_indicators 
            WHERE symbol = ? 
            ORDER BY timestamp DESC 
            LIMIT 3
        `).all(symbol);
    }

    async makePrediction(symbol, indicators) {
        try {
            const prediction = {
                type: 'price',
                value: this.calculatePricePrediction(indicators),
                confidence: this.calculateConfidence(indicators)
            };

            await this.savePrediction(symbol, prediction);
            return prediction;
        } catch (error) {
            console.error('Prediction failed:', error);
            throw error;
        }
    }

    calculatePricePrediction(indicators) {
        // Simple weighted prediction based on indicators
        const weights = {
            macd: 0.4,
            rsi: 0.3,
            bollinger: 0.3
        };

        let prediction = 0;
        for (const [key, weight] of Object.entries(weights)) {
            const value = indicators[key];
            prediction += value * weight;
        }

        return prediction;
    }

    calculateConfidence(indicators) {
        // Calculate confidence based on indicator strength
        const confidence = (indicators.rsi > 70 || indicators.rsi < 30) ? 0.9 : 
                          (indicators.rsi > 60 || indicators.rsi < 40) ? 0.7 : 0.5;
        
        return confidence;
    }

    async savePrediction(symbol, prediction) {
        const stmt = db.prepare(`
            INSERT INTO market_predictions (
                symbol, prediction_type, value, confidence
            ) VALUES (?, ?, ?, ?)
        `);
        
        await stmt.run(
            symbol,
            prediction.type,
            prediction.value,
            prediction.confidence
        );
    }
}

module.exports = new MarketPredictor();
