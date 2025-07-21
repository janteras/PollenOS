class RebalancingScheduler {
  constructor() {
    this.schedules = new Map();
    this.activeMonitors = new Map();
    this.isRunning = false;
    this.rebalanceHistory = [];
  }

  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    console.log('🔄 Starting enhanced rebalancing scheduler');

    // Check for rebalancing opportunities every 30 minutes
    this.schedulerInterval = setInterval(() => {
      this.checkRebalancingOpportunities();
    }, 1800000); // 30 minutes

    // Performance reporting every 6 hours
    this.reportingInterval = setInterval(() => {
      this.generatePerformanceReport();
    }, 21600000); // 6 hours
  }

  async checkRebalancingOpportunities() {
    console.log('🔍 Checking rebalancing opportunities across all portfolios');

    const timestamp = new Date().toISOString();
    let opportunitiesFound = 0;

    for (const [portfolioId, schedule] of this.schedules) {
      try {
        const opportunity = await this.evaluatePortfolio(portfolioId, schedule);
        if (opportunity) {
          opportunitiesFound++;
          await this.executeRebalanceIfNeeded(portfolioId, opportunity);
        }
      } catch (error) {
        console.error(`❌ Error evaluating portfolio ${portfolioId}:`, error.message);
      }
    }

    console.log(`📊 Rebalancing check complete: ${opportunitiesFound} opportunities found`);
  }

  async evaluatePortfolio(portfolioId, schedule) {
    const { strategy, targetAllocation, riskTolerance, minRebalanceThreshold } = schedule;

    // Simulate current portfolio state
    const currentState = await this.getCurrentPortfolioState(portfolioId);
    const marketConditions = await this.getMarketConditions();

    // Calculate deviation from target allocation
    const deviations = this.calculateDeviations(currentState, targetAllocation);
    const maxDeviation = Math.max(...Object.values(deviations).map(Math.abs));

    if (maxDeviation > (minRebalanceThreshold || 0.05)) {
      return {
        portfolioId,
        strategy,
        maxDeviation,
        deviations,
        marketConditions,
        urgency: this.calculateUrgency(maxDeviation, marketConditions),
        estimatedImpact: this.estimateRebalanceImpact(deviations, currentState.totalValue)
      };
    }

    return null;
  }

  async getCurrentPortfolioState(portfolioId) {
    // Mock portfolio state - in real implementation would query actual contracts
    const strategies = ['conservative', 'momentum', 'technical', 'mean-reversion', 'breakout', 'scalping', 'grid-trading'];
    const strategyIndex = parseInt(portfolioId.slice(-1)) % strategies.length;
    const strategy = strategies[strategyIndex];

    // Simulate some drift from target allocation
    const baseDrift = 0.02 + Math.random() * 0.08; // 2-10% drift

    return {
      totalValue: 1000 + Math.random() * 500, // $1000-1500
      assets: {
        'PLN': { weight: 0.4 + (Math.random() - 0.5) * baseDrift, value: 400 },
        'WETH': { weight: 0.3 + (Math.random() - 0.5) * baseDrift, value: 300 },
        'USDC': { weight: 0.3 + (Math.random() - 0.5) * baseDrift, value: 300 }
      },
      strategy,
      lastUpdate: Date.now(),
      performance24h: (Math.random() - 0.5) * 0.1 // -5% to +5%
    };
  }

  async getMarketConditions() {
    // Mock market conditions
    return {
      volatility: 0.15 + Math.random() * 0.2, // 15-35% volatility
      trend: Math.random() > 0.5 ? 'bullish' : 'bearish',
      gasPrice: 0.5 + Math.random() * 2, // 0.5-2.5 gwei equivalent
      liquidityScore: 0.7 + Math.random() * 0.3 // 70-100% liquidity
    };
  }

  calculateDeviations(currentState, targetAllocation) {
    const deviations = {};

    for (const [asset, targetWeight] of Object.entries(targetAllocation)) {
      const currentWeight = currentState.assets[asset]?.weight || 0;
      deviations[asset] = currentWeight - targetWeight;
    }

    return deviations;
  }

  calculateUrgency(maxDeviation, marketConditions) {
    let urgency = 'low';

    if (maxDeviation > 0.15) urgency = 'high';
    else if (maxDeviation > 0.1) urgency = 'medium';

    // Increase urgency in high volatility
    if (marketConditions.volatility > 0.25 && urgency === 'low') urgency = 'medium';

    return urgency;
  }

  estimateRebalanceImpact(deviations, totalValue) {
    const totalDeviation = Object.values(deviations).reduce((sum, dev) => sum + Math.abs(dev), 0);
    return {
      tradeVolume: totalValue * totalDeviation * 0.5,
      estimatedCost: totalValue * totalDeviation * 0.001, // 0.1% cost estimate
      expectedImprovement: totalDeviation * 0.02 // 2% improvement per unit deviation
    };
  }

  async executeRebalanceIfNeeded(portfolioId, opportunity) {
    const { urgency, estimatedImpact } = opportunity;

    // Only execute if benefits outweigh costs
    if (estimatedImpact.expectedImprovement > estimatedImpact.estimatedCost * 2) {
      console.log(`🔄 Executing rebalance for portfolio ${portfolioId} (${urgency} urgency)`);

      const rebalanceResult = await this.simulateRebalance(opportunity);

      // Record rebalance
      this.rebalanceHistory.push({
        timestamp: Date.now(),
        portfolioId,
        strategy: opportunity.strategy,
        maxDeviation: opportunity.maxDeviation,
        urgency,
        impact: estimatedImpact,
        result: rebalanceResult,
        success: rebalanceResult.success
      });

      // Update schedule
      const schedule = this.schedules.get(portfolioId);
      if (schedule) {
        schedule.lastRebalance = Date.now();
        schedule.nextRebalance = Date.now() + (schedule.interval || 3600000);
      }

      console.log(`${rebalanceResult.success ? '✅' : '❌'} Rebalance ${rebalanceResult.success ? 'completed' : 'failed'} for ${portfolioId}`);
    } else {
      console.log(`⏸️ Rebalance skipped for ${portfolioId}: costs exceed benefits`);
    }
  }

  async simulateRebalance(opportunity) {
    // Simulate rebalance execution
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    const success = Math.random() > 0.05; // 95% success rate

    return {
      success,
      executionTime: 1000 + Math.random() * 2000,
      gasUsed: Math.floor(50000 + Math.random() * 100000),
      tradesExecuted: Object.keys(opportunity.deviations).length,
      error: success ? null : 'Simulated execution failure'
    };
  }

  generatePerformanceReport() {
    const recent = this.rebalanceHistory.filter(r => Date.now() - r.timestamp < 86400000); // Last 24h
    const successRate = recent.length > 0 ? recent.filter(r => r.success).length / recent.length : 0;

    console.log('\n📊 REBALANCING PERFORMANCE REPORT');
    console.log('════════════════════════════════════════');
    console.log(`📅 Period: Last 24 hours`);
    console.log(`🔄 Total rebalances: ${recent.length}`);
    console.log(`✅ Success rate: ${(successRate * 100).toFixed(1)}%`);
    console.log(`📈 Active portfolios: ${this.schedules.size}`);
    console.log(`⚡ Monitoring status: ${this.isRunning ? 'Active' : 'Stopped'}`);

    if (recent.length > 0) {
      const avgDeviation = recent.reduce((sum, r) => sum + r.maxDeviation, 0) / recent.length;
      console.log(`📊 Average max deviation: ${(avgDeviation * 100).toFixed(2)}%`);

      const urgencyBreakdown = recent.reduce((acc, r) => {
        acc[r.urgency] = (acc[r.urgency] || 0) + 1;
        return acc;
      }, {});

      console.log(`🚨 Urgency breakdown:`, urgencyBreakdown);
    }
    console.log('════════════════════════════════════════\n');
  }

  addPortfolio(portfolioId, config) {
    const defaultConfig = {
      interval: 3600000, // 1 hour default
      minRebalanceThreshold: 0.05, // 5% default
      targetAllocation: { 'PLN': 0.4, 'WETH': 0.3, 'USDC': 0.3 },
      riskTolerance: 'medium',
      ...config
    };

    this.schedules.set(portfolioId, {
      ...defaultConfig,
      lastRebalance: Date.now(),
      nextRebalance: Date.now() + defaultConfig.interval
    });

    console.log(`✅ Added portfolio to rebalancing schedule: ${portfolioId} (${config.strategy})`);
  }

  removePortfolio(portfolioId) {
    this.schedules.delete(portfolioId);
    console.log(`🗑️ Removed portfolio from rebalancing schedule: ${portfolioId}`);
  }

  getScheduleStatus() {
    return {
      isRunning: this.isRunning,
      activePortfolios: this.schedules.size,
      totalRebalances: this.rebalanceHistory.length,
      recentRebalances: this.rebalanceHistory.filter(r => Date.now() - r.timestamp < 86400000).length
    };
  }

  stop() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
    }
    if (this.reportingInterval) {
      clearInterval(this.reportingInterval);
    }

    this.isRunning = false;
    console.log('⏹️ Stopped rebalancing scheduler');
  }
}

module.exports = RebalancingScheduler;