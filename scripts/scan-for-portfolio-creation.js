const { ethers } = require('ethers');
const config = require('./config');

// PollenDAO contract ABI with relevant events
const POLLEN_DAO_ABI = [
  'event PortfolioCreated(address indexed creator, uint256 amount, uint256[] weights, bool tokenType)',
  'function getPortfolio(address) external view returns (address, uint256[], uint256, uint256)',
  'function getPortfolio1(address owner, address delegate) external view returns (address, uint256[] memory, uint256, uint256, bool[] memory, uint256)'
];

// PollenDAO contract address on Base Sepolia
const POLLEN_DAO_ADDRESS = '0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7';
const USER_ADDRESS = '0x561529036AB886c1FD3D112360383D79fBA9E71c';

async function scanForPortfolioCreation() {
  try {
    const provider = new ethers.providers.JsonRpcProvider(config.RPC_URL);
    const daoContract = new ethers.Contract(POLLEN_DAO_ADDRESS, POLLEN_DAO_ABI, provider);
    
    // Get the current block number
    const currentBlock = await provider.getBlockNumber();
    console.log(`🔍 Current block: ${currentBlock}`);
    
    // Look back 20,000 blocks (adjust as needed)
    const fromBlock = Math.max(0, currentBlock - 20000);
    console.log(`📡 Scanning blocks ${fromBlock} to ${currentBlock} (${currentBlock - fromBlock} blocks)...`);
    
    // Get the block details for the fromBlock to estimate the time range
    try {
      const fromBlockDetails = await provider.getBlock(fromBlock);
      const toBlockDetails = await provider.getBlock(currentBlock);
      const timeDiff = toBlockDetails.timestamp - fromBlockDetails.timestamp;
      const daysAgo = Math.round(timeDiff / (60 * 60 * 24));
      console.log(`⏰ Time range: ~${daysAgo} days ago to now`);
    } catch (e) {
      console.log('⚠️ Could not fetch block details:', e.message);
    }
    
    // 1. First, try to get the portfolio directly from the contract
    console.log('\n🔎 Checking for existing portfolio...');
    try {
      // Try the newer getPortfolio1 function first
      try {
        const portfolio = await daoContract.getPortfolio1(USER_ADDRESS, USER_ADDRESS);
        if (portfolio && portfolio[0] !== ethers.constants.AddressZero) {
          console.log('✅ Found portfolio using getPortfolio1:', portfolio[0]);
          await updateConfigWithPortfolio(portfolio[0]);
          return;
        }
      } catch (e) {
        // Fall back to the older getPortfolio function
        const portfolio = await daoContract.getPortfolio(USER_ADDRESS);
        if (portfolio && portfolio[0] !== ethers.constants.AddressZero) {
          console.log('✅ Found portfolio using getPortfolio:', portfolio[0]);
          await updateConfigWithPortfolio(portfolio[0]);
          return;
        }
      }
      console.log('ℹ️ No active portfolio found via contract calls');
    } catch (error) {
      console.log('⚠️ Error querying portfolio from contract:', error.message);
    }
    
    // 2. Look for PortfolioCreated events
    console.log('\n🔍 Scanning for PortfolioCreated events...');
    const filter = daoContract.filters.PortfolioCreated(USER_ADDRESS);
    const events = await daoContract.queryFilter(filter, fromBlock, 'latest');
    
    console.log(`📊 Found ${events.length} PortfolioCreated events`);
    
    for (const event of events) {
      console.log('\n--- Event Found ---');
      console.log('Block:', event.blockNumber);
      console.log('Transaction:', event.transactionHash);
      console.log('Amount:', ethers.utils.formatEther(event.args.amount), 'tokens');
      console.log('Token Type:', event.args.tokenType ? 'vePLN' : 'PLN');
      
      // Get the transaction receipt
      const receipt = await provider.getTransactionReceipt(event.transactionHash);
      
      // 3. Check if this transaction created any contracts
      if (receipt.contractAddress) {
        console.log('✅ Contract created directly:', receipt.contractAddress);
        await verifyAndSavePortfolio(receipt.contractAddress);
        return;
      }
      
      // 4. Check for internal transactions (contract creations)
      console.log('🔍 Checking for internal contract creations...');
      try {
        // Get the transaction trace
        const trace = await provider.send('debug_traceTransaction', [
          event.transactionHash,
          { tracer: 'callTracer' }
        ]);
        
        // Find all contract creations in the trace
        const createdContracts = findCreatedContracts(trace);
        
        if (createdContracts.length > 0) {
          console.log('\nFound contract creation operations:');
          createdContracts.forEach((contract, i) => {
            console.log(`\nContract ${i + 1}:`);
            console.log(`Type: ${contract.type}`);
            console.log(`From: ${contract.from}`);
            console.log(`To: ${contract.to}`);
            console.log(`Value: ${ethers.utils.formatEther(contract.value || '0')} ETH`);
            console.log(`Gas used: ${contract.gasUsed}`);
          });
          
          // The last created contract is likely the portfolio
          const portfolioAddress = createdContracts[createdContracts.length - 1].to;
          console.log('\n🔍 Most likely portfolio address:', portfolioAddress);
          
          await verifyAndSavePortfolio(portfolioAddress);
          return;
        } else {
          console.log('No contract creation operations found in trace');
        }
      } catch (traceError) {
        console.log('⚠️ Could not trace transaction (node may not support tracing):', traceError.message);
      }
    }
    
    // 5. If we get here, we couldn't find the portfolio
    console.log('\n⚠️ No portfolio contract creation found in the scanned blocks');
    console.log('Try one of these options:');
    console.log('1. Increase the block range in the script');
    console.log('2. Check the transaction on a block explorer');
    console.log('3. Manually set the portfolio address in the config');
    
  } catch (error) {
    console.error('❌ Error scanning for portfolio creation:', error);
  }
}

