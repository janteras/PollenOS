
#!/usr/bin/env node

const { ethers } = require('ethers');
const axios = require('axios');
const PollenContractVerifier = require('./modules/pollen-verification');
const logger = require('./modules/logger');

// Contract addresses to analyze
const POLLEN_CONTRACTS = {
  DAO: '0x8B312F4503790CBd1030b97C545c7F3eFDaDE717',
  VE_PLN: '0x2eCB6F9dF29163758024d416997764922E4528d4',
  PLN_TOKEN: '0x7b2B702706D9b361dfE3f00bD138C0CFDA7FB2Cf'
};

// Additional addresses mentioned in API calls
const ADDITIONAL_ADDRESSES = {
  UNKNOWN: '0xd4b705299A16E85Ba7eF7dfa5C2B318B973bBa7C'
};

class PollenContractAnalyzer {
  constructor() {
    this.provider = new ethers.JsonRpcProvider('https://avalanche-mainnet.infura.io/v3/60755064a92543a1ac7aaf4e20b71cdf');
    this.verifier = new PollenContractVerifier();
  }

  /**
   * Analyze contract deployment and basic info
   */
  async analyzeContractDeployment(address, name) {
    try {
      console.log(`\n=== Analyzing ${name} (${address}) ===`);
      
      const code = await this.provider.getCode(address);
      const codeSize = code.length;
      
      // Get current block for reference
      const currentBlock = await this.provider.getBlockNumber();
      
      // Try to find deployment transaction by checking early blocks
      let deploymentBlock = null;
      let deploymentTx = null;
      
      try {
        // Check for contract creation in recent history
        const recentLogs = await this.provider.getLogs({
          address: address,
          fromBlock: Math.max(0, currentBlock - 100000),
          toBlock: 'latest'
        });
        
        if (recentLogs.length > 0) {
          const earliestLog = recentLogs[recentLogs.length - 1];
          deploymentBlock = earliestLog.blockNumber;
        }
      } catch (e) {
        logger.warn(`Could not fetch deployment info for ${address}: ${e.message}`);
      }

      // Get transaction count (nonce) to understand activity
      const txCount = await this.provider.getTransactionCount(address);
      
      const result = {
        address,
        name,
        codeSize: `${Math.round(codeSize / 2)} bytes`,
        hasCode: code !== '0x',
        transactionCount: txCount,
        deploymentBlock,
        currentBlock,
        isContract: code !== '0x'
      };

      console.log(`Code Size: ${result.codeSize}`);
      console.log(`Has Contract Code: ${result.hasCode ? '✅' : '❌'}`);
      console.log(`Transaction Count: ${result.transactionCount}`);
      console.log(`Deployment Block: ${result.deploymentBlock || 'Unknown'}`);

      return result;
    } catch (error) {
      console.error(`Error analyzing ${name}:`, error.message);
      return { address, name, error: error.message };
    }
  }

