const { ethers } = require('ethers');
const config = require('./config');

async function decodeTransactionInput() {
  try {
    // The input data from the transaction
    const inputData = '0x215fea270000000000000000000000000000000000000000000000008ac7230489e8000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000180000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000070000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000070000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';
    
    // The PollenDAO ABI for the createPortfolio function
    const createPortfolioABI = [
      'function createPortfolio(uint256 amount, uint256[] calldata weights, bytes32[] calldata data, bool tokenType) external'
    ];
    
    // Create an Interface from the ABI
    const iface = new ethers.utils.Interface(createPortfolioABI);
    
    // Decode the input data
    const decoded = iface.decodeFunctionData('createPortfolio', inputData);
    
    console.log('Decoded Transaction Input:');
    console.log('Amount:', decoded.amount.toString());
    console.log('Weights:', decoded.weights.map(w => w.toString()));
    console.log('Data:', decoded.data);
    console.log('Token Type:', decoded.tokenType);
    
    // Try to find the portfolio address by calculating it
    const provider = new ethers.providers.JsonRpcProvider(config.RPC_URL);
    const tx = await provider.getTransaction('0xd34c0e7c113ef6f9dd49cab7ffe3a1ce27f2e7e6c872288c7c89e9c00ae72914');
    
    if (tx) {
      console.log('\nTransaction Details:');
      console.log('From:', tx.from);
      console.log('To:', tx.to);
      console.log('Nonce:', tx.nonce);
      
      // Calculate the contract address using CREATE opcode (nonce-based)
      const sender = tx.from.toLowerCase();
      const nonce = tx.nonce;
      const rlpEncoded = ethers.utils.RLP.encode([
        sender,
        ethers.utils.hexlify(nonce)
      ]);
      const contractAddress = ethers.utils.keccak256(rlpEncoded).substring(26);
      const createAddress = '0x' + contractAddress;
      
      console.log('\nPotential Portfolio Address (CREATE):', createAddress);
      
      // Check if there's code at this address
      const code = await provider.getCode(createAddress);
      console.log('Code at address:', code !== '0x' ? 'Contract exists' : 'No contract');
    }
    
  } catch (error) {
    console.error('Error decoding transaction input:', error);
  }
}

// Run the function
decodeTransactionInput().catch(console.error);