// Helper function to recursively find contract creations in a trace
function findCreatedContracts(node) {
  if (!node) return [];
  
  let contracts = [];
  
  // Check if this node created a contract
  if (node.type === 'CREATE' || node.type === 'CREATE2') {
    contracts.push({
      type: node.type,
      from: node.from,
      to: node.to,
      value: node.value || '0',
      gas: node.gas,
      gasUsed: node.gasUsed,
      input: node.input
    });
  }
  
  // Recursively check child calls
  if (node.calls) {
    for (const call of node.calls) {
      contracts = contracts.concat(findCreatedContracts(call));
    }
  }
  
  return contracts;
}

// Verify a contract exists and save it to config
async function verifyAndSavePortfolio(address) {
  try {
    const provider = new ethers.providers.JsonRpcProvider(config.RPC_URL);
    const code = await provider.getCode(address);
    
    if (code !== '0x') {
      console.log('✅ Contract has code, saving to config...');
      await updateConfigWithPortfolio(address);
    } else {
      console.log('⚠️ No code found at address:', address);
    }
  } catch (error) {
    console.error('Error verifying contract:', error);
  }
}

// Update the config file with the portfolio address
async function updateConfigWithPortfolio(address) {
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Update the config object
    if (!config.CONTRACTS) config.CONTRACTS = {};
    config.CONTRACTS.PORTFOLIO = address;
    
    // Save the config to disk
    const configPath = path.join(__dirname, 'config.js');
    fs.writeFileSync(
      configPath,
      `module.exports = ${JSON.stringify(config, null, 2)};`,
      'utf8'
    );
    
    console.log('✅ Updated config with portfolio address:', address);
    console.log(`📝 Config saved to: ${configPath}`);
    
    return true;
  } catch (error) {
    console.error('Error updating config:', error);
    return false;
  }
}

// Run the scan
scanForPortfolioCreation().catch(console.error);
