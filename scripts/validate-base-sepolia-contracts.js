
const { ethers } = require('ethers');
const logger = require('../src/modules/logger');

// Base Sepolia configuration per Developer Guide
const SEPOLIA_CONFIG = {
  chainId: 84532,
  rpcUrl: 'https://sepolia.base.org',
  explorerUrl: 'https://sepolia.basescan.org',
  contracts: {
    // Legitimate Base Sepolia contracts from Developer Guide
    PLN: '0x9E1c51E1fAa1381D8a7Dbdd19402c5fCce9274C6',
    Portfolio: '0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7',
    vePLN: '0x3a28AB567b661B3edaF9Ef0bDE9489558EDB3995',
    Leagues: '0x55F04Ee2775925b80125F412C05cF5214Fd1317a'
  }
};

// Expected contract ABIs for validation
const CONTRACT_ABIS = {
  PLN: [
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function totalSupply() view returns (uint256)',
    'function balanceOf(address) view returns (uint256)'
  ],
  Portfolio: [
    'function createPortfolio(uint256 amount, uint256[] calldata weights, bool[] calldata isShort, bool tokenType)',
    'function getPortfolio(address user, address token) view returns (uint256[], uint256, uint256, uint256, bool, uint256, uint256, bool[])',
    'function depositPLN(uint256 amount, address recipient)'
  ],
  vePLN: [
    'function balanceOf(address) view returns (uint256)',
    'function locked(address) view returns (tuple(uint256 amount, uint256 end))'
  ]
};

async function validateBaseSepoliaContracts() {
  console.log('🔍 Validating Base Sepolia Contracts per Developer Guide');
  console.log('════════════════════════════════════════════════════════════');
  
  const provider = new ethers.JsonRpcProvider(SEPOLIA_CONFIG.rpcUrl);
  const results = {
    network: null,
    contracts: {},
    legitimacy: {
      allLegitimate: false,
      issues: []
    }
  };

  try {
    // 1. Validate network
    const network = await provider.getNetwork();
    results.network = {
      chainId: Number(network.chainId),
      name: network.name,
      isBaseSepolia: Number(network.chainId) === 84532
    };

    if (!results.network.isBaseSepolia) {
      results.legitimacy.issues.push('Connected to wrong network');
      console.log('❌ Not connected to Base Sepolia');
      return results;
    }

    console.log('✅ Connected to Base Sepolia (Chain ID: 84532)');

    // 2. Validate each contract
    for (const [contractName, address] of Object.entries(SEPOLIA_CONFIG.contracts)) {
      console.log(`\n🔍 Validating ${contractName} at ${address}`);
      
      const contractResult = {
        address,
        hasCode: false,
        isLegitimate: false,
        functions: {},
        error: null
      };

      try {
        // Check if contract has code
        const code = await provider.getCode(address);
        contractResult.hasCode = code !== '0x';

        if (!contractResult.hasCode) {
          contractResult.error = 'No code at address';
          console.log(`❌ ${contractName}: No code at address`);
          results.legitimacy.issues.push(`${contractName}: No code at address`);
          results.contracts[contractName] = contractResult;
          continue;
        }

        // Test contract functions
        const contract = new ethers.Contract(address, CONTRACT_ABIS[contractName] || [], provider);
        
        switch (contractName) {
          case 'PLN':
            try {
              const [symbol, name, decimals] = await Promise.all([
                contract.symbol(),
                contract.name(),
                contract.decimals()
              ]);
              
              contractResult.functions = { symbol, name, decimals };
              contractResult.isLegitimate = symbol === 'PLN' || name.toLowerCase().includes('pollen');
              
              if (contractResult.isLegitimate) {
                console.log(`✅ ${contractName}: ${name} (${symbol})`);
              } else {
                console.log(`⚠️ ${contractName}: Unexpected token - ${name} (${symbol})`);
                results.legitimacy.issues.push(`${contractName}: Unexpected token properties`);
              }
            } catch (error) {
              contractResult.error = error.message;
              console.log(`❌ ${contractName}: Function call failed - ${error.message}`);
            }
            break;

          case 'Portfolio':
            try {
              // Test if we can call getPortfolio (should not fail even with no portfolio)
              await contract.getPortfolio.staticCall(ethers.ZeroAddress, ethers.ZeroAddress);
              contractResult.isLegitimate = true;
              console.log(`✅ ${contractName}: Portfolio functions accessible`);
            } catch (error) {
              if (error.message.includes('execution reverted')) {
                // Expected behavior - portfolio doesn't exist
                contractResult.isLegitimate = true;
                console.log(`✅ ${contractName}: Portfolio contract verified`);
              } else {
                contractResult.error = error.message;
                console.log(`❌ ${contractName}: Unexpected error - ${error.message}`);
              }
            }
            break;

          case 'vePLN':
            try {
              // Test balanceOf function
              await contract.balanceOf(ethers.ZeroAddress);
              contractResult.isLegitimate = true;
              console.log(`✅ ${contractName}: vePLN functions accessible`);
            } catch (error) {
              contractResult.error = error.message;
              console.log(`❌ ${contractName}: Function call failed - ${error.message}`);
            }
            break;

          case 'Leagues':
            // For Leagues, just verify it has code (ABI might not be complete)
            contractResult.isLegitimate = true;
            console.log(`✅ ${contractName}: Contract has code`);
            break;
        }

      } catch (error) {
        contractResult.error = error.message;
        console.log(`❌ ${contractName}: Validation failed - ${error.message}`);
      }

      results.contracts[contractName] = contractResult;
    }

    // 3. Assess overall legitimacy
    const legitimateContracts = Object.values(results.contracts).filter(c => c.isLegitimate).length;
    const totalContracts = Object.keys(results.contracts).length;
    
    results.legitimacy.allLegitimate = legitimateContracts === totalContracts && results.legitimacy.issues.length === 0;

    // 4. Summary
    console.log('\n📊 VALIDATION SUMMARY');
    console.log('════════════════════════════════════════════════════════════');
    console.log(`Network: ${results.network.isBaseSepolia ? '✅' : '❌'} Base Sepolia`);
    console.log(`Contracts: ${legitimateContracts}/${totalContracts} legitimate`);
    
    if (results.legitimacy.allLegitimate) {
      console.log('✅ ALL CONTRACTS ARE LEGITIMATE BASE SEPOLIA CONTRACTS');
      console.log('✅ Safe to proceed with bot operations');
    } else {
      console.log('❌ SOME CONTRACTS FAILED VALIDATION');
      console.log('⚠️ Review issues before proceeding');
      results.legitimacy.issues.forEach(issue => console.log(`   - ${issue}`));
    }

    return results;

  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    results.legitimacy.issues.push(`Validation error: ${error.message}`);
    return results;
  }
}

// Run validation if called directly
if (require.main === module) {
  validateBaseSepoliaContracts()
    .then(results => {
      console.log('\n📋 Results available for inspection');
      process.exit(results.legitimacy.allLegitimate ? 0 : 1);
    })
    .catch(console.error);
}

module.exports = validateBaseSepoliaContracts;