  /**
   * Test contract functions to determine main functionality
   */
  async testContractFunctions(address, name) {
    try {
      console.log(`\nTesting functions for ${name}...`);
      
      const functionTests = [];

      // Test DAO functions
      if (name === 'DAO') {
        const daoFunctions = [
          "function pollenToken() view returns (address)",
          "function addModule(address, bytes4[]) external",
          "function renounceAdminRole() external"
        ];
        
        const daoContract = new ethers.Contract(address, daoFunctions, this.provider);
        
        try {
          const pollenTokenAddr = await daoContract.pollenToken();
          functionTests.push({ function: 'pollenToken', result: pollenTokenAddr, status: 'success' });
          console.log(`✅ pollenToken(): ${pollenTokenAddr}`);
        } catch (e) {
          functionTests.push({ function: 'pollenToken', error: e.message, status: 'failed' });
          console.log(`❌ pollenToken(): ${e.message}`);
        }
      }

      // Test vePLN staking functions
      if (name === 'VE_PLN') {
        const vePlnFunctions = [
          "function name() view returns (string)",
          "function symbol() view returns (string)",
          "function totalSupply() view returns (uint256)",
          "function balanceOf(address) view returns (uint256)",
          "function locks(address) view returns (uint256, uint256, uint256, uint256, uint256)",
          "function totalLocked() view returns (uint256)"
        ];
        
        const vePlnContract = new ethers.Contract(address, vePlnFunctions, this.provider);
        
        try {
          const name = await vePlnContract.name();
          const symbol = await vePlnContract.symbol();
          const totalSupply = await vePlnContract.totalSupply();
          
          functionTests.push({ function: 'name', result: name, status: 'success' });
          functionTests.push({ function: 'symbol', result: symbol, status: 'success' });
          functionTests.push({ function: 'totalSupply', result: ethers.formatEther(totalSupply), status: 'success' });
          
          console.log(`✅ name(): ${name}`);
          console.log(`✅ symbol(): ${symbol}`);
          console.log(`✅ totalSupply(): ${ethers.formatEther(totalSupply)} tokens`);
          
          // Test totalLocked function
          try {
            const totalLocked = await vePlnContract.totalLocked();
            functionTests.push({ function: 'totalLocked', result: ethers.formatEther(totalLocked), status: 'success' });
            console.log(`✅ totalLocked(): ${ethers.formatEther(totalLocked)} PLN`);
          } catch (e) {
            functionTests.push({ function: 'totalLocked', error: e.message, status: 'failed' });
            console.log(`❌ totalLocked(): ${e.message}`);
          }
        } catch (e) {
          functionTests.push({ function: 'basic_erc20', error: e.message, status: 'failed' });
          console.log(`❌ Basic ERC20 functions: ${e.message}`);
        }
      }

      // Test PLN token functions
      if (name === 'PLN_TOKEN') {
        const plnFunctions = [
          "function name() view returns (string)",
          "function symbol() view returns (string)",
          "function decimals() view returns (uint8)",
          "function totalSupply() view returns (uint256)"
        ];
        
        const plnContract = new ethers.Contract(address, plnFunctions, this.provider);
        
        try {
          const name = await plnContract.name();
          const symbol = await plnContract.symbol();
          const decimals = await plnContract.decimals();
          const totalSupply = await plnContract.totalSupply();
          
          functionTests.push({ function: 'name', result: name, status: 'success' });
          functionTests.push({ function: 'symbol', result: symbol, status: 'success' });
          functionTests.push({ function: 'decimals', result: decimals.toString(), status: 'success' });
          functionTests.push({ function: 'totalSupply', result: ethers.formatEther(totalSupply), status: 'success' });
          
          console.log(`✅ name(): ${name}`);
          console.log(`✅ symbol(): ${symbol}`);
          console.log(`✅ decimals(): ${decimals}`);
          console.log(`✅ totalSupply(): ${ethers.formatEther(totalSupply)} ${symbol}`);
        } catch (e) {
          functionTests.push({ function: 'erc20_basic', error: e.message, status: 'failed' });
          console.log(`❌ ERC20 functions: ${e.message}`);
        }
      }

      return functionTests;
    } catch (error) {
      console.error(`Error testing functions for ${name}:`, error.message);
      return [{ error: error.message }];
    }
  }

