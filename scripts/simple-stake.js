require('dotenv').config({ path: require('path').resolve(__dirname, '../base-sepolia.env') });
const { ethers } = require('ethers');

// vePLN ABI with only the create_lock function
const VEPLN_ABI = [
  'function create_lock(uint256 _value, uint256 _unlock_time) external',
  'function balanceOf(address) view returns (uint256)',
  'function locked(address) view returns (int128 amount, uint256 end)'
];

// ERC20 ABI for PLN token
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)'
];

async function simpleStake() {
  try {
    // Initialize provider and wallet
    const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org');
    const wallet = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, provider);
    
    console.log('\n=== Simple PLN Staking on Base Sepolia ===');
    console.log(`Wallet: ${wallet.address}`);
    
    // Initialize contracts
    const plnToken = new ethers.Contract(
      process.env.PLN_TOKEN_ADDRESS,
      ERC20_ABI,
      wallet
    );
    
    const vePLN = new ethers.Contract(
      process.env.VEPLN_CONTRACT_ADDRESS,
      VEPLN_ABI,
      wallet
    );
    
    // Check balances
    const ethBalance = await provider.getBalance(wallet.address);
    const plnBalance = await plnToken.balanceOf(wallet.address);
    
    console.log(`\n=== Balances ===`);
    console.log(`ETH: ${ethers.formatEther(ethBalance)}`);
    console.log(`PLN: ${ethers.formatEther(plnBalance)}`);
    
    // Check existing lock
    const locked = await vePLN.locked(wallet.address);
    if (locked.amount > 0n) {
      const unlockDate = new Date(Number(locked.end) * 1000);
      console.log(`\n⚠️  Existing lock found:`);
      console.log(`Amount: ${ethers.formatEther(locked.amount)} PLN`);
      console.log(`Unlocks: ${unlockDate}`);
      return { success: false, message: 'Existing lock found' };
    }
    
    // Calculate stake amount (1 PLN for test)
    const stakeAmount = ethers.parseEther('1');
    if (stakeAmount > plnBalance) {
      throw new Error(`Insufficient PLN balance. Need at least 1 PLN`);
    }
    
    // Calculate unlock time (30 days from now)
    const unlockTime = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
    
    console.log(`\n=== Staking Details ===`);
    console.log(`Amount: 1 PLN`);
    console.log(`Lock period: 30 days`);
    console.log(`Unlock time: ${new Date(unlockTime * 1000)}`);
    
    // Check allowance
    const allowance = await plnToken.allowance(wallet.address, process.env.VEPLN_CONTRACT_ADDRESS);
    
    if (allowance < stakeAmount) {
      console.log('\nApproving PLN for staking...');
      const approveTx = await plnToken.approve(
        process.env.VEPLN_CONTRACT_ADDRESS,
        stakeAmount,
        { gasLimit: 200000 }
      );
      console.log(`Approval tx: ${approveTx.hash}`);
      await approveTx.wait();
      console.log('Approval confirmed');
    }
    
    // Stake with higher gas limit
    console.log('\n🚀 Creating lock...');
    const tx = await vePLN.create_lock(
      stakeAmount,
      unlockTime,
      { 
        gasLimit: 500000,
        gasPrice: await provider.getFeeData().then(feeData => feeData.gasPrice * 2n)
      }
    );
    
    console.log(`Transaction sent: ${tx.hash}`);
    console.log('Waiting for confirmation...');
    
    const receipt = await tx.wait();
    console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
    
    // Verify the lock
    const newLock = await vePLN.locked(wallet.address);
    console.log(`\n=== Lock Created ===`);
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
simpleStake()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
