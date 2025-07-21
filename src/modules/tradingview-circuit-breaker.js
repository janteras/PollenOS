
class TradingViewCircuitBreaker {
  constructor() {
    this.failureCount = 0;
    this.maxFailures = 10;
    this.resetTimeout = 30 * 60 * 1000; // 30 minutes
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.lastFailureTime = null;
  }

  async execute(apiCall) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.failureCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN - TradingView API temporarily disabled');
      }
    }

    try {
      const result = await apiCall();
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failureCount = 0;
      }
      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();
      
      if (this.failureCount >= this.maxFailures) {
        this.state = 'OPEN';
      }
      
      throw error;
    }
  }
}

module.exports = new TradingViewCircuitBreaker();
