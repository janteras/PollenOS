require('dotenv').config();
const { ethers } = require('ethers');

// Base configuration
const baseConfig = {
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

  // Wallet configuration
  wallet: {
    privateKey: process.env.BOT1_PRIVATE_KEY || process.env.WALLET_PRIVATE_KEY,
    address: process.env.BOT1_WALLET_ADDRESS || process.env.WALLET_ADDRESS
  },

  // Trading parameters
  trading: {
    minTradeSize: ethers.parseEther('0.1'),
    maxTradeSize: ethers.parseEther('1000'),
    maxSlippage: 0.01,
    gasLimitMultiplier: 1.2,
    maxGasPrice: ethers.parseUnits('200', 'gwei'),
    
    // Portfolio parameters
    minRebalanceThreshold: 0.05,
    maxRebalanceThreshold: 0.2,
    rebalanceCooldown: 24 * 60 * 60,
    optimizationWindow: 24 * 60 * 60,
    
    // Staking parameters
    minStakeAmount: ethers.parseEther('100'),
    maxStakeAmount: ethers.parseEther('100000'),
    minLockDuration: 7 * 24 * 60 * 60,
    maxLockDuration: 365 * 24 * 60 * 60,
    optimalLockDuration: 30 * 24 * 60 * 60
  },
  
  // Development flags
  development: {
    skipNetworkValidation: true,
    debug: true
  }
};

// Export the configuration
module.exports = baseConfig;
