
#!/usr/bin/env node

const { ethers } = require('ethers');
const axios = require('axios');
const logger = require('./modules/logger');

// Avalanche mainnet configuration
const AVALANCHE_RPC = 'https://avalanche-mainnet.infura.io/v3/60755064a92543a1ac7aaf4e20b71cdf';
const AVASCAN_API = 'https://api.avascan.info';

// Contract addresses
const CONTRACTS = {
  PLN_TOKEN: '0x7b2B702706D9b361dfE3f00bD138C0CFDA7FB2Cf',
  POLLEN_MAIN: '0x2eCB6F9dF29163758024d416997764922E4528d4',
  POLLEN_DAO: '0x8B312F4503790CBd1030b97C545c7F3eFDaDE717'
};

// Wallets to analyze
const BOT_WALLETS = [
  '0x48B2353954496679CF7C73d239bc12098cB0C5B4',
  '0xf2c312F97c099f9d79bc3Ce058308923A02A3eeA',
  '0x43f76157E9696302E287181828cB3B0C6B89d31e',
  '0xC02764913ce2F23B094F0338a711EFD984024A46',
  '0x00FfF703fa6837A1a46b3DF9B6a047404046379E'
];

const MAIN_WALLET = '0x561529036AB886c1FD3D112360383D79fBA9E71c';

