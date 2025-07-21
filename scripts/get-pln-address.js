require('dotenv').config({ path: require('path').resolve(__dirname, '../base-sepolia.env') });
const { ethers } = require('ethers');

// vePLN contract ABI with the token function
const VEPLN_ABI = [
  'function token() view returns (address)'
];

async function getPLNAddress() {
  try {
    // Initialize provider
    const provider = new ethers.providers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org');
    
    // vePLN contract address on Base Sepolia
    const vePLN_ADDRESS = '0x3a28AB567b661B3edaF9Ef0bDE9489558EDB3995';
    
    // Create contract instance
    const vePLN = new ethers.Contract(vePLN_ADDRESS, VEPLN_ABI, provider);
    
    // Get the underlying token address
    const plnAddress = await vePLN.token();
    
    console.log(`🔍 PLN Token Address: ${plnAddress}`);
    
    // Get token details
    const tokenABI = [
      'function symbol() view returns (string)',
      'function name() view returns (string)',
      'function decimals() view returns (uint8)'
    ];
    
    const token = new ethers.Contract(plnAddress, tokenABI, provider);
    
    const [symbol, name, decimals] = await Promise.all([
      token.symbol(),
      token.name(),
      token.decimals()
    ]);
    
    console.log('📝 Token Details:');
    console.log(`- Name: ${name}`);
    console.log(`- Symbol: ${symbol}`);
    console.log(`- Decimals: ${decimals}`);
    console.log(`- Address: ${plnAddress}`);
    
    return plnAddress;
    
  } catch (error) {
    console.error('Error fetching PLN token address:', error);
    throw error;
  }
}

// Run the function
if (require.main === module) {
  getPLNAddress()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { getPLNAddress };
