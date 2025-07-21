/**
 * Shared Rate Limiter for Multi-Bot System
 * Coordinates API calls across all bot instances to prevent rate limiting
 */

class SharedRateLimiter {
  constructor() {
    this.lastRequestTimes = new Map();
    this.requestQueues = new Map();
    this.minimumDelays = {
      'CoinGecko': 3000,      // 3 seconds between requests
      'CryptoCompare': 1000,   // 1 second between requests
      'Binance': 500,          // 0.5 seconds between requests
      'TradingView': 2000,     // 2 seconds between requests
      'Infura': 5000,          // 5 seconds between requests (increased from 2)
      'ContractVerification': 5000  // 5 seconds for contract calls (increased from 3)
    };
    this.maxConcurrentRequests = {
      'CoinGecko': 1,          // Only 1 concurrent request
      'CryptoCompare': 2,      // Up to 2 concurrent requests
      'Binance': 3,            // Up to 3 concurrent requests
      'TradingView': 1,        // Only 1 concurrent request
      'Infura': 1,             // Only 1 concurrent request for Infura
      'ContractVerification': 1 // Only 1 concurrent contract verification
    };
    this.activeRequests = new Map();
    this.circuitBreaker = {
      failures: 0,
      threshold: 5,
      timeout: 60000, // 1 minute
      nextAttempt: 0,
      state: 'CLOSED' // CLOSED, OPEN, HALF_OPEN
    };
  }

