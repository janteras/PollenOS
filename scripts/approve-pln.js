require('dotenv').config({ path: require('path').resolve(__dirname, '../base-sepolia.env') });
const { ethers } = require('ethers');

// Contract ABIs
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address) view returns (uint256)'
];

// Base Sepolia Contract Addresses
const CONFIG = {
  RPC_URL: 'https://sepolia.base.org',
  CHAIN_ID: 84532,
  CONTRACTS: {
    PLN: '0x9E1c51E1fAa1381D8a7Dbdd19402c5fCce9274C6', // PLN Token
    VEPLN: '0x3a28AB567b661B3edaF9Ef0bDE9489558EDB3995', // vePLN Contract
    POLLEN_DAO: '0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7',
    LEAGUES: '0x55F04Ee2775925b80125F412C05cF5214Fd1317a'
  }
};

async function approvePLN() {
  try {
    // Initialize provider and wallet
    const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL);
    const wallet = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, provider);
    
    console.log('🔑 Wallet:', wallet.address);
    console.log('🌐 Network: Base Sepolia');
    
    // Get the PLN token contract
    const plnToken = new ethers.Contract(
      CONFIG.CONTRACTS.PLN,
      ERC20_ABI,
      wallet
    );
    
    // Check PLN balance
    const plnBalance = await plnToken.balanceOf(wallet.address);
    console.log(`💰 PLN Balance: ${ethers.utils.formatEther(plnBalance)} PLN`);
    
    if (plnBalance.isZero()) {
      throw new Error('Insufficient PLN balance. You need PLN to approve.');
    }
    
    // Check current allowance for vePLN contract
    const currentAllowance = await plnToken.allowance(
      wallet.address,
      CONFIG.CONTRACTS.VEPLN
    );
    
    console.log(`\n=== Current Allowance ===`);
    console.log(`   vePLN Contract: ${CONFIG.CONTRACTS.VEPLN}`);
    console.log(`   Current Allowance: ${ethers.utils.formatEther(currentAllowance)} PLN`);
    
    // If already approved, no need to approve again
    if (!currentAllowance.isZero()) {
      console.log('✅ PLN is already approved for the vePLN contract');
      return { 
        success: true, 
        allowance: currentAllowance.toString(),
        txHash: 'Already approved' 
      };
    }
    
    // Get current gas price and add buffer
    const gasPrice = (await provider.getGasPrice()).mul(2); // Double the current gas price
    
    // Approve max uint256 amount
    const amount = ethers.constants.MaxUint256; // Approve maximum possible amount
    console.log(`\n🔒 Approving vePLN to spend PLN...`);
    
    // Send the approval transaction
    console.log(`   Spender: ${CONFIG.CONTRACTS.VEPLN}`);
    console.log(`   Amount: MAX (${amount.toString()})`);
    console.log(`   Gas Price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`);
    
    try {
      const tx = await plnToken.approve(
        CONFIG.CONTRACTS.VEPLN,
        amount,
        {
          gasLimit: 200000, // Higher gas limit for token approvals
          gasPrice: gasPrice
        }
      );
      
      console.log(`\n⏳ Transaction sent: ${tx.hash}`);
      console.log('Waiting for confirmation...');
      
      const receipt = await tx.wait();
      console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
      
      // Verify the approval was successful
      const newAllowance = await plnToken.allowance(
        wallet.address, 
        CONFIG.CONTRACTS.VEPLN
      );
      
      console.log('\n=== Approval Successful ===');
      console.log(`   New Allowance: ${ethers.utils.formatEther(newAllowance)} PLN`);
      console.log(`   Transaction Hash: ${receipt.transactionHash}`);
      console.log(`   Block: ${receipt.blockNumber}`);
      console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
      
      return {
        success: true,
        txHash: receipt.transactionHash,
        allowance: newAllowance.toString(),
        blockNumber: receipt.blockNumber
      };
    } catch (error) {
      console.error('\n❌ Error during approval transaction:');
      if (error.code === 'INSUFFICIENT_FUNDS') {
        console.error('   Insufficient ETH for gas. Please fund your wallet.');
      } else if (error.code === 'REPLACEMENT_UNDERPRICED') {
        console.error('   Replacement transaction underpriced. Try again with higher gas price.');
      } else if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
        console.error('   Could not estimate gas. The transaction might fail.');
      } else if (error.reason) {
        console.error(`   ${error.reason}`);
      } else {
        console.error(`   ${error.message}`);
      }
      throw error;
    }
    return { success: true, txHash: tx.hash };
    
  } catch (error) {
    console.error('❌ Error approving PLN:', error.message);
    if (error.reason) console.error('Reason:', error.reason);
    if (error.transactionHash) console.error(`Transaction hash: ${error.transactionHash}`);
    throw error;
  }
}

// Run the approval
approvePLN()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
