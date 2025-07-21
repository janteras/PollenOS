
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
    id: 2,
    name: 'Momentum Bot',
    address: '0x48B2353954496679CF7C73d239bc12098cB0C5B4',
    privateKey: process.env.PRIVATE_KEY_2,
    strategy: {
      amount: '3.0',
      weights: [15, 20, 15, 15, 10, 10, 15],
      isShort: [false, false, false, false, false, false, false]
    }
  }
];

const PORTFOLIO_ABI = [
  'function getPortfolio(address user, address token) view returns (uint256[], uint256, uint256, uint256, bool, uint256, uint256, bool[])',
  'function createPortfolio(uint256, uint256[], bool[], bool)',
  'function rebalancePortfolio(uint256[], bool[], uint256, bool)',
  'function closePortfolio()',
  'function portfolioInitialized(address) view returns (bool)'
];

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address, address) view returns (uint256)',
  'function approve(address, uint256) returns (bool)',
  'function decimals() view returns (uint8)'
];

async function fixPortfolioCreation() {
  console.log('🛠️  Portfolio Creation Fix Script');
  console.log('═══════════════════════════════════════');
  
  const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL, {
    name: 'base-sepolia',
    chainId: CONFIG.CHAIN_ID,
  });

  for (const bot of BOTS) {
    console.log(`\n🔧 Fixing ${bot.name} (${bot.address})`);
    console.log('─'.repeat(50));

    try {
      const wallet = new ethers.Wallet(bot.privateKey, provider);
      const portfolio = new ethers.Contract(CONFIG.CONTRACTS.PORTFOLIO, PORTFOLIO_ABI, wallet);
      const plnToken = new ethers.Contract(CONFIG.CONTRACTS.PLN, ERC20_ABI, wallet);
      
      const plnDecimals = await plnToken.decimals();
      const amount = ethers.utils.parseUnits(bot.strategy.amount, plnDecimals);

      // Step 1: Check current state
      console.log('1️⃣ Checking current portfolio state...');
      
      let portfolioExists = false;
      try {
        const portfolioData = await portfolio.getPortfolio(wallet.address, ethers.constants.AddressZero);
        if (portfolioData[1].gt(0) || portfolioData[2].gt(0) || portfolioData[3].gt(0)) {
          portfolioExists = true;
          console.log('✅ Portfolio already exists');
          console.log(`   Value: ${ethers.utils.formatUnits(portfolioData[1], plnDecimals)} PLN`);
          console.log('   No action needed');
          continue;
        }
      } catch (e) {
        console.log(`   Query failed: ${e.message}`);
      }

      // Step 2: Check if portfolio creation would fail
      console.log('2️⃣ Testing portfolio creation feasibility...');
      try {
        const gasEstimate = await portfolio.estimateGas.createPortfolio(
          amount,
          bot.strategy.weights,
          bot.strategy.isShort,
          false
        );
        console.log(`✅ Creation would succeed (Gas: ${gasEstimate.toString()})`);
      } catch (gasError) {
        if (gasError.reason === "Portfolio has been initialized") {
          console.log('⚠️  Portfolio appears to exist but not detected by queries');
          console.log('🔄 Attempting alternative detection methods...');
          
          // Try different query approaches
          const alternatives = [
            () => portfolio.getPortfolio(wallet.address, wallet.address),
            () => portfolio.getPortfolio(wallet.address, CONFIG.CONTRACTS.PLN),
          ];

          for (let i = 0; i < alternatives.length; i++) {
            try {
              const result = await alternatives[i]();
              if (result[1].gt(0) || result[2].gt(0) || result[3].gt(0)) {
                console.log(`✅ Found portfolio via alternative method ${i + 1}`);
                console.log(`   Value: ${ethers.utils.formatUnits(result[1], plnDecimals)} PLN`);
                portfolioExists = true;
                break;
              }
            } catch (e) {
              console.log(`   Alternative ${i + 1} failed: ${e.message}`);
            }
          }

          if (!portfolioExists) {
            console.log('❌ Portfolio state inconsistent - may need manual intervention');
            console.log('💡 Consider:');
            console.log('   - Checking contract events for portfolio creation');
            console.log('   - Verifying contract ABI compatibility');
            console.log('   - Contacting protocol team if issue persists');
          }
          continue;
        } else {
          console.log(`❌ Creation would fail: ${gasError.reason || gasError.message}`);
          continue;
        }
      }

      // Step 3: Check and set allowance
      console.log('3️⃣ Checking PLN allowance...');
      const allowance = await plnToken.allowance(wallet.address, CONFIG.CONTRACTS.PORTFOLIO);
      
      if (allowance.lt(amount)) {
        console.log('🔓 Setting PLN allowance...');
        const approveTx = await plnToken.approve(CONFIG.CONTRACTS.PORTFOLIO, amount);
        console.log(`   Approval tx: ${approveTx.hash}`);
        await approveTx.wait();
        console.log('✅ Allowance set');
      } else {
        console.log('✅ Sufficient allowance already set');
      }

      // Step 4: Create portfolio
      console.log('4️⃣ Creating portfolio...');
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

      console.log(`   Transaction: ${createTx.hash}`);
      console.log('   Waiting for confirmation...');
      
      const receipt = await createTx.wait();
      console.log('✅ Portfolio created successfully!');
      console.log(`   Block: ${receipt.blockNumber}`);
      console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
      console.log(`   Explorer: https://sepolia.basescan.org/tx/${createTx.hash}`);

      // Step 5: Verify creation
      console.log('5️⃣ Verifying portfolio creation...');
      const finalPortfolio = await portfolio.getPortfolio(wallet.address, ethers.constants.AddressZero);
      console.log(`   Portfolio value: ${ethers.utils.formatUnits(finalPortfolio[1], plnDecimals)} PLN`);
      console.log(`   Deposit amount: ${ethers.utils.formatUnits(finalPortfolio[2], plnDecimals)} PLN`);

    } catch (error) {
      console.error(`❌ Error fixing ${bot.name}:`, error);
    }
  }

  console.log('\n🎯 Portfolio fix script completed!');
}

// Run the fix script
fixPortfolioCreation().catch(console.error);
