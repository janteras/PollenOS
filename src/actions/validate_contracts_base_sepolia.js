const { ethers } = require('ethers');
require('dotenv').config();

/**
 * Validate Base Sepolia Pollen contracts
 * Checks connectivity and basic functionality for all contracts
 */
class BaseSepoliaContractValidator {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(
      process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'
    );
        
    this.contracts = {
      pollenDAO: process.env.POLLEN_DAO_ADDRESS || '0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7',
      leagues: process.env.LEAGUES_CONTRACT_ADDRESS || '0x55F04Ee2775925b80125F412C05cF5214Fd1317a',
      vePLN: process.env.VEPLN_CONTRACT_ADDRESS || '0x3a28AB567b661B3edaF9Ef0bDE9489558EDB3995',
      plnToken: process.env.PLN_TOKEN_ADDRESS || '0x9E1c51E1fAa1381D8a7Dbdd19402c5fCce9274C6'
    };

    // Basic ABI for common functions
    this.erc20ABI = [
      'function name() external view returns (string)',
      'function symbol() external view returns (string)', 
      'function decimals() external view returns (uint8)',
      'function totalSupply() external view returns (uint256)',
      'function balanceOf(address) external view returns (uint256)'
    ];

    this.basicABI = [
      'function owner() external view returns (address)',
      'function paused() external view returns (bool)'
    ];
  }

  /**
     * Validate network connectivity
     */
  async validateNetwork() {
    try {
      const network = await this.provider.getNetwork();
      const blockNumber = await this.provider.getBlockNumber();
      const gasPrice = await this.provider.getFeeData();

      return {
        success: true,
        chainId: Number(network.chainId),
        blockNumber,
        gasPrice: gasPrice.gasPrice ? ethers.formatUnits(gasPrice.gasPrice, 'gwei') : 'N/A',
        network: network.name || 'base-sepolia'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
     * Validate a specific contract address
     */
  async validateContract(contractAddress, contractName) {
    try {
      // Check if address has code
      const code = await this.provider.getCode(contractAddress);
      if (code === '0x') {
        return {
          success: false,
          contractName,
          address: contractAddress,
          error: 'No contract code found at address'
        };
      }

      const result = {
        success: true,
        contractName,
        address: contractAddress,
        hasCode: true,
        codeSize: (code.length - 2) / 2 // Remove 0x and divide by 2
      };

      // Try to get additional info for token contracts
      if (contractName === 'plnToken') {
        try {
          const contract = new ethers.Contract(contractAddress, this.erc20ABI, this.provider);
          const [name, symbol, decimals, totalSupply] = await Promise.all([
            contract.name(),
            contract.symbol(),
            contract.decimals(),
            contract.totalSupply()
          ]);

          result.tokenInfo = {
            name,
            symbol,
            decimals: Number(decimals),
            totalSupply: ethers.formatUnits(totalSupply, decimals)
          };
        } catch (tokenError) {
          result.tokenInfoError = tokenError.message;
        }
      }

      return result;
    } catch (error) {
      return {
        success: false,
        contractName,
        address: contractAddress,
        error: error.message
      };
    }
  }

  /**
     * Validate all contracts
     */
  async validateAllContracts() {
    const results = {
      timestamp: new Date().toISOString(),
      network: await this.validateNetwork(),
      contracts: {}
    };

    // Validate each contract
    for (const [name, address] of Object.entries(this.contracts)) {
      console.log(`Validating ${name} contract at ${address}...`);
      results.contracts[name] = await this.validateContract(address, name);
    }

    return results;
  }

  /**
     * Check if all contracts are accessible
     */
  async checkContractsAccessibility() {
    const results = await this.validateAllContracts();
        
    const summary = {
      networkConnected: results.network.success,
      contractsAccessible: Object.values(results.contracts).every(c => c.success),
      totalContracts: Object.keys(results.contracts).length,
      successfulContracts: Object.values(results.contracts).filter(c => c.success).length,
      failedContracts: Object.values(results.contracts).filter(c => !c.success).map(c => ({
        name: c.contractName,
        error: c.error
      }))
    };

    return {
      summary,
      details: results
    };
  }
}

/**
 * ElizaOS Action Handler
 */
async function validateContractsBaseSepoliaAction(runtime, message, state) {
  try {
    console.log('🔍 Starting Base Sepolia contract validation...');
        
    const validator = new BaseSepoliaContractValidator();
    const results = await validator.checkContractsAccessibility();
        
    if (results.summary.networkConnected && results.summary.contractsAccessible) {
      console.log('✅ All Base Sepolia contracts validated successfully');
            
      // Store validation results in memory
      if (runtime.messageManager) {
        await runtime.messageManager.createMemory({
          id: `contract-validation-${Date.now()}`,
          content: {
            text: 'Base Sepolia contracts validation successful',
            source: 'contract_validator',
            timestamp: new Date().toISOString(),
            metadata: results
          }
        });
      }
            
      return {
        success: true,
        message: `✅ Base Sepolia validation complete. All ${results.summary.totalContracts} contracts accessible.`,
        data: results.summary
      };
    } else {
      console.log('❌ Contract validation failed');
            
      return {
        success: false,
        message: `❌ Contract validation failed. Network: ${results.summary.networkConnected ? 'OK' : 'FAILED'}, Contracts: ${results.summary.successfulContracts}/${results.summary.totalContracts}`,
        data: results.summary,
        errors: results.summary.failedContracts
      };
    }
        
  } catch (error) {
    console.error('Error during contract validation:', error);
    return {
      success: false,
      message: '❌ Contract validation error: ' + error.message,
      error: error.message
    };
  }
}

module.exports = {
  BaseSepoliaContractValidator,
  validateContractsBaseSepoliaAction
}; 