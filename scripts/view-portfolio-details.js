require('dotenv').config({ path: require('path').resolve(__dirname, '../base-sepolia.env') });
const { ethers } = require('ethers');

// Configuration
const CONFIG = {
  RPC_URL: 'https://sepolia.base.org',
  CHAIN_ID: 84532,
  CONTRACTS: {
    PLN: '0x9E1c51E1fAa1381D8a7Dbdd19402c5fCce9274C6',
    PORTFOLIO: '0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7',
  },
  ASSETS: {
    '0x9BF058E1EDc025770CcEB47196278ce0f59f85da': 'Asset 1',
    '0xf1318a938D4bcF1BB018425174726C41C4652f4a': 'Asset 2',
    '0x999B45BB215209e567FaF486515af43b8353e393': 'Asset 3',
    '0xE4aB69C077896252FAFBD49EFD26B5D171A32410': 'Asset 4',
    '0x74D8f222D3b8c173C24aD188f6B538159eE0F270': 'Asset 5',
    '0xCaB42f74e47B5f9A4FCBC5C1DfC4C9210626511C': 'Asset 6',
    '0x081827b8C3Aa05287b5aA2bC3051fbE638F33152': 'Asset 7'
  }
};

// Initialize provider
const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL);

// ABI for Portfolio contract
const PORTFOLIO_ABI = [
  'function getPortfolio(address owner, address delegator) view returns (uint256[] memory, uint256, uint256, uint256, bool, uint256, uint256, bool[])',
  'function getAssets() view returns (address[] memory)',
  'function getBenchMarkValue() view returns (uint256)',
  'function getPrices(uint256[] calldata, address[] calldata) view returns (uint256[] memory)',
  'function getAssetSymbols() view returns (string[] memory)'
];

// ABI for ERC20
const ERC20_ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)'
];

async function getAssetSymbols(portfolio) {
  try {
    const symbols = await portfolio.getAssetSymbols();
    return symbols;
  } catch (error) {
    console.log('Could not fetch asset symbols, using default mapping');
    return [];
  }
}

async function getAssetInfo(assetAddress, provider) {
  try {
    const contract = new ethers.Contract(assetAddress, ERC20_ABI, provider);
    const [symbol, decimals] = await Promise.all([
      contract.symbol(),
      contract.decimals()
    ]);
    return { symbol, decimals };
  } catch (error) {
    return { symbol: 'UNKNOWN', decimals: 18 };
  }
}

async function displayPortfolioDetails(walletAddress) {
  console.log(`\n=== Portfolio Details for ${walletAddress} ===`);
  
  const portfolio = new ethers.Contract(CONFIG.CONTRACTS.PORTFOLIO, PORTFOLIO_ABI, provider);
  
  try {
    // Get portfolio data
    const portfolioData = await portfolio.getPortfolio(walletAddress, walletAddress);
    const [
      assetAmounts,
      balance,
      depositPLN,
      depositVePLN,
      isOpen,
      benchMarkRef,
      shortsValue,
      isShort
    ] = portfolioData;
    
    // Get asset addresses
    const assetAddresses = await portfolio.getAssets();
    
    // Get prices
    const isValidAssets = assetAddresses.map(() => 1);
    const prices = await portfolio.getPrices(isValidAssets, assetAddresses);
    
    // Get asset symbols and decimals
    const assetInfo = await Promise.all(
      assetAddresses.map(addr => getAssetInfo(addr, provider))
    );
    
    // Display portfolio summary
    console.log('\n📊 Portfolio Summary:');
    console.log(`   Status: ${isOpen ? '✅ Open' : '❌ Closed'}`);
    console.log(`   Total Value: ${ethers.utils.formatEther(balance)}`);
    console.log(`   PLN Deposited: ${ethers.utils.formatEther(depositPLN)}`);
    console.log(`   vePLN Deposited: ${ethers.utils.formatEther(depositVePLN)}`);
    console.log(`   Benchmark Reference: ${benchMarkRef}`);
    
    // Display asset allocation
    console.log('\n📈 Asset Allocation:');
    let totalValue = ethers.BigNumber.from(0);
    const allocations = [];
    
    for (let i = 0; i < assetAddresses.length; i++) {
      const amount = assetAmounts[i];
      const price = prices[i];
      const assetValue = amount.mul(price).div(ethers.BigNumber.from(10).pow(18));
      totalValue = totalValue.add(assetValue);
      
      const info = assetInfo[i] || { symbol: `Asset ${i+1}`, decimals: 18 };
      
      allocations.push({
        symbol: info.symbol,
        amount: ethers.utils.formatUnits(amount, info.decimals),
        price: ethers.utils.formatEther(price),
        value: parseFloat(ethers.utils.formatEther(assetValue)),
        valueBN: assetValue,
        isShort: isShort[i] || false
      });
    }
    
    // Filter out zero allocations and sort by value (descending)
    const nonZeroAllocations = allocations.filter(a => a.value > 0);
    nonZeroAllocations.sort((a, b) => b.value - a.value);
    
    // Calculate total value from non-zero allocations
    const displayTotalValue = nonZeroAllocations.reduce(
      (sum, alloc) => sum.add(alloc.valueBN), 
      ethers.BigNumber.from(0)
    );
    
    // Display table
    console.log('\n' + [
      'Symbol'.padEnd(10),
      'Amount'.padEnd(20),
      'Price'.padEnd(15),
      'Value'.padEnd(15),
      'Allocation'.padEnd(12),
      'Type'
    ].join(' | '));
    
    console.log('-'.repeat(90));
    
    for (const alloc of nonZeroAllocations) {
      const allocation = alloc.valueBN.mul(10000).div(displayTotalValue).toNumber() / 100;
      
      console.log([
        alloc.symbol.padEnd(10),
        alloc.amount.padEnd(20),
        `$${alloc.price}`.padEnd(15),
        `$${alloc.value.toFixed(6)}`.padEnd(15),
        `${allocation.toFixed(2)}%`.padEnd(12),
        alloc.isShort ? 'SHORT' : 'LONG'
      ].join(' | '));
    }
    
    console.log('\n💡 Portfolio created successfully with the above allocation.');
    
    return {
      walletAddress,
      isOpen,
      totalValue: ethers.utils.formatEther(totalValue),
      depositPLN: ethers.utils.formatEther(depositPLN),
      depositVePLN: ethers.utils.formatEther(depositVePLN),
      benchMarkRef: benchMarkRef.toString(),
      allocations
    };
    
  } catch (error) {
    console.error('❌ Error fetching portfolio details:', error.message);
    if (error.code === 'CALL_EXCEPTION') {
      console.log('   This wallet may not have a portfolio yet.');
    }
    return null;
  }
}

// If called directly, show current wallet's portfolio
if (require.main === module) {
  const wallet = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, provider);
  displayPortfolioDetails(wallet.address);
}

module.exports = {
  displayPortfolioDetails,
  CONFIG
};
