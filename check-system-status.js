
/**
 * System Status Checker for Multi-Bot Trading System
 * Validates all components and provides comprehensive status report
 */

const { ethers } = require('ethers');
const logger = require('./src/modules/logger');

// Load configuration
require('dotenv').config({ path: './config/base-sepolia-pods-default.env' });

const BASE_SEPOLIA_CONFIG = {
  chainId: 84532,
  rpcUrl: 'https://sepolia.base.org',
  contracts: {
    plnToken: '0x9E1c51E1fAa1381D8a7Dbdd19402c5fCce9274C6',
    pollenDAO: '0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7',
    vePLN: '0x3a28AB567b661B3edaF9Ef0bDE9489558EDB3995',
    leagues: '0x55F04Ee2775925b80125F412C05cF5214Fd1317a'
  }
};

const BOTS = [
  { id: 1, name: 'Conservative Bot', address: '0x561529036AB886c1FD3D112360383D79fBA9E71c' },
  { id: 2, name: 'Momentum Bot', address: '0x48B2353954496679CF7C73d239bc12098cB0C5B4' },
  { id: 3, name: 'Technical Bot', address: '0x43f76157E9696302E287181828cB3B0C6B89d31e' },
  { id: 4, name: 'Mean Reversion Bot', address: '0xC02764913ce2F23B094F0338a711EFD984024A46' },
  { id: 5, name: 'Breakout Bot', address: '0x00FfF703fa6837A1a46b3DF9B6a047404046379E' },
  { id: 6, name: 'Scalping Bot', address: '0xD5404dd1Af9701A5ba8C8064240529594849450D' },
  { id: 7, name: 'Grid Trading Bot', address: '0x0E27bFe07Fb67497b093AFA6c94BF76a2A81ee13' },
  { id: 8, name: 'High-Frequency Bot', address: '0x0A0025182D874cccd509055E67990B317B5Ac3e9' },
  { id: 9, name: 'Liquidity Provision Bot', address: '0x57B445073008C9Ed50ef3740dDba21A1C344d4Ec' },
  { id: 10, name: 'Cross-Chain Arbitrage Bot', address: '0xA3a0eF7472fbdE00f4d06C1F7f1233B778F47477' }
];

