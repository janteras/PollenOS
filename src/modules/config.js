/**
 * Configuration module for Pollen Trading Bot
 * Loads and manages configuration settings
 */
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const logger = require('./logger');
const RpcProvider = require('./rpcProvider');

// Network RPC URLs - Used as fallbacks when Infura is not available
const RPC_URLS = {
  'avalanche': 'https://api.avax.network/ext/bc/C/rpc',
  'base': 'https://mainnet.base.org',
  'avalanche-testnet': 'https://api.avax-test.network/ext/bc/C/rpc',
  'base-testnet': 'https://goerli.base.org',
};

// Contract addresses per network
const CONTRACT_ADDRESSES = {
  'avalanche': process.env.POLLEN_CONTRACT_AVALANCHE,
  'base': process.env.POLLEN_CONTRACT_BASE,
  'avalanche-testnet': process.env.POLLEN_CONTRACT_AVALANCHE_TESTNET,
  'base-testnet': process.env.POLLEN_CONTRACT_BASE_TESTNET,
};

/**
 * Load configuration from environment variables and command line arguments
 */
async function load(argv) {
  try {
    const configFile = path.resolve('./config/.env');

    // Check if config file exists
    if (!fs.existsSync(configFile)) {
      logger.warn('Configuration file not found. Please run setup or create a .env file in the config directory.');
    }

    // Import Pollen assets module for dynamic asset configuration
    const pollenAssets = require('./pollen-assets');

    // Get assets based on risk profile or use default recommended set
    const riskProfile = process.env.RISK_LEVEL === 'low' ? 'conservative' :
      process.env.RISK_LEVEL === 'high' ? 'aggressive' : 'moderate';

    // Build config object
    const config = {
      // Network settings
      network: argv.network || process.env.NETWORK || 'avalanche',
      privateKey: process.env.ETHEREUM_PRIVATE_KEY || process.env.PRIVATE_KEY,

      // Pollen settings
      pollenApiUrl: process.env.POLLEN_API_URL || 'https://app.pollen.id/api',

      // Contract addresses
      contracts: {
        vePLN: '0x2eCB6F9dF29163758024d416997764922E4528d4',
        pollenVirtual: '0x8B312F4503790CBd1030b97C545c7F3eFDaDE717',
        plnToken: '0x7b2B702706D9b361dfE3f00bD138C0CFDA7FB2Cf'
      },

      // Get the appropriate contract address based on the network
      pollenContractAddress: getContractAddress(argv.network || process.env.NETWORK || 'avalanche'),

      // RPC Provider settings
      infuraApiKey: process.env.INFURA_API_KEY,
      botId: process.env.BOT_ID || '1',

      // Etherscan API settings
      etherscanApiKey: process.env.ETHERSCAN_API_KEY,
      snowtraceApiKey: process.env.SNOWTRACE_API_KEY,
      basescanApiKey: process.env.BASESCAN_API_KEY,

      // Trading settings
      tradingInterval: parseInt(process.env.TRADING_INTERVAL || '3600000'),
      maxAllocationPercent: parseInt(process.env.MAX_ALLOCATION_PERCENT || '20'),
      riskLevel: process.env.RISK_LEVEL || 'medium',

      // TradingView settings
      tradingviewUsername: process.env.TRADINGVIEW_USERNAME,
      tradingviewPassword: process.env.TRADINGVIEW_PASSWORD,

      // CryptoCompare settings
      cryptocompareApiKey: process.env.CRYPTOCOMPARE_API_KEY,

      // Bot configuration
      autoRebalance: process.env.AUTO_REBALANCE === 'true',
      rebalanceThreshold: parseInt(process.env.REBALANCE_THRESHOLD || '5'),

      // Neuron settings
      neuronThesis: argv.thesis || process.env.NEURON_THESIS || 'Trading based on technical indicators',

      // Asset management
      assets: process.env.ASSETS ?
        process.env.ASSETS.split(',').map(asset => asset.trim()) :
        pollenAssets.getRecommendedAssets(riskProfile, 12),
      maxAssetCount: parseInt(process.env.MAX_ASSET_COUNT) || 15,
      enableAllAssets: process.env.ENABLE_ALL_ASSETS === 'true',
      priorityAssets: (process.env.PRIORITY_ASSETS || 'WBTC.E,WETH.E,WAVAX,USDT.E').split(',')
    };

    // Validate required configuration
    validateConfig(config);

    return config;
  } catch (error) {
    logger.error('Error loading configuration:', error);
    throw error;
  }
}

/**
 * Validate configuration and ensure all required fields are present
 */
function validateConfig(config) {
  const requiredFields = [
    'network',
    'privateKey',
    'pollenContractAddress'
  ];

  const missingFields = requiredFields.filter(field => !config[field]);

  if (missingFields.length > 0) {
    logger.error(`Missing required configuration: ${missingFields.join(', ')}`);
    throw new Error(`Missing required configuration: ${missingFields.join(', ')}`);
  }

  // Validate network
  const validNetworks = Object.keys(RPC_URLS);
  if (!validNetworks.includes(config.network)) {
    logger.error(`Invalid network: ${config.network}. Must be one of: ${validNetworks.join(', ')}`);
    throw new Error(`Invalid network: ${config.network}`);
  }
}

/**
 * Create and return an optimized RPC provider
 */
function createRpcProvider(config) {
  return new RpcProvider({
    infuraKey: config.infuraApiKey,
    network: config.network,
    botId: config.botId
  });
}

/**
 * Get Ethereum provider for the specified network
 */
async function getProvider(config) {
  try {
    // If we have an Infura key, use our optimized provider
    if (config.infuraApiKey) {
      const rpcProvider = createRpcProvider(config);
      return await rpcProvider.getEthersProvider();
    }

    // Fallback to direct provider with wallet support
    const rpcUrl = RPC_URLS[config.network];
    if (!rpcUrl) {
      throw new Error(`No RPC URL configured for network: ${config.network}`);
    }
    
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Add wallet for transaction support if private key exists
    if (config.privateKey) {
      return new ethers.Wallet(config.privateKey, provider);
    }
    
    return provider;
  } catch (error) {
    logger.error(`Error creating provider: ${error.message}`);
    throw error;
  }
}

/**
 * Get contract address for the specified network
 */
function getContractAddress(network) {
  const address = CONTRACT_ADDRESSES[network];
  if (!address) {
    logger.warn(`No contract address configured for network: ${network}`);
  }
  return address;
}

/**
 * Create and return a Web3 contract instance
 */
async function getContract(config, abi, address) {
  try {
    // If we have an Infura key, use our optimized provider
    if (config.infuraApiKey) {
      const rpcProvider = createRpcProvider(config);
      return await rpcProvider.getContract(abi, address || config.pollenContractAddress);
    }

    // Fallback to direct Web3 instance
    const Web3 = require('web3');
    const rpcUrl = RPC_URLS[config.network];
    if (!rpcUrl) {
      throw new Error(`No RPC URL configured for network: ${config.network}`);
    }
    const web3 = new Web3(rpcUrl);
    return new web3.eth.Contract(abi, address || config.pollenContractAddress);
  } catch (error) {
    logger.error(`Error creating contract: ${error.message}`);
    throw error;
  }
}

module.exports = {
  load,
  getProvider,
  getContractAddress,
  getContract,
  createRpcProvider
};