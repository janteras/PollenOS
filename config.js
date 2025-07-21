const { ethers } = require('ethers');

module.exports = {
  // Network configuration
  NETWORK: process.env.NETWORK || 'base-sepolia',
  RPC_URL: process.env.RPC_URL || 'https://sepolia.base.org',
  CHAIN_ID: parseInt(process.env.CHAIN_ID) || 84532,
  
  // Contract addresses
  CONTRACTS: {
    VEPLN: '0x3a28AB567b661B3edaF9Ef0bDE9489558EDB3995',
    PLN: '0x0000000000000000000000000000000000000000', // Replace with actual PLN token address
    POLLEN_DAO: '0x0000000000000000000000000000000000000000' // Replace with actual Pollen DAO address
  },
  
  // Gas settings
  GAS: {
    PRICE_MULTIPLIER: 1.2, // 20% higher than estimated
    GAS_LIMIT: 500000,
    MAX_FEE_PER_GAS: '2000000000', // 2 gwei in wei
    MAX_PRIORITY_FEE_PER_GAS: '1500000000' // 1.5 gwei in wei
  },
  
  // Bot settings
  BOT: {
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000, // ms
    LOG_LEVEL: 'info', // error, warn, info, debug
    
    // Default staking parameters (in wei as strings to avoid BigInt issues)
    DEFAULT_STAKE_AMOUNT: '1000000000000000000', // 1 PLN (1e18 wei)
    MIN_STAKE_AMOUNT: '100000000000000000',      // 0.1 PLN
    MAX_STAKE_AMOUNT: '1000000000000000000000',  // 1000 PLN
    
    // Lock durations (in seconds)
    LOCK_DURATIONS: {
      MIN: 604800,          // 1 week
      DEFAULT: 31536000,    // 1 year
      MAX: 126144000        // 4 years
    }
  },
  
  // API endpoints (if needed)
  API: {
    BASE_URL: 'https://api.pollen.xyz',
    TIMEOUT: 10000 // 10 seconds
  },
  
  // Monitoring settings
  MONITORING: {
    ENABLED: true,
    INTERVAL: 300000, // 5 minutes
    METRICS_PORT: 9090
  },
  
  // Helper functions
  parseEther: (amount) => ethers.parseEther(amount.toString()),
  formatEther: (wei) => ethers.formatEther(wei.toString()),
  parseUnits: (amount, unit) => ethers.parseUnits(amount.toString(), unit),
  formatUnits: (amount, unit) => ethers.formatUnits(amount.toString(), unit)
};
