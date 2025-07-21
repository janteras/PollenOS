class PortfolioMonitor {
  constructor(provider, wallet, portfolioAddress, strategy) {
    this.provider = provider;
    this.wallet = wallet;
    this.portfolioAddress = portfolioAddress;
    this.strategy = strategy;
    this.isMonitoring = false;
    this.lastRebalance = Date.now();
    this.rebalanceThreshold = 0.05; // 5% deviation triggers rebalance
    this.minRebalanceInterval = 3600000; // 1 hour minimum between rebalances
  }

  async startMonitoring() {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    console.log(`📊 Starting portfolio monitoring for ${this.portfolioAddress}`);
    console.log(`📈 Strategy: ${this.strategy}`);

    // Monitor every 2 minutes for active rebalancing
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkPortfolioHealth();
      } catch (error) {
        console.error('Portfolio monitoring error:', error.message);
      }
    }, 120000); // 2 minutes
  }

  async checkPortfolioHealth() {
    console.log(`🔍 Checking portfolio health: ${this.portfolioAddress.slice(0, 10)}...`);

    try {
      // Get current portfolio state
      const portfolioState = await this.getPortfolioState();

      // Calculate target allocation based on strategy
      const targetAllocation = await this.calculateTargetAllocation();

      // Check if rebalancing is needed
      const rebalanceNeeded = this.shouldRebalance(portfolioState, targetAllocation);

      if (rebalanceNeeded && this.canRebalance()) {
        console.log(`🔄 Rebalancing needed for ${this.strategy} strategy`);
        await this.executeRebalance(portfolioState, targetAllocation);
      } else {
        console.log(`✅ Portfolio within target allocation (${this.strategy})`);
      }

    } catch (error) {
      console.error(`❌ Portfolio health check failed: ${error.message}`);
    }
  }

  async getPortfolioState() {
    // Mock portfolio state for now - in real implementation would query contracts
    return {
      totalValue: 1000,
      assets: {
        'PLN': { weight: 0.4, value: 400 },
        'WETH': { weight: 0.3, value: 300 },
        'USDC': { weight: 0.3, value: 300 }
      },
      lastUpdate: Date.now()
    };
  }

  async calculateTargetAllocation() {
    // Strategy-based target allocations
    const strategies = {
      'conservative': { 'PLN': 0.5, 'WETH': 0.25, 'USDC': 0.25 },
      'momentum': { 'PLN': 0.4, 'WETH': 0.4, 'USDC': 0.2 },
      'technical': { 'PLN': 0.35, 'WETH': 0.35, 'USDC': 0.3 },
      'mean-reversion': { 'PLN': 0.45, 'WETH': 0.25, 'USDC': 0.3 },
      'breakout': { 'PLN': 0.3, 'WETH': 0.5, 'USDC': 0.2 },
      'scalping': { 'PLN': 0.6, 'WETH': 0.2, 'USDC': 0.2 },
      'grid-trading': { 'PLN': 0.4, 'WETH': 0.3, 'USDC': 0.3 }
    };

    return strategies[this.strategy] || strategies['conservative'];
  }

  shouldRebalance(currentState, targetAllocation) {
    // Check if any asset deviates more than threshold from target
    for (const [asset, targetWeight] of Object.entries(targetAllocation)) {
      const currentWeight = currentState.assets[asset]?.weight || 0;
      const deviation = Math.abs(currentWeight - targetWeight);

      if (deviation > this.rebalanceThreshold) {
        console.log(`📊 ${asset}: Current ${(currentWeight * 100).toFixed(1)}%, Target ${(targetWeight * 100).toFixed(1)}%, Deviation ${(deviation * 100).toFixed(1)}%`);
        return true;
      }
    }

    return false;
  }

  canRebalance() {
    const timeSinceLastRebalance = Date.now() - this.lastRebalance;
    return timeSinceLastRebalance >= this.minRebalanceInterval;
  }

  async executeRebalance(currentState, targetAllocation) {
    console.log(`🔄 Executing rebalance for ${this.strategy} strategy`);

    try {
      // Calculate required trades
      const trades = this.calculateRequiredTrades(currentState, targetAllocation);

      // Execute trades (simulation for now)
      for (const trade of trades) {
        console.log(`📈 ${trade.type} ${trade.amount.toFixed(2)} ${trade.asset} (${trade.reason})`);

        // In real implementation, would execute actual trades
        await this.simulateTrade(trade);
      }

      this.lastRebalance = Date.now();
      console.log(`✅ Rebalancing completed successfully`);

    } catch (error) {
      console.error(`❌ Rebalancing failed: ${error.message}`);
    }
  }

  calculateRequiredTrades(currentState, targetAllocation) {
    const trades = [];
    const totalValue = currentState.totalValue;

    for (const [asset, targetWeight] of Object.entries(targetAllocation)) {
      const currentValue = currentState.assets[asset]?.value || 0;
      const targetValue = totalValue * targetWeight;
      const difference = targetValue - currentValue;

      if (Math.abs(difference) > totalValue * 0.01) { // Minimum 1% difference
        trades.push({
          asset: asset,
          type: difference > 0 ? 'BUY' : 'SELL',
          amount: Math.abs(difference),
          reason: `Rebalance to ${(targetWeight * 100).toFixed(1)}%`
        });
      }
    }

    return trades;
  }

  async simulateTrade(trade) {
    // Simulate trade execution with random delay
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

    // Random success/failure for simulation
    const success = Math.random() > 0.1; // 90% success rate

    if (success) {
      console.log(`✅ ${trade.type} ${trade.amount.toFixed(2)} ${trade.asset} executed successfully`);
    } else {
      console.log(`❌ ${trade.type} ${trade.amount.toFixed(2)} ${trade.asset} failed`);
      throw new Error(`Trade execution failed for ${trade.asset}`);
    }
  }

  getRebalancingStats() {
    return {
      isMonitoring: this.isMonitoring,
      strategy: this.strategy,
      lastRebalance: new Date(this.lastRebalance).toISOString(),
      rebalanceThreshold: `${(this.rebalanceThreshold * 100).toFixed(1)}%`,
      minInterval: `${this.minRebalanceInterval / 60000} minutes`
    };
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.isMonitoring = false;
      console.log(`⏹️ Stopped portfolio monitoring`);
    }
  }
}

module.exports = PortfolioMonitor;