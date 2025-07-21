const { ethers } = require('ethers');
const config = require('./config');

async function getPortfolioAddress(txHash) {
  try {
    const provider = new ethers.providers.JsonRpcProvider(config.RPC_URL);
    
    console.log(`🔍 Fetching transaction receipt for: ${txHash}`);
    const receipt = await provider.getTransactionReceipt(txHash);
    
    if (!receipt) {
      console.log('Transaction not found or not yet mined');
      return null;
    }
    
    console.log('\n📄 Transaction Receipt:');
    console.log('- Block Number:', receipt.blockNumber);
    console.log('- Gas Used:', receipt.gasUsed.toString());
    console.log('- Status:', receipt.status === 1 ? 'Success' : 'Failed');
    
    if (receipt.logs && receipt.logs.length > 0) {
      console.log('\n📜 Logs:');
      receipt.logs.forEach((log, index) => {
        console.log(`\nLog ${index}:`);
        console.log('- Address:', log.address);
        console.log('- Topics:', log.topics);
        console.log('- Data:', log.data);
      });
    }
    
    // Look for contract creation
    if (receipt.contractAddress) {
      console.log('\n🏗️  Contract created at:', receipt.contractAddress);
      return receipt.contractAddress;
    }
    
    console.log('\n❌ No contract creation found in this transaction');
    return null;
    
  } catch (error) {
    console.error('Error fetching transaction receipt:', error);
    return null;
  }
}

// Run with transaction hash from command line
const txHash = process.argv[2];
if (require.main === module && txHash) {
  getPortfolioAddress(txHash).catch(console.error);
}

module.exports = getPortfolioAddress;
