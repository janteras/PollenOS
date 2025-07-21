// Base Sepolia Configuration
module.exports = {
  // Network settings
  network: {
    name: 'base-sepolia',
    chainId: 84532,
    rpcUrl: 'https://sepolia.base.org',
    explorerUrl: 'https://sepolia.basescan.org',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    }
  },

  // Contract addresses
  contracts: {
    virtualContract: '0x55F04Ee2775925b80125F412C05cF5214Fd1317a',
    plnToken: '0x9E1c51E1fAa1381D8a7Dbdd19402c5fCce9274C6',
    pollenDAO: '0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7',
    leagues: '0x55F04Ee2775925b80125F412C05cF5214Fd1317a',
    vePLN: '0x3a28AB567b661B3edaF9Ef0bDE9489558EDB3995'
  },

  // Trading parameters
  trading: {
    minTradeSize: '0.1', // PLN
    maxTradeSize: '1000', // PLN
    maxSlippage: 0.01, // 1%
    gasLimitMultiplier: 1.2,
    maxGasPrice: '200', // gwei
    
    // Portfolio parameters
    minRebalanceThreshold: 0.05, // 5%
    maxRebalanceThreshold: 0.2, // 20%
    rebalanceCooldown: 86400, // 24 hours in seconds
    optimizationWindow: 86400, // 24 hours in seconds
    
    // Staking parameters
    minStakeAmount: '100', // PLN
    maxStakeAmount: '100000', // PLN
    minLockDuration: 604800, // 7 days in seconds
    maxLockDuration: 31536000, // 1 year in seconds
    optimalLockDuration: 2592000 // 30 days in seconds
  },
  
  // Development flags
  development: {
    skipNetworkValidation: true,
    debug: true
  }
};
