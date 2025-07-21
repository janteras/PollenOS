
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
    privateKey: process.env.PRIVATE_KEY_1,
    strategy: {
      amount: '2.0',
      weights: [16, 14, 14, 14, 14, 14, 14],
      isShort: [false, false, false, false, false, false, false]
    }
  },
  {
    id: 2,
    name: 'Momentum Bot',
    address: '0x48B2353954496679CF7C73d239bc12098cB0C5B4',
    privateKey: process.env.PRIVATE_KEY_2,
    strategy: {
      amount: '3.0',
      weights: [15, 20, 15, 15, 10, 10, 15],
      isShort: [false, false, false, false, false, false, false]
    }
  },
  {
    id: 3,
    name: 'Technical Bot',
    address: '0x43f76157E9696302E287181828cB3B0C6B89d31e',
    privateKey: process.env.PRIVATE_KEY_3,
    strategy: {
      amount: '3.0',
      weights: [14, 16, 15, 15, 15, 15, 10],
      isShort: [false, false, false, false, false, false, false]
    }
  },
  {
    id: 4,
    name: 'Mean Reversion Bot',
    address: '0xC02764913ce2F23B094F0338a711EFD984024A46',
    privateKey: process.env.PRIVATE_KEY_4,
    strategy: {
      amount: '4.0',
      weights: [20, 15, 15, 15, 15, 10, 10],
      isShort: [false, false, false, false, false, false, false]
    }
  },
  {
    id: 5,
    name: 'Breakout Bot',
    address: '0x00FfF703fa6837A1a46b3DF9B6a047404046379E',
    privateKey: process.env.PRIVATE_KEY_5,
    strategy: {
      amount: '2.0',
      weights: [25, 15, 15, 15, 10, 10, 10],
      isShort: [false, false, false, false, false, false, false]
    }
  }
];

// Comprehensive Portfolio ABI based on the developer guide
const PORTFOLIO_ABI = [
  'function createPortfolio(uint256 amount, uint256[] calldata weights, bool[] calldata isShort, bool tokenType)',
  'function getPortfolio(address user, address token) view returns (uint256[], uint256, uint256, uint256, bool, uint256, uint256, bool[])',
  'function depositPLN(uint256 amount, address recipient)',
  'function rebalancePortfolio(uint256[] calldata newWeights, bool[] calldata newIsShort)',
  'function withdraw(uint256 amount, address recipient)',
  'event PortfolioCreated(address indexed user, address indexed token, uint256 amount, uint256[] weights, bool[] isShort, bool tokenType)'
];

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address, address) view returns (uint256)',
  'function approve(address, uint256) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
];

