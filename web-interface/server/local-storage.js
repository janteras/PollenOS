const sqlite3 = require('sqlite3');
const path = require('path');

// Initialize database
const dbPath = path.join(__dirname, '../data/local/pollenos.db');
const db = new sqlite3.Database(dbPath);

class LocalStorage {
  constructor() {
    this.initializeDatabase();
  }

  initializeDatabase() {
    // Create tables if they don't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS bot_configurations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        strategy TEXT NOT NULL,
        risk_level INTEGER NOT NULL,
        network TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS trade_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bot_id INTEGER NOT NULL,
        symbol TEXT NOT NULL,
        side TEXT NOT NULL,
        quantity DECIMAL(20,8) NOT NULL,
        price DECIMAL(20,8) NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bot_id) REFERENCES bot_configurations(id)
      );

      CREATE TABLE IF NOT EXISTS performance_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bot_id INTEGER NOT NULL,
        portfolio_value DECIMAL(20,8) NOT NULL,
        daily_change_percent DECIMAL(10,4),
        total_trades INTEGER,
        successful_trades INTEGER,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bot_id) REFERENCES bot_configurations(id)
      );

      CREATE TABLE IF NOT EXISTS validation_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bot_id INTEGER NOT NULL,
        validation_status TEXT NOT NULL,
        validation_score DECIMAL(5,2),
        last_validated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bot_id) REFERENCES bot_configurations(id)
      );

      CREATE TABLE IF NOT EXISTS network_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        network TEXT NOT NULL UNIQUE,
        rpc_url TEXT NOT NULL,
        chain_id INTEGER NOT NULL,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  // Bot Configuration Management
  saveBotConfiguration(config) {
    const stmt = db.prepare(`
      INSERT INTO bot_configurations (name, strategy, risk_level, network)
      VALUES (?, ?, ?, ?)
      RETURNING id
    `);
    return stmt.get(config.name, config.strategy, config.risk_level, config.network);
  }

  getBotConfigurations() {
    return db.prepare('SELECT * FROM bot_configurations ORDER BY created_at DESC').all();
  }

  updateBotConfiguration(id, config) {
    const stmt = db.prepare(`
      UPDATE bot_configurations
      SET name = ?, strategy = ?, risk_level = ?, network = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(config.name, config.strategy, config.risk_level, config.network, id);
  }

  // Trade History Management
  saveTrade(botId, trade) {
    const stmt = db.prepare(`
      INSERT INTO trade_history (bot_id, symbol, side, quantity, price)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(botId, trade.symbol, trade.side, trade.quantity, trade.price);
  }

  getTradeHistory(botId) {
    return db.prepare('SELECT * FROM trade_history WHERE bot_id = ? ORDER BY timestamp DESC').all(botId);
  }

  // Performance Tracking
  savePerformanceMetrics(botId, metrics) {
    const stmt = db.prepare(`
      INSERT INTO performance_metrics (bot_id, portfolio_value, daily_change_percent, total_trades, successful_trades)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(botId, metrics.portfolioValue, metrics.dailyChangePercent, metrics.totalTrades, metrics.successfulTrades);
  }

  getLatestPerformanceMetrics(botId) {
    return db.prepare('SELECT * FROM performance_metrics WHERE bot_id = ? ORDER BY timestamp DESC LIMIT 1').get(botId);
  }

  // Network Configuration
  saveNetworkConfig(network, config) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO network_config (network, rpc_url, chain_id)
      VALUES (?, ?, ?)
    `);
    stmt.run(network, config.rpcUrl, config.chainId);
  }

  getNetworkConfig(network) {
    return db.prepare('SELECT * FROM network_config WHERE network = ?').get(network);
  }

  // Validation Records
  saveValidationRecord(botId, status, score) {
    const stmt = db.prepare(`
      INSERT INTO validation_records (bot_id, validation_status, validation_score)
      VALUES (?, ?, ?)
    `);
    stmt.run(botId, status, score);
  }

  getLatestValidationRecord(botId) {
    return db.prepare('SELECT * FROM validation_records WHERE bot_id = ? ORDER BY last_validated DESC LIMIT 1').get(botId);
  }

  // Close database connection
  close() {
    db.close();
  }
}

module.exports = new LocalStorage();
