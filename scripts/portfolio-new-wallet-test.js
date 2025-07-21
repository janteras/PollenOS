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
  // Use the first private key from the provided list
  PRIVATE_KEY: 'd74ae2c1a798042c9bbf56f15d2649df6d114e763f9444e2cddcde050900f1d0'
};

// ABI for the Portfolio contract
const PORTFOLIO_ABI = [
  'function createPortfolio(uint256 amount, uint256[] calldata weights, bool[] calldata isShort, bool tokenType)',
  'function getPortfolio(address user, address token) view returns (uint256[], uint256, uint256, uint256, bool, uint256, uint256, bool[])'
];

// ABI for the PLN token
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address, address) view returns (uint256)',
  'function approve(address, uint256) returns (bool)',
  'function transfer(address, uint256) returns (bool)',
  'function transferFrom(address, address, uint256) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
];

async function testWithNewWallet() {
  console.log('=== Testing Portfolio Creation with New Wallet ===\n');
  
  // Initialize provider and wallet
  const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL, {
    name: 'base-sepolia',
    chainId: CONFIG.CHAIN_ID,
  });

  const wallet = new ethers.Wallet(CONFIG.PRIVATE_KEY, provider);
  console.log(`Using wallet: ${wallet.address}`);
  
  // Initialize contracts
  const plnToken = new ethers.Contract(CONFIG.CONTRACTS.PLN, ERC20_ABI, wallet);
  const portfolio = new ethers.Contract(CONFIG.CONTRACTS.PORTFOLIO, PORTFOLIO_ABI, wallet);
  
  // 1. Check ETH balance
  const ethBalance = await provider.getBalance(wallet.address);
  console.log(`\n1. ETH Balance: ${ethers.utils.formatEther(ethBalance)}`);
  
  if (ethBalance.lt(ethers.utils.parseEther('0.001'))) {
    console.log('⚠️  Warning: Low ETH balance. You may need to fund this wallet with ETH for gas.');
  }
  
  // 2. Check PLN token info
  const plnSymbol = await plnToken.symbol();
  const plnDecimals = await plnToken.decimals();
  const plnBalance = await plnToken.balanceOf(wallet.address);
  
  console.log(`\n2. ${plnSymbol} Token:`);
  console.log(`   Balance: ${ethers.utils.formatUnits(plnBalance, plnDecimals)} ${plnSymbol}`);
  
  // 3. Check if portfolio already exists
  console.log('\n3. Checking for existing portfolio...');
  try {
    const portfolioData = await portfolio.getPortfolio(wallet.address, ethers.constants.AddressZero);
    console.log('   ❗ Portfolio already exists for this wallet!');
    console.log('   Portfolio data:', {
      totalValue: ethers.utils.formatUnits(portfolioData[1], plnDecimals),
      isActive: portfolioData[4]
    });
    return; // Exit if portfolio exists
  } catch (error) {
    if (error.reason === 'Portfolio does not exist') {
      console.log('   No existing portfolio found for this wallet.');
    } else {
      console.log('   Error checking portfolio:', error.message);
    }
  }
  
  // 4. Check PLN balance and approve if needed
  const amountToDeposit = ethers.utils.parseUnits('10', plnDecimals);
  
  if (plnBalance.lt(amountToDeposit)) {
    console.log(`\n❌ Insufficient ${plnSymbol} balance. Need at least 10 ${plnSymbol} to create a portfolio.`);
    return;
  }
  
  console.log(`\n4. Checking ${plnSymbol} allowance...`);
  const allowance = await plnToken.allowance(wallet.address, CONFIG.CONTRACTS.PORTFOLIO);
  
  if (allowance.lt(amountToDeposit)) {
    console.log(`Approving ${plnSymbol} spend...`);
    const approveTx = await plnToken.approve(
      CONFIG.CONTRACTS.PORTFOLIO, 
      amountToDeposit,
      {
        gasLimit: 100000,
        gasPrice: ethers.utils.parseUnits('2', 'gwei')
      }
    );
    
    console.log(`   Approval tx: ${approveTx.hash}`);
    console.log('   Waiting for confirmation...');
    await approveTx.wait();
    console.log('   ✔️  Approval confirmed');
  } else {
    console.log('   Sufficient allowance already set');
  }
  
  // 5. Prepare portfolio creation parameters
  const weights = [16, 14, 14, 14, 14, 14, 14]; // Must sum to 100
  const isShort = [false, false, false, false, false, false, false];
  const tokenType = false; // false for PLN, true for vePLN
  
  console.log('\n5. Creating portfolio with parameters:');
  console.log('   Amount: 10.0', plnSymbol);
  console.log('   Weights:', weights.join(', '), '(sum:', weights.reduce((a, b) => a + b, 0) + ')');
  console.log('   isShort:', isShort.join(', '));
  console.log('   tokenType:', tokenType ? 'vePLN' : 'PLN');
  
  // 6. Create the portfolio
  try {
    console.log('\n6. Sending createPortfolio transaction...');
    const tx = await portfolio.createPortfolio(
      amountToDeposit,
      weights,
      isShort,
      tokenType,
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
    
  } catch (error) {
    console.error('\n❌ Error creating portfolio:');
    console.error(error);
    
    if (error.transactionHash) {
      console.log(`\nTransaction failed: https://sepolia.basescan.org/tx/${error.transactionHash}`);
    }
    
    if (error.reason) {
      console.log('Reason:', error.reason);
    }
  }
}

// Run the test
testWithNewWallet()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
