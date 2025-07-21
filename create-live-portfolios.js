
#!/usr/bin/env node

/**
 * Create Live Portfolios for All Bots on Base Sepolia
 * This script creates actual portfolio contracts for each bot
 */

require('dotenv').config({ path: './config/base-sepolia-pods-default.env' });
const { ethers } = require('ethers');
const logger = require('./src/modules/logger');

// Bot configurations with their wallet details
const BOTS = [
  {
    id: 1,
    name: 'Conservative Bot',
    privateKey: 'd74ae2c1a798042c9bbf56f15d2649df6d114e763f9444e2cddcde050900f1d0',
    address: '0x561529036AB886c1FD3D112360383D79fBA9E71c',
    initialStake: '2'
  },
  {
    id: 2,
    name: 'Momentum Bot',
    privateKey: '241083ae625b93b41b555052840c09458c71704889b22774101d21b4d1482e62',
    address: '0x48B2353954496679CF7C73d239bc12098cB0C5B4',
    initialStake: '3'
  },
  {
    id: 3,
    name: 'Technical Bot',
    privateKey: '0aa4b2f50b7efc44721b23a2ef7fc3ab11b658369af23381752c6d86b42628b1',
    address: '0x43f76157E9696302E287181828cB3B0C6B89d31e',
    initialStake: '3'
  },
  {
    id: 4,
    name: 'Mean Reversion Bot',
    privateKey: '7dde37bea0f47ea849c9a7a285f3a277acd81c908accdb501ca036db1a5b11da',
    address: '0xC02764913ce2F23B094F0338a711EFD984024A46',
    initialStake: '4'
  },
  {
    id: 5,
    name: 'Breakout Bot',
    privateKey: '64da71a2688d24c0f970ded84d2d744081e467ae493f4c3256c4f8ee9bb959ee',
    address: '0x00FfF703fa6837A1a46b3DF9B6a047404046379E',
    initialStake: '2'
  },
  {
    id: 6,
    name: 'Scalping Bot',
    privateKey: '01c9ebbb878c20446425a726bd4d47f99620afa3cfcb3103866337054949f87c',
    address: '0xD5404dd1Af9701A5ba8C8064240529594849450D',
    initialStake: '3'
  },
  {
    id: 7,
    name: 'Grid Trading Bot',
    privateKey: 'f56adb2c0b947f7d5f94c63b81a679dda6de49987bc99008779bb57827a600fe',
    address: '0x0E27bFe07Fb67497b093AFA6c94BF76a2A81ee13',
    initialStake: '4'
  }
];

// Base Sepolia contract addresses
const CONTRACTS = {
  plnToken: '0x9E1c51E1fAa1381D8a7Dbdd19402c5fCce9274C6',
  pollenDAO: '0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7',
  leagues: '0x55F04Ee2775925b80125F412C05cF5214Fd1317a'
};

// Contract ABIs
const PLN_TOKEN_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function transfer(address to, uint256 amount) returns (bool)'
];

const POLLEN_DAO_ABI = [
  'function createPortfolio(uint256 _amount, uint256 _lockDuration) returns (address)',
  'function getUserPortfolio(address _user) view returns (address)',
  'function minStakeAmount() view returns (uint256)',
  'function maxStakeAmount() view returns (uint256)',
  'function minLockDuration() view returns (uint256)',
  'function maxLockDuration() view returns (uint256)',
  'event PortfolioCreated(address indexed user, address indexed portfolio, uint256 amount, uint256 lockDuration)'
];

const LEAGUES_ABI = [
  'function getPortfolioValue(address _portfolio) view returns (uint256)',
  'function rebalancePortfolio(address _portfolio, address[] calldata _assets, uint256[] calldata _weights) returns (bool)',
  'function executeArbitrage(address _portfolio, address _tokenIn, address _tokenOut, uint256 _amountIn) returns (bool)'
];

class LivePortfolioCreator {
  constructor() {
    this.provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
    this.createdPortfolios = new Map();
  }

