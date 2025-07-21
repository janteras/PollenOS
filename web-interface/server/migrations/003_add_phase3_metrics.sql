-- migrations/003_add_phase3_metrics.sql
BEGIN TRANSACTION;

-- Add win/loss tracking
ALTER TABLE pollen_virtual_metrics ADD COLUMN win_loss_ratio DECIMAL(5,2);

-- Add benchmark comparison
ALTER TABLE pollen_virtual_metrics ADD COLUMN benchmark_comparison DECIMAL(5,2);

-- Create trade execution metrics table
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

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_trade_metrics_bot ON trade_execution_metrics(bot_id);
CREATE INDEX IF NOT EXISTS idx_trade_metrics_time ON trade_execution_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_trade_metrics_status ON trade_execution_metrics(status);

-- Add trade history table for win/loss tracking
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
    close_time TIMESTAMP,
    FOREIGN KEY (bot_id) REFERENCES bots(id)
);

-- Add index for trade history
CREATE INDEX IF NOT EXISTS idx_trade_history_bot ON trade_history(bot_id);
CREATE INDEX IF NOT EXISTS idx_trade_history_time ON trade_history(timestamp);

COMMIT;
