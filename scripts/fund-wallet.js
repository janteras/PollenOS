require('dotenv').config({ path: require('path').resolve(__dirname, '../base-sepolia.env') });
const { ethers } = require('ethers');
const logger = require('../src/modules/logger');

async function checkAndFundWallet() {
  try {
    // Initialize provider and wallet
    const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org');
    const wallet = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, provider);
    
    // Get current balance
    const balance = await provider.getBalance(wallet.address);
    const minBalance = ethers.parseEther('0.01'); // 0.01 ETH minimum
    
    console.log(`\n=== Wallet Status ===`);
    console.log(`Address: ${wallet.address}`);
    console.log(`Balance: ${ethers.formatEther(balance)} ETH`);
    
    if (balance < minBalance) {
      console.log('\n⚠️  Wallet balance is low. Please fund with testnet ETH from:');
      console.log('1. Base Sepolia Faucet: https://www.base.org/faucet');
      console.log(`2. Or use this command in another terminal (requires a funded account):`);
      console.log(`   cast send --rpc-url ${provider._network.url} --unlocked --from YOUR_FUNDED_ADDRESS --value 0.1ether ${wallet.address}`);
    } else {
      console.log('\n✅ Wallet has sufficient ETH for gas fees');
    }
    
    return { address: wallet.address, balance };
    
  } catch (error) {
    console.error('❌ Error checking wallet balance:', error.message);
    throw error;
  }
}

// Run the check
checkAndFundWallet()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
