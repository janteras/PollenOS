-- Add tables for Pollen Virtual performance metrics
BEGIN TRANSACTION;

-- Table for storing Pollen Virtual competition metrics
CREATE TABLE IF NOT EXISTS pollen_virtual_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id INTEGER NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    competition_id TEXT NOT NULL,
    rank INTEGER NOT NULL,
    total_participants INTEGER NOT NULL,
    pnl_30d DECIMAL(20, 8) NOT NULL,
    sharpe_ratio_30d DECIMAL(10, 4) NOT NULL,
    max_drawdown_30d DECIMAL(10, 4) NOT NULL,
    win_rate_30d DECIMAL(10, 4) NOT NULL,
    risk_adjusted_return_30d DECIMAL(10, 4) NOT NULL,
    FOREIGN KEY (bot_id) REFERENCES bots(id),
    UNIQUE(bot_id, competition_id)
);

-- Add Pollen Virtual metrics to agent scores
ALTER TABLE agent_scores ADD COLUMN pollen_virtual_score DECIMAL(5,2) DEFAULT 0;
ALTER TABLE agent_scores ADD COLUMN last_virtual_rank INTEGER;

-- Add Pollen Virtual metrics to validation results
ALTER TABLE validation_results ADD COLUMN pollen_virtual_metrics TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pollen_virtual_metrics_bot_id ON pollen_virtual_metrics(bot_id);
CREATE INDEX IF NOT EXISTS idx_pollen_virtual_metrics_competition ON pollen_virtual_metrics(competition_id);
CREATE INDEX IF NOT EXISTS idx_pollen_virtual_metrics_timestamp ON pollen_virtual_metrics(timestamp);

COMMIT;
