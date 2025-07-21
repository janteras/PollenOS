/**
 * Setup wizard for Pollen Trading Bot
 * Helps users configure the bot without needing technical knowledge
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { ethers } = require('ethers');
const logger = require('./modules/logger');

// Create readline interface for command-line interaction
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Run the setup wizard
 */
async function runSetup() {
  console.log('\n\x1b[36m=================================================\x1b[0m');
  console.log('\x1b[36m           Pollen Trading Bot Setup Wizard\x1b[0m');
  console.log('\x1b[36m=================================================\x1b[0m\n');
  console.log('This wizard will help you configure your Pollen Trading Bot.\n');
  
  const config = await collectConfiguration();
  
  await saveConfiguration(config);
  
  console.log('\n\x1b[32mSetup completed successfully!\x1b[0m');
  console.log('\x1b[32mYou can now start the bot with: npm start\x1b[0m\n');
  
  rl.close();
  process.exit(0);
}

/**
 * Collect configuration from user
 */
async function collectConfiguration() {
  const config = {};
  
  // Check for existing configuration
  const configPath = path.resolve('./config/.env');
  if (fs.existsSync(configPath)) {
    const useExisting = await askQuestion('Existing configuration found. Do you want to use it as a starting point? (y/n): ');
    if (useExisting.toLowerCase() === 'y') {
      // Load existing configuration
      const envFile = fs.readFileSync(configPath, 'utf8');
      const envLines = envFile.split('\n');
      
      // Parse .env file into config object
      for (const line of envLines) {
        if (line.trim() && !line.startsWith('#')) {
          const [key, ...valueParts] = line.split('=');
          if (key) {
            config[key] = valueParts.join('=').trim();
          }
        }
      }
      
      console.log('Loaded existing configuration. You can update any values below.');
    }
  }
  
  console.log('\n\x1b[33m1. Blockchain Configuration\x1b[0m');
  
  // Network selection
  config.NETWORK = await askQuestion('Select network (avalanche, base, avalanche-testnet, base-testnet) [default: avalanche]: ', config.NETWORK || 'avalanche');
  
  // Private key
  let privateKey = await askQuestion('Enter your Ethereum Private Key (leave empty to skip): ', config.ETHEREUM_PRIVATE_KEY || '');
  if (privateKey) {
    // Validate and format private key
    try {
      if (!privateKey.startsWith('0x')) {
        privateKey = '0x' + privateKey;
      }
      new ethers.Wallet(privateKey); // Will throw if invalid
      config.ETHEREUM_PRIVATE_KEY = privateKey;
    } catch (error) {
      console.log('\x1b[31mInvalid private key. Please enter a valid private key.\x1b[0m');
      config.ETHEREUM_PRIVATE_KEY = await askQuestion('Enter a valid Ethereum Private Key: ');
    }
  }
  
  console.log('\n\x1b[33m2. Pollen Configuration\x1b[0m');
  
  // Pollen contract addresses
  if (config.NETWORK.includes('avalanche')) {
    config.POLLEN_CONTRACT_AVALANCHE = await askQuestion('Pollen contract address on Avalanche: ', config.POLLEN_CONTRACT_AVALANCHE || '0x');
    config.POLLEN_CONTRACT_AVALANCHE_TESTNET = await askQuestion('Pollen contract address on Avalanche Testnet: ', config.POLLEN_CONTRACT_AVALANCHE_TESTNET || '0x');
  } else {
    config.POLLEN_CONTRACT_BASE = await askQuestion('Pollen contract address on Base: ', config.POLLEN_CONTRACT_BASE || '0x');
    config.POLLEN_CONTRACT_BASE_TESTNET = await askQuestion('Pollen contract address on Base Testnet: ', config.POLLEN_CONTRACT_BASE_TESTNET || '0x');
  }
  
  console.log('\n\x1b[33m3. Trading Strategy Configuration\x1b[0m');
  
  // Trading interval
  const tradingIntervalHours = await askQuestion('Trading interval in hours [default: 1]: ', (config.TRADING_INTERVAL ? (parseInt(config.TRADING_INTERVAL) / 3600000).toString() : '1'));
  config.TRADING_INTERVAL = (parseFloat(tradingIntervalHours) * 3600000).toString();
  
  // Max allocation
  config.MAX_ALLOCATION_PERCENT = await askQuestion('Maximum allocation per asset in percentage [default: 20]: ', config.MAX_ALLOCATION_PERCENT || '20');
  
  // Risk level
  config.RISK_LEVEL = await askQuestion('Risk level (low, medium, high) [default: medium]: ', config.RISK_LEVEL || 'medium');
  
  console.log('\n\x1b[33m4. TradingView Configuration\x1b[0m');
  
  // TradingView credentials (optional)
  console.log('TradingView credentials (optional for enhanced data access)');
  config.TRADINGVIEW_USERNAME = await askQuestion('TradingView username (leave empty to skip): ', config.TRADINGVIEW_USERNAME || '');
  if (config.TRADINGVIEW_USERNAME) {
    config.TRADINGVIEW_PASSWORD = await askQuestion('TradingView password: ', config.TRADINGVIEW_PASSWORD || '');
  }
  
  console.log('\n\x1b[33m5. Bot Configuration\x1b[0m');
  
  // Auto rebalance
  const autoRebalance = await askQuestion('Enable automatic rebalancing (y/n) [default: y]: ', config.AUTO_REBALANCE === 'true' ? 'y' : config.AUTO_REBALANCE === 'false' ? 'n' : 'y');
  config.AUTO_REBALANCE = (autoRebalance.toLowerCase() === 'y').toString();
  
  // Rebalance threshold
  config.REBALANCE_THRESHOLD = await askQuestion('Rebalance threshold percentage [default: 5]: ', config.REBALANCE_THRESHOLD || '5');
  
  // Log level
  config.LOG_LEVEL = await askQuestion('Log level (debug, info, warn, error) [default: info]: ', config.LOG_LEVEL || 'info');
  
  console.log('\n\x1b[33m6. Neuron Configuration\x1b[0m');
  
  // Neuron thesis
  config.NEURON_THESIS = await askQuestion('Trading thesis (short description of your strategy): ', config.NEURON_THESIS || 'Trading based on technical indicators');
  
  console.log('\n\x1b[33m7. RPC Provider Configuration\x1b[0m');
  
  // Infura API key
  config.INFURA_API_KEY = await askQuestion('Infura API key: ', config.INFURA_API_KEY || '');
  
  // Bot ID (for staggered requests)
  config.BOT_ID = await askQuestion('Bot ID (number from 1-5 for multiple bot setups): ', config.BOT_ID || '1');
  
  console.log('\n\x1b[33m8. Etherscan API Configuration (For contract verification)\x1b[0m');
  
  // API keys (optional)
  console.log('API keys (optional, for contract verification)');
  
  if (config.NETWORK.includes('avalanche')) {
    config.SNOWTRACE_API_KEY = await askQuestion('Snowtrace API key (leave empty to skip): ', config.SNOWTRACE_API_KEY || '');
  } else {
    config.BASESCAN_API_KEY = await askQuestion('BaseScan API key (leave empty to skip): ', config.BASESCAN_API_KEY || '');
  }
  
  return config;
}

