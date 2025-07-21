/**
 * RPC Provider module for Pollen Trading Bot
 * Handles load balancing and failover between multiple RPC providers
 * Implements staggered requests and rate limiting based on bot ID
 */
const { Web3 } = require('web3'); // Note: Web3 1.x uses default export, Web3 2.x uses named export
const { ethers } = require('ethers');
const { performance } = require('perf_hooks');
const logger = require('./logger');

class RpcProvider {
  constructor(options = {}) {
    // Secure API key handling with fallbacks
    const infuraKey = options.infuraKey || process.env.INFURA_API_KEY;
    const infuraSecret = process.env.INFURA_API_SECRET; // Should be in Replit Secrets

    if (!infuraKey) {
      logger.warn('Infura API key not found, relying on public RPC only');
    }

    if (infuraSecret) {
      logger.debug('Infura API secret loaded securely from environment');
    }

    // Circuit breaker for rate limiting
    this.circuitBreaker = {
      isOpen: false,
      failureCount: 0,
      lastFailureTime: 0,
      threshold: 3,
      timeout: 60000 // 1 minute circuit breaker timeout
    };

    this.providers = [
      // Primary Infura provider with enhanced security
      {
        name: 'Infura',
        url: `https://avalanche-mainnet.infura.io/v3/${infuraKey}`,
        wsUrl: `wss://avalanche-mainnet.infura.io/ws/v3/${infuraKey}`,
        weight: 10,
        requestCount: 0,
        dailyLimit: 100000, // Free tier daily limit
        isActive: !!infuraKey,
        hasAuth: !!infuraSecret,
        rateLimitBuffer: 0.1 // 10% buffer before hitting limits
      },
      // Backup provider - Avalanche public RPC  
      {
        name: 'Public RPC',
        url: 'https://api.avax.network/ext/bc/C/rpc',
        weight: 5,
        requestCount: 0,
        dailyLimit: 10000, // More conservative for public endpoints
        isActive: true,
        rateLimitBuffer: 0.2 // 20% buffer for public endpoints
      },
      // Additional backup provider
      {
        name: 'Ankr RPC',
        url: 'https://rpc.ankr.com/avalanche',
        weight: 3,
        requestCount: 0,
        dailyLimit: 5000,
        isActive: true,
        rateLimitBuffer: 0.3
      }
    ];

    // Configure provider for the selected network
    if (options.network) {
      this.configureForNetwork(options.network);
    }

    this.lastResetTime = Date.now();
    this.botId = parseInt(options.botId) || 1;
    this.requestDelay = (this.botId - 1) * 5000; // Increase stagger delay to 5 seconds per bot
    this.setupProviders();

    logger.info(`RPC Provider initialized for bot ID ${this.botId}`);
  }

  /**
   * Configure RPC URLs based on the selected network
   */
  configureForNetwork(network) {
    switch (network) {
    case 'avalanche':
      this.providers[0].url = `https://avalanche-mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`;
      this.providers[1].url = 'https://api.avax.network/ext/bc/C/rpc';
      this.networkConfig = {
        chainId: 43114,
        name: 'avalanche',
        ensAddress: null, // Critical: Disable ENS to prevent lookup errors
        _defaultProvider: null, // Disable default provider
        _detectNetwork: false // Disable network detection
      };
      break;
    case 'base':
      this.providers[0].url = `https://base-mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`;
      this.providers[1].url = 'https://mainnet.base.org';
      this.networkConfig = {
        chainId: 8453,
        name: 'base',
        ensAddress: null,
        _defaultProvider: null,
        _detectNetwork: false
      };
      break;
    case 'avalanche-testnet':
      this.providers[0].url = `https://avalanche-fuji.infura.io/v3/${process.env.INFURA_API_KEY}`;
      this.providers[1].url = 'https://api.avax-test.network/ext/bc/C/rpc';
      this.networkConfig = {
        chainId: 43113,
        name: 'avalanche-testnet',
        ensAddress: null,
        _defaultProvider: null,
        _detectNetwork: false
      };
      break;
    case 'base-testnet':
      this.providers[0].url = `https://base-sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`;
      this.providers[1].url = 'https://sepolia.base.org';
      this.networkConfig = {
        chainId: 84532,
        name: 'base-testnet',
        ensAddress: null,
        _defaultProvider: null,
        _detectNetwork: false
      };
      break;
    default:
      logger.warn(`Unknown network: ${network}, using default Avalanche configuration`);
      this.networkConfig = {
        chainId: 43114,
        name: 'avalanche',
        ensAddress: null,
        _defaultProvider: null,
        _detectNetwork: false
      };
    }
  }

