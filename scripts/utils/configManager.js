const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

class ConfigManager {
  constructor() {
    this.config = {};
    this.loadConfig();
  }

  loadConfig() {
    try {
      // Load base config
      const baseConfig = require('../../config');
      
      // Load environment variables
      const envConfig = {
        rpcUrl: process.env.RPC_URL || baseConfig.RPC_URL,
        privateKey: process.env.WALLET_PRIVATE_KEY,
        contracts: {
          pln: process.env.PLN_ADDRESS || baseConfig.CONTRACTS.PLN,
          vePln: process.env.VEPLN_ADDRESS || baseConfig.CONTRACTS.VEPLN,
          portfolio: process.env.PORTFOLIO_ADDRESS || baseConfig.CONTRACTS.PORTFOLIO,
          pollenDao: process.env.POLLEN_DAO_ADDRESS || baseConfig.CONTRACTS.POLLEN_DAO
        },
        gas: {
          maxFeePerGas: process.env.MAX_FEE_PER_GAS || '100', // gwei
          maxPriorityFeePerGas: process.env.MAX_PRIORITY_FEE_PER_GAS || '2', // gwei
          gasLimit: process.env.GAS_LIMIT || '1000000'
        },
        strategies: baseConfig.STRATEGIES || {}
      };

      // Validate required config
      this.validateConfig(envConfig);
      
      // Set config with defaults
      this.config = {
        ...envConfig,
        network: baseConfig.NETWORK,
        defaultStrategy: baseConfig.DEFAULT_STRATEGY || 'conservative',
        monitoring: {
          enabled: process.env.MONITORING_ENABLED !== 'false',
          port: process.env.MONITORING_PORT || 3000
        },
        logging: {
          level: process.env.LOG_LEVEL || 'info',
          file: process.env.LOG_FILE || 'logs/pollen-bot.log',
          maxSize: process.env.LOG_MAX_SIZE || '10m',
          maxFiles: process.env.LOG_MAX_FILES || '5'
        }
      };
      
      // Ensure log directory exists
      this.ensureLogDirectory();
      
    } catch (error) {
      console.error('Error loading configuration:', error);
      process.exit(1);
    }
  }
  
  validateConfig(config) {
    const required = [
      'rpcUrl',
      'privateKey',
      'contracts.pln',
      'contracts.vePln',
      'contracts.portfolio',
      'contracts.pollenDao'
    ];
    
    const missing = [];
    
    required.forEach(field => {
      const value = field.split('.').reduce((obj, key) => obj && obj[key], config);
      if (value === undefined || value === null || value === '') {
        missing.push(field);
      }
    });
    
    if (missing.length > 0) {
      throw new Error(`Missing required configuration: ${missing.join(', ')}`);
    }
    
    // Validate wallet private key
    try {
      new ethers.Wallet(config.privateKey);
    } catch (error) {
      throw new Error('Invalid private key in configuration');
    }
    
    // Validate contract addresses
    Object.entries(config.contracts).forEach(([name, address]) => {
      if (!ethers.isAddress(address)) {
        throw new Error(`Invalid ${name.toUpperCase()} contract address: ${address}`);
      }
    });
  }
  
  ensureLogDirectory() {
    const logPath = path.dirname(this.config.logging.file);
    if (!fs.existsSync(logPath)) {
      fs.mkdirSync(logPath, { recursive: true });
    }
  }
  
  get(key, defaultValue = null) {
    return key.split('.').reduce((obj, k) => (obj && obj[k] !== undefined ? obj[k] : defaultValue), this.config);
  }
  
  set(key, value) {
    const keys = key.split('.');
    let current = this.config;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!current[k]) {
        current[k] = {};
      }
      current = current[k];
    }
    
    current[keys[keys.length - 1]] = value;
    return this;
  }
  
  getStrategy(name) {
    const strategy = this.get(`strategies.${name}`);
    if (!strategy) {
      throw new Error(`Strategy '${name}' not found in configuration`);
    }
    return strategy;
  }
  
  getGasSettings() {
    return {
      maxFeePerGas: ethers.parseUnits(this.get('gas.maxFeePerGas', '100'), 'gwei'),
      maxPriorityFeePerGas: ethers.parseUnits(this.get('gas.maxPriorityFeePerGas', '2'), 'gwei'),
      gasLimit: parseInt(this.get('gas.gasLimit', '1000000'))
    };
  }
}

// Export a singleton instance
const configManager = new ConfigManager();
module.exports = configManager;
