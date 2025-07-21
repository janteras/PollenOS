#!/usr/bin/env node
/**
 * Pollen Trading Bot Deployment Script
 * 
 * Deploys the enhanced trading bot with actual ABI integration
 * Tests contract connections and elizaOS framework setup
 * 
 * Usage: node scripts/deploy-pollen-bot.js [--testnet] [--verify-only]
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const logger = require('../src/modules/logger');
const PollenContractInterface = require('../src/modules/pollen-contract-interface');

// Command line arguments
const args = process.argv.slice(2);
const isTestnet = args.includes('--testnet');
const verifyOnly = args.includes('--verify-only');

// Configuration
const CONFIG = {
  NETWORK: isTestnet ? 'fuji' : 'avalanche',
  RPC_URL: isTestnet 
    ? process.env.AVALANCHE_FUJI_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc'
    : process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
  CHAIN_ID: isTestnet ? 43113 : 43114,
  
  // Contract addresses (mainnet)
  CONTRACTS: {
    VEPLN: '0x2eCB6F9dF29163758024d416997764922E4528d4',
    PLN_TOKEN: '0x7b2B702706D9b361dfE3f00bD138C0CFDA7FB2Cf',
    POLLEN_DAO: '0x8B312F4503790CBd1030b97C545c7F3eFDaDE717'
  },
  
  // elizaOS configuration
  ELIZAOS: {
    CHARACTER_PATH: './elizaos/characters/pollen-trading-bot.character.json',
    ACTIONS_DIR: './elizaos/actions',
    REQUIRED_ACTIONS: ['stake_pln.js', 'rebalance_portfolio.js', 'analyze_market.js', 'check_portfolio.js']
  }
};

async function main() {
  try {
    console.log(`🚀 Deploying Pollen Trading Bot (${CONFIG.NETWORK.toUpperCase()})`);
    console.log(`⚡ Network: ${CONFIG.NETWORK} (Chain ID: ${CONFIG.CHAIN_ID})`);
    console.log(`🔗 RPC URL: ${CONFIG.RPC_URL}`);
    console.log('='.repeat(60));
    
    // Step 1: Environment validation
    await validateEnvironment();
    
    // Step 2: Network and contract verification
    await verifyNetwork();
    
    // Step 3: Contract ABI validation
    await validateContractABI();
    
    // Step 4: elizaOS framework validation
    await validateElizaOSFramework();
    
    if (verifyOnly) {
      console.log('✅ Verification complete - all systems ready!');
      return;
    }
    
    // Step 5: Deploy trading bot components
    await deployTradingBot();
    
    // Step 6: Run integration tests
    await runIntegrationTests();
    
    // Step 7: Generate deployment report
    await generateDeploymentReport();
    
    console.log('\n🎉 Pollen Trading Bot deployment successful!');
    console.log('🔗 Ready for elizaOS integration and trading operations');
    
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

/**
 * Validate environment variables and dependencies
 */
async function validateEnvironment() {
  console.log('\n📋 Step 1: Environment Validation');
  
  const requiredEnvVars = [
    'PRIVATE_KEY',
    'AVALANCHE_RPC_URL',
    'TRADINGVIEW_API_KEY'
  ];
  
  const missing = requiredEnvVars.filter(env => !process.env[env]);
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
  
  // Validate private key format
  if (!process.env.PRIVATE_KEY.startsWith('0x') || process.env.PRIVATE_KEY.length !== 66) {
    throw new Error('Invalid private key format');
  }
  
  console.log('✅ Environment variables validated');
  
  // Check node dependencies
  const requiredPackages = ['ethers', 'axios', 'ws'];
  for (const pkg of requiredPackages) {
    try {
      require(pkg);
      console.log(`✅ ${pkg} package available`);
    } catch (error) {
      throw new Error(`Missing required package: ${pkg}`);
    }
  }
}

/**
 * Verify network connection and wallet setup
 */
async function verifyNetwork() {
  console.log('\n🌐 Step 2: Network Verification');
  
  const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  // Test network connection
  const network = await provider.getNetwork();
  console.log(`🔗 Connected to ${network.name} (Chain ID: ${network.chainId})`);
  
  if (Number(network.chainId) !== CONFIG.CHAIN_ID) {
    throw new Error(`Wrong network. Expected ${CONFIG.CHAIN_ID}, got ${network.chainId}`);
  }
  
  // Check wallet balance
  const balance = await provider.getBalance(wallet.address);
  const avaxBalance = ethers.formatEther(balance);
  
  console.log(`💰 Wallet: ${wallet.address}`);
  console.log(`💎 AVAX Balance: ${avaxBalance}`);
  
  if (parseFloat(avaxBalance) < 0.1) {
    console.warn('⚠️  Low AVAX balance - may not cover gas fees');
  }
  
  console.log('✅ Network connection verified');
}

/**
 * Validate contract ABI and connectivity
 */
async function validateContractABI() {
  console.log('\n📜 Step 3: Contract ABI Validation');
  
  // Check if ABI file exists
  const abiPath = path.join(__dirname, '../attached_assets/0x2ecb6f9df29163758024d416997764922e4528d4.abi.json');
  
  if (!fs.existsSync(abiPath)) {
    throw new Error(`ABI file not found: ${abiPath}`);
  }
  
  // Load and validate ABI
  const abiData = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
  console.log(`📋 ABI loaded: ${abiData.length} functions/events`);
  
  // Verify required functions exist
  const requiredFunctions = [
    'lock', 'unlock', 'increaseLock', 'extendLock', 'updateLock',
    'claimRewards', 'getAvailableRewards', 'locks', 'balanceOf', 'getVotingPower'
  ];
  
  const availableFunctions = abiData
    .filter(item => item.type === 'function')
    .map(item => item.name);
  
  const missingFunctions = requiredFunctions.filter(fn => !availableFunctions.includes(fn));
  
  if (missingFunctions.length > 0) {
    throw new Error(`Missing required functions in ABI: ${missingFunctions.join(', ')}`);
  }
  
  console.log('✅ Contract ABI validated');
  
  // Test contract connectivity
  const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
  const pollenInterface = new PollenContractInterface(provider, process.env.PRIVATE_KEY);
  
  await pollenInterface.verifyContractConnectivity();
  console.log('✅ Contract connectivity verified');
}

