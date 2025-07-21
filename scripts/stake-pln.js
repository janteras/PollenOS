require('dotenv').config({ path: require('path').resolve(__dirname, '../base-sepolia.env') });
const { ethers } = require('ethers');

// Contract ABIs
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)'
];

const VEPLN_ABI = [
  'function create_lock(uint256 _value, uint256 _unlock_time) external',
  'function balanceOf(address) view returns (uint256)',
  'function locked(address) view returns (int128 amount, uint256 end)'
];

async function stakePLN(amountPLN, lockDays = 30) {
  try {
    // Initialize provider and wallet
    const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org');
    const wallet = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, provider);
    
    // Get the contracts
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
    
    // Check current balances and locks
    const plnBalance = await plnToken.balanceOf(wallet.address);
    const locked = await vePLN.locked(wallet.address);
    
    console.log('\n=== Current Status ===');
    console.log(`PLN Balance: ${ethers.formatEther(plnBalance)} PLN`);
    
    if (locked.amount > 0) {
      const unlockDate = new Date(Number(locked.end) * 1000);
      console.log(`Already locked: ${ethers.formatEther(locked.amount)} PLN until ${unlockDate}`);
      console.log('You need to wait for the current lock to expire before creating a new one.');
      return { success: false, message: 'Existing lock found' };
    }
    
    // Parse the amount to stake
    let stakeAmount;
    if (amountPLN === 'max') {
      stakeAmount = plnBalance;
    } else {
      stakeAmount = ethers.parseEther(amountPLN);
    }
    
    if (stakeAmount > plnBalance) {
      throw new Error(`Insufficient PLN balance. Available: ${ethers.formatEther(plnBalance)} PLN`);
    }
    
    // Calculate unlock time (current time + lockDays in seconds)
    const unlockTime = Math.floor(Date.now() / 1000) + (lockDays * 24 * 60 * 60);
    
    console.log(`\n=== Staking Details ===`);
    console.log(`Amount to stake: ${ethers.formatEther(stakeAmount)} PLN`);
    console.log(`Lock period: ${lockDays} days`);
    console.log(`Unlock time: ${new Date(unlockTime * 1000)}`);
    
    // Check allowance
    const allowance = await plnToken.allowance(wallet.address, process.env.VEPLN_CONTRACT_ADDRESS);
    
    if (allowance < stakeAmount) {
      console.log('Insufficient allowance. Approving more PLN for staking...');
      const approveTx = await plnToken.approve(
        process.env.VEPLN_CONTRACT_ADDRESS,
        stakeAmount,
        {
          gasLimit: 200000,
          gasPrice: await provider.getFeeData().then(feeData => feeData.gasPrice * 2n)
        }
      );
      await approveTx.wait();
      console.log('Approval confirmed');
    }
    
    // Perform the staking
    console.log('\n🚀 Creating lock for staking...');
    const tx = await vePLN.create_lock(
      stakeAmount,
      unlockTime,
      {
        gasLimit: 500000, // Higher gas limit for staking
        gasPrice: await provider.getFeeData().then(feeData => feeData.gasPrice * 2n)
      }
    );
    
    console.log(`Transaction sent: ${tx.hash}`);
    console.log('Waiting for confirmation...');
    
    const receipt = await tx.wait();
    console.log(`✅ Staking successful! Transaction confirmed in block ${receipt.blockNumber}`);
    
    // Verify the lock
    const newLock = await vePLN.locked(wallet.address);
    console.log(`\n=== New Lock Details ===`);
    console.log(`Locked amount: ${ethers.formatEther(newLock.amount)} PLN`);
    console.log(`Unlock time: ${new Date(Number(newLock.end) * 1000)}`);
    
    return { success: true, txHash: tx.hash };
    
  } catch (error) {
    console.error('❌ Error staking PLN:', error.message);
    if (error.reason) console.error('Reason:', error.reason);
    if (error.transactionHash) console.error(`Transaction hash: ${error.transactionHash}`);
    throw error;
  }
}

// Get command line arguments
const args = process.argv.slice(2);
const amount = args[0] || '1.0';  // Default to 1.0 PLN if not specified
const days = parseInt(args[1]) || 30;  // Default to 30 days if not specified

// Run the staking
stakePLN(amount, days)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
