require('dotenv').config({ path: require('path').resolve(__dirname, '../base-sepolia.env') });
const { ethers } = require('ethers');
const { setTimeout } = require('timers/promises');

// Contract ABIs
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)'
];

const VEPLN_ABI = [
  'function stake(uint256 amount, uint256 lockDuration) external',
  'function getLockInfo(address) view returns (uint256 amount, uint256 lockEnd)',
  'function balanceOf(address) view returns (uint256)'
];

// Contract addresses (Base Sepolia)
const PLN_TOKEN_ADDRESS = '0x9E1c51E1fAa1381D8a7Dbdd19402c5fCce9274C6'; // PLN token
const VEPLN_ADDRESS = '0x3a28AB567b661B3edaF9Ef0bDE9489558EDB3995'; // vePLN contract

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
    const [symbol, decimals] = await Promise.all([
      plnToken.symbol(),
      plnToken.decimals()
    ]);
    const name = 'Pollen Token'; // Hardcoded name since name() is not available
    
    // Convert amount to wei
    const amountWei = ethers.utils.parseUnits(amountPLN.toString(), decimals);
    
    console.log(`\n📊 Staking Details:`);
    console.log(`- Token: ${name} (${symbol})`);
    console.log(`- Amount to stake: ${amountPLN} ${symbol}`);
    console.log(`- Lock period: ${lockDays} days`);
    
    // Check PLN balance
    const plnBalance = await plnToken.balanceOf(wallet.address);
    const formattedBalance = ethers.utils.formatUnits(plnBalance, decimals);
    console.log(`- Your ${symbol} Balance: ${formattedBalance} ${symbol}`);
    
    if (plnBalance.lt(amountWei)) {
      throw new Error(`Insufficient ${symbol} balance. Required: ${amountPLN} ${symbol}, Available: ${formattedBalance} ${symbol}`);
    }
    
    // Check allowance
    const allowance = await plnToken.allowance(wallet.address, VEPLN_ADDRESS);
    console.log(`- Current allowance: ${ethers.utils.formatUnits(allowance, decimals)} ${symbol}`);
    
    // Approve if needed
    if (allowance.lt(amountWei)) {
      console.log('\n🔓 Approving token spending...');
      
      // Get the current nonce
      const nonce = await wallet.getTransactionCount('pending');
      
      // Send approval with explicit nonce
      const approveTx = await plnToken.approve(VEPLN_ADDRESS, amountWei, { 
        gasLimit: 150000,
        nonce: nonce
      });
      
      console.log(`⏳ Waiting for approval confirmation... (Tx: ${approveTx.hash})`);
      await approveTx.wait();
      console.log('✅ Approval confirmed!');
      
      // Add a small delay to ensure the transaction is processed
      await setTimeout(2000);
    }
    
    // Calculate lock duration in seconds
    const lockDuration = lockDays * 24 * 60 * 60; // Convert days to seconds
    
    // Stake tokens
    console.log('\n🚀 Staking tokens...');
    
    // Get the current nonce for the staking transaction
    const nonce = await wallet.getTransactionCount('pending');
    
    // Send staking transaction with explicit nonce and higher gas limit
    const stakeTx = await vePLN.stake(amountWei, lockDuration, { 
      gasLimit: 500000, // Increased gas limit
      nonce: nonce
    });
    
    console.log(`⏳ Waiting for staking confirmation... (Tx: ${stakeTx.hash})`);
    
    // Wait for transaction receipt with retry logic
    let receipt;
    let retries = 3;
    
    while (retries > 0) {
      try {
        receipt = await stakeTx.wait();
        break;
      } catch (error) {
        retries--;
        if (retries === 0) throw error;
        console.log(`⚠️  Transaction pending, retrying... (${retries} attempts left)`);
        await setTimeout(5000); // Wait 5 seconds before retrying
      }
    }
    
    console.log('✅ Staking successful!');
    
    // Get updated lock info
    const [lockedAmount, lockEnd] = await vePLN.getLockInfo(wallet.address);
    const unlockDate = new Date(lockEnd.toNumber() * 1000);
    
    console.log('\n🔒 Lock Details:');
    console.log(`- Locked Amount: ${ethers.utils.formatUnits(lockedAmount, decimals)} ${symbol}`);
    console.log(`- Lock End: ${unlockDate.toLocaleString()}`);
    
    // Get vePLN balance
    const vePLNBalance = await vePLN.balanceOf(wallet.address);
    console.log(`\n💰 Your vePLN Balance: ${ethers.utils.formatUnits(vePLNBalance, decimals)} vePLN`);
    
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
