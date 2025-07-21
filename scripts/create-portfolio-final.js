require('dotenv').config({ path: require('path').resolve(__dirname, '.wallets') });
const { ethers } = require('ethers');

// Configuration
const CONFIG = {
  RPC_URL: 'https://sepolia.base.org',
  CHAIN_ID: 84532,
  CONTRACTS: {
    PLN: '0x9E1c51E1fAa1381D8a7Dbdd19402c5fCce9274C6',
    PORTFOLIO: '0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7',
  },
  // Use the parameters from the successful transaction
  PORTFOLIO_PARAMS: {
    amount: '10.0', // 10.0 tokens
    weights: [16, 14, 14, 14, 14, 14, 14], // Must sum to 100
    isShort: [false, false, false, false, false, false, false],
    tokenType: false, // false for PLN, true for vePLN
  }
};

// ABI for the Portfolio contract (minimal)
const PORTFOLIO_ABI = [
  'function createPortfolio(uint256, uint256[], bool[], bool)',
  'function balanceOf(address) view returns (uint256)',
  'function getPortfolio(address, address) view returns (uint256[], uint256, uint256, uint256, bool, uint256, uint256, bool[])'
];

// ABI for the PLN token (minimal)
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address, address) view returns (uint256)',
  'function approve(address, uint256) returns (bool)',
  'function decimals() view returns (uint8)'
];

async function createPortfolio() {
  console.log('=== Portfolio Creation Script ===\n');
  
  // Initialize provider and wallet
  const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL, {
    name: 'base-sepolia',
    chainId: CONFIG.CHAIN_ID,
  });

  // Load private key from environment (using the first wallet)
  const privateKey = process.env.PRIVATE_KEY_1;
  if (!privateKey) {
    throw new Error('Private key not found in environment variables');
  }
  
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log(`Using wallet: ${wallet.address}`);
  
  // Initialize contracts
  const plnToken = new ethers.Contract(CONFIG.CONTRACTS.PLN, ERC20_ABI, wallet);
  const portfolio = new ethers.Contract(CONFIG.CONTRACTS.PORTFOLIO, PORTFOLIO_ABI, wallet);
  
  // 1. Check ETH balance
  const ethBalance = await provider.getBalance(wallet.address);
  console.log(`\n1. ETH Balance: ${ethers.utils.formatEther(ethBalance)}`);
  
  if (ethBalance.lt(ethers.utils.parseEther('0.005'))) {
    console.log('⚠️  Low ETH balance. You may need more ETH for gas.');
  }
  
  // 2. Check PLN balance
  const plnBalance = await plnToken.balanceOf(wallet.address);
  const plnDecimals = await plnToken.decimals();
  const plnAmount = ethers.utils.parseUnits(CONFIG.PORTFOLIO_PARAMS.amount, plnDecimals);
  
  console.log(`\n2. PLN Balance: ${ethers.utils.formatUnits(plnBalance, plnDecimals)}`);
  console.log(`   Required: ${ethers.utils.formatUnits(plnAmount, plnDecimals)}`);
  
  if (plnBalance.lt(plnAmount)) {
    throw new Error(`Insufficient PLN balance. Need at least ${CONFIG.PORTFOLIO_PARAMS.amount} PLN`);
  }
  
  // 3. Check and approve PLN allowance
  console.log('\n3. Checking PLN allowance...');
  const allowance = await plnToken.allowance(wallet.address, CONFIG.CONTRACTS.PORTFOLIO);
  
  if (allowance.lt(plnAmount)) {
    console.log('Approving PLN spend...');
    const approveTx = await plnToken.approve(CONFIG.CONTRACTS.PORTFOLIO, plnAmount, {
      gasLimit: 100000,
      gasPrice: ethers.utils.parseUnits('2', 'gwei')
    });
    
    console.log(`   Approval tx: ${approveTx.hash}`);
    console.log('   Waiting for confirmation...');
    await approveTx.wait();
    console.log('   ✔️  Approval confirmed');
  } else {
    console.log('   Sufficient allowance already set');
  }
  
  // 4. Prepare portfolio creation parameters
  const weights = CONFIG.PORTFOLIO_PARAMS.weights.map(w => 
    ethers.BigNumber.from(w)
  );
  
  console.log('\n4. Creating portfolio with parameters:');
  console.log('   Amount:', CONFIG.PORTFOLIO_PARAMS.amount, 'PLN');
  console.log('   Weights:', CONFIG.PORTFOLIO_PARAMS.weights.join(', '));
  console.log('   isShort:', CONFIG.PORTFOLIO_PARAMS.isShort.join(', '));
  console.log('   tokenType:', CONFIG.PORTFOLIO_PARAMS.tokenType ? 'vePLN' : 'PLN');
  
  // 5. Create portfolio
  console.log('\n5. Sending createPortfolio transaction...');
  try {
    const tx = await portfolio.createPortfolio(
      plnAmount,
      weights,
      CONFIG.PORTFOLIO_PARAMS.isShort,
      CONFIG.PORTFOLIO_PARAMS.tokenType,
      {
        gasLimit: 1000000,
        gasPrice: ethers.utils.parseUnits('2', 'gwei')
      }
    );
    
    console.log(`   Transaction hash: ${tx.hash}`);
    console.log('   Waiting for confirmation...');
    
    const receipt = await tx.wait();
    console.log(`\n✅ Portfolio created successfully!`);
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
    console.log(`   View on explorer: https://sepolia.basescan.org/tx/${tx.hash}`);
    
    // 6. Verify portfolio creation
    console.log('\n6. Verifying portfolio creation...');
    try {
      const portfolioData = await portfolio.getPortfolio(wallet.address, ethers.constants.AddressZero);
      console.log('   Portfolio created successfully!');
      console.log('   Portfolio value:', ethers.utils.formatUnits(portfolioData[1], plnDecimals), 'PLN');
      console.log('   Creation time:', new Date(portfolioData[4].toNumber() * 1000).toISOString());
    } catch (e) {
      console.log('   Could not verify portfolio details (this might be expected):', e.message);
    }
    
  } catch (error) {
    console.error('\n❌ Error creating portfolio:');
    console.error(error);
    
    if (error.transactionHash) {
      console.log(`\nTransaction failed: https://sepolia.basescan.org/tx/${error.transactionHash}`);
    }
    
    if (error.reason) {
      console.log('Reason:', error.reason);
    }
    
    process.exit(1);
  }
}

// Run the script
createPortfolio()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