  /**
   * Initialize Web3 providers and setup monitoring
   */
  setupProviders() {
    // Validate configuration before starting
    const infuraKey = process.env.INFURA_API_KEY || process.env.INFURA_PROJECT_ID;
    if (!infuraKey || infuraKey === 'undefined' || infuraKey.length < 32) {
      logger.error('Infura API key is missing or invalid. Please add INFURA_API_KEY to Replit Secrets.');
      // Don't throw error, just mark Infura as inactive
      this.providers.forEach(provider => {
        if (provider.name === 'Infura') {
          provider.isActive = false;
          logger.warn('Infura provider deactivated due to missing/invalid API key');
        }
      });
    } else {
      logger.info('Infura API key loaded successfully from environment');
    }

    this.providers.forEach(provider => {
      try {
        // Handle both Web3 v1.x and v2.x initialization syntax
        try {
          provider.web3 = new Web3(provider.url);
        } catch (web3Error) {
          logger.warn(`Failed to initialize with new Web3 constructor: ${web3Error.message}`);
          // Fallback for older Web3 versions if available
          const Web3Fallback = require('web3');
          provider.web3 = new Web3Fallback(provider.url);
        }

        provider.ethersProvider = new ethers.JsonRpcProvider(provider.url);
        logger.info(`Successfully initialized provider ${provider.name}`);
      } catch (error) {
        logger.error(`Failed to initialize provider ${provider.name}: ${error.message}`);
        provider.isActive = false;
      }
    });

    this.rotateProviderDaily();
  }

  /**
   * Reset request counters daily
   */
  rotateProviderDaily() {
    setInterval(() => {
      const now = Date.now();
      // Reset counters every 24 hours (UTC)
      if (now - this.lastResetTime > 24 * 60 * 60 * 1000) {
        this.providers.forEach(provider => {
          provider.requestCount = 0;
          provider.isActive = true;
        });
        this.lastResetTime = now;
        logger.info(`[Bot ${this.botId}] Daily provider reset completed`);
      }
    }, 60 * 60 * 1000); // Check hourly
  }

