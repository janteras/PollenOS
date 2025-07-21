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

// Configuration
const PORTFOLIO_CONFIG = {
  amount: '1', // 1 PLN per portfolio
  gasLimit: 500000,
  gasPrice: ethers.utils.parseUnits('2', 'gwei'),
  delayBetweenWallets: 10000, // 10 seconds
};

// Add delay helper
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Default allocation weights (7 assets, sum to 1.0)
const DEFAULT_WEIGHTS = [
  '0.1561', // WETH
  '0.1457', // WBTC
  '0.1451', // LINK
  '0.1432', // UNI
  '0.1366', // AAVE
  '0.1365', // SNX
  '0.1365'  // CRV
];

async function createPortfolios() {
  console.log('=== Creating Portfolios ===\n');

  const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL, {
    name: 'base-sepolia',
    chainId: 84532,
  });

  // ABI for the Portfolio contract
  const portfolioABI = [
    'function createPortfolio(uint256, uint256[], bool[], bool)',
    'function balanceOf(address) view returns (uint256)',
    'function getPortfolio(address,address) view returns (uint256[],uint256,uint256,uint256,bool,uint256,uint256,bool[])'
  ];

  // ABI for PLN token
  const plnABI = [
    'function balanceOf(address) view returns (uint256)',
    'function allowance(address,address) view returns (uint256)',
    'function approve(address,uint256) returns (bool)'
  ];

  // Initialize PLN token contract
  const plnToken = new ethers.Contract(CONFIG.CONTRACTS.PLN, plnABI, provider);

  for (const [index, privateKey] of PRIVATE_KEYS.entries()) {
    const wallet = new ethers.Wallet(privateKey, provider);
    console.log(`\n=== Processing Wallet ${index + 1}/${PRIVATE_KEYS.length} ===`);
    console.log(`Address: ${wallet.address}`);

    try {
      // 1. Check ETH balance
      const ethBalance = await provider.getBalance(wallet.address);
      console.log(`   ETH Balance: ${ethers.utils.formatEther(ethBalance)}`);

      if (ethBalance.lt(ethers.utils.parseEther('0.01'))) {
        console.log('   ❌ Insufficient ETH for gas');
        continue;
      }

      // 2. Check PLN balance
      const plnBalance = await plnToken.balanceOf(wallet.address);
      const amountWei = ethers.utils.parseEther(PORTFOLIO_CONFIG.amount);
      console.log(`   PLN Balance: ${ethers.utils.formatEther(plnBalance)}`);

      if (plnBalance.lt(amountWei)) {
        console.log(`   ❌ Insufficient PLN balance (needed: ${PORTFOLIO_CONFIG.amount} PLN)`);
        continue;
      }

      // 3. Check PLN allowance
      const allowance = await plnToken.allowance(wallet.address, CONFIG.CONTRACTS.PORTFOLIO);
      
      if (allowance.lt(amountWei)) {
        console.log('   Setting PLN allowance...');
        try {
          const plnTokenWithSigner = plnToken.connect(wallet);
          const approveTx = await plnTokenWithSigner.approve(
            CONFIG.CONTRACTS.PORTFOLIO,
            amountWei,
            {
              gasLimit: 250000,
              gasPrice: PORTFOLIO_CONFIG.gasPrice
            }
          );
          
          console.log(`   ✅ Approval sent: ${approveTx.hash}`);
          console.log('   Waiting for confirmation...');
          
          const receipt = await approveTx.wait();
          console.log(`   ✅ Approval confirmed in block ${receipt.blockNumber}`);
          
          // Wait after approval
          console.log('   Waiting 5 seconds before portfolio creation...');
          await delay(5000);
        } catch (error) {
          console.error('   ❌ Approval failed:', error.message);
          continue;
        }
      } else {
        console.log('   ✅ Sufficient allowance already set');
      }

      // 4. Create portfolio contract with signer
      const portfolio = new ethers.Contract(
        CONFIG.CONTRACTS.PORTFOLIO,
        portfolioABI,
        wallet
      );

      // 5. Prepare portfolio parameters
      const weights = DEFAULT_WEIGHTS.map(w => 
        ethers.utils.parseEther(w)
      );
      
      const isShort = Array(DEFAULT_WEIGHTS.length).fill(false);
      const tokenType = true; // true for PLN, false for vePLN

      // 6. Create portfolio
      console.log('   Creating portfolio...');
      try {
        const tx = await portfolio.createPortfolio(
          amountWei,    // amount
          weights,      // weights
          isShort,      // isShort array
          tokenType,    // tokenType (PLN/vePLN)
          {
            gasLimit: PORTFOLIO_CONFIG.gasLimit,
            gasPrice: PORTFOLIO_CONFIG.gasPrice
          }
        );

        console.log(`   ✅ Portfolio creation sent: ${tx.hash}`);
        console.log('   Waiting for confirmation...');
        
        const receipt = await tx.wait();
        console.log(`   ✅ Portfolio created in block ${receipt.blockNumber}`);
        console.log(`   Transaction hash: ${receipt.transactionHash}`);
        console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
        
      } catch (error) {
        console.error('   ❌ Portfolio creation failed:', error.message);
        if (error.transactionHash) {
          console.log(`   Transaction hash: ${error.transactionHash}`);
          console.log(`   Check status: https://sepolia.basescan.org/tx/${error.transactionHash}`);
        }
        console.error('   Error details:', error);
        continue;
      }

      // Add delay between wallets
      if (index < PRIVATE_KEYS.length - 1) {
        console.log(`\nWaiting ${PORTFOLIO_CONFIG.delayBetweenWallets/1000} seconds before next wallet...`);
        await delay(PORTFOLIO_CONFIG.delayBetweenWallets);
      }

    } catch (error) {
      console.error(`   ❌ Unexpected error: ${error.message}`);
      console.error('   Stack:', error.stack);
    }
  }

  console.log('\n=== Portfolio Creation Process Completed ===');
}

// Run with error handling
createPortfolios()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
