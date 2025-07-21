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
].filter(Boolean); // Remove any undefined values

// Portfolio configuration
const PORTFOLIO_CONFIG = {
  amount: '1', // 1 PLN per wallet
  weights: [
    ethers.utils.parseEther('0.1561'), // WBTC
    ethers.utils.parseEther('0.1457'), // cbETH
    ethers.utils.parseEther('0.1451'), // WETH
    ethers.utils.parseEther('0.1432'), // LINK
    ethers.utils.parseEther('0.1366'), // USDT
    ethers.utils.parseEther('0.1365'), // USDC
    ethers.utils.parseEther('0.1365')  // DAI
  ],
  isShort: [false, false, false, false, false, false, false],
  tokenType: true // true for PLN, false for vePLN
};

// Add delay between transactions
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function replicatePortfolio() {
  const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL);
  // Create contract factory
  const portfolioInterface = new ethers.utils.Interface([
    'function createPortfolio(uint256,uint256[],bool[],bool)'
  ]);

  for (const [index, privateKey] of PRIVATE_KEYS.entries()) {
    const wallet = new ethers.Wallet(privateKey, provider);
    // Create contract with signer for this wallet
    const portfolio = new ethers.Contract(
      CONFIG.CONTRACTS.PORTFOLIO,
      portfolioInterface,
      wallet // Use wallet as the signer
    );
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
      const amountWei = ethers.utils.parseEther(PORTFOLIO_CONFIG.amount);

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
          await delay(2000); // Wait 2 seconds after approval
        } catch (error) {
          console.error('   ❌ Approval failed:', error.message);
          continue;
        }
      }

      // 3. Create portfolio
      console.log('   Creating portfolio...');
      try {
        const tx = await portfolio.createPortfolio(
          amountWei,
          PORTFOLIO_CONFIG.weights,
          PORTFOLIO_CONFIG.isShort,
          PORTFOLIO_CONFIG.tokenType,
          { gasLimit: 1500000 }
        );

        const receipt = await tx.wait();
        console.log(`   ✅ Portfolio created: ${receipt.transactionHash}`);
        console.log(`   https://sepolia.basescan.org/tx/${receipt.transactionHash}`);
      } catch (error) {
        console.error('   ❌ Portfolio creation failed:', error.message);
        if (error.transactionHash) {
          console.log(`   Transaction hash: ${error.transactionHash}`);
        }
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
replicatePortfolio().catch(console.error);
