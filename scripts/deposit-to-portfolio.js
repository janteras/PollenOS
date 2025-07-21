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

// Deposit configuration
const DEPOSIT_CONFIG = {
  amount: '1', // 1 PLN per wallet
};

// Add delay between transactions
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function depositToPortfolio() {
  const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL);
  
  // ABI for depositPLN function
  const portfolioABI = [
    'function depositPLN(uint256 amount, address recipient)',
    'function balanceOf(address) view returns (uint256)'
  ];
  
  for (const [index, privateKey] of PRIVATE_KEYS.entries()) {
    const wallet = new ethers.Wallet(privateKey, provider);
    console.log(`\n=== Processing wallet ${index + 1}/${PRIVATE_KEYS.length}: ${wallet.address} ===`);

    try {
      // 1. Check balances
      const [ethBalance, plnToken] = await Promise.all([
        provider.getBalance(wallet.address),
        new ethers.Contract(
          CONFIG.CONTRACTS.PLN,
          ['function balanceOf(address) view returns (uint256)', 'function allowance(address,address) view returns (uint256)'],
          wallet
        )
      ]);

      const plnBalance = await plnToken.balanceOf(wallet.address);
      const amountWei = ethers.utils.parseEther(DEPOSIT_CONFIG.amount);

      console.log(`   ETH Balance: ${ethers.utils.formatEther(ethBalance)}`);
      console.log(`   PLN Balance: ${ethers.utils.formatEther(plnBalance)}`);

      if (ethBalance.lt(ethers.utils.parseEther('0.01'))) {
        console.log('   ❌ Insufficient ETH for gas');
        continue;
      }

      if (plnBalance.lt(amountWei)) {
        console.log('   ❌ Insufficient PLN balance');
        continue;
      }

      // 2. Approve PLN if needed
      const allowance = await plnToken.allowance(wallet.address, CONFIG.CONTRACTS.PORTFOLIO);
      if (allowance.lt(amountWei)) {
        console.log('   Approving PLN...');
        try {
          const tx = await plnToken.approve(
            CONFIG.CONTRACTS.PORTFOLIO,
            amountWei,
            { gasLimit: 200000 }
          );
          const receipt = await tx.wait();
          console.log(`   ✅ Approval confirmed in tx: ${receipt.transactionHash}`);
          await delay(2000);
        } catch (error) {
          console.error('   ❌ Approval failed:', error.message);
          continue;
        }
      }

      // 3. Create portfolio contract with signer
      const portfolio = new ethers.Contract(
        CONFIG.CONTRACTS.PORTFOLIO,
        portfolioABI,
        wallet
      );

      // 4. Deposit PLN
      console.log('   Depositing PLN...');
      try {
        const tx = await portfolio.depositPLN(
          amountWei,
          wallet.address, // recipient (same as sender for self)
          { gasLimit: 500000 } // Increased gas limit
        );

        const receipt = await tx.wait();
        console.log(`   ✅ Deposit successful: ${receipt.transactionHash}`);
        console.log(`   https://sepolia.basescan.org/tx/${receipt.transactionHash}`);
      } catch (error) {
        console.error('   ❌ Deposit failed:', error.message);
        if (error.transactionHash) {
          console.log(`   Transaction hash: ${error.transactionHash}`);
        }
        // Log the full error for debugging
        console.error('   Error details:', error);
      }

      // Add delay between wallets
      if (index < PRIVATE_KEYS.length - 1) {
        console.log('   Waiting 5 seconds before next wallet...');
        await delay(5000);
      }

    } catch (error) {
      console.error(`   ❌ Unexpected error: ${error.message}`);
    }
  }
}

// Run the script
depositToPortfolio().catch(console.error);
