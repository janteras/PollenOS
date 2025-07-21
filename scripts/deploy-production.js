#!/usr/bin/env node

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const LivePollenTradingBot = require('../src/live-trading-bot');
const logger = require('../src/modules/logger');

/**
 * Production Deployment Script
 * Validates environment and deploys live trading bot
 */
class ProductionDeployment {
  constructor() {
    this.requiredEnvVars = [
      'WALLET_PRIVATE_KEY',
      'AVALANCHE_RPC_URL',
      'PLN_TOKEN_ADDRESS',
      'VEPLN_CONTRACT_ADDRESS'
    ];
    
    this.contractAddresses = {
      plnToken: '0x7b2B702706D9b361dfE3f00bD138C0CFDA7FB2Cf',
      vePlnContract: '0x2eCB6F9dF29163758024d416997764922E4528d4',
      pollenDao: '0x8B312F4503790CBd1030b97C545c7F3eFDaDE717'
    };
  }

  /**
   * Main deployment function
   */
  async deploy() {
    try {
      console.log('🚀 Starting Production Deployment...');
      console.log('⚠️  WARNING: This will use REAL funds on Avalanche Mainnet!');
      
      // Load production environment
      this.loadProductionEnvironment();
      
      // Validate environment
      await this.validateEnvironment();
      
      // Verify contracts
      await this.verifyContracts();
      
      // Check wallet balance
      await this.checkWalletBalance();
      
      // Deploy trading bot
      await this.deployTradingBot();
      
      console.log('✅ Production deployment completed successfully!');
      
    } catch (error) {
      console.error('❌ Production deployment failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Load production environment variables
   */
  loadProductionEnvironment() {
    const productionEnvPath = path.join(__dirname, '..', 'production.env');
    
    if (fs.existsSync(productionEnvPath)) {
      console.log('📄 Loading production environment...');
      const envContent = fs.readFileSync(productionEnvPath, 'utf8');
      
      envContent.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value && !key.startsWith('#')) {
          process.env[key.trim()] = value.trim();
        }
      });
      
      console.log('✅ Production environment loaded');
    } else {
      throw new Error('production.env file not found. Please create it first.');
    }
  }

  /**
   * Validate required environment variables
   */
  async validateEnvironment() {
    console.log('🔍 Validating environment...');
    
    const missing = this.requiredEnvVars.filter(key => !process.env[key] || process.env[key] === 'your_actual_private_key_here');
    
    if (missing.length > 0) {
      throw new Error(`Missing or placeholder environment variables: ${missing.join(', ')}`);
    }
    
    // Validate private key format
    if (!process.env.WALLET_PRIVATE_KEY.startsWith('0x') || process.env.WALLET_PRIVATE_KEY.length !== 66) {
      throw new Error('Invalid private key format. Must be 64 characters with 0x prefix.');
    }
    
    // Validate network
    if (process.env.NETWORK !== 'avalanche-mainnet') {
      throw new Error('Network must be set to avalanche-mainnet for production');
    }
    
    // Validate trading mode
    if (process.env.TRADING_MODE !== 'LIVE' || process.env.SIMULATION_MODE === 'true') {
      throw new Error('Trading mode must be LIVE and simulation mode must be false');
    }
    
    console.log('✅ Environment validation passed');
  }

  /**
   * Verify Pollen contracts on Avalanche Mainnet
   */
  async verifyContracts() {
    console.log('🔗 Verifying Pollen contracts...');
    
    const provider = new ethers.JsonRpcProvider(process.env.AVALANCHE_RPC_URL);
    
    // Verify network
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== 43114) {
      throw new Error(`Expected Avalanche Mainnet (43114), got ${network.chainId}`);
    }
    
    // Verify PLN token
    const plnToken = new ethers.Contract(
      this.contractAddresses.plnToken,
      ['function name() view returns (string)', 'function symbol() view returns (string)'],
      provider
    );
    
