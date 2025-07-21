const { ethers } = require('ethers');
const config = require('./config');

async function decodePortfolioEvent() {
  try {
    // The raw event data from the transaction
    const eventData = {
      topics: [
        '0x10885129e4cd810b6c6dfaf2fc8f26a25e0efebfbeea7067655d85e35dc88931',
        '0x000000000000000000000000561529036ab886c1fd3d112360383d79fba9e71c'
      ],
      data: '0x0000000000000000000000000000000000000000000000008ac7230489e800000000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000070000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000e',
      address: '0xef789258233e6cfbb5e0bb093fc9537e69e81bb7'
    };

    // Load the PollenDAO ABI
    const PollenDAOABI = require('../reference-code/pollen-subgraph-v3/abis/IPollenDAO.json');
    const iface = new ethers.utils.Interface(PollenDAOABI);
    
    // Find the event fragment
    const eventFragment = iface.getEvent('PortfolioCreated');
    console.log('Event Fragment:', eventFragment);
    
    // Decode the log
    const decodedLog = iface.decodeEventLog(
      eventFragment,
      eventData.data,
      eventData.topics
    );
    
    console.log('\nDecoded Log:', decodedLog);
    
    // The portfolio address might be in the decoded log or need to be calculated
    console.log('\nEvent Parameters:');
    console.log('- Creator:', decodedLog.creator);
    console.log('- Amount:', decodedLog.amount.toString());
    console.log('- Weights:', decodedLog.weights);
    console.log('- Token Type:', decodedLog.tokenType);
    
    // If the portfolio address is not in the event, we might need to calculate it
    // based on the creator address and nonce
    const provider = new ethers.providers.JsonRpcProvider(config.RPC_URL);
    const creatorAddress = decodedLog.creator;
    
    // Get the transaction count (nonce) of the creator at the block before the transaction
    const tx = await provider.getTransaction('0xd34c0e7c113ef6f9dd49cab7ffe3a1ce27f2e7e6c872288c7c89e9c00ae72914');
    const blockNumber = tx.blockNumber;
    const nonce = await provider.getTransactionCount(creatorAddress, blockNumber - 1);
    
    console.log('\nCreator Address:', creatorAddress);
    console.log('Block Number:', blockNumber);
    console.log('Nonce at block:', nonce);
    
    // Calculate the contract address using CREATE2
    const bytecode = '0x'; // We don't have the exact bytecode, but we can try with empty
    const salt = '0x' + '0'.repeat(64); // Default salt
    
    const create2Address = ethers.utils.getCreate2Address(
      creatorAddress,
      salt,
      ethers.utils.keccak256(bytecode)
    );
    
    console.log('\nCalculated CREATE2 Address:', create2Address);
    
    // Also try the traditional CREATE pattern (nonce-based)
    const rlpEncoded = ethers.utils.RLP.encode([
      creatorAddress,
      '0x' + nonce.toString(16)
    ]);
    
    const hash = ethers.utils.keccak256(rlpEncoded);
    const createAddress = '0x' + hash.slice(26);
    
    console.log('Calculated CREATE Address:', createAddress);
    
    // Check if either address has code
    const codeAtCreate2 = await provider.getCode(create2Address);
    const codeAtCreate = await provider.getCode(createAddress);
    
    if (codeAtCreate2 !== '0x') {
      console.log('\n✅ Found contract at CREATE2 address:', create2Address);
      console.log('Updating config with portfolio address...');
      
      // Update the config
      config.CONTRACTS.PORTFOLIO = create2Address;
      console.log('Config updated with portfolio address');
    }
    
    if (codeAtCreate !== '0x') {
      console.log('\n✅ Found contract at CREATE address:', createAddress);
      console.log('Updating config with portfolio address...');
      
      // Update the config
      config.CONTRACTS.PORTFOLIO = createAddress;
      console.log('Config updated with portfolio address');
    }
    
    if (codeAtCreate2 === '0x' && codeAtCreate === '0x') {
      console.log('\n❌ No contract found at calculated addresses. The portfolio might be deployed at a different address.');
      console.log('Try checking the internal transactions of the creation transaction on the block explorer.');
    }
    
  } catch (error) {
    console.error('Error decoding portfolio event:', error);
  }
}

// Run the function
decodePortfolioEvent().catch(console.error);
