const sqlite3 = require('sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/local/pollenos.db');
const db = new sqlite3.Database(dbPath);

class RiskControls {
    constructor() {
        this.initializeTables();
    }

    initializeTables() {
        db.exec(`
            CREATE TABLE IF NOT EXISTS risk_controls (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                bot_id INTEGER NOT NULL,
                control_type TEXT NOT NULL,
                parameters TEXT NOT NULL,
                active BOOLEAN DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (bot_id) REFERENCES bot_configurations(id)
            );

            CREATE TABLE IF NOT EXISTS control_triggers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                control_id INTEGER NOT NULL,
                metric_name TEXT NOT NULL,
                threshold DECIMAL(20,8),
                action TEXT NOT NULL,
                last_triggered TIMESTAMP,
                FOREIGN KEY (control_id) REFERENCES risk_controls(id)
            );
        `);
    }

    async createControl(botId, controlType, parameters) {
        try {
            const stmt = db.prepare(`
                INSERT INTO risk_controls (
                    bot_id, control_type, parameters
                ) VALUES (?, ?, ?)
            `);
            
            const controlId = await stmt.run(
                botId,
                controlType,
                JSON.stringify(parameters)
            ).lastID;

            // Create triggers based on control type
            const triggers = this.createControlTriggers(controlType, parameters);
            await this.saveTriggers(controlId, triggers);

            return { id: controlId };
        } catch (error) {
            console.error('Failed to create risk control:', error);
            throw error;
        }
    }

    createControlTriggers(controlType, parameters) {
        const triggers = [];
        
        switch (controlType) {
            case 'stop-loss':
                triggers.push({
                    metric: 'price_change',
                    threshold: parameters.threshold,
                    action: 'sell_position'
                });
                break;

            case 'position-size':
                triggers.push({
                    metric: 'position_size',
                    threshold: parameters.maxSize,
                    action: 'reduce_position'
                });
                break;

            case 'volatility':
                triggers.push({
                    metric: 'volatility',
                    threshold: parameters.maxVolatility,
                    action: 'reduce_exposure'
                });
                break;

            case 'liquidity':
                triggers.push({
                    metric: 'liquidity_ratio',
                    threshold: parameters.minLiquidity,
                    action: 'reduce_position'
                });
                break;
        }

        return triggers;
    }

    async saveTriggers(controlId, triggers) {
        const stmt = db.prepare(`
            INSERT INTO control_triggers (
                control_id, metric_name, threshold, action
            ) VALUES (?, ?, ?, ?)
        `);

        await Promise.all(triggers.map(trigger =>
            stmt.run(
                controlId,
                trigger.metric,
                trigger.threshold,
                trigger.action
            )
        ));
    }

    async evaluateControls(botId, metrics) {
        try {
            const activeControls = await this.getActiveControls(botId);
            const triggeredActions = [];

            for (const control of activeControls) {
                const triggers = await this.getControlTriggers(control.id);
                const actions = await this.checkTriggers(triggers, metrics);
                triggeredActions.push(...actions);
            }

            // Execute actions if any were triggered
            if (triggeredActions.length > 0) {
                await this.executeActions(triggeredActions);
            }

            return triggeredActions;
        } catch (error) {
            console.error('Failed to evaluate risk controls:', error);
            throw error;
        }
    }

    async getActiveControls(botId) {
        return db.prepare(`
            SELECT * FROM risk_controls 
            WHERE bot_id = ? AND active = 1
        `).all(botId);
    }

    async getControlTriggers(controlId) {
        return db.prepare(`
            SELECT * FROM control_triggers 
            WHERE control_id = ?
        `).all(controlId);
    }

    async checkTriggers(triggers, metrics) {
        const actions = [];
        for (const trigger of triggers) {
            const metricValue = metrics[trigger.metric_name];
            if (metricValue !== undefined) {
                if (metricValue > trigger.threshold) {
                    actions.push({
                        trigger_id: trigger.id,
                        action: trigger.action,
                        metric: trigger.metric_name,
                        value: metricValue
                    });
                }
            }
        }
        return actions;
    }

    async executeActions(actions) {
        for (const action of actions) {
            switch (action.action) {
                case 'sell_position':
                    await this.executeSellPosition(action);
                    break;
                case 'reduce_position':
                    await this.executeReducePosition(action);
                    break;
                case 'reduce_exposure':
                    await this.executeReduceExposure(action);
                    break;
            }
        }
    }

    async executeSellPosition(action) {
        // Implementation of position selling logic
        console.log(`Executing sell position for ${action.metric}`);
        // Add actual trading logic here
    }

    async executeReducePosition(action) {
        // Implementation of position reduction logic
        console.log(`Reducing position for ${action.metric}`);
        // Add actual position reduction logic here
    }

    async executeReduceExposure(action) {
        // Implementation of exposure reduction logic
        console.log(`Reducing exposure due to ${action.metric}`);
        // Add actual exposure reduction logic here
    }

    async updateTriggerStatus(triggerId, timestamp) {
        const stmt = db.prepare(`
            UPDATE control_triggers 
            SET last_triggered = ? 
            WHERE id = ?
        `);
        await stmt.run(timestamp, triggerId);
    }

    async disableControl(controlId) {
        const stmt = db.prepare(`
            UPDATE risk_controls 
            SET active = 0 
            WHERE id = ?
        `);
        await stmt.run(controlId);
    }
}

module.exports = new RiskControls();