    const tokenName = await plnToken.name();
    const tokenSymbol = await plnToken.symbol();
    
    if (tokenName !== 'Pollen' || tokenSymbol !== 'PLN') {
      throw new Error(`Invalid PLN token. Expected Pollen/PLN, got ${tokenName}/${tokenSymbol}`);
    }
    
    // Verify vePLN contract
    const vePlnContract = new ethers.Contract(
      this.contractAddresses.vePlnContract,
      ['function name() view returns (string)'],
      provider
    );
    
    const vePlnName = await vePlnContract.name();
    if (vePlnName !== 'Locked Pollen') {
      throw new Error(`Invalid vePLN contract. Expected 'Locked Pollen', got '${vePlnName}'`);
    }
    
    console.log('✅ Contract verification passed');
    console.log(`   PLN Token: ${tokenName} (${tokenSymbol})`);
    console.log(`   vePLN Contract: ${vePlnName}`);
  }

  /**
   * Check wallet balance and permissions
   */
  async checkWalletBalance() {
    console.log('💰 Checking wallet balance...');
    
    const provider = new ethers.JsonRpcProvider(process.env.AVALANCHE_RPC_URL);
    const wallet = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, provider);
    
    // Check AVAX balance for gas
    const avaxBalance = await provider.getBalance(wallet.address);
    const avaxFormatted = ethers.utils.formatEther(avaxBalance);
    
    if (parseFloat(avaxFormatted) < 0.1) {
      throw new Error(`Insufficient AVAX for gas fees. Need at least 0.1 AVAX, have ${avaxFormatted}`);
    }
    
    // Check PLN balance
    const plnToken = new ethers.Contract(
      this.contractAddresses.plnToken,
      ['function balanceOf(address) view returns (uint256)'],
      provider
    );
    
    const plnBalance = await plnToken.balanceOf(wallet.address);
    const plnFormatted = ethers.utils.formatEther(plnBalance);
    
    const minPlnRequired = parseFloat(process.env.MIN_PLN_STAKE || '10');
    if (parseFloat(plnFormatted) < minPlnRequired) {
      throw new Error(`Insufficient PLN balance. Need at least ${minPlnRequired} PLN, have ${plnFormatted}`);
    }
    
    console.log('✅ Wallet balance check passed');
    console.log(`   Wallet Address: ${wallet.address}`);
    console.log(`   AVAX Balance: ${avaxFormatted} AVAX`);
    console.log(`   PLN Balance: ${plnFormatted} PLN`);
  }

  /**
   * Deploy and start the live trading bot
   */
  async deployTradingBot() {
    console.log('🤖 Deploying live trading bot...');
    
    const bot = new LivePollenTradingBot();
    
    // Initialize bot
    await bot.initialize();
    
    // Start trading
    await bot.startTrading();
    
    console.log('✅ Live trading bot deployed and started');
    console.log('📊 Bot Status:', bot.getStatus());
    
    // Set up graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Received shutdown signal...');
      await bot.stopTrading();
      console.log('✅ Trading bot stopped gracefully');
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.log('\n🛑 Received termination signal...');
      await bot.stopTrading();
      console.log('✅ Trading bot stopped gracefully');
      process.exit(0);
    });
    
    // Keep process alive
    console.log('🔄 Trading bot is running. Press Ctrl+C to stop.');
    
    // Log status every 5 minutes
    setInterval(() => {
      const status = bot.getStatus();
      console.log(`📊 Status Update: ${status.activePositions} active positions, Last rebalance: ${status.lastRebalance || 'Never'}`);
    }, 5 * 60 * 1000);
  }
}

// Run deployment if called directly
if (require.main === module) {
  const deployment = new ProductionDeployment();
  deployment.deploy().catch(error => {
    console.error('Deployment failed:', error);
    process.exit(1);
  });
}

module.exports = ProductionDeployment; 