require('dotenv').config();
const fs = require('fs');
const path = require('path');

/**
 * Base Sepolia Configuration Loader
 * Loads and validates configuration for Base Sepolia network
 */
class BaseSepoliaConfigLoader {
  constructor() {
    this.requiredEnvVars = [
      'BASE_SEPOLIA_RPC_URL',
      'POLLEN_DAO_ADDRESS',
      'LEAGUES_CONTRACT_ADDRESS',
      'VEPLN_CONTRACT_ADDRESS',
      'PLN_TOKEN_ADDRESS'
    ];

    this.defaultConfig = {
      network: 'base-sepolia',
      chainId: 84532,
      rpcUrl: 'https://sepolia.base.org',
      gasLimit: 500000,
      maxGasPriceGwei: 20,
      simulationMode: true,
      riskLevel: 'low',
      tradingInterval: 7200000, // 2 hours
      rebalanceThreshold: 3,
      maxAllocation: 15
    };
  }

  /**
     * Load environment configuration
     */
  loadEnvironmentConfig() {
    const config = {
      // Network settings
      network: process.env.NETWORK || this.defaultConfig.network,
      chainId: parseInt(process.env.CHAIN_ID) || this.defaultConfig.chainId,
      rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || this.defaultConfig.rpcUrl,
            
      // Contract addresses
      contracts: {
        pollenDAO: process.env.POLLEN_DAO_ADDRESS,
        leagues: process.env.LEAGUES_CONTRACT_ADDRESS,
        vePLN: process.env.VEPLN_CONTRACT_ADDRESS,
        plnToken: process.env.PLN_TOKEN_ADDRESS
      },

      // Wallet settings
      wallet: {
        privateKey: process.env.WALLET_PRIVATE_KEY,
        address: process.env.WALLET_ADDRESS
      },

      // Trading settings
      trading: {
        mode: process.env.TRADING_MODE || 'SIMULATION',
        simulationMode: process.env.SIMULATION_MODE === 'true',
        minPlnStake: parseFloat(process.env.MIN_PLN_STAKE) || 1,
        maxPositionSize: parseFloat(process.env.MAX_POSITION_SIZE) || 50,
        rebalanceThreshold: parseFloat(process.env.REBALANCE_THRESHOLD) || 0.03,
        maxSlippage: parseFloat(process.env.MAX_SLIPPAGE) || 0.05
      },

      // Gas settings
      gas: {
        gasLimit: parseInt(process.env.GAS_LIMIT) || this.defaultConfig.gasLimit,
        gasPriceGwei: parseFloat(process.env.GAS_PRICE_GWEI) || 0.1,
        priorityFeeGwei: parseFloat(process.env.PRIORITY_FEE_GWEI) || 0.05,
        maxGasPriceGwei: parseFloat(process.env.MAX_GAS_PRICE_GWEI) || this.defaultConfig.maxGasPriceGwei
      },

      // Risk management
      riskManagement: {
        enableStopLoss: process.env.ENABLE_STOP_LOSS === 'true',
        stopLossPercentage: parseFloat(process.env.STOP_LOSS_PERCENTAGE) || 0.10,
        enableTakeProfit: process.env.ENABLE_TAKE_PROFIT === 'true',
        takeProfitPercentage: parseFloat(process.env.TAKE_PROFIT_PERCENTAGE) || 0.20,
        maxDailyTrades: parseInt(process.env.MAX_DAILY_TRADES) || 20
      },

      // ElizaOS settings
      elizaOS: {
        agentId: process.env.ELIZAOS_AGENT_ID || 'pollen-trading-bot-base-sepolia',
        configPath: process.env.ELIZAOS_CONFIG_PATH || 'elizaos/base-sepolia-agent.json',
        actionsDir: process.env.ELIZAOS_ACTIONS_DIR || 'src/actions/base-sepolia/',
        knowledgeDir: process.env.ELIZAOS_KNOWLEDGE_DIR || 'docs/base-sepolia/'
      },

      // Monitoring settings
      monitoring: {
        enableMonitoring: process.env.ENABLE_MONITORING === 'true',
        logLevel: process.env.LOG_LEVEL || 'debug',
        logFilePath: process.env.LOG_FILE_PATH || 'logs/base-sepolia-trading.log',
        enableDebugMode: process.env.ENABLE_DEBUG_MODE === 'true'
      },

      // Performance tracking
      performance: {
        trackPerformance: process.env.TRACK_PERFORMANCE === 'true',
        saveTradeHistory: process.env.SAVE_TRADE_HISTORY === 'true',
        performanceReportInterval: parseInt(process.env.PERFORMANCE_REPORT_INTERVAL) || 86400000
      }
    };

    return config;
  }

