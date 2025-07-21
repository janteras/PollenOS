/**
 * Create Base Sepolia Portfolios for All 5 Trading Bots
 * This script creates actual portfolio contracts on Base Sepolia testnet
 */

// Polyfill for AbortController in older Node.js versions
if (typeof globalThis.AbortController === 'undefined') {
  globalThis.AbortController = class AbortController {
    constructor() {
      this.signal = { aborted: false };
    }
    abort() {
      this.signal.aborted = true;
    }
  };
}

require('dotenv').config({ path: './base-sepolia.env' });
const { ethers } = require('ethers');

// Base Sepolia Configuration per Developer Guide
const CONFIG = {
  RPC_URL: 'https://sepolia.base.org',
  CHAIN_ID: 84532,
  CONTRACTS: {
    PLN: '0x9E1c51E1fAa1381D8a7Dbdd19402c5fCce9274C6',
    PORTFOLIO: '0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7',
    VEPLN: '0x3a28AB567b661B3edaF9Ef0bDE9489558EDB3995',
    LEAGUES: '0x55F04Ee2775925b80125F412C05cF5214Fd1317a'
  }
};

// Bot Configuration with Private Keys
const BOTS = [
  {
    id: 1,
    name: 'Conservative Bot',
    privateKey: 'd74ae2c1a798042c9bbf56f15d2649df6d114e763f9444e2cddcde050900f1d0',
    strategy: 'conservative'
  },
  {
    id: 2,
    name: 'Momentum Bot', 
    privateKey: '241083ae625b93b41b555052840c09458c71704889b22774101d21b4d1482e62',
    strategy: 'momentum'
  },
  {
    id: 3,
    name: 'Technical Bot',
    privateKey: '0aa4b2f50b7efc44721b23a2ef7fc3ab11b658369af23381752c6d86b42628b1',
    strategy: 'technical'
  },
  {
    id: 4,
    name: 'Mean Reversion Bot',
    privateKey: '7dde37bea0f47ea849c9a7a285f3a277acd81c908accdb501ca036db1a5b11da',
    strategy: 'mean_reversion'
  },
  {
    id: 5,
    name: 'Breakout Bot',
    privateKey: '64da71a2688d24c0f970ded84d2d744081e467ae493f4c3256c4f8ee9bb959ee',
    strategy: 'breakout'
  }
];

// Contract ABIs per Developer Guide
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address, address) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
];

const PORTFOLIO_ABI = [
  'function createPortfolio(uint256 amount, uint256[] calldata weights, bool[] calldata isShort, bool tokenType)',
  'function depositPLN(uint256 amount, address recipient)',
  'function getPortfolio(address user, address token) view returns (uint256[], uint256, uint256, uint256, bool, uint256, uint256, bool[])',
  'function rebalancePortfolio(uint256[] calldata newWeights, bool[] calldata newIsShort)',
  'function withdraw(uint256 amount, address recipient)',
  'event PortfolioCreated(address indexed user, address indexed token, uint256 amount, uint256[] weights, bool[] isShort, bool tokenType)'
];

// Portfolio configurations per strategy (2-5 PLN range for testing)
const PORTFOLIO_CONFIGS = {
  conservative: {
    amount: ethers.parseEther('2'), // 2 PLN minimum - conservative approach
    weights: [20, 15, 15, 15, 10, 10, 15], // Conservative allocation
    isShort: [false, false, false, false, false, false, false] // All longs
  },
  momentum: {
    amount: ethers.parseEther('3'), // 3 PLN - moderate amount
    weights: [15, 20, 15, 15, 10, 10, 15], // Momentum focused
    isShort: [false, false, false, false, false, false, false] // All longs
  },
  technical: {
    amount: ethers.parseEther('3'), // 3 PLN - reduced from 4
    weights: [18, 16, 16, 16, 11, 11, 12], // Technical analysis
    isShort: [false, false, false, false, false, false, false] // All longs
  },
  mean_reversion: {
    amount: ethers.parseEther('4'), // 4 PLN - reduced from 5
    weights: [15, 15, 15, 15, 15, 15, 10], // Balanced
    isShort: [false, false, true, false, false, true, false] // Mixed longs/shorts
  },
  breakout: {
    amount: ethers.parseEther('2'), // 2 PLN - reduced from 3, use minimum for aggressive strategy
    weights: [10, 25, 15, 15, 10, 10, 15], // Aggressive
    isShort: [false, false, false, false, false, false, false] // All longs
  }
};

