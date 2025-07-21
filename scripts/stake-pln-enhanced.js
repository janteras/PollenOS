require('dotenv').config({ path: require('path').resolve(__dirname, '../base-sepolia.env') });
const { ethers } = require('ethers');

// Contract ABIs
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function symbol() view returns (string)'
];

const VEPLN_ABI = [
  'function stake(uint256 amount, uint256 lockDuration) external',
  'function getLockInfo(address) view returns (uint256 amount, uint256 lockEnd)',
  'function balanceOf(address) view returns (uint256)'
];

// Contract addresses
const PLN_TOKEN_ADDRESS = '0x...'; // Replace with actual PLN token address
const VEPLN_ADDRESS = '0x3a28AB567b661B3edaF9Ef0bDE9489558EDB3995';

async function stakePLN(amountPLN, lockDays = 30) {
  try {
    // Initialize provider and wallet
    const provider = new ethers.providers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org');
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    console.log('🔍 Initializing staking process...');
    console.log(`👛 Wallet: ${wallet.address}`);
    
    // Initialize contracts
    const plnToken = new ethers.Contract(PLN_TOKEN_ADDRESS, ERC20_ABI, wallet);
    const vePLN = new ethers.Contract(VEPLN_ADDRESS, VEPLN_ABI, wallet);
    
    // Get token info
    const [plnSymbol, plnDecimals] = await Promise.all([
      plnToken.symbol(),
      plnToken.decimals().catch(() => 18) // Default to 18 if not available
    ]);
    
    // Convert amount to wei
    const amountWei = ethers.utils.parseUnits(amountPLN.toString(), plnDecimals);
    
    console.log(`\n📊 Staking Details:`);
    console.log(`- Amount to stake: ${amountPLN} ${plnSymbol}`);
    console.log(`- Lock period: ${lockDays} days`);
    
    // Check PLN balance
    const plnBalance = await plnToken.balanceOf(wallet.address);
    console.log(`- Your ${plnSymbol} Balance: ${ethers.utils.formatUnits(plnBalance, plnDecimals)} ${plnSymbol}`);
    
    if (plnBalance.lt(amountWei)) {
      throw new Error(`Insufficient ${plnSymbol} balance. Required: ${amountPLN} ${plnSymbol}, Available: ${ethers.utils.formatUnits(plnBalance, plnDecimals)} ${plnSymbol}`);
    }
    
    // Check allowance
    const allowance = await plnToken.allowance(wallet.address, VEPLN_ADDRESS);
    console.log(`- Current allowance: ${ethers.utils.formatUnits(allowance, plnDecimals)} ${plnSymbol}`);
    
    // Approve if needed
    if (allowance.lt(amountWei)) {
      console.log('\n🔓 Approving token spending...');
      const approveTx = await plnToken.approve(VEPLN_ADDRESS, amountWei, { gasLimit: 100000 });
      console.log(`⏳ Waiting for approval confirmation... (Tx: ${approveTx.hash})`);
      await approveTx.wait();
      console.log('✅ Approval confirmed!');
    }
    
    // Calculate lock duration in seconds
    const lockDuration = lockDays * 24 * 60 * 60; // Convert days to seconds
    
    // Stake tokens
    console.log('\n🚀 Staking tokens...');
    const stakeTx = await vePLN.stake(amountWei, lockDuration, { gasLimit: 300000 });
    console.log(`⏳ Waiting for staking confirmation... (Tx: ${stakeTx.hash})`);
    
    const receipt = await stakeTx.wait();
    console.log('✅ Staking successful!');
    
    // Get updated lock info
    const [lockedAmount, lockEnd] = await vePLN.getLockInfo(wallet.address);
    const unlockDate = new Date(lockEnd.toNumber() * 1000);
    
    console.log('\n🔒 Lock Details:');
    console.log(`- Locked Amount: ${ethers.utils.formatUnits(lockedAmount, plnDecimals)} ${plnSymbol}`);
    console.log(`- Lock End: ${unlockDate.toLocaleString()}`);
    
    // Get vePLN balance
    const vePLNBalance = await vePLN.balanceOf(wallet.address);
    console.log(`\n💰 Your vePLN Balance: ${ethers.utils.formatUnits(vePLNBalance, plnDecimals)} vePLN`);
    
    return {
      txHash: receipt.transactionHash,
      amountStaked: amountWei.toString(),
      lockEnd: lockEnd.toString(),
      vePLNBalance: vePLNBalance.toString()
    };
    
  } catch (error) {
    console.error('\n❌ Error staking tokens:', error.message);
    if (error.reason) console.error('Reason:', error.reason);
    if (error.transactionHash) console.error('Transaction hash:', error.transactionHash);
    throw error;
  }
}

// Get command line arguments
const args = process.argv.slice(2);
const amount = args[0] || '10.0';  // Default to 10.0 PLN if not specified
const days = parseInt(args[1]) || 30;  // Default to 30 days if not specified

// Run the staking function
if (require.main === module) {
  console.log(`🔄 Attempting to stake ${amount} PLN for ${days} days...`);
  stakePLN(amount, days)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Staking failed:', error);
      process.exit(1);
    });
}

module.exports = { stakePLN };
