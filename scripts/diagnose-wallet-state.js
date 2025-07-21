require('dotenv').config();
const { ethers } = require('ethers');

// Configuration
const CONFIG = {
  RPC_URL: 'https://sepolia.base.org',
  CHAIN_ID: 84532,
  CONTRACTS: {
    PLN: '0x9E1c51E1fAa1381D8a7Dbdd19402c5fCce9274C6',
    PORTFOLIO: '0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7',
  },
  // Using the first private key as default, can be overridden
  PRIVATE_KEY: process.env.WALLET_PRIVATE_KEY || '0x241083ae625b93b41b555052840c09458c71704889b22774101d21b4d1482e62'
};

// ABI for the Portfolio contract
const PORTFOLIO_ABI = [
  'event PortfolioCreated(address indexed user, address indexed token, uint256 amount, uint256[] weights, bool[] isShort, bool tokenType)',
  'function createPortfolio(uint256 amount, uint256[] calldata weights, bool[] calldata isShort, bool tokenType)',
  'function getPortfolio(address user, address token) view returns (uint256[], uint256, uint256, uint256, bool, uint256, uint256, bool[])'
];

// ABI for the PLN token
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address, address) view returns (uint256)',
  'function approve(address, uint256) returns (bool)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)'
];

async function diagnoseWalletState() {
  console.log('=== Wallet State Diagnosis ===\n');
  
  // Initialize provider and wallet
  const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL, {
    name: 'base-sepolia',
    chainId: CONFIG.CHAIN_ID,
  });

  const wallet = new ethers.Wallet(CONFIG.PRIVATE_KEY, provider);
  console.log(`Wallet: ${wallet.address}`);
  
  // Initialize contracts
  const plnToken = new ethers.Contract(CONFIG.CONTRACTS.PLN, ERC20_ABI, wallet);
  const portfolio = new ethers.Contract(CONFIG.CONTRACTS.PORTFOLIO, PORTFOLIO_ABI, wallet);
  
  // 1. Check ETH balance
  const ethBalance = await provider.getBalance(wallet.address);
  console.log(`\n1. ETH Balance: ${ethers.utils.formatEther(ethBalance)}`);
  
  // 2. Check PLN token info
  const plnSymbol = await plnToken.symbol();
  const plnDecimals = await plnToken.decimals();
  const plnBalance = await plnToken.balanceOf(wallet.address);
  
  console.log(`\n2. ${plnSymbol} Token:`);
  console.log(`   Balance: ${ethers.utils.formatUnits(plnBalance, plnDecimals)} ${plnSymbol}`);
  
  // 3. Check PLN allowance
  const allowance = await plnToken.allowance(wallet.address, CONFIG.CONTRACTS.PORTFOLIO);
  console.log(`\n3. ${plnSymbol} Allowance for Portfolio:`);
  console.log(`   ${ethers.utils.formatUnits(allowance, plnDecimals)} ${plnSymbol}`);
  
  // 4. Check portfolio state
  console.log('\n4. Checking portfolio state...');
  try {
    const portfolioData = await portfolio.getPortfolio(wallet.address, ethers.constants.AddressZero);
    console.log('   Portfolio data:', {
      totalValue: ethers.utils.formatUnits(portfolioData[1], plnDecimals),
      isActive: portfolioData[4],
      lastRebalanceTime: new Date(Number(portfolioData[5]) * 1000).toISOString(),
      createTime: new Date(Number(portfolioData[6]) * 1000).toISOString(),
      weights: portfolioData[0].map(w => w.toString())
    });
  } catch (error) {
    console.log('   Error getting portfolio:', error.reason || error.message);
    
    // Check if it's because the portfolio doesn't exist
    if (error.reason === 'Portfolio does not exist') {
      console.log('   No portfolio exists for this wallet.');
    }
  }
  
  // 5. Check for PortfolioCreated events
  console.log('\n5. Checking for PortfolioCreated events...');
  try {
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 10000); // Last 10k blocks
    
    const filter = portfolio.filters.PortfolioCreated(wallet.address, null, null, null, null, null);
    const events = await portfolio.queryFilter(filter, fromBlock, 'latest');
    
    if (events.length > 0) {
      console.log(`   Found ${events.length} PortfolioCreated event(s):`);
      events.forEach((event, i) => {
        console.log(`\n   Event ${i + 1}:`);
        console.log('   - Block:', event.blockNumber);
        console.log('   - Tx Hash:', event.transactionHash);
        console.log('   - Token:', event.args.token);
        console.log('   - Amount:', ethers.utils.formatUnits(event.args.amount, plnDecimals), plnSymbol);
        console.log('   - Weights:', event.args.weights.map(w => w.toString()));
        console.log('   - isShort:', event.args.isShort);
        console.log('   - tokenType:', event.args.tokenType);
      });
    } else {
      console.log('   No PortfolioCreated events found in the last 10,000 blocks.');
    }
  } catch (error) {
    console.log('   Error querying events:', error.message);
  }
  
  // 6. Check recent transactions
  console.log('\n6. Checking recent transactions...');
  try {
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 10000);
    
    // Get all transactions to/from the wallet
    const txs = await provider.getLogs({
      fromBlock: fromBlock,
      toBlock: 'latest',
      address: [CONFIG.CONTRACTS.PORTFOLIO, CONFIG.CONTRACTS.PLN],
      topics: [
        null,
        ethers.utils.hexZeroPad(wallet.address, 32) // Filter by wallet in the first topic (from)
      ]
    });
    
    if (txs.length > 0) {
      console.log(`   Found ${txs.length} relevant transaction(s):`);
      
      for (const tx of txs) {
        const txReceipt = await provider.getTransactionReceipt(tx.transactionHash);
        console.log(`\n   Tx: ${tx.transactionHash}`);
        console.log('   Block:', tx.blockNumber);
        console.log('   To:', txReceipt.to);
        console.log('   Method:', tx.topics[0]);
        console.log('   Status:', txReceipt.status === 1 ? 'Success' : 'Failed');
        console.log('   Gas Used:', txReceipt.gasUsed.toString());
      }
    } else {
      console.log('   No relevant transactions found in the last 10,000 blocks.');
    }
  } catch (error) {
    console.log('   Error querying transactions:', error.message);
  }
}

// Run the diagnosis
diagnoseWalletState()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
