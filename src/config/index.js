// Main configuration file
const path = require('path');
const fs = require('fs');

// Load environment variables - try base-sepolia.env first, then fall back to .env
const baseSepoliaEnvPath = path.join(__dirname, '../../base-sepolia.env');
const defaultEnvPath = path.join(__dirname, '../../config/.env');
const rootEnvPath = path.join(__dirname, '../../.env');

if (fs.existsSync(baseSepoliaEnvPath)) {
  require('dotenv').config({ path: baseSepoliaEnvPath });
  console.log('✅ Loaded Base Sepolia configuration');
} else if (fs.existsSync(rootEnvPath)) {
  require('dotenv').config({ path: rootEnvPath });
  console.log('✅ Loaded root .env configuration');
} else if (fs.existsSync(defaultEnvPath)) {
  require('dotenv').config({ path: defaultEnvPath });
  console.log('✅ Loaded config/.env configuration');
} else {
  console.warn('⚠️ No .env file found, using system environment variables only');
}

// Additional fallback for private key
if (!process.env.PRIVATE_KEY && !process.env.WALLET_PRIVATE_KEY) {
  console.warn('Warning: Missing environment variables: PRIVATE_KEY or WALLET_PRIVATE_KEY');
  console.warn('Some features may not work correctly.');
} else if (process.env.WALLET_PRIVATE_KEY && !process.env.PRIVATE_KEY) {
  console.log('✅ Using WALLET_PRIVATE_KEY from base-sepolia.env');
}

const config = {
  network: {
    name: 'base-sepolia',
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || process.env.RPC_URL || 'https://sepolia.base.org',
    chainId: parseInt(process.env.CHAIN_ID) || 84532,
    explorerUrl: 'https://sepolia.basescan.org'
  },
  wallet: {
    privateKey: process.env.PRIVATE_KEY || process.env.WALLET_PRIVATE_KEY || process.env.PRIVATE_KEY_1,
    address: process.env.WALLET_ADDRESS
  },
  contracts: {
    virtualContract: process.env.LEAGUES_CONTRACT_ADDRESS || process.env.VIRTUAL_CONTRACT_ADDRESS || '0x55F04Ee2775925b80125F412C05cF5214Fd1317a',
    plnToken: '0x9E1c51E1fAa1381D8a7Dbdd19402c5fCce9274C6', // Fixed to match Sepolia Developer Guide
    pollenDAO: process.env.POLLEN_DAO_ADDRESS || '0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7',
    vePLN: process.env.VEPLN_CONTRACT_ADDRESS || '0x3a28AB567b661B3edaF9Ef0bDE9489558EDB3995'
  },
  trading: {
    maxGasPrice: process.env.MAX_GAS_PRICE || '50000000000', // 50 gwei
    slippage: process.env.SLIPPAGE || '0.01', // 1%
    riskProfiles: {
      conservative: {
        defaultAllocation: {
          'USDC': 0.4,
          'USDT': 0.4,
          'PLN': 0.2
        }
      },
      moderate: {
        defaultAllocation: {
          'USDC': 0.3,
          'USDT': 0.3,
          'PLN': 0.4
        }
      },
      aggressive: {
        defaultAllocation: {
          'USDC': 0.2,
          'USDT': 0.2,
          'PLN': 0.6
        }
      }
    }
  },
  monitoring: {
    metricsInterval: 60, // seconds
    notifications: {
      enabled: process.env.NOTIFICATIONS_ENABLED === 'true',
      email: process.env.EMAIL_NOTIFICATIONS === 'true',
      telegram: {
        enabled: process.env.TELEGRAM_ENABLED === 'true',
        botToken: process.env.TELEGRAM_BOT_TOKEN,
        chatId: process.env.TELEGRAM_CHAT_ID
      }
    },
    alertThresholds: {
      drawdown: parseFloat(process.env.MAX_DRAWDOWN || '0.1'), // 10%
      volatility: parseFloat(process.env.MAX_VOLATILITY || '0.2'), // 20%
      portfolioDeviation: parseFloat(process.env.MAX_PORTFOLIO_DEVIATION || '0.05') // 5%
    }
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/pollen-bot.log'
  }
};