/**
 * Validate elizaOS framework setup
 */
async function validateElizaOSFramework() {
  console.log('\n🤖 Step 4: elizaOS Framework Validation');
  
  // Check character configuration
  const characterPath = path.join(__dirname, '..', CONFIG.ELIZAOS.CHARACTER_PATH);
  
  if (!fs.existsSync(characterPath)) {
    throw new Error(`Character file not found: ${characterPath}`);
  }
  
  const characterConfig = JSON.parse(fs.readFileSync(characterPath, 'utf8'));
  console.log(`👤 Character: ${characterConfig.name} (@${characterConfig.username})`);
  console.log(`🎯 Actions: ${characterConfig.actions.length} configured`);
  
  // Validate action files
  const actionsDir = path.join(__dirname, '..', CONFIG.ELIZAOS.ACTIONS_DIR);
  
  for (const actionFile of CONFIG.ELIZAOS.REQUIRED_ACTIONS) {
    const actionPath = path.join(actionsDir, actionFile);
    
    if (!fs.existsSync(actionPath)) {
      throw new Error(`Action file not found: ${actionPath}`);
    }
    
    // Try to load the action
    try {
      const action = require(actionPath);
      if (!action.name || !action.handler) {
        throw new Error(`Invalid action structure in ${actionFile}`);
      }
      console.log(`✅ Action validated: ${action.name}`);
    } catch (error) {
      throw new Error(`Error loading action ${actionFile}: ${error.message}`);
    }
  }
  
  console.log('✅ elizaOS framework validated');
}

/**
 * Deploy trading bot components
 */
async function deployTradingBot() {
  console.log('\n🚀 Step 5: Trading Bot Deployment');
  
  // Initialize main trading bot
  const pollenBot = require('../pollen-trading-bot');
  
  console.log('🔧 Initializing Pollen Trading Bot...');
  await pollenBot.initialize();
  
  console.log('📊 Starting market data feeds...');
  await pollenBot.startMarketDataFeeds();
  
  console.log('⚡ Enabling automated strategies...');
  await pollenBot.enableAutomatedStrategies();
  
  console.log('✅ Trading bot deployed successfully');
}

/**
 * Run integration tests
 */
async function runIntegrationTests() {
  console.log('\n🧪 Step 6: Integration Tests');
  
  const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
  const pollenInterface = new PollenContractInterface(provider, process.env.PRIVATE_KEY);
  
  await pollenInterface.initialize();
  
  // Test 1: Account status retrieval
  console.log('🔍 Testing account status retrieval...');
  const accountStatus = await pollenInterface.getAccountStatus();
  console.log(`✅ Account status: PLN ${accountStatus.balances.pln}, vePLN ${accountStatus.balances.vePln}`);
  
  // Test 2: Lock information
  console.log('🔒 Testing lock information...');
  const lockInfo = await pollenInterface.getLockInfo();
  if (lockInfo) {
    console.log(`✅ Lock info: ${lockInfo.amount} PLN, ${lockInfo.daysRemaining} days remaining`);
  } else {
    console.log('ℹ️  No active lock found');
  }
  
  // Test 3: Rewards check
  console.log('💰 Testing rewards calculation...');
  const availableRewards = await pollenInterface.getAvailableRewards();
  console.log(`✅ Available rewards: ${availableRewards} PLN`);
  
  console.log('✅ Integration tests passed');
}

/**
 * Generate deployment report
 */
async function generateDeploymentReport() {
  console.log('\n📋 Step 7: Deployment Report');
  
  const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const pollenInterface = new PollenContractInterface(provider, process.env.PRIVATE_KEY);
  
  await pollenInterface.initialize();
  
  const report = {
    deployment: {
      timestamp: new Date().toISOString(),
      network: CONFIG.NETWORK,
      chainId: CONFIG.CHAIN_ID,
      wallet: wallet.address
    },
    contracts: {
      vePLN: CONFIG.CONTRACTS.VEPLN,
      plnToken: CONFIG.CONTRACTS.PLN_TOKEN,
      pollenDAO: CONFIG.CONTRACTS.POLLEN_DAO
    },
    account: await pollenInterface.getAccountStatus(),
    elizaOS: {
      character: CONFIG.ELIZAOS.CHARACTER_PATH,
      actions: CONFIG.ELIZAOS.REQUIRED_ACTIONS.length
    }
  };
  
  // Save report to file
  const reportPath = path.join(__dirname, '../deployment-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`📄 Deployment report saved: ${reportPath}`);
  console.log('\n📊 Deployment Summary:');
  console.log(`🌐 Network: ${report.deployment.network} (${report.deployment.chainId})`);
  console.log(`👤 Wallet: ${report.deployment.wallet}`);
  console.log(`💰 PLN Balance: ${report.account.balances.pln}`);
  console.log(`🔒 vePLN Balance: ${report.account.balances.vePln}`);
  console.log(`🗳️  Voting Power: ${report.account.governance.votingPower}`);
  console.log(`🤖 elizaOS Actions: ${report.elizaOS.actions}`);
}

// Run deployment
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  main,
  CONFIG
}; 