  /**
   * Wait for permission to make a request to a specific source
   * @param {string} source - Data source name
   * @param {string} botId - Bot identifier
   * @returns {Promise<void>}
   */
  async waitForPermission(source, botId) {
    // Check circuit breaker state
    if (this.circuitBreaker.state === 'OPEN') {
      if (Date.now() < this.circuitBreaker.nextAttempt) {
        throw new Error(`Circuit breaker is OPEN. Next attempt in ${Math.ceil((this.circuitBreaker.nextAttempt - Date.now()) / 1000)}s`);
      } else {
        this.circuitBreaker.state = 'HALF_OPEN';
      }
    }
    const now = Date.now();
    const lastRequest = this.lastRequestTimes.get(source) || 0;
    const minDelay = this.minimumDelays[source] || 1000;
    const maxConcurrent = this.maxConcurrentRequests[source] || 1;

    // Check active requests
    const activeCount = this.activeRequests.get(source) || 0;

    // Wait if too many concurrent requests
    if (activeCount >= maxConcurrent) {
      await this.waitForSlot(source);
    }

    // Wait for minimum delay
    const timeSinceLastRequest = now - lastRequest;
    if (timeSinceLastRequest < minDelay) {
      const waitTime = minDelay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // Register this request
    this.activeRequests.set(source, (this.activeRequests.get(source) || 0) + 1);
    this.lastRequestTimes.set(source, Date.now());
  }

  /**
   * Wait for an available slot for the source
   * @param {string} source - Data source name
   * @returns {Promise<void>}
   */
  async waitForSlot(source) {
    return new Promise((resolve) => {
      const checkSlot = () => {
        const activeCount = this.activeRequests.get(source) || 0;
        const maxConcurrent = this.maxConcurrentRequests[source] || 1;

        if (activeCount < maxConcurrent) {
          resolve();
        } else {
          setTimeout(checkSlot, 500); // Check every 500ms
        }
      };
      checkSlot();
    });
  }

  /**
   * Mark request as completed
   * @param {string} source - Data source name
   */
  releaseRequest(source) {
    const current = this.activeRequests.get(source) || 0;
    this.activeRequests.set(source, Math.max(0, current - 1));
  }

  /**
   * Get current status for debugging
   * @returns {Object} Current rate limiter status
   */
  getStatus() {
    return {
      lastRequestTimes: Object.fromEntries(this.lastRequestTimes),
      activeRequests: Object.fromEntries(this.activeRequests),
      timestamp: Date.now()
    };
  }

  async executeWithRateLimit(key, fn, priority = 'normal') {
    const queue = this.getQueue(key);

    // Implement exponential backoff for Infura specifically
    if (key === 'infura' && this.lastCallTime && this.lastCallTime[key]) {
      const timeSinceLastCall = Date.now() - this.lastCallTime[key];
      const minInterval = this.isExtendedBackoff ? 2000 : 1000; // 2s for extended backoff

      if (timeSinceLastCall < minInterval) {
        await new Promise(resolve => setTimeout(resolve, minInterval - timeSinceLastCall));
      }
    }

    return new Promise((resolve, reject) => {
      const request = { 
        fn, 
        resolve, 
        reject, 
        timestamp: Date.now(),
        priority: priority,
        retryCount: 0,
        maxRetries: 3
      };

      if (priority === 'high') {
        queue.unshift(request);
      } else {
        queue.push(request);
      }

      this.processQueue(key);
    });
  }

  /**
   * Initialize queue if it doesn't exist
   */
  getQueue(key) {
    if (!this.requestQueues.has(key)) {
      this.requestQueues.set(key, []);
    }
    return this.requestQueues.get(key);
  }

  /**
   * Process the request queue for a specific source
   */
  async processQueue(key) {
    const queue = this.getQueue(key);

    if (queue.length === 0) {
      return;
    }

    const activeCount = this.activeRequests.get(key) || 0;
    const maxConcurrent = this.maxConcurrentRequests[key] || 1;

    if (activeCount >= maxConcurrent) {
      return; // Wait for active requests to complete
    }

    const request = queue.shift();
    if (!request) {
      return;
    }

    // Mark request as active
    this.activeRequests.set(key, activeCount + 1);

    try {
      // Wait for rate limit
      await this.waitForPermission(key, 'queue-processor');

      // Execute the request
      const result = await request.fn();
      request.resolve(result);
      this.recordSuccess();

    } catch (error) {
      this.recordFailure();
      // Handle retry logic
      if (request.retryCount < request.maxRetries) {
        request.retryCount++;
        const retryDelay = Math.pow(2, request.retryCount) * 1000;

        setTimeout(() => {
          if (request.priority === 'high') {
            queue.unshift(request);
          } else {
            queue.push(request);
          }
          this.processQueue(key);
        }, retryDelay);

      } else {
        request.reject(error);
      }
    } finally {
      // Release the request slot
      this.releaseRequest(key);

      // Process next request in queue
      setTimeout(() => this.processQueue(key), 100);
    }
  }

  /**
   * Set extended backoff mode
   */
  setExtendedBackoff(enabled) {
    this.isExtendedBackoff = enabled;
    if (enabled) {
      // Increase delays for extended backoff
      Object.keys(this.minimumDelays).forEach(source => {
        this.minimumDelays[source] *= 2;
      });
    }
  }

  /**
   * Get queue status for monitoring
   */
  getQueueStatus() {
    const status = {};
    for (const [key, queue] of this.requestQueues) {
      status[key] = {
        queueLength: queue.length,
        activeRequests: this.activeRequests.get(key) || 0,
        maxConcurrent: this.maxConcurrentRequests[key] || 1,
        lastRequest: this.lastRequestTimes.get(key) || 0
      };
    }
    return status;
  }

  recordSuccess() {
    this.consecutiveErrors = 0;
    this.backoffMultiplier = 1;

    if (this.circuitBreaker.state === 'HALF_OPEN') {
      this.circuitBreaker.state = 'CLOSED';
      this.circuitBreaker.failures = 0;
    }
  }

  recordFailure() {
    this.consecutiveErrors++;
    this.circuitBreaker.failures++;

    if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
      this.circuitBreaker.state = 'OPEN';
      this.circuitBreaker.nextAttempt = Date.now() + this.circuitBreaker.timeout;
    }
  }
}

// Create singleton instance
const sharedRateLimiter = new SharedRateLimiter();

module.exports = sharedRateLimiter;