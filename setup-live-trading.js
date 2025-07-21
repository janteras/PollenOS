
#!/usr/bin/env node

/**
 * Setup Live Trading System
 * Comprehensive script to prepare all bots for live blockchain trading
 */

require('dotenv').config({ path: './config/base-sepolia-pods-default.env' });
const { ethers } = require('ethers');
const logger = require('./src/modules/logger');

const BOTS = [
  {
    id: 1,
    name: 'Conservative Bot',
    privateKey: 'd74ae2c1a798042c9bbf56f15d2649df6d114e763f9444e2cddcde050900f1d0',
    address: '0x561529036AB886c1FD3D112360383D79fBA9E71c'
  },
  {
    id: 2,
    name: 'Momentum Bot',
    privateKey: '241083ae625b93b41b555052840c09458c71704889b22774101d21b4d1482e62',
    address: '0x48B2353954496679CF7C73d239bc12098cB0C5B4'
  },
  {
    id: 3,
    name: 'Technical Bot',
    privateKey: '0aa4b2f50b7efc44721b23a2ef7fc3ab11b658369af23381752c6d86b42628b1',
    address: '0x43f76157E9696302E287181828cB3B0C6B89d31e'
  },
  {
    id: 4,
    name: 'Mean Reversion Bot',
    privateKey: '7dde37bea0f47ea849c9a7a285f3a277acd81c908accdb501ca036db1a5b11da',
    address: '0xC02764913ce2F23B094F0338a711EFD984024A46'
  },
  {
    id: 5,
    name: 'Breakout Bot',
    privateKey: '64da71a2688d24c0f970ded84d2d744081e467ae493f4c3256c4f8ee9bb959ee',
    address: '0x00FfF703fa6837A1a46b3DF9B6a047404046379E'
  },
  {
    id: 6,
    name: 'Scalping Bot',
    privateKey: '01c9ebbb878c20446425a726bd4d47f99620afa3cfcb3103866337054949f87c',
    address: '0xD5404dd1Af9701A5ba8C8064240529594849450D'
  },
  {
    id: 7,
    name: 'Grid Trading Bot',
    privateKey: 'f56adb2c0b947f7d5f94c63b81a679dda6de49987bc99008779bb57827a600fe',
    address: '0x0E27bFe07Fb67497b093AFA6c94BF76a2A81ee13'
  }
];

const CONTRACTS = {
  plnToken: '0x9E1c51E1fAa1381D8a7Dbdd19402c5fCce9274C6',
  pollenDAO: '0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7',
  leagues: '0x55F04Ee2775925b80125F412C05cF5214Fd1317a'
};

async function setupLiveTrading() {
  logger.info('🚀 Setting Up Live Trading System');
  logger.info('═'.repeat(60));

  const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
  
  // Verify network
  const network = await provider.getNetwork();
  logger.info(`🌐 Connected to Base Sepolia (Chain ID: ${network.chainId})`);

  let readyBots = 0;
  const setupResults = [];

  for (const bot of BOTS) {
    try {
      logger.info(`\n🔄 Setting up ${bot.name} (Bot ${bot.id})`);
      
      const wallet = new ethers.Wallet(bot.privateKey, provider);
      const ethBalance = await provider.getBalance(wallet.address);
      
      const plnContract = new ethers.Contract(
        CONTRACTS.plnToken,
        ['function balanceOf(address) view returns (uint256)'],
        provider
      );
      const plnBalance = await plnContract.balanceOf(wallet.address);
      
      const pollenDAO = new ethers.Contract(
        CONTRACTS.pollenDAO,
        ['function getUserPortfolio(address _user) view returns (address)'],
        provider
      );
      const portfolioAddress = await pollenDAO.getUserPortfolio(wallet.address);
      
      const hasPortfolio = portfolioAddress !== ethers.ZeroAddress;
      const hasETH = ethBalance > ethers.parseEther('0.001');
      const hasPLN = plnBalance > ethers.parseEther('1');
      
      logger.info(`  💰 ETH: ${ethers.formatEther(ethBalance)} (${hasETH ? '✅' : '❌'})`);
      logger.info(`  💎 PLN: ${ethers.formatEther(plnBalance)} (${hasPLN ? '✅' : '❌'})`);
      logger.info(`  📊 Portfolio: ${hasPortfolio ? portfolioAddress : 'None'} (${hasPortfolio ? '✅' : '❌'})`);
      
      const isReady = hasETH && hasPLN && hasPortfolio;
      
      if (isReady) {
        readyBots++;
        logger.info(`✅ ${bot.name} is ready for live trading`);
      } else {
        logger.warn(`⚠️ ${bot.name} needs setup`);
      }
      
      setupResults.push({
        botId: bot.id,
        botName: bot.name,
        hasETH,
        hasPLN,
        hasPortfolio,
        portfolioAddress: hasPortfolio ? portfolioAddress : null,
        isReady
      });
      
    } catch (error) {
      logger.error(`❌ Error setting up ${bot.name}:`, error.message);
      setupResults.push({
        botId: bot.id,
        botName: bot.name,
        hasETH: false,
        hasPLN: false,
        hasPortfolio: false,
        portfolioAddress: null,
        isReady: false,
        error: error.message
      });
    }
  }

  // Summary
  logger.info('\n🎯 LIVE TRADING SETUP SUMMARY');
  logger.info('═'.repeat(60));
  logger.info(`✅ Ready for live trading: ${readyBots}/${BOTS.length} bots`);
  
  const needsPortfolio = setupResults.filter(r => r.hasETH && r.hasPLN && !r.hasPortfolio);
  const needsFunding = setupResults.filter(r => !r.hasETH || !r.hasPLN);
  
  if (needsPortfolio.length > 0) {
    logger.info(`\n📋 Bots needing portfolio creation: ${needsPortfolio.length}`);
    logger.info('Run: node create-live-portfolios.js');
  }
  
  if (needsFunding.length > 0) {
    logger.info(`\n💰 Bots needing funding: ${needsFunding.length}`);
    needsFunding.forEach(bot => {
      logger.info(`  Bot ${bot.botId}: ${!bot.hasETH ? 'ETH ' : ''}${!bot.hasPLN ? 'PLN' : ''}`);
    });
  }
  
  if (readyBots === BOTS.length) {
    logger.info('\n🎉 All bots are ready for live trading!');
    logger.info('Next steps:');
    logger.info('1. Run: node live-trading-engine.js');
    logger.info('2. Or use the "Run Live Trading" workflow');
  }
  
  return setupResults;
}

// Run setup
if (require.main === module) {
  setupLiveTrading().catch(console.error);
}

module.exports = { setupLiveTrading };