class WalletAnalyzer {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(AVALANCHE_RPC);
    this.plnTokenContract = new ethers.Contract(
      CONTRACTS.PLN_TOKEN,
      [
        "function balanceOf(address) view returns (uint256)",
        "function decimals() view returns (uint8)",
        "function symbol() view returns (string)"
      ],
      this.provider
    );
  }

  /**
   * Get AVAX balance for a wallet
   */
  async getAvaxBalance(address) {
    try {
      const balance = await this.provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      logger.error(`Error getting AVAX balance for ${address}:`, error.message);
      return '0';
    }
  }

  /**
   * Get PLN token balance for a wallet
   */
  async getPlnBalance(address) {
    try {
      const balance = await this.plnTokenContract.balanceOf(address);
      return ethers.formatEther(balance);
    } catch (error) {
      logger.error(`Error getting PLN balance for ${address}:`, error.message);
      return '0';
    }
  }

  /**
   * Get transaction history using Avascan API
   */
  async getTransactionHistory(address, limit = 100) {
    try {
      // Using free Avascan API endpoints
      const response = await axios.get(`${AVASCAN_API}/v1/account/${address}/transactions`, {
        params: {
          limit: limit,
          sort: 'timestamp:desc'
        },
        timeout: 10000
      });

      if (response.data && response.data.transactions) {
        return response.data.transactions;
      }

      // Fallback: Use direct RPC calls to get recent transactions
      return await this.getRecentTransactionsRPC(address);
    } catch (error) {
      logger.warn(`Avascan API failed for ${address}, using RPC fallback:`, error.message);
      return await this.getRecentTransactionsRPC(address);
    }
  }

  /**
   * Fallback method to get recent transactions using RPC
   */
  async getRecentTransactionsRPC(address) {
    try {
      const currentBlock = await this.provider.getBlockNumber();
      const transactions = [];
      
      // Check last 1000 blocks for transactions
      for (let i = 0; i < 1000; i++) {
        const blockNumber = currentBlock - i;
        const block = await this.provider.getBlock(blockNumber, true);
        
        if (block && block.transactions) {
          const userTxs = block.transactions.filter(tx => 
            tx.from?.toLowerCase() === address.toLowerCase() || 
            tx.to?.toLowerCase() === address.toLowerCase()
          );
          
          userTxs.forEach(tx => {
            transactions.push({
              hash: tx.hash,
              blockNumber: blockNumber,
              from: tx.from,
              to: tx.to,
              value: ethers.formatEther(tx.value || '0'),
              gasUsed: tx.gasLimit?.toString() || '0',
              timestamp: new Date().toISOString() // Approximate
            });
          });
        }
        
        if (transactions.length >= 50) break; // Limit results
      }
      
      return transactions;
    } catch (error) {
      logger.error(`Error getting RPC transactions for ${address}:`, error.message);
      return [];
    }
  }

  /**
   * Analyze Pollen-specific interactions
   */
  async analyzePollenInteractions(address) {
    try {
      const interactions = {
        plnTransfers: 0,
        pollenContractCalls: 0,
        totalVolume: '0',
        lastActivity: null
      };

      // Get PLN transfer events
      const plnTransferEvents = await this.provider.getLogs({
        address: CONTRACTS.PLN_TOKEN,
        topics: [
          ethers.id("Transfer(address,address,uint256)"),
          null, // from (any)
          ethers.zeroPadValue(address, 32) // to this address
        ],
        fromBlock: -10000, // Last ~10k blocks
        toBlock: 'latest'
      });

      interactions.plnTransfers = plnTransferEvents.length;

      // Check interactions with main Pollen contract
      const pollenLogs = await this.provider.getLogs({
        address: CONTRACTS.POLLEN_MAIN,
        topics: [null], // Any event
        fromBlock: -5000,
        toBlock: 'latest'
      });

      // Filter logs where this address is involved
      interactions.pollenContractCalls = pollenLogs.filter(log => 
        log.topics.some(topic => 
          topic.toLowerCase().includes(address.slice(2).toLowerCase())
        )
      ).length;

      if (plnTransferEvents.length > 0) {
        const latestEvent = plnTransferEvents[plnTransferEvents.length - 1];
        const block = await this.provider.getBlock(latestEvent.blockNumber);
        interactions.lastActivity = new Date(block.timestamp * 1000).toISOString();
      }

      return interactions;
    } catch (error) {
      logger.error(`Error analyzing Pollen interactions for ${address}:`, error.message);
      return {
        plnTransfers: 0,
        pollenContractCalls: 0,
        totalVolume: '0',
        lastActivity: null
      };
    }
  }

  /**
   * Comprehensive wallet analysis
   */
  async analyzeWallet(address, isMainWallet = false) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`ANALYZING ${isMainWallet ? 'MAIN WALLET' : 'BOT WALLET'}: ${address}`);
    console.log(`${'='.repeat(60)}`);

    const analysis = {
      address,
      type: isMainWallet ? 'main' : 'bot',
      balances: {},
      transactions: {},
      pollenActivity: {},
      riskAssessment: {},
      recommendations: []
    };

    try {
      // Get balances
      console.log('📊 Fetching balances...');
      analysis.balances.avax = await this.getAvaxBalance(address);
      analysis.balances.pln = await this.getPlnBalance(address);

      console.log(`AVAX Balance: ${analysis.balances.avax} AVAX`);
      console.log(`PLN Balance: ${analysis.balances.pln} PLN`);

      // Get transaction history
      console.log('📈 Analyzing transaction history...');
      const txHistory = await this.getTransactionHistory(address);
      analysis.transactions.total = txHistory.length;
      analysis.transactions.recent = txHistory.slice(0, 10);

      // Calculate transaction volume
      const totalVolume = txHistory.reduce((sum, tx) => {
        return sum + parseFloat(tx.value || 0);
      }, 0);
      analysis.transactions.totalVolume = totalVolume.toFixed(4);

      console.log(`Total Transactions: ${analysis.transactions.total}`);
      console.log(`Total Volume: ${analysis.transactions.totalVolume} AVAX`);

      // Analyze Pollen-specific activity
      console.log('🌺 Analyzing Pollen ecosystem interactions...');
      analysis.pollenActivity = await this.analyzePollenInteractions(address);

      console.log(`PLN Transfers: ${analysis.pollenActivity.plnTransfers}`);
      console.log(`Pollen Contract Calls: ${analysis.pollenActivity.pollenContractCalls}`);
      console.log(`Last Activity: ${analysis.pollenActivity.lastActivity || 'None detected'}`);

      // Risk assessment
      analysis.riskAssessment = this.assessRisk(analysis);
      console.log(`Risk Level: ${analysis.riskAssessment.level}`);

      // Generate recommendations
      analysis.recommendations = this.generateRecommendations(analysis, isMainWallet);
      console.log('💡 Recommendations:');
      analysis.recommendations.forEach(rec => console.log(`  • ${rec}`));

      return analysis;
    } catch (error) {
      console.error(`❌ Error analyzing wallet ${address}:`, error.message);
      analysis.error = error.message;
      return analysis;
    }
  }

  /**
   * Assess risk level for a wallet
   */
  assessRisk(analysis) {
    let riskScore = 0;
    const factors = [];

    // Low balance risk
    if (parseFloat(analysis.balances.avax) < 0.1) {
      riskScore += 3;
      factors.push('Low AVAX balance for gas fees');
    }

    // No PLN tokens
    if (parseFloat(analysis.balances.pln) === 0) {
      riskScore += 2;
      factors.push('No PLN tokens for trading');
    }

    // Low activity
    if (analysis.transactions.total < 10) {
      riskScore += 2;
      factors.push('Low transaction activity');
    }

    // No Pollen interactions
    if (analysis.pollenActivity.plnTransfers === 0) {
      riskScore += 3;
      factors.push('No Pollen ecosystem interactions detected');
    }

    let level;
    if (riskScore >= 7) level = 'HIGH';
    else if (riskScore >= 4) level = 'MEDIUM';
    else level = 'LOW';

    return { level, score: riskScore, factors };
  }

  /**
   * Generate recommendations for wallet optimization
   */
  generateRecommendations(analysis, isMainWallet) {
    const recommendations = [];

    if (parseFloat(analysis.balances.avax) < 0.1) {
      recommendations.push('Fund wallet with at least 1 AVAX for gas fees');
    }

    if (parseFloat(analysis.balances.pln) === 0) {
      if (isMainWallet) {
        recommendations.push('Acquire PLN tokens to enable trading functionality');
      } else {
        recommendations.push('Transfer PLN tokens from main wallet for bot operations');
      }
    }

    if (analysis.transactions.total < 10) {
      recommendations.push('Increase wallet activity to establish transaction history');
    }

    if (analysis.pollenActivity.plnTransfers === 0) {
      recommendations.push('Begin interacting with Pollen ecosystem contracts');
    }

    if (analysis.pollenActivity.pollenContractCalls === 0) {
      recommendations.push('Test Pollen platform integration with small transactions');
    }

    return recommendations;
  }

  /**
   * Generate comprehensive trading bot assessment
   */
  generateBotAssessment(analyses) {
    console.log(`\n${'='.repeat(80)}`);
    console.log('🤖 COMPREHENSIVE TRADING BOT ASSESSMENT');
    console.log(`${'='.repeat(80)}`);

    const assessment = {
      totalWallets: analyses.length,
      activeWallets: 0,
      totalFunds: { avax: 0, pln: 0 },
      overallRisk: 'LOW',
      criticalIssues: [],
      recommendations: []
    };

    // Analyze all wallets
    analyses.forEach(analysis => {
      if (analysis.transactions && analysis.transactions.total > 0) {
        assessment.activeWallets++;
      }

      if (analysis.balances) {
        assessment.totalFunds.avax += parseFloat(analysis.balances.avax || 0);
        assessment.totalFunds.pln += parseFloat(analysis.balances.pln || 0);
      }

      if (analysis.riskAssessment && analysis.riskAssessment.level === 'HIGH') {
        assessment.overallRisk = 'HIGH';
      } else if (analysis.riskAssessment && analysis.riskAssessment.level === 'MEDIUM' && assessment.overallRisk !== 'HIGH') {
        assessment.overallRisk = 'MEDIUM';
      }
    });

    // Critical issues
    if (assessment.totalFunds.pln === 0) {
      assessment.criticalIssues.push('❌ NO PLN TOKENS: Bot cannot execute any trades');
    }

    if (assessment.totalFunds.avax < 0.5) {
      assessment.criticalIssues.push('⚠️ LOW GAS FUNDS: Insufficient AVAX for transaction fees');
    }

    if (assessment.activeWallets === 0) {
      assessment.criticalIssues.push('❌ NO ACTIVE WALLETS: No transaction history detected');
    }

    // Recommendations
    if (assessment.totalFunds.pln === 0) {
      assessment.recommendations.push('🔥 URGENT: Fund main wallet with PLN tokens immediately');
    }

    if (assessment.totalFunds.avax < 1) {
      assessment.recommendations.push('💰 Fund wallets with additional AVAX for gas fees');
    }

    assessment.recommendations.push('🔧 Configure bot to use funded wallets for trading operations');
    assessment.recommendations.push('📊 Set up monitoring for wallet balances and trading activity');

    // Display results
    console.log(`Total Wallets Analyzed: ${assessment.totalWallets}`);
    console.log(`Active Wallets: ${assessment.activeWallets}`);
    console.log(`Total AVAX: ${assessment.totalFunds.avax.toFixed(4)} AVAX`);
    console.log(`Total PLN: ${assessment.totalFunds.pln.toFixed(4)} PLN`);
    console.log(`Overall Risk Level: ${assessment.overallRisk}`);

    console.log('\n🚨 CRITICAL ISSUES:');
    assessment.criticalIssues.forEach(issue => console.log(`  ${issue}`));

    console.log('\n✅ RECOMMENDATIONS:');
    assessment.recommendations.forEach(rec => console.log(`  ${rec}`));

    return assessment;
  }

  /**
   * Main analysis function
   */
  async runCompleteAnalysis() {
    console.log('🔍 STARTING COMPREHENSIVE WALLET ANALYSIS FOR POLLEN TRADING BOT');
    console.log('=' .repeat(80));

    const analyses = [];

    // Analyze main wallet first
    const mainWalletAnalysis = await this.analyzeWallet(MAIN_WALLET, true);
    analyses.push(mainWalletAnalysis);

    // Analyze bot wallets
    for (const botWallet of BOT_WALLETS) {
      const analysis = await this.analyzeWallet(botWallet, false);
      analyses.push(analysis);
      
      // Brief pause between analyses
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Generate comprehensive assessment
    const assessment = this.generateBotAssessment(analyses);

    // Save results
    const results = {
      timestamp: new Date().toISOString(),
      analyses,
      assessment,
      summary: {
        analysisComplete: true,
        walletsAnalyzed: analyses.length,
        criticalIssuesFound: assessment.criticalIssues.length,
        recommendationsGenerated: assessment.recommendations.length
      }
    };

    // Write results to file
    const fs = require('fs');
    fs.writeFileSync('wallet_analysis_results.json', JSON.stringify(results, null, 2));
    
    console.log('\n💾 Analysis complete! Results saved to wallet_analysis_results.json');
    
    return results;
  }
}

// Execute analysis if run directly
if (require.main === module) {
  const analyzer = new WalletAnalyzer();
  analyzer.runCompleteAnalysis().catch(console.error);
}

module.exports = WalletAnalyzer;
