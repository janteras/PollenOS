const { ethers } = require('ethers');
const config = require('./config');

// Raw event data from the transaction
const eventData = {
  topics: [
    '0x10885129e4cd810b6c6dfaf2fc8f26a25e0efebfbeea7067655d85e35dc88931',
    '0x000000000000000000000000561529036ab886c1fd3d112360383d79fba9e71c'
  ],
  data: '0x0000000000000000000000000000000000000000000000008ac7230489e800000000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000070000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000e'
};

async function decodeEvent() {
  try {
    // Load the PollenDAO ABI
    const PollenDAOABI = require('../reference-code/pollen-subgraph-v3/abis/IPollenDAO.json');
    const iface = new ethers.utils.Interface(PollenDAOABI);
    
    // Get the event fragment
    const eventFragment = iface.getEvent('PortfolioCreated');
    console.log('Event Fragment:', eventFragment);
    
    // Decode the event log
    const decodedLog = iface.decodeEventLog(
      eventFragment,
      eventData.data,
      eventData.topics
    );
    
    console.log('\nDecoded Event:');
    console.log('- Creator:', decodedLog.creator);
    console.log('- Amount:', decodedLog.amount.toString());
    console.log('- Weights:', decodedLog.weights);
    console.log('- Token Type:', decodedLog.tokenType);
    
    // If the portfolio address is in the weights array (as a workaround)
    if (decodedLog.weights && decodedLog.weights.length > 0) {
      console.log('\nPossible Portfolio Addresses in Weights:');
      decodedLog.weights.forEach((weight, index) => {
        // Try to convert weight to address
        const hex = '0x' + weight.toString(16).padStart(40, '0');
        console.log(`- Weight ${index}: ${hex}`);
      });
    }
    
  } catch (error) {
    console.error('Error decoding event:', error);
  }
}

// Run the function
decodeEvent().catch(console.error);
