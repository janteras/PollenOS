const fs = require('fs').promises;
const path = require('path');
const { validateStrategy } = require('./strategy-validator');
const localStorage = require('./local-storage');

const STRATEGIES_DIR = path.join(__dirname, '../../data/strategies');

class StrategyManager {
  constructor() {
    this.strategies = new Map();
    this.initializeStrategies();
  }

  async initializeStrategies() {
    try {
      await fs.mkdir(STRATEGIES_DIR, { recursive: true });
      await this.loadStrategies();
    } catch (error) {
      console.error('Error initializing strategies:', error);
      throw error;
    }
  }

  async loadStrategies() {
    try {
      const files = await fs.readdir(STRATEGIES_DIR);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const strategy = await fs.readFile(
            path.join(STRATEGIES_DIR, file),
            'utf-8'
          );
          const strategyData = JSON.parse(strategy);
          this.strategies.set(strategyData.id, strategyData);
        }
      }
      return Array.from(this.strategies.values());
    } catch (error) {
      console.error('Error loading strategies:', error);
      throw error;
    }
  }

  async saveStrategy(strategy) {
    try {
      // Validate strategy before saving
      const validation = await validateStrategy(strategy);
      if (!validation.valid) {
        throw new Error(`Strategy validation failed: ${validation.errors.join(', ')}`);
      }

      // Save to file system
      await fs.writeFile(
        path.join(STRATEGIES_DIR, `${strategy.id}.json`),
        JSON.stringify(strategy, null, 2)
      );

      // Save to local database
      localStorage.saveStrategy(strategy);

      // Update in-memory cache
      this.strategies.set(strategy.id, strategy);

      return { success: true, id: strategy.id };
    } catch (error) {
      console.error('Error saving strategy:', error);
      throw error;
    }
  }

  async getStrategy(id) {
    const strategy = this.strategies.get(id);
    if (!strategy) {
      throw new Error(`Strategy ${id} not found`);
    }
    return strategy;
  }

  async getStrategies() {
    return Array.from(this.strategies.values());
  }

  async deleteStrategy(id) {
    try {
      // Remove from file system
      await fs.unlink(path.join(STRATEGIES_DIR, `${id}.json`));

      // Remove from local database
      localStorage.deleteStrategy(id);

      // Remove from in-memory cache
      this.strategies.delete(id);

      return { success: true };
    } catch (error) {
      console.error('Error deleting strategy:', error);
      throw error;
    }
  }

  async validateStrategy(strategy) {
    try {
      const validation = await validateStrategy(strategy);
      return validation;
    } catch (error) {
      console.error('Error validating strategy:', error);
      throw error;
    }
  }

  async testStrategy(strategy, testParams) {
    try {
      // Validate strategy first
      const validation = await this.validateStrategy(strategy);
      if (!validation.valid) {
        throw new Error(`Strategy validation failed: ${validation.errors.join(', ')}`);
      }

      // Run backtest
      const results = await this.runBacktest(strategy, testParams);
      return results;
    } catch (error) {
      console.error('Error testing strategy:', error);
      throw error;
    }
  }

  async runBacktest(strategy, params) {
    // TODO: Implement backtesting logic
    // This will use historical data to test strategy performance
    return {
      success: true,
      results: {
        totalTrades: 0,
        winRate: 0,
        profitLoss: 0,
        maxDrawdown: 0,
        sharpeRatio: 0
      }
    };
  }
}

// Export singleton instance
module.exports = new StrategyManager();