  /**
   * Get ethers provider for contract interactions with retry logic
   */
  async getEthersProvider() {
    if (!this.ethersProvider) {
      const activeProvider = await this.selectProvider();

      // Create provider with explicit network configuration to prevent ENS lookups
      const networkConfig = {
        chainId: this.networkConfig?.chainId || 43114,
        name: this.networkConfig?.name || 'avalanche',
        ensAddress: null, // Explicitly disable ENS
        _defaultProvider: null // Disable default provider fallback
      };

      let retries = 3;
      while (retries > 0) {
        try {
          this.ethersProvider = new ethers.JsonRpcProvider(
            activeProvider.url,
            networkConfig
          );

          // Test connection
          await this.ethersProvider.getNetwork();

          // Disable ENS resolution at provider level
          this.ethersProvider.getResolver = () => null;
          this.ethersProvider.resolveName = () => null;
          this.ethersProvider.lookupAddress = () => null;

          logger.debug(`Created ethers provider for: ${activeProvider.name} with network: ${networkConfig.name} (ENS disabled)`);
          break;
        } catch (error) {
          retries--;
          logger.warn(`Provider connection failed, retries left: ${retries}`);
          if (retries === 0) {
            // Try next provider
            activeProvider.isActive = false;
            const nextProvider = await this.selectProvider();
            activeProvider.url = nextProvider.url;
            retries = 1; // One more try with new provider
          }
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    return this.ethersProvider;
  }

  /**
   * Select the best provider based on usage and weight
   */
  async selectProvider() {
    // Filter active providers
    const activeProviders = this.providers.filter(p => p.isActive);
    if (activeProviders.length === 0) {
      throw new Error('No active RPC providers available');
    }

    // If circuit breaker is active, prioritize public providers
    if (this.circuitBreaker.isOpen || this.circuitBreaker.failureCount > 0) {
      const publicProviders = activeProviders.filter(p => p.name !== 'Infura');
      if (publicProviders.length > 0) {
        logger.debug(`[Bot ${this.botId}] Using public provider due to rate limiting`);
        return publicProviders[0];
      }
    }

    // Select provider with highest weight and lowest usage ratio
    return activeProviders.reduce((best, current) => {
      const bestRatio = best.requestCount / best.dailyLimit;
      const currentRatio = current.requestCount / current.dailyLimit;

      return currentRatio < bestRatio ? current : best;
    }, activeProviders[0]);
  }

  /**
   * Make a Web3 request with automatic retries and provider selection
   */
  async makeRequest(method, ...args) {
    // Check circuit breaker
    if (this.circuitBreaker.isOpen) {
      const timeSinceFailure = Date.now() - this.circuitBreaker.lastFailureTime;
      if (timeSinceFailure < this.circuitBreaker.timeout) {
        throw new Error('Circuit breaker is open - too many recent failures');
      } else {
        // Reset circuit breaker
        this.circuitBreaker.isOpen = false;
        this.circuitBreaker.failureCount = 0;
      }
    }

    // Implement staggered delay based on bot ID with additional rate limiting
    const baseDelay = this.requestDelay;
    const rateLimitDelay = this.circuitBreaker.failureCount * 10000; // Increase delay to 10 seconds per failure
    const totalDelay = baseDelay + rateLimitDelay;

    logger.debug(`[Bot ${this.botId}] Applying delay of ${totalDelay}ms before request`);
    await new Promise(resolve => setTimeout(resolve, totalDelay));

    const startTime = performance.now();
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        const provider = await this.selectProvider();

        // Execute the request
        const result = await provider.web3.eth[method](...args);

        // Update request count
        provider.requestCount++;

        // Deactivate if near limit
        if (provider.requestCount >= provider.dailyLimit * 0.95) {
          provider.isActive = false;
          logger.warn(`[Bot ${this.botId}] Provider ${provider.name} approaching limit, deactivating`);
        }

        const duration = performance.now() - startTime;
        logger.debug(`[Bot ${this.botId}] Request ${method} completed in ${duration.toFixed(2)}ms (Provider: ${provider.name})`);

        return result;
      } catch (error) {
        attempts++;

        // Handle rate limiting specifically
        if (error.message.includes('Too Many Requests') || error.code === -32005) {
          this.circuitBreaker.failureCount++;
          this.circuitBreaker.lastFailureTime = Date.now();

          if (this.circuitBreaker.failureCount >= this.circuitBreaker.threshold) {
            this.circuitBreaker.isOpen = true;
            logger.error(`[Bot ${this.botId}] Circuit breaker opened due to rate limiting`);
          }

          // Mark Infura as temporarily inactive
          const currentProvider = await this.selectProvider();
          if (currentProvider.name === 'Infura') {
            currentProvider.isActive = false;
            logger.warn(`[Bot ${this.botId}] Temporarily deactivated Infura due to rate limiting`);

            // Reactivate after 5 minutes
            setTimeout(() => {
              currentProvider.isActive = true;
              logger.info(`[Bot ${this.botId}] Reactivated Infura provider`);
            }, 300000);
          }
        }

        // Deactivate the provider if there's a connection error
        if (error.message.includes('connection') || error.message.includes('network')) {
          const currentProvider = await this.selectProvider();
          currentProvider.isActive = false;
          logger.error(`[Bot ${this.botId}] Deactivated provider ${currentProvider.name} due to connection error`);
        }

        if (attempts >= maxAttempts) throw error;

        // Exponential backoff with rate limit consideration
        let backoff = Math.pow(2, attempts) * 1000 + Math.random() * 1000;
        if (error.message.includes('Too Many Requests')) {
          backoff = Math.max(backoff, 30000); // Minimum 30 seconds for rate limit errors
        }

        logger.warn(`[Bot ${this.botId}] Request failed, retrying in ${backoff.toFixed(0)}ms: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, backoff));
      }
    }
  }

  /**
   * Get a Web3 instance from the best available provider
   */
  async getWeb3() {
    const provider = await this.selectProvider();
    return provider.web3;
  }



  /**
   * Create a contract instance using Web3
   */
  async getContract(abi, address) {
    const web3 = await this.getWeb3();
    return new web3.eth.Contract(abi, address);
  }

  /**
   * Create a contract instance using ethers.js
   */
  async getEthersContract(abi, address) {
    const provider = await this.getEthersProvider();
    return new ethers.Contract(address, abi, provider);
  }

  /**
   * Create a contract instance with signer for transactions
   */
  async getEthersContractWithSigner(abi, address) {
    const provider = await this.getEthersProvider();
    const privateKey = process.env.ETHEREUM_PRIVATE_KEY;

    if (!privateKey) {
      throw new Error('Private key not found in environment variables');
    }

    const wallet = new ethers.Wallet(privateKey, provider);
    return new ethers.Contract(address, abi, wallet);
  }

  /**
   * Returns currently active provider.
   */
  async getActiveProvider() {
    // Filter active providers
    const activeProviders = this.providers.filter(p => p.isActive);
    if (activeProviders.length === 0) {
      throw new Error('No active RPC providers available');
    }
    return activeProviders[0]; // Return the first active provider
  }
}

module.exports = RpcProvider;