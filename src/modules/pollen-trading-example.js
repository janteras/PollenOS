/**
 * Example implementation of Pollen trading integration
 * Shows how to stake PLN and manage virtual portfolios
 */
const PollenStaking = require('./pollen-staking');
const PollenVirtual = require('./pollen-virtual');
const { ethers } = require('ethers');
const logger = require('./logger');

class PollenTradingBot {
  constructor(provider, wallet, config) {
    this.pollenStaking = new PollenStaking(provider, wallet);
    this.pollenVirtual = new PollenVirtual(provider, wallet, config.contracts.pollenVirtual);
    this.wallet = wallet;
    this.config = config;
  }

  /**
   * Initialize trading bot with PLN staking and virtual portfolio
   */
  async initialize(initialStakeAmount = '100') {
    try {
      logger.info('Initializing Pollen trading bot...');

      // Initialize Pollen Virtual contract
      await this.pollenVirtual.initialize();

      // Check PLN balance
      const plnBalance = await this.pollenStaking.getPlnBalance();
      logger.info(`Current PLN balance: ${plnBalance}`);

      if (parseFloat(plnBalance) < parseFloat(initialStakeAmount)) {
        throw new Error(`Insufficient PLN balance. Need ${initialStakeAmount}, have ${plnBalance}`);
      }

      // Stake initial amount
      logger.info(`Staking ${initialStakeAmount} PLN...`);
      await this.pollenStaking.stakePln(initialStakeAmount);

      // Verify staked balance
      const stakedBalance = await this.pollenStaking.getStakedBalance();
      logger.info(`Successfully staked. Current staked balance: ${stakedBalance} PLN`);

      // Initialize virtual portfolio with default allocation
      const defaultAllocation = this.getDefaultAllocation();
      await this.pollenVirtual.updatePortfolio(
        defaultAllocation.assets,
        defaultAllocation.weights
      );

      return true;
    } catch (error) {
      logger.error('Error initializing trading bot:', error);
      throw error;
    }
  }

  /**
   * Get default portfolio allocation based on risk level
   */
  getDefaultAllocation() {
    const riskLevel = this.config.riskLevel || 'medium';
    const assets = this.config.priorityAssets || ['WBTC.E', 'WETH.E', 'WAVAX', 'USDT.E'];

    // Default allocations based on risk level
    const allocations = {
      low: [0.3, 0.3, 0.2, 0.2], // Conservative
      medium: [0.4, 0.3, 0.2, 0.1], // Balanced
      high: [0.5, 0.3, 0.15, 0.05] // Aggressive
    };

    return {
      assets,
      weights: allocations[riskLevel] || allocations.medium
    };
  }

  /**
   * Execute trading strategy based on market signals
   */
  async executeTradingStrategy(marketSignals) {
    try {
      logger.info('Executing trading strategy based on market signals...');

      // Get current portfolio
      const currentPortfolio = await this.pollenVirtual.getPortfolio();
      
      // Calculate new allocation based on signals
      const newAllocation = this.calculateNewAllocation(currentPortfolio, marketSignals);
      
      // Update portfolio if allocation has changed significantly
      if (this.shouldRebalance(currentPortfolio, newAllocation)) {
        logger.info('Rebalancing portfolio based on new signals...');
        await this.pollenVirtual.updatePortfolio(
          newAllocation.assets,
          newAllocation.weights
        );
      }

      // Monitor performance
      const performance = await this.pollenVirtual.getPerformance();
      logger.info('Portfolio performance:', performance);

      return {
        portfolio: await this.pollenVirtual.getPortfolio(),
        performance
      };
    } catch (error) {
      logger.error('Error executing trading strategy:', error);
      throw error;
    }
  }

  /**
   * Calculate new allocation based on market signals
   */
  calculateNewAllocation(currentPortfolio, marketSignals) {
    // TODO: Implement sophisticated allocation strategy
    // For now, return current allocation
    return {
      assets: currentPortfolio.assets,
      weights: currentPortfolio.weights
    };
  }

  /**
   * Check if portfolio should be rebalanced
   */
  shouldRebalance(currentPortfolio, newAllocation) {
    const threshold = this.config.rebalanceThreshold || 5;
    
    // Calculate maximum weight difference
    const maxDiff = Math.max(
      ...currentPortfolio.weights.map((weight, i) => 
        Math.abs(weight - newAllocation.weights[i]) * 100
      )
    );

    return maxDiff > threshold;
  }

  /**
   * Monitor and manage portfolio
   */
  async monitorPortfolio() {
    try {
      const portfolio = await this.pollenVirtual.getPortfolio();
      const performance = await this.pollenVirtual.getPerformance();
      
      logger.info('Portfolio Status:');
      logger.info(`Total Value: ${portfolio.totalValue}`);
      logger.info(`Total Return: ${performance.totalReturn}%`);
      logger.info(`Sharpe Ratio: ${performance.sharpeRatio}`);
      
      // Check if rebalancing is needed
      if (this.config.autoRebalance) {
        const currentAllocation = {
          assets: portfolio.assets,
          weights: portfolio.weights
        };
        
        if (this.shouldRebalance(currentAllocation, this.getDefaultAllocation())) {
          logger.info('Auto-rebalancing portfolio...');
          await this.pollenVirtual.updatePortfolio(
            currentAllocation.assets,
            currentAllocation.weights
          );
        }
      }

      return {
        portfolio,
        performance
      };
    } catch (error) {
      logger.error('Error monitoring portfolio:', error);
      throw error;
    }
  }
}

module.exports = PollenTradingBot;
