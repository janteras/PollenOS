const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

class Monitoring extends EventEmitter {
  constructor() {
    super();
    this.metrics = {
      startTime: Date.now(),
      transactions: {
        total: 0,
        success: 0,
        failed: 0,
        byType: {}
      },
      gas: {
        totalUsed: '0',
        averagePrice: '0',
        lastPrice: '0'
      },
      errors: [],
      performance: {
        averageResponseTime: 0,
        lastResponseTime: 0
      }
    };
    
    this.setupCleanup();
  }
  
  trackTransaction(type, success, gasUsed, gasPrice) {
    this.metrics.transactions.total++;
    
    if (success) {
      this.metrics.transactions.success++;
    } else {
      this.metrics.transactions.failed++;
    }
    
    // Track by transaction type
    if (!this.metrics.transactions.byType[type]) {
      this.metrics.transactions.byType[type] = { success: 0, failed: 0 };
    }
    
    if (success) {
      this.metrics.transactions.byType[type].success++;
    } else {
      this.metrics.transactions.byType[type].failed++;
    }
    
    // Update gas metrics
    if (gasUsed && gasPrice) {
      const gasCost = BigInt(gasUsed) * BigInt(gasPrice);
      this.metrics.gas.totalUsed = (BigInt(this.metrics.gas.totalUsed) + gasCost).toString();
      this.metrics.gas.lastPrice = gasPrice.toString();
      
      // Update average gas price
      const totalTxs = this.metrics.transactions.success + this.metrics.transactions.failed;
      const currentAvg = BigInt(this.metrics.gas.averagePrice || '0');
      const newAvg = (currentAvg * BigInt(totalTxs - 1) + BigInt(gasPrice)) / BigInt(totalTxs);
      this.metrics.gas.averagePrice = newAvg.toString();
    }
    
    this.emit('metricsUpdated', this.getMetrics());
  }
  
  trackError(error, context = {}) {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      code: error.code,
      context
    };
    
    this.metrics.errors.push(errorEntry);
    
    // Keep only the last 100 errors
    if (this.metrics.errors.length > 100) {
      this.metrics.errors.shift();
    }
    
    this.emit('error', errorEntry);
  }
  
  trackPerformance(startTime) {
    const responseTime = Date.now() - startTime;
    this.metrics.performance.lastResponseTime = responseTime;
    
    // Update average response time (exponential moving average)
    const alpha = 0.1; // Smoothing factor
    this.metrics.performance.averageResponseTime = 
      alpha * responseTime + 
      (1 - alpha) * (this.metrics.performance.averageResponseTime || responseTime);
    
    this.emit('performance', {
      responseTime,
      averageResponseTime: this.metrics.performance.averageResponseTime
    });
  }
  
  getMetrics() {
    return {
      ...this.metrics,
      uptime: Date.now() - this.metrics.startTime,
      successRate: this.metrics.transactions.total > 0 
        ? (this.metrics.transactions.success / this.metrics.transactions.total) * 100 
        : 0
    };
  }
  
  async saveMetrics() {
    try {
      const metricsDir = path.join(__dirname, '../../metrics');
      if (!fs.existsSync(metricsDir)) {
        fs.mkdirSync(metricsDir, { recursive: true });
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filePath = path.join(metricsDir, `metrics-${timestamp}.json`);
      
      const data = {
        timestamp: new Date().toISOString(),
        ...this.getMetrics()
      };
      
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      
      // Clean up old metrics (keep last 24 hours)
      this.cleanupOldMetrics(metricsDir);
      
      return filePath;
    } catch (error) {
      console.error('Failed to save metrics:', error);
      return null;
    }
  }
  
  cleanupOldMetrics(metricsDir) {
    try {
      const files = fs.readdirSync(metricsDir);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      files.forEach(file => {
        if (file.startsWith('metrics-') && file.endsWith('.json')) {
          const filePath = path.join(metricsDir, file);
          const stats = fs.statSync(filePath);
          
          if (now - stats.mtimeMs > maxAge) {
            fs.unlinkSync(filePath);
          }
        }
      });
    } catch (error) {
      console.error('Error cleaning up old metrics:', error);
    }
  }
  
  setupCleanup() {
    // Save metrics on exit
    process.on('SIGINT', async () => {
      await this.saveMetrics();
      process.exit(0);
    });
    
    // Save metrics periodically (every hour)
    setInterval(() => this.saveMetrics(), 60 * 60 * 1000);
  }
}

// Create a singleton instance
const monitoring = new Monitoring();

module.exports = monitoring;
