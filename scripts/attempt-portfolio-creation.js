require('dotenv').config();
const { ethers } = require('ethers');

// Configuration
const CONFIG = {
  RPC_URL: 'https://sepolia.base.org',
  CHAIN_ID: 84532,
  CONTRACTS: {
    PLN: '0x9E1c51E1fAa1381D8a7Dbdd19402c5fCce9274C6',
    PORTFOLIO: '0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7',
  },
  // Using the first wallet private key
  PRIVATE_KEY: '0x241083ae625b93b41b555052840c09458c71704889b22774101d21b4d1482e62'
};

// ABI for the Portfolio contract
const PORTFOLIO_ABI = [
  'function createPortfolio(uint256 amount, uint256[] calldata weights, bool[] calldata isShort, bool tokenType)',
  'function getPortfolio(address user, address token) view returns (uint256[], uint256, uint256, uint256, bool, uint256, uint256, bool[])'
];

// ABI for the PLN token
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address, address) view returns (uint256)',
  'function approve(address, uint256) returns (bool)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)'
];

// Enhanced error decoding
function decodeRevertReason(returnData) {
  if (!returnData || returnData === '0x') return 'No return data';
  
  // Check for common error signatures
  const revertPrefix = '0x08c379a0'; // Error(string)
  if (returnData.startsWith(revertPrefix)) {
    try {
      const reason = ethers.utils.defaultAbiCoder.decode(
        ['string'],
        '0x' + returnData.slice(10)
      );
      return `Revert: ${reason}`;
    } catch (e) {
      return `Revert reason could not be decoded: ${returnData}`;
    }
  }
  
  return `Unknown error: ${returnData}`;
}

async function attemptPortfolioCreation() {
  console.log('=== Attempting Portfolio Creation ===\n');
  
  // Initialize provider and wallet
  const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL, {
    name: 'base-sepolia',
    chainId: CONFIG.CHAIN_ID,
  });

  const wallet = new ethers.Wallet(CONFIG.PRIVATE_KEY, provider);
  console.log(`Using wallet: ${wallet.address}`);
  
  // Initialize contracts
  const plnToken = new ethers.Contract(CONFIG.CONTRACTS.PLN, ERC20_ABI, wallet);
  const portfolio = new ethers.Contract(CONFIG.CONTRACTS.PORTFOLIO, PORTFOLIO_ABI, wallet);
  
  // 1. Check balances
  const ethBalance = await provider.getBalance(wallet.address);
  const plnSymbol = await plnToken.symbol();
  const plnDecimals = await plnToken.decimals();
  const plnBalance = await plnToken.balanceOf(wallet.address);
  
  console.log(`\n1. Balances:`);
  console.log(`   ETH: ${ethers.utils.formatEther(ethBalance)}`);
  console.log(`   ${plnSymbol}: ${ethers.utils.formatUnits(plnBalance, plnDecimals)}`);
  
  // 2. Check allowance
  const allowance = await plnToken.allowance(wallet.address, CONFIG.CONTRACTS.PORTFOLIO);
  console.log(`\n2. ${plnSymbol} Allowance: ${ethers.utils.formatUnits(allowance, plnDecimals)}`);
  
  // 3. Prepare portfolio parameters
  const amountToDeposit = ethers.utils.parseUnits('10', plnDecimals);
  const weights = [16, 14, 14, 14, 14, 14, 14]; // Must sum to 100
  const isShort = [false, false, false, false, false, false, false];
  const tokenType = false; // false for PLN, true for vePLN
  
  console.log('\n3. Portfolio Parameters:');
  console.log('   Amount:', ethers.utils.formatUnits(amountToDeposit, plnDecimals), plnSymbol);
  console.log('   Weights:', weights.join(', '), '(sum:', weights.reduce((a, b) => a + b, 0) + ')');
  console.log('   isShort:', isShort.join(', '));
  console.log('   tokenType:', tokenType ? 'vePLN' : 'PLN');
  
  // 4. Check if we need to approve more tokens
  if (allowance.lt(amountToDeposit)) {
    console.log('\nApproving tokens...');
    try {
      const approveTx = await plnToken.approve(
        CONFIG.CONTRACTS.PORTFOLIO,
        amountToDeposit,
        {
          gasLimit: 100000,
          gasPrice: ethers.utils.parseUnits('2', 'gwei')
        }
      );
      
      console.log(`   Approval tx: ${approveTx.hash}`);
      console.log('   Waiting for confirmation...');
      await approveTx.wait();
      console.log('   ✔️  Approval confirmed');
    } catch (error) {
      console.error('   ❌ Approval failed:', error.message);
      if (error.transactionHash) {
        const tx = await provider.getTransactionReceipt(error.transactionHash);
        console.log('   Transaction status:', tx.status === 1 ? 'Success' : 'Failed');
        console.log('   Gas used:', tx.gasUsed.toString());
      }
      return;
    }
  }
  
  // 5. Attempt to create portfolio
  console.log('\n5. Attempting to create portfolio...');
  
  try {
    // First, simulate the transaction
    console.log('   Simulating transaction...');
    try {
      const callData = portfolio.interface.encodeFunctionData('createPortfolio', [
        amountToDeposit,
        weights,
        isShort,
        tokenType
      ]);
      
      const result = await provider.call({
        to: CONFIG.CONTRACTS.PORTFOLIO,
        data: callData,
        from: wallet.address
      });
      
      console.log('   ✅ Simulation successful');
    } catch (simError) {
      console.log('   ❌ Simulation failed:');
      console.log('   ', decodeRevertReason(simError.data));
      console.log('   Raw error:', simError.message);
      return;
    }
    
    // If simulation passes, send the actual transaction
    console.log('   Sending transaction...');
    const tx = await portfolio.createPortfolio(
      amountToDeposit,
      weights,
      isShort,
      tokenType,
      {
        gasLimit: 1000000,
        gasPrice: ethers.utils.parseUnits('2', 'gwei')
      }
    );
    
    console.log(`   Transaction hash: ${tx.hash}`);
    console.log('   Waiting for confirmation...');
    
    const receipt = await tx.wait();
    console.log('\n✅ Portfolio created successfully!');
    console.log('   Block:', receipt.blockNumber);
    console.log('   Gas used:', receipt.gasUsed.toString());
    
  } catch (error) {
    console.error('\n❌ Portfolio creation failed:');
    console.error('   Message:', error.message);
    
    if (error.reason) {
      console.log('   Reason:', error.reason);
    }
    
    if (error.transactionHash) {
      console.log('   Transaction hash:', error.transactionHash);
      console.log('   View on explorer: https://sepolia.basescan.org/tx/' + error.transactionHash);
      
      try {
        const tx = await provider.getTransactionReceipt(error.transactionHash);
        console.log('   Transaction status:', tx.status === 1 ? 'Success' : 'Failed');
        console.log('   Gas used:', tx.gasUsed.toString());
        
        // Try to get the revert reason
        if (tx.status === 0) {
          const txData = await provider.getTransaction(error.transactionHash);
          const code = await provider.call({
            to: txData.to,
            from: txData.from,
            data: txData.data,
            value: txData.value,
            gasLimit: tx.gasUsed,
            gasPrice: tx.effectiveGasPrice || tx.gasPrice
          });
          
          console.log('   Revert reason:', decodeRevertReason(code));
        }
      } catch (txError) {
        console.log('   Could not fetch transaction details:', txError.message);
      }
    }
  }
}

// Run the portfolio creation attempt
attemptPortfolioCreation()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