class PortfolioManager {
  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL, {
      name: 'base-sepolia',
      chainId: CONFIG.CHAIN_ID,
    });
  }

  async detectPortfolio(botAddress) {
    const portfolio = new ethers.Contract(CONFIG.CONTRACTS.PORTFOLIO, PORTFOLIO_ABI, this.provider);
    const plnToken = new ethers.Contract(CONFIG.CONTRACTS.PLN, ERC20_ABI, this.provider);
    
    const decimals = await plnToken.decimals();
    
    // Test multiple detection methods as seen in your diagnosis
    const detectionMethods = [
      {
        name: 'getPortfolio(addr, ZeroAddress)',
        method: () => portfolio.getPortfolio(botAddress, ethers.constants.AddressZero)
      },
      {
        name: 'getPortfolio(addr, addr)',
        method: () => portfolio.getPortfolio(botAddress, botAddress)
      },
      {
        name: 'getPortfolio(addr, PLN)',
        method: () => portfolio.getPortfolio(botAddress, CONFIG.CONTRACTS.PLN)
      }
    ];

    for (const detection of detectionMethods) {
      try {
        console.log(`   Testing: ${detection.name}`);
        const result = await detection.method();
        
        // Check if portfolio has value (weights, totalValue, depositPLN, depositVePLN)
        if (result && result.length >= 4) {
          const [weights, totalValue, depositPLN, depositVePLN] = result;
          
          if (totalValue.gt(0) || depositPLN.gt(0) || depositVePLN.gt(0)) {
            console.log(`   ✅ Portfolio found via ${detection.name}`);
            console.log(`      Total Value: ${ethers.utils.formatUnits(totalValue, decimals)} PLN`);
            console.log(`      Deposit PLN: ${ethers.utils.formatUnits(depositPLN, decimals)} PLN`);
            console.log(`      Deposit VePLN: ${ethers.utils.formatUnits(depositVePLN, decimals)} VePLN`);
            
            return {
              exists: true,
              data: result,
              method: detection.name,
              totalValue: ethers.utils.formatUnits(totalValue, decimals),
              depositPLN: ethers.utils.formatUnits(depositPLN, decimals),
              depositVePLN: ethers.utils.formatUnits(depositVePLN, decimals)
            };
          }
        }
        console.log(`   ❌ No portfolio via ${detection.name}`);
      } catch (error) {
        console.log(`   ❌ ${detection.name} failed: ${error.message}`);
      }
    }

    return { exists: false };
  }

  async createPortfolio(bot) {
    console.log(`\n🏗️ Creating portfolio for ${bot.name}`);
    console.log('─'.repeat(50));

    const wallet = new ethers.Wallet(bot.privateKey, this.provider);
    const portfolio = new ethers.Contract(CONFIG.CONTRACTS.PORTFOLIO, PORTFOLIO_ABI, wallet);
    const plnToken = new ethers.Contract(CONFIG.CONTRACTS.PLN, ERC20_ABI, wallet);
    
    const decimals = await plnToken.decimals();
    const amount = ethers.utils.parseUnits(bot.strategy.amount, decimals);
    
    // Check balances
    const [ethBalance, plnBalance] = await Promise.all([
      this.provider.getBalance(wallet.address),
      plnToken.balanceOf(wallet.address)
    ]);
    
    console.log(`💰 ETH: ${ethers.utils.formatEther(ethBalance)} ETH`);
    console.log(`💎 PLN: ${ethers.utils.formatUnits(plnBalance, decimals)} PLN`);
    console.log(`📊 Required: ${bot.strategy.amount} PLN`);
    
    if (plnBalance.lt(amount)) {
      throw new Error(`Insufficient PLN balance. Need ${bot.strategy.amount} PLN, have ${ethers.utils.formatUnits(plnBalance, decimals)} PLN`);
    }
    
    // Check and set allowance
    const allowance = await plnToken.allowance(wallet.address, CONFIG.CONTRACTS.PORTFOLIO);
    console.log(`🔓 Current allowance: ${ethers.utils.formatUnits(allowance, decimals)} PLN`);
    
    if (allowance.lt(amount)) {
      console.log('🔧 Setting PLN allowance...');
      const approveTx = await plnToken.approve(CONFIG.CONTRACTS.PORTFOLIO, amount, {
        gasLimit: 100000,
        gasPrice: ethers.utils.parseUnits('2', 'gwei')
      });
      console.log(`   Approval tx: ${approveTx.hash}`);
      await approveTx.wait();
      console.log('   ✅ Allowance set');
    } else {
      console.log('✅ Sufficient allowance already set');
    }

    // Test portfolio creation feasibility
    console.log('🧪 Testing portfolio creation...');
    try {
      const gasEstimate = await portfolio.estimateGas.createPortfolio(
        amount,
        bot.strategy.weights,
        bot.strategy.isShort,
        false // tokenType: false = PLN
      );
      console.log(`✅ Creation feasible (Gas: ${gasEstimate.toString()})`);
    } catch (gasError) {
      if (gasError.reason === "Portfolio has been initialized" || 
          gasError.message.includes("Portfolio has been initialized")) {
        throw new Error('Portfolio already exists but not detected by queries');
      }
      throw new Error(`Portfolio creation would fail: ${gasError.reason || gasError.message}`);
    }

    // Create portfolio
    console.log('⏰ Waiting 3 seconds before portfolio creation...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('🏗️ Creating portfolio with strategy...');
    console.log(`   Amount: ${bot.strategy.amount} PLN`);
    console.log(`   Weights: [${bot.strategy.weights.join(', ')}]`);
    console.log(`   Positions: [${bot.strategy.isShort.map(s => s ? 'SHORT' : 'LONG').join(', ')}]`);
    
    const createTx = await portfolio.createPortfolio(
      amount,
      bot.strategy.weights,
      bot.strategy.isShort,
      false, // tokenType: false = PLN
      {
        gasLimit: 500000,
        gasPrice: ethers.utils.parseUnits('2', 'gwei')
      }
    );

    console.log(`📡 Transaction: ${createTx.hash}`);
    console.log('⏳ Waiting for confirmation...');
    
    const receipt = await createTx.wait();
    console.log('✅ Portfolio created successfully!');
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
    console.log(`   Explorer: https://sepolia.basescan.org/tx/${createTx.hash}`);

    return receipt;
  }

  async processBot(bot) {
    console.log(`\n📊 Processing ${bot.name} (Bot ${bot.id})`);
    console.log('═'.repeat(60));
    console.log(`🔑 Wallet: ${bot.address}`);
    
    try {
      // Check basic balances
      const plnToken = new ethers.Contract(CONFIG.CONTRACTS.PLN, ERC20_ABI, this.provider);
      const [ethBalance, plnBalance, decimals] = await Promise.all([
        this.provider.getBalance(bot.address),
        plnToken.balanceOf(bot.address),
        plnToken.decimals()
      ]);
      
      console.log(`💰 ETH Balance: ${ethers.utils.formatEther(ethBalance)} ETH`);
      console.log(`💎 PLN Balance: ${ethers.utils.formatUnits(plnBalance, decimals)} PLN`);
      console.log(`📈 Required: ${bot.strategy.amount} PLN`);
      console.log(`🔍 Token Decimals: ${decimals}`);

      // Check allowance
      const allowance = await plnToken.allowance(bot.address, CONFIG.CONTRACTS.PORTFOLIO);
      console.log(`🔓 PLN Allowance: ${ethers.utils.formatUnits(allowance, decimals)} PLN`);

      // Detect existing portfolio
      console.log('\n🔍 Portfolio Detection:');
      console.log('─'.repeat(30));
      const portfolioStatus = await this.detectPortfolio(bot.address);
      
      if (portfolioStatus.exists) {
        console.log('✅ Portfolio already exists');
        console.log(`   Detection method: ${portfolioStatus.method}`);
        console.log(`   Total value: ${portfolioStatus.totalValue} PLN`);
        console.log(`   No action needed`);
        return { status: 'exists', bot: bot.name };
      } else {
        console.log('❌ No portfolio found');
        
        // Check if we have sufficient balance to create
        const requiredAmount = ethers.utils.parseUnits(bot.strategy.amount, decimals);
        if (plnBalance.lt(requiredAmount)) {
          console.log(`❌ Insufficient PLN balance for portfolio creation`);
          return { status: 'insufficient_funds', bot: bot.name };
        }
        
        // Create portfolio
        await this.createPortfolio(bot);
        return { status: 'created', bot: bot.name };
      }
      
    } catch (error) {
      console.error(`❌ Error processing ${bot.name}:`, error.message);
      return { status: 'error', bot: bot.name, error: error.message };
    }
  }

  async processAllBots() {
    console.log('🚀 Improved Portfolio Manager');
    console.log('═══════════════════════════════════════');
    
    const network = await this.provider.getNetwork();
    console.log(`🌐 Connected to ${network.name} (Chain ID: ${network.chainId})\n`);

    const results = [];
    
    for (const bot of BOTS) {
      const result = await this.processBot(bot);
      results.push(result);
    }

    // Summary
    console.log('\n📋 PROCESSING SUMMARY');
    console.log('═'.repeat(40));
    
    const created = results.filter(r => r.status === 'created');
    const exists = results.filter(r => r.status === 'exists');
    const errors = results.filter(r => r.status === 'error');
    const insufficient = results.filter(r => r.status === 'insufficient_funds');
    
    console.log(`✅ Portfolios created: ${created.length}`);
    console.log(`📊 Portfolios already exist: ${exists.length}`);
    console.log(`💰 Insufficient funds: ${insufficient.length}`);
    console.log(`❌ Errors: ${errors.length}`);
    
    if (created.length > 0) {
      console.log('\n🎉 Successfully created portfolios for:');
      created.forEach(r => console.log(`   • ${r.bot}`));
    }
    
    if (errors.length > 0) {
      console.log('\n⚠️ Errors occurred for:');
      errors.forEach(r => console.log(`   • ${r.bot}: ${r.error}`));
    }
    
    console.log('\n🎯 Portfolio management completed!');
  }
}

// Run the improved portfolio manager
async function main() {
  const manager = new PortfolioManager();
  await manager.processAllBots();
}

main().catch(console.error);