// Use wallet from config or environment
let privateKey = config.wallet.privateKey || process.env.PRIVATE_KEY || process.env.WALLET_PRIVATE_KEY;

// Ensure private key has 0x prefix
if (privateKey && !privateKey.startsWith('0x')) {
  privateKey = '0x' + privateKey;
}

config.wallet = {
  privateKey: privateKey,
  address: config.wallet.address || process.env.WALLET_ADDRESS
};

// Validate Base Sepolia specific configuration per Developer Guide
if (config.network.name === 'base-sepolia' || config.network.chainId === 84532) {
  console.log('🔗 Validating Base Sepolia configuration...');

  // Validate network settings
  if (config.network.chainId !== 84532) {
    console.warn('⚠️ Expected Chain ID 84532 for Base Sepolia, got:', config.network.chainId);
  }

  // Validate RPC URL - Fix incorrect Avalanche RPC
  if (config.network.rpcUrl.includes('avax.network') || config.network.rpcUrl.includes('avalanche')) {
    console.error('❌ CRITICAL: Using Avalanche RPC URL for Base Sepolia network!');
    console.error('   Current RPC:', config.network.rpcUrl);
    console.error('   Expected Base Sepolia RPC: https://sepolia.base.org');
    console.error('   Check your environment variables - RPC_URL or BASE_SEPOLIA_RPC_URL may be incorrect');
    config.network.rpcUrl = 'https://sepolia.base.org';
    console.log('✅ Auto-corrected: Using correct Base Sepolia RPC URL');
  } else if (!config.network.rpcUrl.includes('sepolia.base.org') && !config.network.rpcUrl.includes('base-sepolia')) {
    console.warn('⚠️ Using non-standard Base Sepolia RPC URL:', config.network.rpcUrl);
    console.warn('   Expected: https://sepolia.base.org');
  } else {
    console.log('✅ Using correct Base Sepolia RPC URL:', config.network.rpcUrl);
  }

  // Validate contract addresses per Developer Guide
  const expectedContracts = {
    plnToken: '0x9E1c51E1fAa1381D8a7Dbdd19402c5fCce9274C6',
    pollenDAO: '0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7',
    vePLN: '0x3a28AB567b661B3edaF9Ef0bDE9489558EDB3995',
    virtualContract: '0x55F04Ee2775925b80125F412C05cF5214Fd1317a'
  };

  Object.entries(expectedContracts).forEach(([key, expectedAddress]) => {
    if (config.contracts[key] && config.contracts[key].toLowerCase() !== expectedAddress.toLowerCase()) {
      console.warn(`⚠️ Contract address mismatch for ${key}:`);
      console.warn(`   Expected: ${expectedAddress}`);
      console.warn(`   Got: ${config.contracts[key]}`);
    } else if (config.contracts[key]) {
      console.log(`✅ ${key}: ${config.contracts[key]}`);
    }
  });
}

// Validate required configuration with better fallbacks
const requiredEnvVars = ['RPC_URL'];
const missingEnvVars = requiredEnvVars.filter(varName => {
  return !process.env[varName] && 
         !process.env[varName.replace('RPC_URL', 'BASE_SEPOLIA_RPC_URL')] &&
         !config.network.rpcUrl;
});

if (missingEnvVars.length > 0) {
  console.warn(`Warning: Missing environment variables: ${missingEnvVars.join(', ')}`);
  console.warn('Using default Base Sepolia RPC URL as fallback');
}

// Validate contract addresses
if (!config.contracts.plnToken || !config.contracts.vePLN) {
  console.warn('Warning: Missing contract addresses. Bot will run in simulation mode.');
}

// Validate wallet configuration
if (!config.wallet.privateKey) {
  console.warn('Warning: No private key found. Bot will run in monitoring mode only.');
  config.wallet.privateKey = null;
}

// Ensure all required config sections exist
config.trading = config.trading || {};
config.monitoring = config.monitoring || {};
config.logging = config.logging || {};

console.log('✅ Configuration validation completed');

module.exports = config;