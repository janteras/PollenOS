// Base Sepolia Network Configuration
const { ethers } = require('ethers');

// Helper function to validate addresses
function validateAddress(address, name) {
    if (!ethers.utils.isAddress(address)) {
        throw new Error(`Invalid ${name} address: ${address}`);
    }
    return address;
}

module.exports = {
  // Network RPC URL - Using a reliable provider
  RPC_URL: 'https://sepolia.base.org', // Base Sepolia
  
  // Gas settings
  GAS: {
    LIMIT: 1000000,
    MULTIPLIER: 1.2
  },
  
  // Contract addresses (Base Sepolia)
  CONTRACTS: {
    // Core Protocol Contracts
    POLLEN_DAO: validateAddress('0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7', 'PollenDAO'),
    LEAGUES: validateAddress('0x55F04Ee2775925b80125F412C05cF5214Fd1317a', 'Leagues'),
    VEPLN: validateAddress('0x3a28AB567b661B3edaF9Ef0bDE9489558EDB3995', 'vePLN'),
    PLN: validateAddress('0x9E1c51E1fAa1381D8a7Dbdd19402c5fCce9274C6', 'PLN'),
    
    // Portfolio contract (not yet found)
    PORTFOLIO: null, // Will be set when found
    
    // Token addresses (example tokens - replace with actual)
    TOKENS: {
      WETH: '0x4200000000000000000000000000000000000006', // Wrapped ETH on Base
      USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Mock USDC
      DAI: '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707', // Mock DAI
      WBTC: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0'  // Mock WBTC
    }
  },
  
  // Address validation on init
  validateAddresses() {
    try {
      Object.entries(this.CONTRACTS).forEach(([key, value]) => {
        if (value) validateAddress(value, key);
      });
      return true;
    } catch (error) {
      console.error('Configuration validation failed:', error.message);
      return false;
    }
  },
  
  // Default staking parameters
  STAKING: {
    DEFAULT_AMOUNT: '1.0', // Default amount to stake in PLN
    DEFAULT_LOCK_DAYS: 30,  // Default lock period in days
    MIN_LOCK_DAYS: 7,      // Minimum lock period in days
    MAX_LOCK_DAYS: 1460    // ~4 years max lock
  },
  
  // Default portfolio configuration
  PORTFOLIO: {
    // Default weights (sum should be 10000 = 100%)
    DEFAULT_WEIGHTS: [4000, 3000, 2000, 1000], // 40% WETH, 30% USDC, 20% DAI, 10% WBTC
    
    // Rebalancing settings
    REBALANCE_THRESHOLD: 200, // 2% threshold for rebalancing
    MAX_SLIPPAGE: 50,        // 0.5% max slippage
    
    // Asset configuration
    ASSETS: [
      '0x4200000000000000000000000000000000000006', // WETH
      '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // USDC
      '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707', // DAI
      '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0'  // WBTC
    ]
  },
  
  // Bot configuration
  BOTS: {
    COUNT: 5, // Number of trading bots to run
    INTERVAL: 300, // 5 minutes between operations
    MAX_TRADE_SIZE: '0.1', // Max trade size in ETH equivalent
    GAS_PRICE_CAP: '100', // Max gas price in gwei
    
    // Bot strategies (example configurations)
    STRATEGIES: [
      { name: 'conservative', risk: 'low', maxDrawdown: 0.05 },
      { name: 'balanced', risk: 'medium', maxDrawdown: 0.10 },
      { name: 'aggressive', risk: 'high', maxDrawdown: 0.20 },
      { name: 'arbitrage', risk: 'high', maxDrawdown: 0.15 },
      { name: 'market_maker', risk: 'medium', maxDrawdown: 0.08 }
    ]
  },
  
  // API endpoints
  APIS: {
    PRICE_FEED: 'https://api.coingecko.com/api/v3/simple/price',
    GAS_STATION: 'https://api.etherscan.io/api?module=gastracker&action=gasoracle',
    SUBGRAPH: 'https://api.thegraph.com/subgraphs/name/your-org/your-subgraph'
  }
};
