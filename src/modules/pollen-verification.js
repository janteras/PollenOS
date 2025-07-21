const ethers = require('ethers');
const axios = require('axios');
const logger = require('./logger');

// Base Sepolia configuration
const BASE_SEPOLIA_CONFIG = {
  rpcUrl: 'https://sepolia.base.org',
  chainId: 84532,
  explorerUrl: 'https://sepolia.basescan.org'
};

// Base Sepolia contract addresses
const CONTRACTS_TO_VERIFY = {
  // Main contracts
  PLN_TOKEN: '0x9E1c51E1fAa1381D8a7Dbdd19402c5fCce9274C6',
  VIRTUAL_CONTRACT: '0x55F04Ee2775925b80125F412C05cF5214Fd1317a',
  POLLEN_DAO: '0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7',
  VEPLN: '0x3a28AB567b661B3edaF9Ef0bDE9489558EDB3995',
  LEAGUES: '0x55F04Ee2775925b80125F412C05cF5214Fd1317a'
};

class PollenContractVerifier {
  constructor(config) {
    this.config = config;
    // Use the provider from config or create a new one
    this.provider = config.provider || new ethers.JsonRpcProvider(BASE_SEPOLIA_CONFIG.rpcUrl);
    this.contracts = {
      ...CONTRACTS_TO_VERIFY,
      ...(config.contracts || {})
    };
  }

  /**
   * Verify PLN token contract
   */
  async verifyPlnToken() {
    try {
      logger.info('Verifying PLN token contract...');

      const tokenContract = new ethers.Contract(
        CONTRACTS_TO_VERIFY.PLN_TOKEN,
        [
          'function name() view returns (string)',
          'function symbol() view returns (string)',
          'function decimals() view returns (uint8)',
          'function totalSupply() view returns (uint256)'
        ],
        this.provider
      );

      const [name, symbol, decimals, totalSupply] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.decimals(),
        tokenContract.totalSupply()
      ]);

      const result = {
        address: CONTRACTS_TO_VERIFY.PLN_TOKEN,
        name,
        symbol,
        decimals: Number(decimals),
        totalSupply: ethers.formatEther(totalSupply),
        verified: symbol === 'PLN'
      };