async function checkExistingPortfolios() {
  console.log('🔍 Checking for existing portfolios...');
  console.log('=====================================\n');

  const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
  const existingPortfolios = [];

  for (const bot of BOTS) {
    try {
      const wallet = new ethers.Wallet(bot.privateKey, provider);
      const portfolio = new ethers.Contract(CONFIG.CONTRACTS.PORTFOLIO, PORTFOLIO_ABI, wallet);

      console.log(`🔎 Checking ${bot.name}: ${wallet.address}`);

      try {
        const existingPortfolio = await portfolio.getPortfolio(
          wallet.address,
          ethers.ZeroAddress
        );

        if (existingPortfolio && existingPortfolio[1] > 0) {
          console.log(`  ✅ Has portfolio with value: ${ethers.formatEther(existingPortfolio[1])} PLN`);
          existingPortfolios.push({
            bot: bot.name,
            address: wallet.address,
            value: ethers.formatEther(existingPortfolio[1]),
            weights: existingPortfolio[0].map(w => w.toString())
          });
        } else {
          console.log(`  📝 No portfolio found`);
        }
      } catch (error) {
        console.log(`  ⚠️  Error checking portfolio: ${error.message}`);
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
  }

  console.log(`\n📊 Found ${existingPortfolios.length} existing portfolios\n`);
  return existingPortfolios;
}

async function createBotPortfolios() {
  console.log('🚀 Creating Base Sepolia Portfolios for All Trading Bots');
  console.log('=======================================================\n');

  const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);

  // Verify network
  const network = await provider.getNetwork();
  console.log(`✅ Connected to ${network.name} (Chain ID: ${network.chainId})`);

  if (Number(network.chainId) !== CONFIG.CHAIN_ID) {
    throw new Error(`Wrong network! Expected ${CONFIG.CHAIN_ID}, got ${Number(network.chainId)}`);
  }

  // First check for existing portfolios
  const existingPortfolios = await checkExistingPortfolios();

  const results = [];

  for (const bot of BOTS) {
    console.log(`\n📊 Processing ${bot.name} (Bot ${bot.id})`);
    console.log('=====================================');

    try {
      // Initialize wallet
      const wallet = new ethers.Wallet(bot.privateKey, provider);
      console.log(`🔑 Wallet: ${wallet.address}`);

      // Check ETH balance
      const ethBalance = await provider.getBalance(wallet.address);
      console.log(`💰 ETH Balance: ${ethers.formatEther(ethBalance)} ETH`);

      if (ethBalance < ethers.parseEther('0.01')) {
        console.log(`❌ Insufficient ETH for gas fees`);
        results.push({ bot: bot.name, status: 'failed', reason: 'Insufficient ETH' });
        continue;
      }

      // Initialize contracts
      const plnToken = new ethers.Contract(CONFIG.CONTRACTS.PLN, ERC20_ABI, wallet);
      const portfolio = new ethers.Contract(CONFIG.CONTRACTS.PORTFOLIO, PORTFOLIO_ABI, wallet);

      // Check PLN balance with more detailed verification
      const plnBalance = await plnToken.balanceOf(wallet.address);
      const config = PORTFOLIO_CONFIGS[bot.strategy];
      const decimals = await plnToken.decimals();

      console.log(`💎 PLN Balance: ${ethers.formatEther(plnBalance)} PLN`);
      console.log(`📈 Required: ${ethers.formatEther(config.amount)} PLN`);
      console.log(`🔍 Token Decimals: ${decimals}`);

      // Check if balance is sufficient with a small buffer for rounding
      const requiredWithBuffer = config.amount + ethers.parseEther('0.01'); // Add 0.01 PLN buffer
      if (plnBalance < requiredWithBuffer) {
        console.log(`❌ Insufficient PLN balance (including buffer)`);
        console.log(`   Available: ${ethers.formatEther(plnBalance)} PLN`);
        console.log(`   Required (with buffer): ${ethers.formatEther(requiredWithBuffer)} PLN`);
        results.push({ 
          bot: bot.name, 
          status: 'failed', 
          reason: 'Insufficient PLN balance',
          available: ethers.formatEther(plnBalance),
          required: ethers.formatEther(config.amount)
        });
        continue;
      }

      // Verify we can actually transfer this amount
      try {
        const transferableBalance = plnBalance - ethers.parseEther('0.001'); // Keep small amount for gas
        if (transferableBalance < config.amount) {
          console.log(`❌ PLN balance too low for safe transfer`);
          results.push({ 
            bot: bot.name, 
            status: 'failed', 
            reason: 'PLN balance too low for safe transfer'
          });
          continue;
        }
      } catch (error) {
        console.log(`⚠️  Could not verify transferable balance: ${error.message}`);
      }

      // Check existing portfolio more thoroughly
      let hasExistingPortfolio = false;
      let portfolioType = '';

      // First try with ZeroAddress (most common for this contract)
      try {
        const existingPortfolio = await portfolio.getPortfolio(
          wallet.address,
          ethers.ZeroAddress
        );

        if (existingPortfolio && existingPortfolio[1] > 0) { // totalValue > 0
          console.log(`✅ Portfolio already exists with value: ${ethers.formatEther(existingPortfolio[1])} PLN`);
          console.log(`   Weights: [${existingPortfolio[0].map(w => w.toString()).join(', ')}]`);
          console.log(`   Is Short: [${existingPortfolio[7] ? existingPortfolio[7].map(s => s ? 'SHORT' : 'LONG').join(', ') : 'N/A'}]`);
          hasExistingPortfolio = true;
          portfolioType = 'PLN';
          results.push({ 
            bot: bot.name, 
            status: 'exists', 
            portfolio: existingPortfolio,
            address: wallet.address,
            totalValue: ethers.formatEther(existingPortfolio[1]),
            type: portfolioType
          });
          continue;
        }
      } catch (error) {
        console.log(`📝 Checking for existing portfolio (ZeroAddress): ${error.message}`);
      }

      // Try with PLN token address as backup
      try {
        const existingPortfolio = await portfolio.getPortfolio(
          wallet.address,
          CONFIG.CONTRACTS.PLN
        );

        if (existingPortfolio && existingPortfolio[1] > 0) { // totalValue > 0
          console.log(`✅ PLN Portfolio already exists with value: ${ethers.formatEther(existingPortfolio[1])} PLN`);
          console.log(`   Weights: [${existingPortfolio[0].map(w => w.toString()).join(', ')}]`);
          hasExistingPortfolio = true;
          portfolioType = 'PLN_TOKEN';
          results.push({ 
            bot: bot.name, 
            status: 'exists', 
            portfolio: existingPortfolio,
            address: wallet.address,
            totalValue: ethers.formatEther(existingPortfolio[1]),
            type: portfolioType
          });
          continue;
        }
      } catch (error) {
        console.log(`📝 Checking for existing portfolio (PLN): ${error.message}`);
      }

      if (hasExistingPortfolio) {
        continue;
      }

      // Check and set allowance
      const allowance = await plnToken.allowance(wallet.address, CONFIG.CONTRACTS.PORTFOLIO);

      if (allowance < config.amount) {
        console.log(`🔓 Setting PLN allowance...`);
        const approveTx = await plnToken.approve(
          CONFIG.CONTRACTS.PORTFOLIO,
          config.amount,
          { gasLimit: 250000 }
        );

        console.log(`⏳ Approval transaction: ${approveTx.hash}`);
        await approveTx.wait();
        console.log(`✅ Approval confirmed`);

        // Wait 3 seconds after approval as recommended
        console.log(`⏰ Waiting 3 seconds before portfolio creation...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      } else {
        console.log(`✅ Sufficient allowance already set`);

        // Still wait 3 seconds to ensure network stability
        console.log(`⏰ Waiting 3 seconds before portfolio creation...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      // Create portfolio
      console.log(`🏗️ Creating portfolio with ${bot.strategy} strategy...`);
      console.log(`   Amount: ${ethers.formatEther(config.amount)} PLN`);
      console.log(`   Weights: [${config.weights.join(', ')}]`);
      console.log(`   Positions: [${config.isShort.map(s => s ? 'SHORT' : 'LONG').join(', ')}]`);

      // Estimate gas first
      let gasEstimate;
      try {
        gasEstimate = await portfolio.createPortfolio.estimateGas(
          config.amount,
          config.weights,
          config.isShort,
          true // tokenType: true for PLN
        );
        console.log(`⛽ Estimated gas: ${gasEstimate.toString()}`);
      } catch (gasError) {
        console.log(`⚠️  Gas estimation failed, using default: ${gasError.message}`);
        gasEstimate = ethers.getBigInt('1500000'); // Default high gas limit
      }

      const createTx = await portfolio.createPortfolio(
        config.amount,
        config.weights,
        config.isShort,
        true, // tokenType: true for PLN
        { 
          gasLimit: Number(gasEstimate) + 100000, // Add buffer to estimated gas
          gasPrice: ethers.parseUnits('2', 'gwei')
        }
      );

      console.log(`📡 Portfolio creation transaction: ${createTx.hash}`);
      const receipt = await createTx.wait();

      console.log(`✅ Portfolio created successfully!`);
      console.log(`   Block: ${receipt.blockNumber}`);
      console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
      console.log(`   Transaction: https://sepolia.basescan.org/tx/${receipt.transactionHash}`);

      // Verify portfolio creation
      const newPortfolio = await portfolio.getPortfolio(
        wallet.address,
        ethers.ZeroAddress
      );

      console.log(`🎯 Portfolio verification:`);
      console.log(`   Total Value: ${ethers.formatEther(newPortfolio[1])} PLN`);
      console.log(`   Weights: [${newPortfolio[0].map(w => w.toString()).join(', ')}]`);

      results.push({ 
        bot: bot.name, 
        status: 'created', 
        txHash: receipt.transactionHash,
        portfolio: newPortfolio,
        address: wallet.address
      });

    } catch (error) {
      console.error(`❌ Failed to create portfolio for ${bot.name}:`);
      console.error(`   Error: ${error.message}`);

      // Handle specific error cases
      if (error.message.includes('Portfolio has been initialized')) {
        console.log(`   📋 Portfolio already exists for this wallet`);
        results.push({ 
          bot: bot.name, 
          status: 'exists', 
          error: 'Portfolio already initialized',
          address: wallet.address
        });
      } else if (error.message.includes('transfer amount exceeds balance')) {
        console.log(`   💰 Insufficient PLN balance for transfer`);
        results.push({ 
          bot: bot.name, 
          status: 'failed', 
          error: 'Insufficient PLN balance',
          address: wallet.address
        });
      } else {
        if (error.transaction) {
          console.error(`   Transaction: ${error.transaction.hash}`);
          console.error(`   To: ${error.transaction.to}`);
          console.error(`   From: ${error.transaction.from}`);
        }

        if (error.receipt) {
          console.error(`   Gas Used: ${error.receipt.gasUsed.toString()}`);
          console.error(`   Status: ${error.receipt.status}`);
          console.error(`   Block: ${error.receipt.blockNumber}`);
        }

        if (error.reason) {
          console.error(`   Reason: ${error.reason}`);
        }

        if (error.code) {
          console.error(`   Code: ${error.code}`);
        }

        results.push({ 
          bot: bot.name, 
          status: 'failed', 
          error: error.message,
          transactionHash: error.transaction?.hash,
          blockNumber: error.receipt?.blockNumber
        });
      }
    }
  }

  // Summary Report
  console.log('\n🎉 PORTFOLIO CREATION SUMMARY');
  console.log('============================');

  results.forEach(result => {
    const status = result.status === 'created' ? '✅ CREATED' : 
                   result.status === 'exists' ? '✅ EXISTS' : '❌ FAILED';

    console.log(`${result.bot}: ${status}`);

    if (result.txHash) {
      console.log(`   📋 Transaction: ${result.txHash}`);
    }

    if (result.address) {
      console.log(`   🔑 Address: ${result.address}`);
    }
  });

  const created = results.filter(r => r.status === 'created').length;
  const existing = results.filter(r => r.status === 'exists').length;
  const failed = results.filter(r => r.status === 'failed').length;

  console.log(`\n📊 Results: ${created} created, ${existing} existing, ${failed} failed`);

  return results;
}

// Execute if run directly
if (require.main === module) {
  createBotPortfolios()
    .then(results => {
      console.log('\n🎯 Portfolio creation process completed!');
    })
    .catch(error => {
      console.error('\n❌ Portfolio creation failed:', error);
      process.exit(1);
    });
}

module.exports = { createBotPortfolios, BOTS, PORTFOLIO_CONFIGS };