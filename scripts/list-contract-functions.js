require('dotenv').config({ path: require('path').resolve(__dirname, '../base-sepolia.env') });
const { ethers } = require('ethers');
const PORTFOLIO_ABI = require('../reference-code/pollen-subgraph-v3/abis/PatchedPortfolio.json');

// Configuration
const CONFIG = {
  RPC_URL: 'https://sepolia.base.org',
  PORTFOLIO_ADDRESS: '0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7', // Pollen DAO/Portfolio
};

async function listFunctions() {
  console.log('=== Pollen Portfolio Contract Functions ===');
  
  // Initialize provider
  const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL);
  
  // Create contract instance
  const contract = new ethers.Contract(CONFIG.PORTFOLIO_ADDRESS, PORTFOLIO_ABI, provider);
  
  // Get all function fragments
  const functionFragments = PORTFOLIO_ABI.filter(
    x => x.type === 'function' && x.name
  );
  
  console.log(`\nFound ${functionFragments.length} functions:\n`);
  
  // Group functions by name (to handle overloads)
  const functionsByName = {};
  functionFragments.forEach(fn => {
    if (!functionsByName[fn.name]) {
      functionsByName[fn.name] = [];
    }
    functionsByName[fn.name].push(fn);
  });
  
  // Print functions with their signatures
  Object.entries(functionsByName).forEach(([name, overloads]) => {
    console.log(`Function: ${name}`);
    overloads.forEach((fn, i) => {
      const inputs = fn.inputs.map(input => 
        `${input.name || `arg${i}`}: ${input.type}`
      ).join(', ');
      
      const outputs = fn.outputs ? 
        `: ${fn.outputs.map(o => o.type).join(', ')}` : 
        '';
      
      console.log(`  ${i + 1}. ${name}(${inputs})${outputs}`);
      console.log(`     State mutability: ${fn.stateMutability}`);
    });
    console.log('');
  });
  
  // Check for deposit-related functions
  const depositFunctions = functionFragments.filter(fn => 
    fn.name.toLowerCase().includes('deposit')
  );
  
  console.log('\n=== Deposit-related functions ===');
  depositFunctions.forEach(fn => {
    const inputs = fn.inputs.map(input => 
      `${input.name || 'arg'}: ${input.type}`
    ).join(', ');
    console.log(`- ${fn.name}(${inputs})`);
  });
}

listFunctions().catch(console.error);