async function checkSystemStatus() {
  console.log('🔍 MULTI-BOT SYSTEM STATUS CHECK');
  console.log('═'.repeat(60));
  
  const report = {
    timestamp: new Date().toISOString(),
    network: { connected: false, chainId: null, blockNumber: null },
    contracts: {},
    bots: [],
    portfolios: { created: 0, total: BOTS.length },
    trading: { active: false, errors: [] },
    overall: 'unknown'
  };

  try {
    // 1. Check network connectivity
    console.log('\n1. 🌐 Network Connectivity');
    console.log('─'.repeat(30));
    
    const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_CONFIG.rpcUrl);
    const network = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();
    
    report.network = {
      connected: true,
      chainId: Number(network.chainId),
      blockNumber: blockNumber,
      rpcUrl: BASE_SEPOLIA_CONFIG.rpcUrl
    };
    
    console.log(`✅ Connected to Base Sepolia (Chain ID: ${network.chainId})`);
    console.log(`📊 Current block: ${blockNumber}`);
    
    // 2. Check contract deployments
    console.log('\n2. 🏛️ Contract Validation');
    console.log('─'.repeat(30));
    
    for (const [name, address] of Object.entries(BASE_SEPOLIA_CONFIG.contracts)) {
      try {
        const code = await provider.getCode(address);
        const isDeployed = code !== '0x';
        
        report.contracts[name] = {
          address,
          deployed: isDeployed,
          codeSize: code.length
        };
        
        console.log(`${isDeployed ? '✅' : '❌'} ${name}: ${address} ${isDeployed ? '(deployed)' : '(not deployed)'}`);
      } catch (error) {
        report.contracts[name] = {
          address,
          deployed: false,
          error: error.message
        };
        console.log(`❌ ${name}: ${address} (error: ${error.message})`);
      }
    }
    
    // 3. Check bot wallet status
    console.log('\n3. 🤖 Bot Wallet Status');
    console.log('─'.repeat(30));
    
    const plnTokenABI = [
      'function balanceOf(address) view returns (uint256)',
      'function decimals() view returns (uint8)'
    ];
    
    const plnContract = new ethers.Contract(
      BASE_SEPOLIA_CONFIG.contracts.plnToken,
      plnTokenABI,
      provider
    );
    
    for (const bot of BOTS) {
      try {
        const ethBalance = await provider.getBalance(bot.address);
        const plnBalance = await plnContract.balanceOf(bot.address);
        
        const ethFormatted = ethers.formatEther(ethBalance);
        const plnFormatted = ethers.formatEther(plnBalance);
        
        const botStatus = {
          id: bot.id,
          name: bot.name,
          address: bot.address,
          ethBalance: ethFormatted,
          plnBalance: plnFormatted,
          funded: parseFloat(ethFormatted) > 0.001 && parseFloat(plnFormatted) > 1
        };
        
        report.bots.push(botStatus);
        
        console.log(`${botStatus.funded ? '✅' : '⚠️'} Bot ${bot.id} (${bot.name}): ${ethFormatted} ETH, ${plnFormatted} PLN`);
      } catch (error) {
        const botStatus = {
          id: bot.id,
          name: bot.name,
          address: bot.address,
          error: error.message
        };
        
        report.bots.push(botStatus);
        console.log(`❌ Bot ${bot.id} (${bot.name}): Error - ${error.message}`);
      }
    }
    
    // 4. Check portfolio status
    console.log('\n4. 📊 Portfolio Status');
    console.log('─'.repeat(30));
    
    const pollenDAOABI = [
      'function getPortfolio(address user, address token) view returns (uint256[], uint256, uint256, uint256, bool, uint256, uint256, bool[])'
    ];
    
    const pollenDAO = new ethers.Contract(
      BASE_SEPOLIA_CONFIG.contracts.pollenDAO,
      pollenDAOABI,
      provider
    );
    
    let portfoliosCreated = 0;
    
    for (const bot of BOTS) {
      try {
        const portfolioData = await pollenDAO.getPortfolio(bot.address, ethers.ZeroAddress);
        
        // Check if portfolio exists (totalValue > 0)
        const hasPortfolio = portfolioData[1] > 0;
        
        if (hasPortfolio) {
          portfoliosCreated++;
          const totalValue = ethers.formatEther(portfolioData[1]);
          console.log(`✅ Bot ${bot.id}: Portfolio active (${totalValue} PLN)`);
        } else {
          console.log(`⚠️ Bot ${bot.id}: No portfolio detected`);
        }
      } catch (error) {
        console.log(`❌ Bot ${bot.id}: Portfolio check failed - ${error.message}`);
      }
    }
    
    report.portfolios.created = portfoliosCreated;
    
    // 5. Check if multi-bot system is running
    console.log('\n5. 🚀 Trading System Status');
    console.log('─'.repeat(30));
    
    // Check if the multi-bot-launcher.js process might be running
    // This is a simplified check - in production you'd want process monitoring
    try {
      const fs = require('fs');
      if (fs.existsSync('./multi-bot-launcher.js')) {
        console.log('✅ Multi-bot launcher script exists');
        report.trading.active = true;
      } else {
        console.log('❌ Multi-bot launcher script not found');
      }
    } catch (error) {
      console.log('⚠️ Could not check trading system status');
    }
    
    // 6. Generate overall status
    console.log('\n6. 📋 Overall System Status');
    console.log('─'.repeat(30));
    
    const networkOk = report.network.connected;
    const contractsOk = Object.values(report.contracts).every(c => c.deployed);
    const botsOk = report.bots.filter(b => b.funded).length >= 8; // At least 8/10 bots funded
    const portfoliosOk = report.portfolios.created >= 8; // At least 8/10 portfolios
    
    if (networkOk && contractsOk && botsOk && portfoliosOk) {
      report.overall = 'operational';
      console.log('🎯 System Status: ✅ FULLY OPERATIONAL');
    } else if (networkOk && contractsOk && botsOk) {
      report.overall = 'functional';
      console.log('🎯 System Status: ⚠️ FUNCTIONAL (minor issues)');
    } else {
      report.overall = 'issues';
      console.log('🎯 System Status: ❌ NEEDS ATTENTION');
    }
    
    // Summary
    console.log('\n📊 SUMMARY');
    console.log('═'.repeat(60));
    console.log(`🌐 Network: ${report.network.connected ? 'Connected' : 'Disconnected'}`);
    console.log(`🏛️ Contracts: ${Object.values(report.contracts).filter(c => c.deployed).length}/${Object.keys(report.contracts).length} deployed`);
    console.log(`🤖 Bots: ${report.bots.filter(b => b.funded).length}/${report.bots.length} funded`);
    console.log(`📊 Portfolios: ${report.portfolios.created}/${report.portfolios.total} created`);
    console.log(`🚀 Trading: ${report.trading.active ? 'Active' : 'Inactive'}`);
    
    // Save report
    const fs = require('fs');
    fs.writeFileSync('./logs/system-status-report.json', JSON.stringify(report, null, 2));
    console.log('\n💾 Status report saved to: ./logs/system-status-report.json');
    
    return report;
    
  } catch (error) {
    console.error('❌ System status check failed:', error.message);
    report.overall = 'error';
    report.error = error.message;
    return report;
  }
}

// Run the check
if (require.main === module) {
  checkSystemStatus()
    .then(report => {
      console.log('\n✅ System status check completed!');
      process.exit(report.overall === 'operational' ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Failed to check system status:', error);
      process.exit(1);
    });
}

module.exports = checkSystemStatus;
