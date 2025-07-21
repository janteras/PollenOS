/**
 * Bot Status Monitor
 * Tracks the health and performance of all bot instances
 */

const logger = require('./logger');

class BotStatusMonitor {
  constructor() {
    this.botStatuses = new Map();
    this.startTime = Date.now();
  }

  /**
   * Update bot status
   * @param {string} botId - Bot identifier
   * @param {string} newStatus - New status string
   * @param {Object} additionalData - Additional status data
   */
  updateBotStatus(botId, newStatus, additionalData = {}) {
    this.updateStatus(botId, {
      status: newStatus,
      ...additionalData
    });
  }

  /**
   * Update bot status
   * @param {string} botId - Bot identifier
   * @param {Object} status - Status object
   */
  updateStatus(botId, status) {
    // Initialize bot if not exists
    if (!this.botStatuses.has(botId)) {
      this.botStatuses.set(botId, {
        status: 'initializing',
        lastActivity: 'none',
        strategy: 'unknown',
        lastUpdate: Date.now(),
        tradingCycles: 0,
        errors: 0
      });
    }

    const now = Date.now();
    const currentStatus = this.botStatuses.get(botId);

    // Track trading cycles
    if (status.lastActivity === 'trading_cycle_completed') {
      status.tradingCycles = (currentStatus.tradingCycles || 0) + 1;
    }

    // Track errors
    if (status.status === 'error') {
      status.errors = (currentStatus.errors || 0) + 1;
    }

    this.botStatuses.set(botId, {
      ...currentStatus,
      ...status,
      lastUpdate: now,
      uptime: now - this.startTime
    });
  }

  /**
   * Get status for all bots
   * @returns {Object} Status summary
   */
  getAllStatuses() {
    const statuses = {};
    for (const [botId, status] of this.botStatuses) {
      statuses[botId] = status;
    }
    return statuses;
  }

  /**
   * Check for unhealthy bots
   * @returns {Array} List of unhealthy bot IDs
   */
  getUnhealthyBots() {
    const now = Date.now();
    const unhealthy = [];

    for (const [botId, status] of this.botStatuses) {
      // More nuanced health check based on bot state
      const timeSinceUpdate = now - status.lastUpdate;
      const isUnhealthy = 
        (status.status === 'error') ||
        (status.status === 'initializing' && timeSinceUpdate > 5 * 60 * 1000) || // 5 min for init
        (status.status === 'running' && timeSinceUpdate > 30 * 60 * 1000) || // 30 min for running
        (status.status === 'trading' && timeSinceUpdate > 15 * 60 * 1000) || // 15 min for trading
        (timeSinceUpdate > 60 * 60 * 1000); // 1 hour absolute max

      if (isUnhealthy) {
        unhealthy.push(botId);
      }
    }

    return unhealthy;
  }

  /**
   * Log status summary
   */
  logStatusSummary() {
    const statuses = this.getAllStatuses();
    const botCount = Object.keys(statuses).length;
    const unhealthy = this.getUnhealthyBots();
    const activeBots = Object.values(statuses).filter(bot => 
      bot.status === 'running' || bot.status === 'trading' || bot.status === 'active' || 
      (bot.lastActivity && bot.lastActivity !== 'none' && bot.lastActivity !== 'unknown')
    );
    const tradingBots = Object.values(statuses).filter(bot => 
      bot.status === 'trading' || (bot.lastActivity && bot.lastActivity.includes('trading'))
    );

    logger.info(`Bot Status Summary: ${activeBots.length}/${botCount} bots active, ${tradingBots.length} trading, ${unhealthy.length} unhealthy`);

    // Enhanced status logging for debugging
    if (tradingBots.length === 0 && activeBots.length > 0) {
      logger.warn(`⚠️  No bots are currently trading despite ${activeBots.length} being active`);
      
      // Check if bots are stuck in initialization
      const initializingBots = Object.values(statuses).filter(bot => 
        bot.lastActivity && bot.lastActivity.includes('initialized')
      );
      
      if (initializingBots.length > 0) {
        logger.warn(`🔄 ${initializingBots.length} bots appear to be stuck after initialization`);
      }
    }

    // Log individual bot statuses for debugging
    Object.entries(statuses).forEach(([botId, status]) => {
      logger.debug(`Bot ${botId}: ${status.status} - ${status.lastActivity} (${status.strategy})`);
    });

    if (unhealthy.length > 0) {
      logger.warn(`Unhealthy bots: ${unhealthy.join(', ')}`);
    }
  }

  generateStatusReport() {
    const activeCount = Object.values(this.getAllStatuses()).filter(bot => bot.status === 'active').length;
    const unhealthyCount = Object.values(this.getAllStatuses()).filter(bot => bot.status === 'unhealthy').length;
    const tradingCount = Object.values(this.getAllStatuses()).filter(bot => bot.lastActivity && bot.lastActivity.includes('trading')).length;

    return {
      totalBots: Object.keys(this.getAllStatuses()).length,
      activeBots: activeCount,
      unhealthyBots: unhealthyCount,
      tradingBots: tradingCount,
      avgResponseTime: this.calculateAverageResponseTime(),
      timestamp: new Date().toISOString()
    };
  }

  calculateAverageResponseTime() {
    // Implementation for calculating average response time of bots
    return 0; // Placeholder implementation
  }

  /**
   * Send heartbeat to keep bot status current
   * @param {string} botId - Bot identifier
   */
  heartbeat(botId) {
    if (this.botStatuses.has(botId)) {
      const current = this.botStatuses.get(botId);
      this.updateStatus(botId, {
        lastUpdate: Date.now(),
        lastActivity: current.lastActivity || 'heartbeat'
      });
    }
  }

  /**
   * Update bot status
   * @param {string} botId - Bot identifier
   * @param {Object} statusData - Status data
   */
  updateStatus(botId, statusData) {
    const now = new Date().toISOString();
    const botIdStr = botId.toString(); // Ensure consistent string format

    if (!this.botStatuses[botIdStr]) {
      this.botStatuses[botIdStr] = {
        status: 'unknown',
        strategy: 'unknown',
        riskLevel: 'unknown',
        lastUpdate: now,
        startTime: now
      };
    }

    const currentStatus = this.botStatuses.get(botIdStr) || {};

    this.botStatuses.set(botIdStr, {
      ...currentStatus,
      ...statusData,
      lastUpdate: now
    });
  }
}

// Create singleton instance
const botStatusMonitor = new BotStatusMonitor();

module.exports = botStatusMonitor;