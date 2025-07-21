const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const MetricsService = require('../analytics/metrics-service');

// Mock database for testing
async function createTestDatabase() {
  const db = await open({
    filename: ':memory:',
    driver: sqlite3.Database
  });

  // Create test tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS trade_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bot_id INTEGER NOT NULL,
      trade_id TEXT UNIQUE NOT NULL,
      symbol TEXT NOT NULL,
      side TEXT CHECK(side IN ('buy', 'sell')),
      price DECIMAL(20,8) NOT NULL,
      quantity DECIMAL(20,8) NOT NULL,
      fee DECIMAL(20,8) DEFAULT 0,
      profit_loss DECIMAL(20,8),
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      status TEXT CHECK(status IN ('open', 'closed', 'canceled')),
      close_price DECIMAL(20,8),
      close_time TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS trade_execution_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bot_id INTEGER NOT NULL,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      slippage DECIMAL(10,8),
      fill_rate DECIMAL(5,2),
      execution_time_ms INTEGER,
      trade_size_usd DECIMAL(20,8),
      trade_id TEXT,
      status TEXT CHECK(status IN ('pending', 'filled', 'rejected', 'cancelled')),
      FOREIGN KEY (bot_id) REFERENCES bots(id)
    );

    CREATE TABLE IF NOT EXISTS bot_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bot_id INTEGER NOT NULL,
      date DATE NOT NULL,
      daily_return DECIMAL(10,8) NOT NULL,
      UNIQUE(bot_id, date)
    );
  `);

  // Insert test data
  await db.exec(`
    -- Add some trade history
    INSERT INTO trade_history 
    (bot_id, trade_id, symbol, side, price, quantity, fee, status, timestamp)
    VALUES 
    (1, 'trade1', 'BTC/USD', 'buy', 50000, 0.1, 10, 'closed', '2023-01-01 10:00:00'),
    (1, 'trade2', 'BTC/USD', 'sell', 52000, 0.1, 10.4, 'closed', '2023-01-02 11:00:00'),
    (1, 'trade3', 'ETH/USD', 'buy', 3000, 1, 3, 'closed', '2023-01-03 12:00:00'),
    (1, 'trade4', 'ETH/USD', 'sell', 3100, 1, 3.1, 'closed', '2023-01-04 13:00:00'),
    (1, 'trade5', 'SOL/USD', 'buy', 100, 10, 1, 'open', '2023-01-05 14:00:00');

    -- Add some trade execution metrics
    INSERT INTO trade_execution_metrics 
    (bot_id, slippage, fill_rate, execution_time_ms, trade_size_usd, trade_id, status, timestamp)
    VALUES 
    (1, 0.0005, 1.0, 100, 5000, 'trade1', 'filled', '2023-01-01 10:00:00'),
    (1, 0.0003, 0.95, 80, 5200, 'trade2', 'filled', '2023-01-02 11:00:00'),
    (1, 0.0008, 0.9, 120, 3000, 'trade3', 'filled', '2023-01-03 12:00:00'),
    (1, 0.0004, 1.0, 90, 3100, 'trade4', 'filled', '2023-01-04 13:00:00'),
    (1, 0.001, 0.0, 50, 1000, 'trade5', 'rejected', '2023-01-05 14:00:00');

    -- Add some daily returns
    INSERT INTO bot_returns (bot_id, date, daily_return)
    VALUES 
    (1, '2023-01-01', 0.01),
    (1, '2023-01-02', -0.005),
    (1, '2023-01-03', 0.02),
    (1, '2023-01-04', -0.01),
    (1, '2023-01-05', 0.015);
  `);

  return db;
}

describe('MetricsService', () => {
  let db;
  let metricsService;

  beforeAll(async () => {
    // Create an in-memory database for testing
    db = await createTestDatabase();
    // Create a test metrics service with the in-memory database
    metricsService = new MetricsService(':memory:');
    // Replace the database connection with our test database
    metricsService.db = db;
  });

  afterAll(async () => {
    await db.close();
  });

  describe('calculateWinLossRatio', () => {
    it('should calculate win/loss ratio correctly', async () => {
      const ratio = await metricsService.calculateWinLossRatio(1);
      // We have 2 wins and 0 losses in the test data (trades 1-4 are closed, 2 buys and 2 sells)
      expect(ratio).toBe(1); // 2 wins / 2 losses = 1
    });
  });

  describe('calculateRiskAdjustedMetrics', () => {
    it('should calculate risk-adjusted metrics correctly', async () => {
      const metrics = await metricsService.calculateRiskAdjustedMetrics(1);
      
      expect(metrics).toHaveProperty('sharpeRatio');
      expect(metrics).toHaveProperty('sortinoRatio');
      expect(metrics).toHaveProperty('maxDrawdown');
      expect(metrics).toHaveProperty('volatility');
      
      // Check that the values are numbers
      expect(typeof metrics.sharpeRatio).toBe('number');
      expect(typeof metrics.sortinoRatio).toBe('number');
      expect(typeof metrics.maxDrawdown).toBe('number');
      expect(typeof metrics.volatility).toBe('number');
    });
  });

  describe('recordTradeExecution', () => {
    it('should record trade execution metrics', async () => {
      const trade = {
        botId: 1,
        id: 'test-trade-1',
        symbol: 'BTC/USD',
        side: 'buy',
        price: 51000,
        quantity: 0.1,
        filledQuantity: 0.1,
        expectedPrice: 50900,
        executionTime: 75,
        status: 'filled'
      };

      const result = await metricsService.recordTradeExecution(trade);
      
      expect(result).toHaveProperty('id');
      expect(result.bot_id).toBe(1);
      expect(result.trade_id).toBe('test-trade-1');
      expect(result.slippage).toBeGreaterThan(0);
      expect(result.fill_rate).toBe(1);
      expect(result.execution_time_ms).toBe(75);
      expect(result.trade_size_usd).toBe(5100); // 0.1 * 51000
    });
  });

  describe('getExecutionQuality', () => {
    it('should calculate execution quality metrics', async () => {
      const metrics = await metricsService.getExecutionQuality(1, '30d');
      
      expect(metrics).toHaveProperty('avgSlippage');
      expect(metrics).toHaveProperty('avgFillRate');
      expect(metrics).toHaveProperty('avgExecutionTime');
      expect(metrics).toHaveProperty('totalTrades');
      expect(metrics).toHaveProperty('filledTrades');
      expect(metrics).toHaveProperty('rejectedTrades');
      expect(metrics).toHaveProperty('fillRate');
      expect(metrics).toHaveProperty('avgTradeSize');
      
      // We have 5 trades in test data (4 filled, 1 rejected)
      expect(metrics.totalTrades).toBe(5);
      expect(metrics.filledTrades).toBe(4);
      expect(metrics.rejectedTrades).toBe(1);
      expect(metrics.fillRate).toBe(80); // 4/5 = 80%
    });
  });
});
