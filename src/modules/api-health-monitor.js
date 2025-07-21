
const logger = require('./logger');

class APIHealthMonitor {
  constructor() {
    this.healthStatus = {
      tradingview: { failures: 0, lastSuccess: null, disabled: false },
      coingecko: { failures: 0, lastSuccess: null, disabled: false },
      cryptocompare: { failures: 0, lastSuccess: null, disabled: false },
      infura: { failures: 0, lastSuccess: null, disabled: false }
    };
    this.maxFailures = 5;
    this.resetInterval = 30 * 60 * 1000; // 30 minutes
  }

  recordFailure(service) {
    if (this.healthStatus[service]) {
      this.healthStatus[service].failures++;
      this.healthStatus[service].lastFailure = Date.now();
      
      if (this.healthStatus[service].failures >= this.maxFailures) {
        this.healthStatus[service].disabled = true;
        this.healthStatus[service].circuitBreakerUntil = Date.now() + (30 * 60 * 1000); // 30 min circuit breaker
        logger.warn(`Service ${service} disabled due to repeated failures. Circuit breaker active for 30 minutes.`);
      }
    }
  }

  isServiceHealthy(service) {
    if (!this.healthStatus[service]) return false;
    
    // Check if circuit breaker should be reset
    if (this.healthStatus[service].disabled && 
        this.healthStatus[service].circuitBreakerUntil && 
        Date.now() > this.healthStatus[service].circuitBreakerUntil) {
      
      this.healthStatus[service].disabled = false;
      this.healthStatus[service].failures = 0;
      logger.info(`Circuit breaker reset for ${service} - attempting reconnection`);
    }
    
    return !this.healthStatus[service].disabled;
  }

  recordSuccess(service) {
    if (this.healthStatus[service]) {
      this.healthStatus[service].failures = 0;
      this.healthStatus[service].lastSuccess = Date.now();
      this.healthStatus[service].disabled = false;
    }
  }

  getHealthReport() {
    return this.healthStatus;
  }

  resetHealth() {
    Object.keys(this.healthStatus).forEach(service => {
      this.healthStatus[service].failures = 0;
      this.healthStatus[service].disabled = false;
    });
    logger.info('API health status reset');
  }
}

module.exports = new APIHealthMonitor();
