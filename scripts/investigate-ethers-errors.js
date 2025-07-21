
require('dotenv').config();
const { ethers } = require('ethers');

// Configuration
const CONFIG = {
  RPC_URL: 'https://sepolia.base.org',
  CHAIN_ID: 84532,
  CONTRACTS: {
    PLN: '0x9E1c51E1fAa1381D8a7Dbdd19402c5fCce9274C6',
    PORTFOLIO: '0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7',
  }
};

// Failed transaction hashes from the logs
const FAILED_TXS = [
  '0xb8d39b399f250b0232952ce01c963c654cc83db1a5ecb7af044778e441c93b7a', // Technical Bot
  '0x292bef926e8ad3cd3b520ed80309ff1431e24584620992893b232378c37a9d36'  // Mean Reversion Bot
];

// Contract ABIs
const PORTFOLIO_ABI = [
  'function createPortfolio(uint256 amount, uint256[] calldata weights, bool[] calldata isShort, bool tokenType)',
  'function getPortfolio(address user, address token) view returns (uint256[], uint256, uint256, uint256, bool, uint256, uint256, bool[])',
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)'
];

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address, address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
];

async function investigateEthersErrors() {
  console.log('🔍 INVESTIGATING ETHERS.JS ERRORS');
  console.log('════════════════════════════════════════════════════════════════\n');
  
  // Initialize provider
  const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL, {
    name: 'base-sepolia',
    chainId: CONFIG.CHAIN_ID,
  });

  const portfolioContract = new ethers.Contract(CONFIG.CONTRACTS.PORTFOLIO, PORTFOLIO_ABI, provider);
  const plnToken = new ethers.Contract(CONFIG.CONTRACTS.PLN, ERC20_ABI, provider);

  // 1. Check provider connectivity
  console.log('1. Provider Connectivity Test');
  console.log('─────────────────────────────────');
  try {
    const network = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();
    console.log(`✅ Connected to ${network.name} (Chain ID: ${network.chainId})`);
    console.log(`📦 Current block: ${blockNumber}`);
  } catch (error) {
    console.error('❌ Provider connection failed:', error.message);
    return;
  }

  // 2. Contract validation
  console.log('\n2. Contract Validation');
  console.log('─────────────────────────────────');
  
  try {
    // Check if contracts have code
    const portfolioCode = await provider.getCode(CONFIG.CONTRACTS.PORTFOLIO);
    const plnCode = await provider.getCode(CONFIG.CONTRACTS.PLN);
    
    console.log(`Portfolio Contract: ${portfolioCode !== '0x' ? '✅ Has code' : '❌ No code'}`);
    console.log(`PLN Token Contract: ${plnCode !== '0x' ? '✅ Has code' : '❌ No code'}`);
    
    // Test basic contract calls
    const plnSymbol = await plnToken.symbol();
    const plnDecimals = await plnToken.decimals();
    console.log(`PLN Token: ${plnSymbol} (${plnDecimals} decimals)`);
    
  } catch (error) {
    console.error('❌ Contract validation failed:', error.message);
  }

  // 3. Analyze failed transactions
  console.log('\n3. Failed Transaction Analysis');
  console.log('─────────────────────────────────');
  
  for (const txHash of FAILED_TXS) {
    console.log(`\nAnalyzing: ${txHash}`);
    
    try {
      const tx = await provider.getTransaction(txHash);
      const receipt = await provider.getTransactionReceipt(txHash);
      
      if (!tx || !receipt) {
        console.log('❌ Transaction not found');
        continue;
      }
      
      console.log(`From: ${tx.from}`);
      console.log(`To: ${tx.to}`);
      console.log(`Value: ${ethers.utils.formatEther(tx.value)} ETH`);
      console.log(`Gas Limit: ${tx.gasLimit.toString()}`);
      console.log(`Gas Used: ${receipt.gasUsed.toString()}`);
      console.log(`Gas Price: ${ethers.utils.formatUnits(tx.gasPrice || tx.maxFeePerGas, 'gwei')} gwei`);
      console.log(`Status: ${receipt.status === 1 ? 'Success' : 'Failed'}`);
      console.log(`Block: ${receipt.blockNumber}`);
      
      // Decode the input data
      if (tx.data && tx.data !== '0x') {
        try {
          const iface = new ethers.utils.Interface(PORTFOLIO_ABI);
          const decoded = iface.parseTransaction({ data: tx.data });
          console.log(`Function: ${decoded.name}`);
          console.log(`Arguments:`, decoded.args);
          
          // Analyze createPortfolio parameters
          if (decoded.name === 'createPortfolio') {
            const [amount, weights, isShort, tokenType] = decoded.args;
            console.log(`  Amount: ${ethers.utils.formatEther(amount)} PLN`);
            console.log(`  Weights: [${weights.map(w => w.toString()).join(', ')}] (sum: ${weights.reduce((a, b) => a.add(b), ethers.BigNumber.from(0)).toString()})`);
            console.log(`  IsShort: [${isShort.join(', ')}]`);
            console.log(`  TokenType: ${tokenType ? 'vePLN' : 'PLN'}`);
            
            // Check if weights sum to 100
            const totalWeight = weights.reduce((a, b) => a.add(b), ethers.BigNumber.from(0));
            if (!totalWeight.eq(100)) {
              console.log(`⚠️  Weight validation issue: Total = ${totalWeight.toString()}, Expected = 100`);
            }
          }
          
        } catch (decodeError) {
          console.log('⚠️  Could not decode transaction data:', decodeError.message);
        }
      }
      
      // Try to simulate the transaction to get revert reason
      if (receipt.status === 0) {
        console.log('\n🔍 Attempting to get revert reason...');
        try {
          await provider.call({
            to: tx.to,
            from: tx.from,
            data: tx.data,
            value: tx.value,
            gasLimit: tx.gasLimit,
            gasPrice: tx.gasPrice || tx.maxFeePerGas
          }, tx.blockNumber - 1);
          
          console.log('⚠️  Simulation succeeded (unexpected)');
        } catch (callError) {
          console.log('Revert reason:', callError.reason || callError.message);
          
          // Try to decode custom error
          if (callError.data) {
            console.log('Raw error data:', callError.data);
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Error analyzing transaction:', error.message);
    }
  }

  // 4. Check current wallet states
  console.log('\n4. Wallet State Analysis');
  console.log('─────────────────────────────────');
  
  const wallets = [
    { name: 'Technical Bot', address: '0x43f76157E9696302E287181828cB3B0C6B89d31e' },
    { name: 'Mean Reversion Bot', address: '0x8b7a6EfAB54Aa43D4b4Ca5abcBd5F6194382B961' }
  ];
  
  for (const wallet of wallets) {
    console.log(`\n${wallet.name} (${wallet.address}):`);
    
    try {
      const ethBalance = await provider.getBalance(wallet.address);
      const plnBalance = await plnToken.balanceOf(wallet.address);
      const allowance = await plnToken.allowance(wallet.address, CONFIG.CONTRACTS.PORTFOLIO);
      const nonce = await provider.getTransactionCount(wallet.address);
      
      console.log(`  ETH Balance: ${ethers.utils.formatEther(ethBalance)}`);
      console.log(`  PLN Balance: ${ethers.utils.formatEther(plnBalance)}`);
      console.log(`  PLN Allowance: ${ethers.utils.formatEther(allowance)}`);
      console.log(`  Nonce: ${nonce}`);
      
      // Check if portfolio exists
      try {
        const portfolio = await portfolioContract.getPortfolio(wallet.address, wallet.address);
        console.log(`  Portfolio Value: ${ethers.utils.formatEther(portfolio[1])}`);
      } catch (portfolioError) {
        console.log(`  Portfolio: Not found or error`);
      }
      
    } catch (error) {
      console.error(`  ❌ Error checking wallet: ${error.message}`);
    }
  }

  // 5. Gas price analysis
  console.log('\n5. Gas Price Analysis');
  console.log('─────────────────────────────────');
  
  try {
    const feeData = await provider.getFeeData();
    console.log(`Current Gas Price: ${ethers.utils.formatUnits(feeData.gasPrice, 'gwei')} gwei`);
    console.log(`Max Fee Per Gas: ${ethers.utils.formatUnits(feeData.maxFeePerGas, 'gwei')} gwei`);
    console.log(`Max Priority Fee: ${ethers.utils.formatUnits(feeData.maxPriorityFeePerGas, 'gwei')} gwei`);
  } catch (error) {
    console.error('❌ Could not get gas data:', error.message);
  }

  // 6. Recommendations
  console.log('\n6. Recommendations');
  console.log('─────────────────────────────────');
  console.log('Based on the analysis:');
  console.log('• Check if weight arrays sum to exactly 100');
  console.log('• Verify sufficient PLN allowance before transactions');
  console.log('• Consider increasing gas limits for complex operations');
  console.log('• Implement proper error handling for contract calls');
  console.log('• Add simulation before sending actual transactions');
}

// Run the investigation
investigateEthersErrors()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Investigation failed:', error);
    process.exit(1);
  });
