const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
require('dotenv').config({ path: path.resolve(__dirname, '../base-sepolia.env') });

// Helper function to safely parse ether amounts
const parseEtherSafe = (value, defaultValue = '1') => {
  try {
    return ethers.utils.parseEther(value || defaultValue);
  } catch (error) {
    return ethers.utils.parseEther(defaultValue);
  }
};

// Export the configuration
module.exports = {
  network: {
    name: process.env.NETWORK || 'base-sepolia',
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
    chainId: parseInt(process.env.CHAIN_ID || '84532'),
    explorerUrl: 'https://sepolia.basescan.org',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    }
  },
  wallet: {
    privateKey: process.env.WALLET_PRIVATE_KEY,
    address: process.env.WALLET_ADDRESS
  },
  contracts: {
    virtualContract: process.env.LEAGUES_CONTRACT_ADDRESS,
    plnToken: process.env.PLN_TOKEN_ADDRESS,
    pollenDAO: process.env.POLLEN_DAO_ADDRESS,
    vePLN: process.env.VEPLN_CONTRACT_ADDRESS,
    leagues: process.env.LEAGUES_CONTRACT_ADDRESS
  },
  trading: {
    minTradeSize: parseEtherSafe(process.env.MIN_PLN_STAKE, '1'),
    maxTradeSize: parseEtherSafe(process.env.MAX_POSITION_SIZE, '50'),
    maxSlippage: parseFloat(process.env.MAX_SLIPPAGE || '0.05'),
    gasLimitMultiplier: 1.2,
    maxGasPrice: ethers.utils.parseUnits('200', 'gwei'),
    minRebalanceThreshold: parseFloat(process.env.REBALANCE_THRESHOLD || '0.05'),
    maxRebalanceThreshold: 0.2,
    rebalanceCooldown: 24 * 60 * 60,
    optimizationWindow: 24 * 60 * 60,
    minStakeAmount: parseEtherSafe(process.env.MIN_PLN_STAKE, '1'),
    maxStakeAmount: ethers.utils.parseEther('100000')
  }
};
