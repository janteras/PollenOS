require('dotenv').config({ path: require('path').resolve(__dirname, '../base-sepolia.env') });
const { ethers } = require('ethers');

// vePLN ABI (simplified with common functions)
const VEPLN_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function locked(address) view returns (int128 amount, uint256 end)',
  'function create_lock(uint256 _value, uint256 _unlock_time) external',
  'function increase_amount(uint256 _value) external',
  'function increase_unlock_time(uint256 _unlock_time) external',
  'function withdraw() external',
  'function commit_transfer_ownership(address addr) external',
  'function apply_transfer_ownership() external',
  'function commit_smart_wallet_checker(address addr) external',
  'function apply_smart_wallet_checker() external',
  'function token() view returns (address)'
];

async function interactWithVePLN() {
  try {
    // Initialize provider and wallet
    const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
    const wallet = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, provider);
    
    // vePLN contract
    const vePLN = new ethers.Contract(
      '0x3a28AB567b661B3edaF9Ef0bDE9489558EDB3995',
      VEPLN_ABI,
      wallet
    );
    
    console.log('=== vePLN Contract Interaction ===');
    console.log(`Wallet: ${wallet.address}`);
    
    // Get basic info
    const [name, symbol, decimals, tokenAddress] = await Promise.all([
      vePLN.name(),
      vePLN.symbol(),
      vePLN.decimals(),
      vePLN.token()
    ]);
    
    console.log('\n=== Contract Info ===');
    console.log(`Name: ${name}`);
    console.log(`Symbol: ${symbol}`);
    console.log(`Decimals: ${decimals}`);
    console.log(`PLN Token: ${tokenAddress}`);
    
    // Check locked amount
    const locked = await vePLN.locked(wallet.address);
    console.log('\n=== Locked Amount ===');
    console.log(`Amount: ${ethers.formatEther(locked.amount)} PLN`);
    console.log(`Unlock time: ${new Date(Number(locked.end) * 1000)}`);
    
    // Check vePLN balance
    const veBalance = await vePLN.balanceOf(wallet.address);
    console.log(`\nvePLN Balance: ${ethers.formatEther(veBalance)}`);
    
    return {
      name,
      symbol,
      decimals,
      tokenAddress,
      lockedAmount: locked.amount.toString(),
      unlockTime: locked.end.toString(),
      veBalance: veBalance.toString()
    };
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.reason) console.error('Reason:', error.reason);
    if (error.method) console.error('Method:', error.method);
    if (error.transactionHash) console.error(`Tx hash: ${error.transactionHash}`);
    throw error;
  }
}

// Run the interaction
interactWithVePLN()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