  /**
   * Analyze transaction patterns
   */
  async analyzeTransactionPatterns(address, name) {
    try {
      console.log(`\nAnalyzing transaction patterns for ${name}...`);
      
      const currentBlock = await this.provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 10000); // Last ~10k blocks
      
      // Get events/logs
      const logs = await this.provider.getLogs({
        address: address,
        fromBlock: fromBlock,
        toBlock: 'latest'
      });

      // Analyze recent blocks for transactions TO this contract
      let incomingTxs = 0;
      const recentBlocks = 1000;
      
      for (let i = 0; i < Math.min(recentBlocks, 100); i++) {
        try {
          const blockNumber = currentBlock - i;
          const block = await this.provider.getBlock(blockNumber, true);
          
          if (block && block.transactions) {
            const contractTxs = block.transactions.filter(tx => 
              tx.to && tx.to.toLowerCase() === address.toLowerCase()
            );
            incomingTxs += contractTxs.length;
          }
        } catch (e) {
          // Skip if block fetch fails
          break;
        }
      }

      const result = {
        recentLogs: logs.length,
        recentIncomingTransactions: incomingTxs,
        blocksAnalyzed: Math.min(recentBlocks, 100),
        isActive: logs.length > 0 || incomingTxs > 0
      };

      console.log(`Recent Events/Logs: ${result.recentLogs}`);
      console.log(`Recent Incoming Transactions: ${result.recentIncomingTransactions}`);
      console.log(`Contract Activity: ${result.isActive ? '🟢 Active' : '🔴 Inactive'}`);

      return result;
    } catch (error) {
      console.error(`Error analyzing transaction patterns for ${name}:`, error.message);
      return { error: error.message };
    }
  }

  /**
   * Determine the main contract based on analysis
   */
  analyzeMainContract(analysisResults) {
    console.log(`\n=== DETERMINING MAIN POLLEN CONTRACT ===`);
    
    let scores = {};
    
    Object.entries(analysisResults).forEach(([contractName, data]) => {
      let score = 0;
      
      // Score based on code size (larger contracts typically have more functionality)
      if (data.deployment && data.deployment.codeSize) {
        const codeBytes = parseInt(data.deployment.codeSize);
        if (codeBytes > 10000) score += 3;
        else if (codeBytes > 5000) score += 2;
        else if (codeBytes > 1000) score += 1;
      }
      
      // Score based on successful function calls
      if (data.functions) {
        const successfulCalls = data.functions.filter(f => f.status === 'success').length;
        score += successfulCalls * 2;
      }
      
      // Score based on activity
      if (data.transactions) {
        if (data.transactions.isActive) score += 2;
        if (data.transactions.recentLogs > 10) score += 2;
        if (data.transactions.recentIncomingTransactions > 5) score += 1;
      }
      
      // Bonus for specific contract types
      if (contractName === 'VE_PLN') {
        // vePLN is likely the main staking/governance contract
        score += 3;
      } else if (contractName === 'DAO') {
        // DAO is governance but may be lighter
        score += 2;
      } else if (contractName === 'PLN_TOKEN') {
        // Token is important but simpler
        score += 1;
      }
      
      scores[contractName] = score;
    });

    // Determine winner
    const sortedScores = Object.entries(scores).sort(([,a], [,b]) => b - a);
    const winner = sortedScores[0];
    
    console.log('\n📊 SCORING RESULTS:');
    sortedScores.forEach(([name, score]) => {
      console.log(`${name}: ${score} points`);
    });
    
    console.log(`\n🏆 MAIN CONTRACT: ${winner[0]} with ${winner[1]} points`);
    console.log(`Address: ${POLLEN_CONTRACTS[winner[0]]}`);
    
    return {
      mainContract: winner[0],
      address: POLLEN_CONTRACTS[winner[0]],
      score: winner[1],
      allScores: Object.fromEntries(sortedScores)
    };
  }

  /**
   * Generate comprehensive summary
   */
  generateSummary(analysisResults, mainContractResult) {
    console.log(`\n=== COMPREHENSIVE POLLEN ECOSYSTEM ANALYSIS ===`);
    
    const summary = {
      ecosystem: 'Pollen Protocol on Avalanche',
      mainContract: {
        name: mainContractResult.mainContract,
        address: mainContractResult.address,
        purpose: this.getContractPurpose(mainContractResult.mainContract)
      },
      contracts: {},
      recommendations: []
    };

    // Summarize each contract
    Object.entries(analysisResults).forEach(([name, data]) => {
      summary.contracts[name] = {
        address: POLLEN_CONTRACTS[name],
        purpose: this.getContractPurpose(name),
        status: data.deployment?.hasCode ? 'Deployed' : 'Not Found',
        activity: data.transactions?.isActive ? 'Active' : 'Inactive',
        functionsWorking: data.functions?.filter(f => f.status === 'success').length || 0
      };
    });

    // Generate recommendations
    if (mainContractResult.mainContract === 'VE_PLN') {
      summary.recommendations.push('vePLN appears to be the main staking contract - focus integration efforts here');
      summary.recommendations.push('This contract handles PLN token locking and voting power distribution');
    }
    
    if (summary.contracts.DAO.functionsWorking > 0) {
      summary.recommendations.push('DAO contract is functional - can be used for governance operations');
    }
    
    if (summary.contracts.PLN_TOKEN.status === 'Deployed') {
      summary.recommendations.push('PLN token contract is active and can be used for balance checks and transfers');
    }

    console.log('\n📋 FINAL SUMMARY:');
    console.log(`Main Contract: ${summary.mainContract.name} (${summary.mainContract.address})`);
    console.log(`Purpose: ${summary.mainContract.purpose}`);
    console.log('\nContract Status:');
    Object.entries(summary.contracts).forEach(([name, info]) => {
      console.log(`  ${name}: ${info.status} | ${info.activity} | ${info.functionsWorking} working functions`);
    });
    console.log('\nRecommendations:');
    summary.recommendations.forEach(rec => console.log(`  • ${rec}`));

    return summary;
  }

  getContractPurpose(contractName) {
    const purposes = {
      'DAO': 'Governance and protocol management through modular architecture',
      'VE_PLN': 'Vote-escrowed PLN staking contract for governance and rewards',
      'PLN_TOKEN': 'Main PLN token for the Pollen ecosystem',
      'UNKNOWN': 'Unidentified contract requiring further investigation'
    };
    return purposes[contractName] || 'Unknown purpose';
  }

  /**
   * Main analysis function
   */
  async runCompleteAnalysis() {
    console.log('🔍 Starting Comprehensive Pollen Contract Analysis...\n');
    
    const results = {};
    
    // Analyze each known contract
    for (const [name, address] of Object.entries(POLLEN_CONTRACTS)) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`ANALYZING ${name.toUpperCase()}`);
      console.log(`${'='.repeat(60)}`);
      
      results[name] = {
        deployment: await this.analyzeContractDeployment(address, name),
        functions: await this.testContractFunctions(address, name),
        transactions: await this.analyzeTransactionPatterns(address, name)
      };
      
      // Brief pause between analyses
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Determine main contract
    const mainContractResult = this.analyzeMainContract(results);
    
    // Generate final summary
    const summary = this.generateSummary(results, mainContractResult);
    
    return {
      analysisResults: results,
      mainContract: mainContractResult,
      summary: summary
    };
  }
}

// Main execution
async function main() {
  try {
    const analyzer = new PollenContractAnalyzer();
    const results = await analyzer.runCompleteAnalysis();
    
    // Save results to file for future reference
    const fs = require('fs');
    fs.writeFileSync('pollen_analysis_results.json', JSON.stringify(results, null, 2));
    console.log('\n💾 Results saved to pollen_analysis_results.json');
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = PollenContractAnalyzer;
