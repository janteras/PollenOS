const { ethers } = require('ethers');
const config = require('./config');

// Function to calculate the contract address
async function calculatePortfolioAddress() {
  try {
    const provider = new ethers.providers.JsonRpcProvider(config.RPC_URL);
    const txHash = '0xd34c0e7c113ef6f9dd49cab7ffe3a1ce27f2e7e6c872288c7c89e9c00ae72914';
    
    // Get the transaction to find the nonce
    const tx = await provider.getTransaction(txHash);
    if (!tx) {
      console.log('Transaction not found');
      return;
    }
    
    console.log('Transaction Details:');
    console.log('- From:', tx.from);
    console.log('- Nonce:', tx.nonce);
    
    // The PollenDAO contract address that created the portfolio
    const creatorAddress = tx.to.toLowerCase();
    console.log('- Creator (DAO) Address:', creatorAddress);
    
    // Calculate the expected contract address using CREATE2
    // This is a common pattern for deterministic deployments
    const salt = '0x' + '0'.repeat(64); // Default salt if not specified
    const initCode = '0x'; // We don't have the init code, but we can try with empty
    
    // Calculate the CREATE2 address
    const create2Address = ethers.utils.getCreate2Address(
      creatorAddress,
      salt,
      ethers.utils.keccak256(initCode)
    );
    
    console.log('\nCalculated CREATE2 Address:', create2Address);
    
    // Also try the traditional CREATE pattern (nonce-based)
    const nonce = tx.nonce;
    const rlpEncoded = ethers.utils.RLP.encode([
      creatorAddress,
      '0x' + nonce.toString(16).padStart(2, '0')
    ]);
    const hash = ethers.utils.keccak256(rlpEncoded);
    const createAddress = '0x' + hash.slice(26);
    
    console.log('Calculated CREATE Address:', createAddress);
    
    // Try with the next nonce as well (sometimes the nonce is off by 1)
    const nextNonce = nonce + 1;
    const rlpEncodedNext = ethers.utils.RLP.encode([
      creatorAddress,
      '0x' + nextNonce.toString(16).padStart(2, '0')
    ]);
    const hashNext = ethers.utils.keccak256(rlpEncodedNext);
    const createAddressNext = '0x' + hashNext.slice(26);
    
    console.log('Calculated CREATE Address (next nonce):', createAddressNext);
    
    // Check if any of these addresses have code
    console.log('\nChecking if addresses contain code...');
    
    const addressesToCheck = [create2Address, createAddress, createAddressNext];
    
    for (const addr of addressesToCheck) {
      const code = await provider.getCode(addr);
      if (code !== '0x') {
        console.log(`✅ Found contract at ${addr}`);
        console.log('Code length:', code.length);
        
        // If we found a contract, try to interact with it
        try {
          // Try to call a simple function to verify it's a portfolio
          const portfolioABI = [
            'function owner() view returns (address)',
            'function getPortfolioData() view returns (address, uint256, uint256, uint256)'
          ];
          const portfolio = new ethers.Contract(addr, portfolioABI, provider);
          
          const owner = await portfolio.owner().catch(() => 'unknown');
          console.log(`- Owner: ${owner}`);
          
          if (owner !== 'unknown') {
            console.log('🎉 This appears to be a valid portfolio contract!');
            console.log('💾 Updating config with portfolio address:', addr);
            
            // Update the config
            config.CONTRACTS.PORTFOLIO = addr;
            
            // Try to get more portfolio data
            try {
              const portfolioData = await portfolio.getPortfolioData();
              console.log('Portfolio Data:', portfolioData);
            } catch (e) {
              console.log('Could not get portfolio data:', e.message);
            }
            
            return;
          }
        } catch (e) {
          console.log(`- Not a standard portfolio contract: ${e.message}`);
        }
      } else {
        console.log(`❌ No code at ${addr}`);
      }
    }
    
  } catch (error) {
    console.error('Error calculating portfolio address:', error);
  }
}

// Run the function
calculatePortfolioAddress().catch(console.error);
