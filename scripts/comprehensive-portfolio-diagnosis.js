
require('dotenv').config({ path: require('path').resolve(__dirname, '.wallets') });
const { ethers } = require('ethers');

const CONFIG = {
  RPC_URL: 'https://sepolia.base.org',
  CHAIN_ID: 84532,
  CONTRACTS: {
    PLN: '0x9E1c51E1fAa1381D8a7Dbdd19402c5fCce9274C6',
    PORTFOLIO: '0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7',
  }
};

const BOTS = [
  {
    id: 1,
    name: 'Conservative Bot',
    address: '0x561529036AB886c1FD3D112360383D79fBA9E71c',
    privateKey: process.env.PRIVATE_KEY_1
  },
  {
    id: 2,
    name: 'Momentum Bot', 
    address: '0x48B2353954496679CF7C73d239bc12098cB0C5B4',
    privateKey: process.env.PRIVATE_KEY_2
  },
  {
    id: 3,
    name: 'Technical Bot',
    address: '0x43f76157E9696302E287181828cB3B0C6B89d31e', 
    privateKey: process.env.PRIVATE_KEY_3
  },
  {
    id: 4,
    name: 'Mean Reversion Bot',
    address: '0xC02764913ce2F23B094F0338a711EFD984024A46',
    privateKey: process.env.PRIVATE_KEY_4
  },
  {
    id: 5,
    name: 'Breakout Bot',
    address: '0x00FfF703fa6837A1a46b3DF9B6a047404046379E',
    privateKey: process.env.PRIVATE_KEY_5
  }
];

// Comprehensive ABI with all portfolio query methods
const PORTFOLIO_ABI = [
  'function getPortfolio(address user, address token) view returns (uint256[], uint256, uint256, uint256, bool, uint256, uint256, bool[])',
  'function getPortfolio1(address user, address token) view returns (uint256[], uint256, uint256, uint256, bool, uint256, uint256, bool[])',
  'function portfolios(address) view returns (uint256)',
  'function userPortfolios(address) view returns (bool)',
  'function hasPortfolio(address) view returns (bool)',
  'function createPortfolio(uint256, uint256[], bool[], bool)',
  'function portfolioExists(address) view returns (bool)'
];

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address, address) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

