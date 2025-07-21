const sqlite3 = require('sqlite3');
const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');

const dataDir = path.dirname(path.resolve(__dirname, '../data/local/pollenos.db'));
const dbPath = path.resolve(dataDir, 'pollenos.db');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('Created data directory:', dataDir);
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Database opened successfully:', dbPath);
    }
});

class AlertManager extends EventEmitter {
    constructor(websocketHandler) {
        super();
        this.websocketHandler = websocketHandler;
        this.initializeTables();
        this.alertSettings = {
            volatility_threshold: 0.2,
            concentration_threshold: 0.5,
            position_size_limit: 0.1,
            stop_loss_level: 0.05,
            price_change_threshold: 0.02,
            volume_alert: 0.1
        };
    }

    initializeTables() {
        db.exec(`
            CREATE TABLE IF NOT EXISTS alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                severity TEXT NOT NULL,
                message TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                metadata TEXT
            );

            CREATE TABLE IF NOT EXISTS alert_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                setting_name TEXT NOT NULL UNIQUE,
                value TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
    }

    // Get recent alerts from the database
    getRecentAlerts() {
        return new Promise((resolve, reject) => {
            db.all(`
                SELECT * FROM alerts 
                ORDER BY timestamp DESC 
                LIMIT 100
            `, (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(rows);
            });
        });
    }

    async createAlert(type, severity, message, metadata = {}) {
        try {
            const stmt = db.prepare(`
                INSERT INTO alerts (
                    type, severity, message, metadata
                ) VALUES (?, ?, ?, ?)
            `);

            await stmt.run(
                type,
                severity,
                message,
                JSON.stringify(metadata)
            );

            // Create alert object
            const alert = {
                id: stmt.lastID,
                type,
                severity,
                message,
                timestamp: new Date().toISOString(),
                metadata
            };

            // Broadcast to all clients
            this.broadcastAlert(alert);
            return alert;
        } catch (error) {
            console.error('Failed to create alert:', error);
            throw error;
        }
    }

    broadcastAlert(alert) {
        this.emitter.emit('new-alert', alert);
    }

    async updateSettings(settings) {
        try {
            const stmt = db.prepare(`
                INSERT OR REPLACE INTO alert_settings (
                    setting_name, value
                ) VALUES (?, ?)
            `);

            await Promise.all(Object.entries(settings).map(([name, value]) =>
                stmt.run(name, value)
            ));

            // Update in-memory settings
            Object.assign(this.alertSettings, settings);
            return this.alertSettings;
        } catch (error) {
            console.error('Failed to update alert settings:', error);
            throw error;
        }
    }

    async getSettings() {
        try {
            const rows = await db.all(`
                SELECT setting_name, value 
                FROM alert_settings
            `);

            return rows.reduce((settings, row) => {
                settings[row.setting_name] = row.value;
                return settings;
            }, {});
        } catch (error) {
            console.error('Failed to get alert settings:', error);
            return this.alertSettings;
        }
    }

    async checkRiskAlerts(riskFactors) {
        const alerts = [];

        if (riskFactors.volatility > this.alertSettings.volatility_threshold) {
            alerts.push(this.createAlert(
                'risk',
                'high',
                `High volatility detected: ${riskFactors.volatility.toFixed(2)}`,
                { factor: 'volatility', value: riskFactors.volatility }
            ));
        }

        if (riskFactors.concentration > this.alertSettings.concentration_threshold) {
            alerts.push(this.createAlert(
                'risk',
                'medium',
                `High portfolio concentration: ${riskFactors.concentration.toFixed(2)}`,
                { factor: 'concentration', value: riskFactors.concentration }
            ));
        }

        return Promise.all(alerts);
    }

    async checkTradeAlerts(positionSize, stopLoss) {
        const alerts = [];

        if (positionSize > this.alertSettings.position_size_limit) {
            alerts.push(this.createAlert(
                'trade',
                'high',
                `Position size exceeds limit: ${positionSize.toFixed(2)}`,
                { size: positionSize }
            ));
        }

        if (stopLoss < this.alertSettings.stop_loss_level) {
            alerts.push(this.createAlert(
                'trade',
                'medium',
                `Stop-loss level too low: ${stopLoss.toFixed(2)}`,
                { level: stopLoss }
            ));
        }

        return Promise.all(alerts);
    }

    async checkMarketAlerts(priceChange, volume) {
        const alerts = [];

        if (Math.abs(priceChange) > this.alertSettings.price_change_threshold) {
            alerts.push(this.createAlert(
                'market',
                'high',
                `Price change exceeds threshold: ${priceChange.toFixed(2)}`,
                { change: priceChange }
            ));
        }

        if (volume > this.alertSettings.volume_alert) {
            alerts.push(this.createAlert(
                'market',
                'medium',
                `High trading volume detected: ${volume.toFixed(2)}`,
                { volume }
            ));
        }

        return Promise.all(alerts);
    }
}

module.exports = AlertManager;
