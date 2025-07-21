require('dotenv').config({ path: require('path').resolve(__dirname, '../base-sepolia.env') });
const { ethers } = require('ethers');

// Contract ABIs
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)'
];

const VEPLN_ABI = [
  'function create_lock(uint256 _value, uint256 _unlock_time) external',
  'function locked(address) view returns (uint256 amount, uint256 end)'
];

async function stakePLN() {
  try {
    // Initialize provider and wallet
    const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
    const wallet = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, provider);
    
    console.log('\n=== Direct PLN Staking on Base Sepolia ===');
    console.log(`Wallet: ${wallet.address}`);
    
    // Initialize contracts
    const plnToken = new ethers.Contract(
      '0x9E1c51E1fAa1381D8a7Dbdd19402c5fCce9274C6', // PLN Token
      ERC20_ABI,
      wallet
    );
    
    const vePLN = new ethers.Contract(
      '0x3a28AB567b661B3edaF9Ef0bDE9489558EDB3995', // vePLN
      VEPLN_ABI,
      wallet
    );
    
    // Check balances
    const [ethBalance, plnBalance] = await Promise.all([
      provider.getBalance(wallet.address),
      plnToken.balanceOf(wallet.address)
    ]);
    
    console.log('\n=== Balances ===');
    console.log(`ETH: ${ethers.formatEther(ethBalance)}`);
    console.log(`PLN: ${ethers.formatEther(plnBalance)}`);
    
    // Check existing lock
    const locked = await vePLN.locked(wallet.address);
    if (locked.amount > 0) {
      console.log('\n⚠️  Existing lock found:');
      console.log(`Amount: ${ethers.formatEther(locked.amount)} PLN`);
      console.log(`Unlocks: ${new Date(Number(locked.end) * 1000)}`);
      return { success: false, message: 'Existing lock found' };
    }
    
    // Stake 1 PLN for 30 days
    const stakeAmount = ethers.parseEther('1');
    const unlockTime = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
    
    console.log('\n=== Staking Details ===');
    console.log(`Amount: 1 PLN`);
    console.log(`Lock period: 30 days`);
    
    // Approve if needed
    const allowance = await plnToken.allowance(wallet.address, vePLN.target);
    if (allowance < stakeAmount) {
      console.log('\nApproving PLN for staking...');
      const approveTx = await plnToken.approve(vePLN.target, stakeAmount, { gasLimit: 150000 });
      console.log(`Approval tx: ${approveTx.hash}`);
      await approveTx.wait();
      console.log('Approval confirmed');
    }
    
    // Create lock
    console.log('\nCreating lock...');
    const tx = await vePLN.create_lock(
      stakeAmount,
      unlockTime,
      { gasLimit: 500000 }
    );
    
    console.log(`\n✅ Transaction sent: ${tx.hash}`);
    console.log('Waiting for confirmation...');
    
    const receipt = await tx.wait();
    console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
    
    // Verify the lock
    const newLock = await vePLN.locked(wallet.address);
    console.log('\n=== Lock Created ===');
    console.log(`Amount: ${ethers.formatEther(newLock.amount)} PLN`);
    console.log(`Unlocks: ${new Date(Number(newLock.end) * 1000)}`);
    
    return { success: true, txHash: tx.hash };
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.reason) console.error('Reason:', error.reason);
    if (error.transactionHash) console.error(`Tx hash: ${error.transactionHash}`);
    throw error;
  }
}

// Run the staking
stakePLN()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
