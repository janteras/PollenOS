
const PollenContractVerifier = require('./modules/pollen-verification');
const logger = require('./modules/logger');

async function main() {
  logger.info('Starting Pollen Contract Verification...');
  
  const verifier = new PollenContractVerifier();
  
  try {
    const results = await verifier.verifyPollenSystem();
    
    console.log('\n=== POLLEN VERIFICATION RESULTS ===\n');
    
    // PLN Token Results
    console.log('PLN Token Verification:');
    console.log(`- Address: ${results.plnToken.address}`);
    console.log(`- Name: ${results.plnToken.name || 'N/A'}`);
    console.log(`- Symbol: ${results.plnToken.symbol || 'N/A'}`);
    console.log(`- Decimals: ${results.plnToken.decimals || 'N/A'}`);
    console.log(`- Total Supply: ${results.plnToken.totalSupply || 'N/A'} PLN`);
    console.log(`- Verified: ${results.plnToken.verified ? '✅' : '❌'}\n`);
    
    // Contract Verification Results
    console.log('Main Contract Verification:');
    Object.entries(results.contracts).forEach(([name, contract]) => {
      console.log(`\n${name} (${contract.address}):`);
      console.log(`- Verified: ${contract.verified ? '✅' : '❌'}`);
      if (contract.functions) {
        Object.entries(contract.functions).forEach(([func, result]) => {
          console.log(`- ${func}: ${result}`);
        });
      }
      if (contract.error) {
        console.log(`- Error: ${contract.error}`);
      }
    });
    
    // Transaction History
    console.log('\nTransaction History:');
    Object.entries(results.transactionHistory).forEach(([address, history]) => {
      console.log(`\n${address}:`);
      if (history.error) {
        console.log(`- Error: ${history.error}`);
      } else {
        console.log(`- Recent Transactions: ${history.recentTransactions}`);
      }
    });
    
    // Recommendations
    console.log('\n=== RECOMMENDATIONS ===\n');
    
    const workingContracts = Object.entries(results.contracts)
      .filter(([name, contract]) => contract.verified);
    
    if (workingContracts.length > 0) {
      console.log('✅ Found working contract(s):');
      workingContracts.forEach(([name, contract]) => {
        console.log(`- Use ${name}: ${contract.address}`);
      });
    } else {
      console.log('❌ No working main contracts found');
      console.log('- Check contract addresses in documentation');
      console.log('- Verify network configuration (Avalanche mainnet)');
      console.log('- Consider using testnet for development');
    }
    
    if (!results.plnToken.verified) {
      console.log('\n❌ PLN token verification failed');
      console.log('- Verify PLN token address: 0x7b2B702706D9b361dfE3f00bD138C0CFDA7FB2Cf');
      console.log('- Check network connection to Avalanche');
    }
    
  } catch (error) {
    logger.error('Verification failed:', error);
    console.log('\n❌ Verification script failed');
    console.log(`Error: ${error.message}`);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = main;
