require('dotenv').config({ path: require('path').resolve(__dirname, '../base-sepolia.env') });
const { ethers } = require('ethers');

async function stakePLN() {
  try {
    // Initialize provider and wallet
    const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
    const wallet = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, provider);
    
    // vePLN contract ABI with the correct function signature
    const vePLN_ABI = [
      'function stake(uint256 amount, uint256 lockDuration) external',
      'function getLockInfo(address) view returns (uint256 amount, uint256 lockEnd)'
    ];
    
    const vePLN = new ethers.Contract(
      '0x3a28AB567b661B3edaF9Ef0bDE9489558EDB3995',
      vePLN_ABI,
      wallet
    );
    
    console.log('=== Staking PLN on Base Sepolia ===');
    console.log(`Wallet: ${wallet.address}`);
    
    // Check current lock info
    try {
      const lockInfo = await vePLN.getLockInfo(wallet.address);
      console.log('\n=== Current Lock Info ===');
      console.log(`Amount: ${ethers.formatEther(lockInfo.amount)} PLN`);
      console.log(`Lock end: ${new Date(Number(lockInfo.lockEnd) * 1000)}`);
      
      if (lockInfo.amount > 0) {
        console.log('\n⚠️  Wallet already has a lock. Cannot create a new one.');
        return;
      }
    } catch (error) {
      console.log('\nNo existing lock found, proceeding with staking...');
    }
    
    // Stake parameters
    const amount = ethers.parseEther('1'); // 1 PLN
    const lockDuration = 30 * 24 * 60 * 60; // 30 days in seconds
    
    console.log('\n=== Staking Parameters ===');
    console.log(`Amount: ${ethers.formatEther(amount)} PLN`);
    console.log(`Lock duration: 30 days`);
    
    // Send the stake transaction
    console.log('\nSending stake transaction...');
    const tx = await vePLN.stake(amount, lockDuration, {
      gasLimit: 500000,
      gasPrice: await provider.getFeeData().then(feeData => feeData.gasPrice * 2n)
    });
    
    console.log(`\n✅ Transaction sent: ${tx.hash}`);
    console.log('Waiting for confirmation...');
    
    const receipt = await tx.wait();
    console.log(`\n✅ Transaction confirmed in block ${receipt.blockNumber}`);
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.reason) console.error('Reason:', error.reason);
    if (error.transactionHash) console.error(`Tx hash: ${error.transactionHash}`);
    process.exit(1);
  }
}

// Run the staking
stakePLN();
