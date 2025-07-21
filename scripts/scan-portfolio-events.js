require('dotenv').config({ path: require('path').resolve(__dirname, '.wallets') });
const { ethers } = require('ethers');
const PortfolioABI = require('../reference-code/pollen-subgraph-v3/abis/Portfolio.json');

// Configuration
const CONFIG = {
  RPC_URL: 'https://sepolia.base.org',
  CHAIN_ID: 84532,
  CONTRACTS: {
    PORTFOLIO: '0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7',
  },
  // Number of blocks to scan (recent blocks)
  SCAN_BLOCKS: 100000, // Increased to 100,000 blocks
  // Max blocks per request
  MAX_BLOCKS_PER_REQUEST: 2000
};

// Initialize provider
const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL, {
  name: 'base-sepolia',
  chainId: CONFIG.CHAIN_ID,
});

// Initialize contract with ABI
const portfolio = new ethers.Contract(
  CONFIG.CONTRACTS.PORTFOLIO,
  PortfolioABI,
  provider
);

// Event signatures from ABI
const EVENT_SIGNATURES = {
  'AssetAdded': 'AssetAdded(address)',
  'AssetRemoved': 'AssetRemoved(address)',
  'BenchmarkPortfolioCreated': 'BenchmarkPortfolioCreated(address,uint256[])'
};

// Get event topics
const EVENT_TOPICS = {
  'AssetAdded': ethers.utils.id(EVENT_SIGNATURES.AssetAdded),
  'AssetRemoved': ethers.utils.id(EVENT_SIGNATURES.AssetRemoved),
  'BenchmarkPortfolioCreated': ethers.utils.id(EVENT_SIGNATURES.BenchmarkPortfolioCreated)
};

async function getCurrentBlock() {
  return await provider.getBlockNumber();
}

async function scanEvents() {
  console.log('=== Scanning Portfolio Contract Events ===');
  console.log(`Contract: ${CONFIG.CONTRACTS.PORTFOLIO}`);
  
  const currentBlock = await getCurrentBlock();
  const startBlock = Math.max(0, currentBlock - CONFIG.SCAN_BLOCKS);
  
  console.log(`\nScanning blocks ${startBlock} to ${currentBlock}...`);
  
  // Scan for all events in chunks to avoid RPC timeouts
  const events = [];
  
  for (let fromBlock = startBlock; fromBlock <= currentBlock; fromBlock += CONFIG.MAX_BLOCKS_PER_REQUEST) {
    const toBlock = Math.min(fromBlock + CONFIG.MAX_BLOCKS_PER_REQUEST - 1, currentBlock);
    
    try {
      // Get all events from the contract
      const logs = await provider.getLogs({
        address: CONFIG.CONTRACTS.PORTFOLIO,
        fromBlock,
        toBlock
      });
      
      console.log(`Scanned blocks ${fromBlock} to ${toBlock}, found ${logs.length} events`);
      events.push(...logs);
      
    } catch (error) {
      console.error(`Error scanning blocks ${fromBlock}-${toBlock}:`, error.message);
      // If we get a timeout error, try with smaller chunks
      if (error.message.includes('timeout') || error.message.includes('too many results')) {
        CONFIG.MAX_BLOCKS_PER_REQUEST = Math.floor(CONFIG.MAX_BLOCKS_PER_REQUEST / 2);
        console.log(`Reducing block range to ${CONFIG.MAX_BLOCKS_PER_REQUEST} blocks per request`);
        fromBlock -= CONFIG.MAX_BLOCKS_PER_REQUEST; // Retry the same range
      } else {
        throw error;
      }
    }
  }
  
  console.log(`\n=== Found ${events.length} total events ===`);
  
  // Process and display events
  const eventCounts = {};
  const uniqueEvents = [];
  
  for (const log of events) {
    // Get event name from topic
    let eventName = 'Unknown';
    for (const [name, topic] of Object.entries(EVENT_TOPICS)) {
      if (log.topics[0] === topic) {
        eventName = name;
        break;
      }
    }
    
    // Count events by type
    eventCounts[eventName] = (eventCounts[eventName] || 0) + 1;
    
    // Keep only the first few of each event type for display
    if ((eventCounts[eventName] || 0) <= 3) {
      uniqueEvents.push({
        event: eventName,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        data: log.data
      });
    }
  }
  
  // Display event counts
  console.log('\nEvent Counts:');
  Object.entries(eventCounts).forEach(([name, count]) => {
    console.log(`  ${name}: ${count}`);
  });
  
  // Display sample events
  console.log('\nSample Events:');
  uniqueEvents.forEach((evt, i) => {
    console.log(`\n${i + 1}. ${evt.event}`);
    console.log(`   Block: ${evt.blockNumber}`);
    console.log(`   TX: ${evt.transactionHash}`);
    console.log(`   Data: ${evt.data}`);
  });
  
  // If we found transactions, get more details for the first few
  if (uniqueEvents.length > 0) {
    console.log('\n=== Transaction Details ===');
    for (let i = 0; i < Math.min(3, uniqueEvents.length); i++) {
      const evt = uniqueEvents[i];
      try {
        const tx = await provider.getTransaction(evt.transactionHash);
        const receipt = await provider.getTransactionReceipt(evt.transactionHash);
        
        console.log(`\nTransaction: ${evt.transactionHash}`);
        console.log(`   From: ${tx.from}`);
        console.log(`   To: ${tx.to}`);
        console.log(`   Value: ${ethers.utils.formatEther(tx.value)} ETH`);
        console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
        console.log(`   Status: ${receipt.status === 1 ? 'Success' : 'Failed'}`);
        
        // Try to decode the input data
        try {
          const iface = new ethers.utils.Interface(PortfolioABI);
          const decoded = iface.parseTransaction({ data: tx.data });
          if (decoded) {
            console.log('   Method:', decoded.name);
            console.log('   Args:', JSON.stringify(decoded.args, (_, v) => 
              typeof v === 'bigint' ? v.toString() : v, 2));
          }
        } catch (e) {
          console.log('   Could not decode input data');
        }
        
      } catch (e) {
        console.log(`Error getting transaction details: ${e.message}`);
      }
    }
  }
  
  console.log('\n=== Event Scan Complete ===');
}

// Run the scan
scanEvents()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