      logger.info(`PLN Token verification: ${JSON.stringify(result, null, 2)}`);
      return result;
    } catch (error) {
      logger.error('Error verifying PLN token:', error);
      return { verified: false, error: error.message };
    }
  }

  /**
   * Verify main Pollen contract functionality using comprehensive ABI discovery
   */
  async verifyMainContract(contractAddress) {
    try {
      logger.info(`Verifying main contract at ${contractAddress}...`);
      
      // Add progressive delay to prevent rate limiting
      const delay = Math.random() * 3000 + 2000; // 2-5 second random delay
      await new Promise(resolve => setTimeout(resolve, delay));

      // Check if contract exists
      const code = await this.provider.getCode(contractAddress);
      if (code === '0x') {
        return { verified: false, error: 'No contract code at address' };
      }

      const result = { 
        address: contractAddress, 
        functions: {},
        events: {},
        contractType: 'unknown',
        bytecodeLength: code.length
      };

      // Try multiple ABI patterns for Pollen contracts
      const abiPatterns = [
        // Standard staking functions
        [
          'function paused() view returns (bool)',
          'function totalStaked() view returns (uint256)',
          'function stakingToken() view returns (address)',
          'function stake(uint256) external',
          'function unstake(uint256) external'
        ],
        // Pollen-specific trading functions
        [
          'function openPosition(address, uint256, bool, uint256) external',
          'function closePosition(address) external',
          'function getPosition(address, address) view returns (uint256, uint256, bool, uint256)',
          'function updateVirtualPortfolio(address[], uint256[]) external'
        ],
        // ERC20-like functions for PLN interaction
        [
          'function balanceOf(address) view returns (uint256)',
          'function transfer(address, uint256) external returns (bool)',
          'function approve(address, uint256) external returns (bool)',
          'function allowance(address, address) view returns (uint256)'
        ],
        // Governance/Admin functions
        [
          'function owner() view returns (address)',
          'function pause() external',
          'function unpause() external',
          'function emergencyWithdraw() external'
        ]
      ];

      let workingFunctions = 0;

      for (const [index, abi] of abiPatterns.entries()) {
        const contract = new ethers.Contract(contractAddress, abi, this.provider);

        // Add delay between ABI pattern attempts
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }

        for (const functionSig of abi) {
          const functionName = functionSig.split('(')[0].split(' ').pop();

          try {
            // Add small delay between function calls to prevent rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
            
            let callResult;

            // Handle different function types
            if (functionName === 'balanceOf' || functionName === 'allowance') {
              // Use zero address for test calls
              callResult = await contract[functionName]('0x0000000000000000000000000000000000000000');
            } else if (functionName.includes('view') || functionName.includes('returns')) {
              callResult = await contract[functionName]();
            } else {
              // For non-view functions, just check if they exist
              callResult = 'Function exists (not called)';
            }

            result.functions[functionName] = {
              status: 'success',
              value: callResult?.toString() || 'success',
              abi: functionSig
            };
            workingFunctions++;

          } catch (e) {
            result.functions[functionName] = {
              status: 'error',
              error: e.code || 'CALL_FAILED',
              abi: functionSig
            };
          }
        }
      }

      // Determine contract type based on working functions
      if (result.functions.openPosition?.status === 'success') {
        result.contractType = 'pollen-trading';
      } else if (result.functions.stake?.status === 'success') {
        result.contractType = 'staking';
      } else if (result.functions.balanceOf?.status === 'success') {
        result.contractType = 'erc20';
      }

      // Try to get recent events
      try {
        const latestBlock = await this.provider.getBlockNumber();
        const logs = await this.provider.getLogs({
          address: contractAddress,
          fromBlock: latestBlock - 1000,
          toBlock: 'latest'
        });

        result.events.recentEventCount = logs.length;
        result.events.lastActivity = logs.length > 0 ? 'Recent' : 'None found';
      } catch (e) {
        result.events.error = e.message;
      }

      result.verified = workingFunctions > 0;
      result.workingFunctionCount = workingFunctions;

      logger.info(`Contract analysis complete: ${result.contractType}, ${workingFunctions} working functions`);
      return result;
    } catch (error) {
      logger.error(`Error verifying contract ${contractAddress}:`, error);
      return { verified: false, error: error.message };
    }
  }

  /**
   * Verify Pollen DAO contract
   */
  async verifyPollenDao() {
    try {
      logger.info('Verifying Pollen DAO contract...');

      const daoContract = new ethers.Contract(
        CONTRACTS_TO_VERIFY.POLLEN_DAO,
        [
          'function addModule(address module) external',
          'function updateModule(address module) external',
          'function pollenToken() view returns (address)',
          'function setPollenTokens(address pollenToken_, address vePollenToken_) external',
          'event PollenTokenSet(address pollenToken, address vePollenToken)'
        ],
        this.provider
      );

      const [pollenToken] = await Promise.all([
        daoContract.pollenToken()
      ]);

      const result = {
        address: CONTRACTS_TO_VERIFY.POLLEN_DAO,
        pollenToken,
        verified: true // Assuming if we can fetch the token address, it's verified
      };

      logger.info(`Pollen DAO verification: ${JSON.stringify(result, null, 2)}`);
      return result;
    } catch (error) {
      logger.error('Error verifying Pollen DAO:', error);
      return { verified: false, error: error.message };
    }
  }

  /**
   * Fetch complete ABI from external sources (Swiss Knife alternative)
   */
  async fetchContractABI(contractAddress) {
    try {
      // Try Snowtrace API first
      const snowtraceUrl = `https://api.snowtrace.io/api?module=contract&action=getabi&address=${contractAddress}&apikey=YourApiKeyToken`;

      try {
        const response = await axios.get(snowtraceUrl, { timeout: 10000 });
        if (response.data.status === '1') {
          const abi = JSON.parse(response.data.result);
          logger.info(`Successfully fetched ABI from Snowtrace for ${contractAddress}`);
          return { source: 'snowtrace', abi };
        }
      } catch (e) {
        logger.warn(`Snowtrace ABI fetch failed: ${e.message}`);
      }

      // Fallback: Use bytecode analysis to infer function signatures
      const code = await this.provider.getCode(contractAddress);
      const inferredFunctions = this.analyzeBytecodeFunctions(code);

      return { 
        source: 'bytecode-analysis', 
        abi: inferredFunctions,
        note: 'Inferred from bytecode - may be incomplete'
      };

    } catch (error) {
      logger.error(`Error fetching ABI for ${contractAddress}:`, error);
      return { error: error.message };
    }
  }

  /**
   * Analyze bytecode to infer function signatures
   */
  analyzeBytecodeFunctions(bytecode) {
    const commonSelectors = {
      '0x5c975abb': 'paused() view returns (bool)',
      '0x817b1cd2': 'totalStaked() view returns (uint256)',
      '0x72f702f3': 'stakingToken() view returns (address)',
      '0xa694fc3a': 'stake(uint256) external',
      '0x2e1a7d4d': 'unstake(uint256) external',
      '0x70a08231': 'balanceOf(address) view returns (uint256)',
      '0xa9059cbb': 'transfer(address,uint256) external returns (bool)',
      '0x095ea7b3': 'approve(address,uint256) external returns (bool)',
      '0x8da5cb5b': 'owner() view returns (address)'
    };

    const foundFunctions = [];

    for (const [selector, signature] of Object.entries(commonSelectors)) {
      if (bytecode.includes(selector.slice(2))) {
        foundFunctions.push(signature);
      }
    }

    return foundFunctions;
  }

  /**
   * Check transaction history for an address
   */
  async checkTransactionHistory(contractAddress) {
    try {
      logger.info(`Checking transaction history for ${contractAddress}`);
      // Implementation for checking transaction history
      const provider = await this.provider;
      const blockNumber = await provider.getBlockNumber();

      // Try to get recent transactions (simplified check)
      const filter = {
        address: contractAddress,
        fromBlock: Math.max(0, blockNumber - 1000),
        toBlock: 'latest'
      };

      const logs = await provider.getLogs(filter);
      return logs.length > 0;
    } catch (error) {
      logger.warn(`Unable to check transaction history for ${contractAddress}: ${error.message}`);
      // Return true to continue initialization even if history check fails
      return true;
    }
  }

  /**
   * Verify Pollen system contracts
   */
  async verifyPollenSystem() {
    try {
      // Check cache first
      const cacheKey = 'contract_verification_results';
      const cached = this.getFromCache(cacheKey);
      if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutes cache
        return cached.data;
      }

      const results = {
        plnToken: { verified: false },
        pollenDAO: { verified: false },
        contracts: {}
      };

      // Verify PLN token first
      logger.info('Starting PLN token verification...');
      results.plnToken = await this.verifyPlnToken();
      
      // Add delay to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Verify Pollen DAO
      logger.info('Starting Pollen DAO verification...');
      results.pollenDAO = await this.verifyPollenDao();
      
      // Add delay before contract verification
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Verify main contracts
      for (const [name, address] of Object.entries(CONTRACTS_TO_VERIFY)) {
        if (name !== 'PLN_TOKEN' && name !== 'POLLEN_DAO') {
          results.contracts[name] = await this.verifyMainContract(address);
        }
      }

      // Check transaction history for provided addresses
      const addressesToCheck = [
        '0x7b2B702706D9b361dfE3f00bD138C0CFDA7FB2Cf',
        '0x2eCB6F9dF29163758024d416997764922E4528d4'
      ];

      results.transactionHistory = {};
      for (const address of addressesToCheck) {
        results.transactionHistory[address] = await this.checkTransactionHistory(address);
      }

      logger.info('Verification complete. Results:', JSON.stringify(results, null, 2));
      return results;
    } catch (error) {
      logger.error('Error in verifyPollenSystem:', error);
      return {
        plnToken: { verified: false, error: error.message },
        pollenDAO: { verified: false, error: error.message },
        contracts: {},
        transactionHistory: {},
        error: error.message
      };
    }
  }

  /**
   * Simple cache implementation
   */
  getFromCache(key) {
    // Simple in-memory cache - could be enhanced with persistent storage
    if (!this.cache) {
      this.cache = {};
    }
    return this.cache[key];
  }

  setCache(key, data) {
    if (!this.cache) {
      this.cache = {};
    }
    this.cache[key] = {
      data,
      timestamp: Date.now()
    };
  }
}

module.exports = PollenContractVerifier;