  async createPortfolioForBot(bot) {
    try {
      logger.info(`\n🔄 Creating portfolio for ${bot.name} (Bot ${bot.id})`);
      logger.info('─'.repeat(50));

      // Initialize wallet
      const wallet = new ethers.Wallet(bot.privateKey, this.provider);
      logger.info(`👤 Wallet: ${wallet.address}`);

      // Check balances
      const ethBalance = await this.provider.getBalance(wallet.address);
      logger.info(`💰 ETH Balance: ${ethers.formatEther(ethBalance)}`);

      // Initialize contracts
      const plnToken = new ethers.Contract(CONTRACTS.plnToken, PLN_TOKEN_ABI, wallet);
      const pollenDAO = new ethers.Contract(CONTRACTS.pollenDAO, POLLEN_DAO_ABI, wallet);

      // Check PLN balance
      const plnBalance = await plnToken.balanceOf(wallet.address);
      const plnBalanceFormatted = ethers.formatEther(plnBalance);
      logger.info(`💎 PLN Balance: ${plnBalanceFormatted}`);

      // Check if portfolio already exists
      const existingPortfolio = await pollenDAO.getUserPortfolio(wallet.address);
      if (existingPortfolio !== ethers.ZeroAddress) {
        logger.info(`✅ Portfolio already exists: ${existingPortfolio}`);
        this.createdPortfolios.set(bot.id, existingPortfolio);
        return existingPortfolio;
      }

      // Get staking parameters
      const minStakeAmount = await pollenDAO.minStakeAmount();
      const maxStakeAmount = await pollenDAO.maxStakeAmount();
      const minLockDuration = await pollenDAO.minLockDuration();
      const maxLockDuration = await pollenDAO.maxLockDuration();

      logger.info(`📊 Staking Limits: ${ethers.formatEther(minStakeAmount)} - ${ethers.formatEther(maxStakeAmount)} PLN`);
      logger.info(`⏰ Lock Duration: ${minLockDuration} - ${maxLockDuration} seconds`);

      // Calculate stake amount
      const stakeAmount = ethers.parseEther(bot.initialStake);
      const lockDuration = 86400 * 7; // 7 days

      logger.info(`🎯 Stake Amount: ${bot.initialStake} PLN`);
      logger.info(`🔒 Lock Duration: ${lockDuration} seconds (7 days)`);

      // Check if we have enough PLN
      if (plnBalance < stakeAmount) {
        logger.error(`❌ Insufficient PLN balance. Need: ${bot.initialStake}, Have: ${plnBalanceFormatted}`);
        return null;
      }

      // Check PLN allowance
      const allowance = await plnToken.allowance(wallet.address, CONTRACTS.pollenDAO);
      if (allowance < stakeAmount) {
        logger.info(`🔓 Approving PLN spending...`);
        const approveTx = await plnToken.approve(CONTRACTS.pollenDAO, stakeAmount, {
          gasLimit: 100000,
          gasPrice: ethers.parseUnits('0.1', 'gwei')
        });
        await approveTx.wait();
        logger.info(`✅ PLN approved: ${approveTx.hash}`);
      }

      // Create portfolio
      logger.info(`🏗️ Creating portfolio...`);
      const createTx = await pollenDAO.createPortfolio(stakeAmount, lockDuration, {
        gasLimit: 500000,
        gasPrice: ethers.parseUnits('0.1', 'gwei')
      });

      logger.info(`📡 Transaction submitted: ${createTx.hash}`);
      logger.info(`🔗 Explorer: https://sepolia.basescan.org/tx/${createTx.hash}`);

      // Wait for confirmation
      const receipt = await createTx.wait();
      logger.info(`✅ Portfolio created in block: ${receipt.blockNumber}`);

      // Find portfolio address from events
      const portfolioCreatedEvent = receipt.logs.find(log => {
        try {
          const decoded = pollenDAO.interface.parseLog(log);
          return decoded.name === 'PortfolioCreated';
        } catch (e) {
          return false;
        }
      });

      if (portfolioCreatedEvent) {
        const decoded = pollenDAO.interface.parseLog(portfolioCreatedEvent);
        const portfolioAddress = decoded.args.portfolio;
        logger.info(`🎉 Portfolio Address: ${portfolioAddress}`);
        this.createdPortfolios.set(bot.id, portfolioAddress);
        return portfolioAddress;
      }

      // Fallback: Get portfolio from contract
      const portfolioAddress = await pollenDAO.getUserPortfolio(wallet.address);
      if (portfolioAddress !== ethers.ZeroAddress) {
        logger.info(`🎉 Portfolio Address: ${portfolioAddress}`);
        this.createdPortfolios.set(bot.id, portfolioAddress);
        return portfolioAddress;
      }

      logger.error(`❌ Could not determine portfolio address`);
      return null;

    } catch (error) {
      logger.error(`❌ Error creating portfolio for ${bot.name}:`, error.message);
      return null;
    }
  }

  async createAllPortfolios() {
    logger.info('🚀 Creating Live Portfolios for All Bots');
    logger.info('═'.repeat(60));

    // Validate network
    const network = await this.provider.getNetwork();
    logger.info(`🌐 Connected to Base Sepolia (Chain ID: ${network.chainId})`);

    const results = [];
    
    for (const bot of BOTS) {
      const portfolioAddress = await this.createPortfolioForBot(bot);
      results.push({
        botId: bot.id,
        botName: bot.name,
        botAddress: bot.address,
        portfolioAddress: portfolioAddress,
        success: portfolioAddress !== null
      });

      // Add delay between creations
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Display summary
    logger.info('\n🎉 PORTFOLIO CREATION SUMMARY');
    logger.info('═'.repeat(60));
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    logger.info(`✅ Successfully created: ${successful.length}/${results.length} portfolios`);
    
    if (successful.length > 0) {
      logger.info('\n📊 Created Portfolios:');
      successful.forEach(result => {
        logger.info(`  Bot ${result.botId} (${result.botName}): ${result.portfolioAddress}`);
      });
    }

    if (failed.length > 0) {
      logger.info('\n❌ Failed Portfolios:');
      failed.forEach(result => {
        logger.info(`  Bot ${result.botId} (${result.botName}): Creation failed`);
      });
    }

    return results;
  }
}

// Run the portfolio creator
async function main() {
  const creator = new LivePortfolioCreator();
  
  try {
    const results = await creator.createAllPortfolios();
    
    if (results.some(r => r.success)) {
      logger.info('\n🎯 Next Steps:');
      logger.info('1. Run diagnose-bot-portfolios.js to verify portfolio creation');
      logger.info('2. Update multi-bot-launcher.js to use live portfolios');
      logger.info('3. Start live trading with real blockchain transactions');
    }
    
    process.exit(0);
  } catch (error) {
    logger.error('❌ Portfolio creation failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = LivePortfolioCreator;
