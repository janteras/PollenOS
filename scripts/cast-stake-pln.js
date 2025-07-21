const { execSync } = require('child_process');
require('dotenv').config({ path: require('path').resolve(__dirname, '../base-sepolia.env') });

// Configuration
const RPC_URL = 'https://sepolia.base.org';
const PLN_TOKEN = '0x9E1c51E1fAa1381D8a7Dbdd19402c5fCce9274C6';
const VEPLN = '0x3a28AB567b661B3edaF9Ef0bDE9489558EDB3995';
const WALLET = process.env.WALLET_PRIVATE_KEY ? 
  `--private-key ${process.env.WALLET_PRIVATE_KEY}` : 
  '--unlocked --from $(cast wallet address)';

// Helper function to run shell commands
function runCommand(command) {
  try {
    console.log(`$ ${command}`);
    const output = execSync(command, { stdio: 'inherit' });
    return { success: true, output };
  } catch (error) {
    console.error('❌ Command failed:', error.message);
    return { success: false, error };
  }
}

async function stakePLN() {
  try {
    console.log('=== Staking PLN using cast ===');
    
    // 1. Approve PLN for staking (if needed)
    console.log('\n1. Approving PLN for staking...');
    const approveCmd = `cast send ${PLN_TOKEN} \
      "approve(address,uint256)" \
      ${VEPLN} \
      1000000000000000000 \
      ${WALLET} \
      --rpc-url ${RPC_URL} \
      --gas-limit 200000`;
    
    const approveResult = runCommand(approveCmd);
    if (!approveResult.success) {
      console.log('Approval might have failed or already exists. Continuing...');
    }
    
    // 2. Create a lock
    console.log('\n2. Creating lock...');
    const unlockTime = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days from now
    
    const stakeCmd = `cast send ${VEPLN} \
      "create_lock(uint256,uint256)" \
      1000000000000000000 \
      ${unlockTime} \
      ${WALLET} \
      --rpc-url ${RPC_URL} \
      --gas-limit 500000`;
    
    const stakeResult = runCommand(stakeCmd);
    if (!stakeResult.success) {
      throw new Error('Failed to create lock');
    }
    
    console.log('\n✅ Lock created successfully!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the staking
stakePLN();