async function comprehensivePortfolioDiagnosis() {
  console.log('🔍 COMPREHENSIVE Bot Portfolio Diagnosis');
  console.log('══════════════════════════════════════════════════════════════');
  
  const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL, {
    name: 'base-sepolia',
    chainId: CONFIG.CHAIN_ID,
  });

  const network = await provider.getNetwork();
  console.log(`🌐 Connected to ${network.name} (Chain ID: ${network.chainId})\n`);

  const portfolio = new ethers.Contract(CONFIG.CONTRACTS.PORTFOLIO, PORTFOLIO_ABI, provider);
  const plnToken = new ethers.Contract(CONFIG.CONTRACTS.PLN, ERC20_ABI, provider);

  for (const bot of BOTS) {
    console.log(`📊 Comprehensive Analysis: ${bot.name} (Bot ${bot.id})`);
    console.log('═'.repeat(60));
    console.log(`🔑 Address: ${bot.address}`);

    try {
      // Basic balances
      const [ethBalance, plnBalance, plnDecimals] = await Promise.all([
        provider.getBalance(bot.address),
        plnToken.balanceOf(bot.address),
        plnToken.decimals()
      ]);

      console.log(`💰 ETH Balance: ${ethers.utils.formatEther(ethBalance)} ETH`);
      console.log(`💎 PLN Balance: ${ethers.utils.formatUnits(plnBalance, plnDecimals)} PLN`);

      // Check allowance
      const allowance = await plnToken.allowance(bot.address, CONFIG.CONTRACTS.PORTFOLIO);
      console.log(`🔓 PLN Allowance: ${ethers.utils.formatUnits(allowance, plnDecimals)} PLN`);

      console.log('\n🔍 Portfolio Detection Methods:');
      console.log('─'.repeat(40));

      let portfolioFound = false;
      let portfolioDetails = null;

      // Method 1: getPortfolio with ZeroAddress
      try {
        console.log('Testing: getPortfolio(address, ZeroAddress)');
        const result1 = await portfolio.getPortfolio(bot.address, ethers.constants.AddressZero);
        if (result1 && (result1[1].gt(0) || result1[2].gt(0) || result1[3].gt(0))) {
          console.log('✅ Found portfolio via getPortfolio(addr, ZeroAddress)');
          portfolioFound = true;
          portfolioDetails = result1;
          console.log(`   Portfolio Value: ${ethers.utils.formatUnits(result1[1], plnDecimals)} PLN`);
        } else {
          console.log('❌ No portfolio via getPortfolio(addr, ZeroAddress)');
        }
      } catch (e) {
        console.log(`❌ getPortfolio(addr, ZeroAddress) failed: ${e.message}`);
      }

      // Method 2: getPortfolio with self-address
      try {
        console.log('Testing: getPortfolio(address, address)');
        const result2 = await portfolio.getPortfolio(bot.address, bot.address);
        if (result2 && (result2[1].gt(0) || result2[2].gt(0) || result2[3].gt(0))) {
          console.log('✅ Found portfolio via getPortfolio(addr, addr)');
          portfolioFound = true;
          portfolioDetails = result2;
          console.log(`   Portfolio Value: ${ethers.utils.formatUnits(result2[1], plnDecimals)} PLN`);
        } else {
          console.log('❌ No portfolio via getPortfolio(addr, addr)');
        }
      } catch (e) {
        console.log(`❌ getPortfolio(addr, addr) failed: ${e.message}`);
      }

      // Method 3: getPortfolio1 with ZeroAddress
      try {
        console.log('Testing: getPortfolio1(address, ZeroAddress)');
        const result3 = await portfolio.getPortfolio1(bot.address, ethers.constants.AddressZero);
        if (result3 && (result3[1].gt(0) || result3[2].gt(0) || result3[3].gt(0))) {
          console.log('✅ Found portfolio via getPortfolio1(addr, ZeroAddress)');
          portfolioFound = true;
          portfolioDetails = result3;
          console.log(`   Portfolio Value: ${ethers.utils.formatUnits(result3[1], plnDecimals)} PLN`);
        } else {
          console.log('❌ No portfolio via getPortfolio1(addr, ZeroAddress)');
        }
      } catch (e) {
        console.log(`❌ getPortfolio1(addr, ZeroAddress) failed: ${e.message}`);
      }

      // Method 4: getPortfolio1 with self-address
      try {
        console.log('Testing: getPortfolio1(address, address)');
        const result4 = await portfolio.getPortfolio1(bot.address, bot.address);
        if (result4 && (result4[1].gt(0) || result4[2].gt(0) || result4[3].gt(0))) {
          console.log('✅ Found portfolio via getPortfolio1(addr, addr)');
          portfolioFound = true;
          portfolioDetails = result4;
          console.log(`   Portfolio Value: ${ethers.utils.formatUnits(result4[1], plnDecimals)} PLN`);
        } else {
          console.log('❌ No portfolio via getPortfolio1(addr, addr)');
        }
      } catch (e) {
        console.log(`❌ getPortfolio1(addr, addr) failed: ${e.message}`);
      }

      // Method 5: Check direct mapping methods
      const mappingMethods = ['portfolios', 'userPortfolios', 'hasPortfolio', 'portfolioExists'];
      for (const method of mappingMethods) {
        try {
          console.log(`Testing: ${method}(address)`);
          const result = await portfolio[method](bot.address);
          if (result && (typeof result === 'boolean' ? result : result.gt(0))) {
            console.log(`✅ Found portfolio indicator via ${method}: ${result}`);
            portfolioFound = true;
          } else {
            console.log(`❌ No portfolio via ${method}: ${result}`);
          }
        } catch (e) {
          console.log(`❌ ${method} not available or failed: ${e.message}`);
        }
      }

      // Test portfolio creation simulation
      console.log('\n🧪 Testing Portfolio Creation:');
      console.log('─'.repeat(30));
      
      try {
        const testAmount = ethers.utils.parseUnits('1', plnDecimals);
        const testWeights = [16, 14, 14, 14, 14, 14, 14];
        const testShorts = [false, false, false, false, false, false, false];
        
        const wallet = new ethers.Wallet(bot.privateKey, provider);
        const portfolioWithSigner = portfolio.connect(wallet);
        
        // Estimate gas to see if it would fail
        try {
          const gasEstimate = await portfolioWithSigner.estimateGas.createPortfolio(
            testAmount,
            testWeights,
            testShorts,
            false
          );
          console.log(`✅ Portfolio creation would succeed (Gas: ${gasEstimate.toString()})`);
        } catch (gasError) {
          console.log(`❌ Portfolio creation would fail: ${gasError.reason || gasError.message}`);
          if (gasError.reason === "Portfolio has been initialized") {
            console.log('🎯 CONFIRMED: Portfolio already exists but not detected by query methods!');
            portfolioFound = true;
          }
        }
      } catch (e) {
        console.log(`❌ Could not test portfolio creation: ${e.message}`);
      }

      // Final summary for this bot
      console.log('\n📋 SUMMARY:');
      console.log('─'.repeat(20));
      if (portfolioFound) {
        console.log('✅ Portfolio EXISTS');
        if (portfolioDetails) {
          console.log(`   Asset Amounts: [${portfolioDetails[0].map(a => a.toString()).join(', ')}]`);
          console.log(`   Total Value: ${ethers.utils.formatUnits(portfolioDetails[1], plnDecimals)} PLN`);
          console.log(`   Deposit PLN: ${ethers.utils.formatUnits(portfolioDetails[2], plnDecimals)} PLN`);
          console.log(`   Deposit VePLN: ${ethers.utils.formatUnits(portfolioDetails[3], plnDecimals)} VePLN`);
          console.log(`   Is Open: ${portfolioDetails[4]}`);
        }
      } else {
        console.log('❌ No portfolio found');
        console.log('✅ Ready for portfolio creation');
      }

    } catch (error) {
      console.log(`❌ Error analyzing ${bot.name}:`, error.message);
    }

    console.log('\n' + '═'.repeat(60) + '\n');
  }

  console.log('🎯 Comprehensive diagnosis completed!');
}

// Run the comprehensive diagnosis
comprehensivePortfolioDiagnosis().catch(console.error);