/**
 * Save configuration to .env file
 */
async function saveConfiguration(config) {
  try {
    // Ensure config directory exists
    const configDir = path.resolve('./config');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    // Create .env content
    let envContent = '# Pollen Trading Bot Configuration\n';
    envContent += '# Generated by setup wizard on ' + new Date().toISOString() + '\n\n';
    
    // Add config sections
    envContent += '# Blockchain Configuration\n';
    envContent += `NETWORK=${config.NETWORK || 'avalanche'}\n`;
    envContent += `ETHEREUM_PRIVATE_KEY=${config.ETHEREUM_PRIVATE_KEY || ''}\n\n`;
    
    envContent += '# Pollen Configuration\n';
    envContent += 'POLLEN_API_URL=https://app.pollen.id/api\n';
    envContent += `POLLEN_CONTRACT_AVALANCHE=${config.POLLEN_CONTRACT_AVALANCHE || '0x'}\n`;
    envContent += `POLLEN_CONTRACT_BASE=${config.POLLEN_CONTRACT_BASE || '0x'}\n`;
    envContent += `POLLEN_CONTRACT_AVALANCHE_TESTNET=${config.POLLEN_CONTRACT_AVALANCHE_TESTNET || '0x'}\n`;
    envContent += `POLLEN_CONTRACT_BASE_TESTNET=${config.POLLEN_CONTRACT_BASE_TESTNET || '0x'}\n\n`;
    
    envContent += '# RPC Provider Configuration\n';
    envContent += `INFURA_API_KEY=${config.INFURA_API_KEY || ''}\n`;
    envContent += `BOT_ID=${config.BOT_ID || '1'}\n\n`;
    
    envContent += '# Etherscan API Configuration\n';
    envContent += `ETHERSCAN_API_KEY=${config.ETHERSCAN_API_KEY || ''}\n`;
    envContent += `SNOWTRACE_API_KEY=${config.SNOWTRACE_API_KEY || ''}\n`;
    envContent += `BASESCAN_API_KEY=${config.BASESCAN_API_KEY || ''}\n\n`;
    
    envContent += '# Trading Strategy Configuration\n';
    envContent += `TRADING_INTERVAL=${config.TRADING_INTERVAL || '3600000'}\n`;
    envContent += `MAX_ALLOCATION_PERCENT=${config.MAX_ALLOCATION_PERCENT || '20'}\n`;
    envContent += `RISK_LEVEL=${config.RISK_LEVEL || 'medium'}\n\n`;
    
    envContent += '# TradingView Data Source\n';
    envContent += `TRADINGVIEW_USERNAME=${config.TRADINGVIEW_USERNAME || ''}\n`;
    envContent += `TRADINGVIEW_PASSWORD=${config.TRADINGVIEW_PASSWORD || ''}\n\n`;
    
    envContent += '# Bot Configuration\n';
    envContent += `AUTO_REBALANCE=${config.AUTO_REBALANCE || 'true'}\n`;
    envContent += `REBALANCE_THRESHOLD=${config.REBALANCE_THRESHOLD || '5'}\n`;
    envContent += `LOG_LEVEL=${config.LOG_LEVEL || 'info'}\n\n`;
    
    envContent += '# Neuron Configuration\n';
    envContent += `NEURON_THESIS="${config.NEURON_THESIS || 'Trading based on technical indicators'}"\n`;
    
    // Write to .env file
    fs.writeFileSync(path.resolve('./config/.env'), envContent);
    
    console.log('\n\x1b[32mConfiguration saved to ./config/.env\x1b[0m');
  } catch (error) {
    console.error('\n\x1b[31mError saving configuration:', error.message, '\x1b[0m');
    throw error;
  }
}

/**
 * Helper to ask questions in the terminal
 */
function askQuestion(question, defaultValue = '') {
  return new Promise((resolve) => {
    const defaultText = defaultValue ? ` [${defaultValue}]` : '';
    rl.question(`${question}${defaultText}: `, (answer) => {
      resolve(answer || defaultValue);
    });
  });
}

module.exports = {
  runSetup
};

// Allow direct execution
if (require.main === module) {
  runSetup().catch(console.error);
}