  /**
     * Validate configuration
     */
  validateConfig(config) {
    const errors = [];
    const warnings = [];

    // Check required contract addresses
    if (!config.contracts.pollenDAO) {
      errors.push('POLLEN_DAO_ADDRESS is required');
    }
    if (!config.contracts.leagues) {
      errors.push('LEAGUES_CONTRACT_ADDRESS is required');
    }
    if (!config.contracts.vePLN) {
      errors.push('VEPLN_CONTRACT_ADDRESS is required');
    }
    if (!config.contracts.plnToken) {
      errors.push('PLN_TOKEN_ADDRESS is required');
    }

    // Validate contract address format
    const addressPattern = /^0x[a-fA-F0-9]{40}$/;
    Object.entries(config.contracts).forEach(([name, address]) => {
      if (address && !addressPattern.test(address)) {
        errors.push(`Invalid contract address format for ${name}: ${address}`);
      }
    });

    // Check wallet configuration
    if (!config.wallet.privateKey) {
      warnings.push('WALLET_PRIVATE_KEY not set - trading will be disabled');
    }

    // Validate network settings
    if (config.network !== 'base-sepolia') {
      warnings.push(`Network is set to ${config.network}, expected base-sepolia`);
    }
    if (config.chainId !== 84532) {
      warnings.push(`Chain ID is ${config.chainId}, expected 84532 for Base Sepolia`);
    }

    // Validate trading settings
    if (config.trading.maxPositionSize > 100) {
      warnings.push('MAX_POSITION_SIZE is very high - consider lowering for safety');
    }
    if (config.trading.rebalanceThreshold > 0.1) {
      warnings.push('REBALANCE_THRESHOLD is high - may cause frequent rebalancing');
    }

    // Validate gas settings
    if (config.gas.maxGasPriceGwei > 50) {
      warnings.push('MAX_GAS_PRICE_GWEI is very high for Base Sepolia');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
     * Load and validate complete configuration
     */
  load() {
    console.log('📋 Loading Base Sepolia configuration...');
        
    const config = this.loadEnvironmentConfig();
    const validation = this.validateConfig(config);

    if (!validation.isValid) {
      console.error('❌ Configuration validation failed:');
      validation.errors.forEach(error => console.error(`  - ${error}`));
      throw new Error('Invalid configuration');
    }

    if (validation.warnings.length > 0) {
      console.warn('⚠️  Configuration warnings:');
      validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
    }

    console.log('✅ Base Sepolia configuration loaded successfully');
    console.log(`   Network: ${config.network} (Chain ID: ${config.chainId})`);
    console.log(`   RPC URL: ${config.rpcUrl}`);
    console.log(`   Trading Mode: ${config.trading.mode}`);
    console.log(`   Simulation Mode: ${config.trading.simulationMode}`);

    return {
      config,
      validation
    };
  }

  /**
     * Save configuration to file
     */
  saveConfigToFile(config, filePath) {
    try {
      const configDir = path.dirname(filePath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      const configData = {
        timestamp: new Date().toISOString(),
        network: 'base-sepolia',
        ...config
      };

      fs.writeFileSync(filePath, JSON.stringify(configData, null, 2));
      console.log(`✅ Configuration saved to ${filePath}`);
    } catch (error) {
      console.error(`❌ Failed to save configuration: ${error.message}`);
      throw error;
    }
  }

  /**
     * Create default memory files
     */
  createDefaultMemoryFiles() {
    const memoryDir = 'memories/base-sepolia';
        
    if (!fs.existsSync(memoryDir)) {
      fs.mkdirSync(memoryDir, { recursive: true });
    }

    const defaultFiles = [
      {
        name: 'trading-history.json',
        content: {
          created: new Date().toISOString(),
          network: 'base-sepolia',
          trades: []
        }
      },
      {
        name: 'performance.json',
        content: {
          created: new Date().toISOString(),
          network: 'base-sepolia',
          metrics: {}
        }
      },
      {
        name: 'contract-validation.json',
        content: {
          created: new Date().toISOString(),
          network: 'base-sepolia',
          validations: []
        }
      }
    ];

    defaultFiles.forEach(file => {
      const filePath = path.join(memoryDir, file.name);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(file.content, null, 2));
        console.log(`Created memory file: ${filePath}`);
      }
    });
  }
}

/**
 * ElizaOS Loader Function
 */
function loadBaseSepoliaConfig(runtime) {
  try {
    const loader = new BaseSepoliaConfigLoader();
    const result = loader.load();
        
    // Create default memory files
    loader.createDefaultMemoryFiles();
        
    // Store configuration in runtime if available
    if (runtime && runtime.character) {
      runtime.character.baseSepoliaConfig = result.config;
    }
        
    return result;
  } catch (error) {
    console.error('Failed to load Base Sepolia configuration:', error);
    throw error;
  }
}

module.exports = {
  BaseSepoliaConfigLoader,
  loadBaseSepoliaConfig
}; 