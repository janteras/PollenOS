require('dotenv').config({ path: require('path').resolve(__dirname, '../base-sepolia.env') });
const { ethers } = require('ethers');
const ERC20_ABI = require('../reference-code/pollen-subgraph-v3/abis/ERC20.json');
const PORTFOLIO_ABI = require('../reference-code/pollen-subgraph-v3/abis/PatchedPortfolio.json');

// Configuration
const CONFIG = {
  RPC_URL: 'https://sepolia.base.org',
  CHAIN_ID: 84532,
  CONTRACTS: {
    PLN: '0x9E1c51E1fAa1381D8a7Dbdd19402c5fCce9274C6', // PLN Token
    PORTFOLIO: '0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7', // Pollen DAO/Portfolio
  },
  GAS_LIMIT: 1_000_000, // Adjust based on network conditions
  GAS_MULTIPLIER: 1.2, // Add 20% buffer to estimated gas
};

// Initialize provider and wallet
const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL);
const wallet = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, provider);

// Initialize contracts
const plnToken = new ethers.Contract(CONFIG.CONTRACTS.PLN, ERC20_ABI, wallet);
const portfolio = new ethers.Contract(CONFIG.CONTRACTS.PORTFOLIO, PORTFOLIO_ABI, wallet);

async function logBalances() {
  console.log('\n=== Balances ===');
  
  // ETH Balance
  const ethBalance = await provider.getBalance(wallet.address);
  console.log(`ETH Balance: ${ethers.utils.formatEther(ethBalance)} ETH`);
  
  // PLN Balance
  const plnBalance = await plnToken.balanceOf(wallet.address);
  console.log(`PLN Balance: ${ethers.utils.formatEther(plnBalance)} PLN`);
  
  return { ethBalance, plnBalance };
}

async function checkAllowance() {
  console.log('\n=== PLN Allowance ===');
  
  const allowance = await plnToken.allowance(wallet.address, CONFIG.CONTRACTS.PORTFOLIO);
  console.log(`Current allowance for Portfolio: ${ethers.utils.formatEther(allowance)} PLN`);
  
  return allowance;
}

async function approvePLN(amount = ethers.constants.MaxUint256) {
  console.log('\n=== Approving PLN ===');
  
  // Check current allowance first
  const currentAllowance = await checkAllowance();
  
  if (currentAllowance.gte(amount)) {
    console.log('Sufficient allowance already exists');
    return { approved: true, txHash: null };
  }
  
  try {
    console.log(`Approving ${amount === ethers.constants.MaxUint256 ? 'MAX' : ethers.utils.formatEther(amount)} PLN...`);
    
    const gasPrice = await provider.getGasPrice();
    const gasEstimate = await plnToken.estimateGas.approve(
      CONFIG.CONTRACTS.PORTFOLIO,
      amount,
      { from: wallet.address }
    ).catch(e => {
      console.warn('Gas estimation failed, using default:', e.message);
      return 200000; // Fallback gas limit
    });
    
    const tx = await plnToken.approve(
      CONFIG.CONTRACTS.PORTFOLIO,
      amount,
      {
        gasLimit: Math.floor(gasEstimate * CONFIG.GAS_MULTIPLIER),
        gasPrice: gasPrice.mul(2) // Add buffer for faster inclusion
      }
    );
    
    console.log(`Transaction sent: ${tx.hash}`);
    console.log('Waiting for confirmation...');
    
    const receipt = await tx.wait();
    console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
    console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
    
    // Verify the new allowance
    const newAllowance = await plnToken.allowance(wallet.address, CONFIG.CONTRACTS.PORTFOLIO);
    console.log(`New allowance: ${ethers.utils.formatEther(newAllowance)} PLN`);
    
    return { approved: true, txHash: tx.hash };
  } catch (error) {
    console.error('❌ Approval failed:', error.message);
    if (error.transactionHash) {
      console.log(`Transaction hash: ${error.transactionHash}`);
    }
    return { approved: false, error };
  }
}

async function createPortfolio(amount) {
  console.log('\n=== Creating Portfolio ===');
  
  // Convert amount to wei
  const amountWei = ethers.utils.parseEther(amount.toString());
  
  try {
    // Check if we need to approve first
      const allowance = await plnToken.allowance(wallet.address, CONFIG.CONTRACTS.PORTFOLIO);
      if (allowance.lt(amountWei)) {
        console.log('Insufficient allowance. Approving PLN first...');
        const { approved } = await approvePLN(amountWei);
        if (!approved) {
          throw new Error('Failed to approve PLN');
        }
      }
    
    console.log(`Creating portfolio with ${amount} PLN...`);
    
    // Get gas price with buffer
    const gasPrice = (await provider.getGasPrice()).mul(2);
    
    // Get nonce
    const nonce = await provider.getTransactionCount(wallet.address, 'latest');
    
    // Encode the function call for createPortfolio
    const iface = new ethers.utils.Interface(PORTFOLIO_ABI);
    
    // For now, using equal weights and no short positions
    const numAssets = 1; // Only PLN for now
    const weight = ethers.utils.parseEther('1.0'); // 100% weight on PLN
    const weights = Array(numAssets).fill(weight);
    const isShort = Array(numAssets).fill(false);
    const tokenType = true; // true for PLN, false for vePLN
    
    const data = iface.encodeFunctionData('createPortfolio', [
      amountWei,    // amount
      weights,      // weights array
      isShort,      // isShort array
      tokenType     // token type (PLN)
    ]);
    
    // Build the transaction
    const tx = {
      to: CONFIG.CONTRACTS.PORTFOLIO,
      data: data,
      gasLimit: CONFIG.GAS_LIMIT,
      gasPrice: gasPrice,
      nonce: nonce,
      chainId: CONFIG.CHAIN_ID
    };
    
    console.log('Sending transaction...');
    const sentTx = await wallet.sendTransaction(tx);
    console.log(`Transaction sent: ${sentTx.hash}`);
    
    console.log('Waiting for confirmation...');
    const receipt = await sentTx.wait();
    
    console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
    console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
    console.log(`   Status: ${receipt.status === 1 ? 'Success' : 'Failed'}`);
    
    if (receipt.status === 1) {
      console.log('🎉 Portfolio created successfully!');
    } else {
      console.log('❌ Transaction failed');
    }
    
    return { success: receipt.status === 1, txHash: sentTx.hash };
  } catch (error) {
    console.error('❌ Error creating portfolio:', error.message);
    
    if (error.transactionHash) {
      console.log(`Transaction hash: ${error.transactionHash}`);
      console.log(`Check transaction: https://sepolia.basescan.org/tx/${error.transactionHash}`);
    }
    
    if (error.reason) {
      console.log(`Reason: ${error.reason}`);
    }
    
    return { success: false, error };
  }
}

async function main() {
  console.log('=== Pollen Portfolio Interaction ===');
  console.log(`Network: Base Sepolia (Chain ID: ${(await provider.getNetwork()).chainId})`);
  console.log(`Wallet: ${wallet.address}`);
  
  try {
    // Check balances
    await logBalances();
    
    // Check allowance
    await checkAllowance();
    
    // Example: Approve 10 PLN
    // await approvePLN(ethers.utils.parseEther('10'));
    
    // Example: Create portfolio with 1 PLN (for testing)
    // await createPortfolio('1');
    
  } catch (error) {
    console.error('Script error:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);

// Export functions for testing
module.exports = {
  approvePLN,
  createPortfolio,
  checkAllowance,
  logBalances
};
