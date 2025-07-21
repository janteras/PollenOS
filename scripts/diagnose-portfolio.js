require('dotenv').config({ path: require('path').resolve(__dirname, '.wallets') });
const { ethers } = require('ethers');
const { CONFIG } = require('./view-portfolio-details');

// Load private keys from environment variables
const PRIVATE_KEYS = [
  process.env.PRIVATE_KEY_1,
  process.env.PRIVATE_KEY_2,
  process.env.PRIVATE_KEY_3,
  process.env.PRIVATE_KEY_4,
  process.env.PRIVATE_KEY_5
].filter(Boolean);

async function diagnosePortfolio() {
  console.log('=== Portfolio Diagnostic Tool ===\n');

  // Initialize provider
  const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL, {
    name: 'base-sepolia',
    chainId: 84532,
  });

  // Minimal ABI for basic checks
  const minimalABI = [
    'function balanceOf(address) view returns (uint256)',
    'function totalSupply() view returns (uint256)',
    'function getPortfolio(address,address) view returns (uint256[],uint256,uint256,uint256,bool,uint256,uint256,bool[])'
  ];

  // Create contract instance
  const portfolio = new ethers.Contract(CONFIG.CONTRACTS.PORTFOLIO, minimalABI, provider);
  const plnToken = new ethers.Contract(CONFIG.CONTRACTS.PLN, ['function balanceOf(address) view returns (uint256)'], provider);

  // 1. Check contract state
  try {
    console.log('1. Checking contract state...');
    const totalSupply = await portfolio.totalSupply();
    console.log(`   Total Supply: ${ethers.utils.formatEther(totalSupply)} shares`);
  } catch (error) {
    console.error('   ❌ Error checking contract state:', error.message);
  }

  // 2. Check each wallet
  console.log('\n2. Checking wallet balances...');
  for (const [index, privateKey] of PRIVATE_KEYS.entries()) {
    const wallet = new ethers.Wallet(privateKey, provider);
    console.log(`\n=== Wallet ${index + 1}/${PRIVATE_KEYS.length} ===`);
    console.log(`Address: ${wallet.address}`);

    try {
      // Check ETH balance
      const ethBalance = await provider.getBalance(wallet.address);
      console.log(`   ETH: ${ethers.utils.formatEther(ethBalance)}`);

      // Check PLN balance
      const plnBalance = await plnToken.balanceOf(wallet.address);
      console.log(`   PLN: ${ethers.utils.formatEther(plnBalance)}`);

      // Check portfolio balance
      try {
        const balance = await portfolio.balanceOf(wallet.address);
        console.log(`   Portfolio Balance: ${ethers.utils.formatEther(balance)} shares`);
        
        if (balance.gt(0)) {
          console.log('   Fetching portfolio details...');
          try {
            const portfolioData = await portfolio.getPortfolio(wallet.address, ethers.constants.AddressZero);
            const [amounts, , , , , , ,] = portfolioData;
            console.log('   Portfolio amounts:', amounts.map(a => a.toString()));
          } catch (e) {
            console.log('   Could not fetch portfolio details:', e.message);
          }
        }
      } catch (error) {
        console.log('   ❌ Error checking portfolio balance:', error.message);
      }

      // Check recent transactions
      console.log('   Recent transactions:');
      const txs = await provider.getTransactionCount(wallet.address);
      console.log(`   Total transactions: ${txs}`);
      
      // Get the last transaction
      if (txs > 0) {
        const lastTx = await provider.getTransactionReceipt(
          await provider.getTransactionCount(wallet.address) - 1
        );
        console.log('   Last transaction:', {
          hash: lastTx.transactionHash,
          blockNumber: lastTx.blockNumber,
          status: lastTx.status === 1 ? 'Success' : 'Failed'
        });
      }
      
    } catch (error) {
      console.error('   ❌ Error checking wallet:', error.message);
    }
  }

  console.log('\n=== Diagnostic Complete ===');
}

// Run the diagnostic
diagnosePortfolio()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
