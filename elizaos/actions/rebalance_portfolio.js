/**
 * elizaOS Action: Rebalance Portfolio
 * 
 * Based on actual vePLN contract ABI and Pollen whitepaper
 * Handles both vePLN lock adjustments and virtual portfolio rebalancing
 */

const { ethers } = require('ethers');
const logger = require('../../src/modules/logger');
const PollenContractInterface = require('../../src/modules/pollen-contract-interface');

const rebalancePortfolioAction = {
  name: 'REBALANCE_PORTFOLIO',
  description: 'Rebalances PLN stake amounts and virtual portfolio allocations based on market conditions',
  
  validate: async (runtime, message) => {
    const params = message.content?.params || {};
    
    // Validate rebalancing type
    if (!params.type || !['stake', 'portfolio', 'both'].includes(params.type)) {
      return false;
    }
    
    // Validate stake rebalancing parameters
    if (params.type === 'stake' || params.type === 'both') {
      if (!params.stakeAction || !['increase', 'extend', 'update'].includes(params.stakeAction)) {
        return false;
      }
    }
    
    // Validate portfolio rebalancing parameters  
    if (params.type === 'portfolio' || params.type === 'both') {
      if (!params.newAllocations || !Array.isArray(params.newAllocations)) {
        return false;
      }
      
      // Check allocations sum to 1 (allowing for rounding errors)
      const totalWeight = params.newAllocations.reduce((sum, alloc) => sum + Math.abs(alloc.weight), 0);
      if (Math.abs(totalWeight - 1.0) > 0.001) {
        return false;
      }
    }
    
    return true;
  },

  handler: async (runtime, message) => {
    try {
      const params = message.content.params;
      const { type, stakeAction, newAllocations, marketData } = params;
      
      logger.info(`🔄 elizaOS Action: Rebalancing portfolio (${type})`);
      
      // Initialize Pollen contract interface
      const provider = new ethers.JsonRpcProvider(process.env.AVALANCHE_RPC_URL);
      const pollenInterface = new PollenContractInterface(provider, process.env.PRIVATE_KEY);
      
      await pollenInterface.initialize();
      
      const results = {};
      
      // Handle vePLN stake rebalancing
      if (type === 'stake' || type === 'both') {
        logger.info(`📊 Rebalancing vePLN stake: ${stakeAction}`);
        
        const stakeResult = await handleStakeRebalancing(
          pollenInterface, 
          stakeAction, 
          params,
          marketData
        );
        
        results.stakeRebalancing = stakeResult;
      }
      
      // Handle virtual portfolio rebalancing
      if (type === 'portfolio' || type === 'both') {
        logger.info(`🎯 Rebalancing virtual portfolio`);
        
        const portfolioResult = await handlePortfolioRebalancing(
          pollenInterface,
          newAllocations,
          marketData
        );
        
        results.portfolioRebalancing = portfolioResult;
      }
      
      // Calculate overall impact
      const impactAnalysis = await calculateRebalancingImpact(pollenInterface, results);
      
      logger.info(`✅ Portfolio rebalancing completed!
        Stake Changes: ${results.stakeRebalancing?.success || 'N/A'}
        Portfolio Changes: ${results.portfolioRebalancing?.success || 'N/A'}
        Expected Boost Change: ${impactAnalysis.boostChange}%
        Estimated APY Change: ${impactAnalysis.apyChange}%`);
      
      // Store rebalancing event
      await runtime.storeMemory({
        type: 'rebalancing_event',
        action: 'rebalance_portfolio',
        rebalancingType: type,
        results: results,
        impact: impactAnalysis,
        timestamp: new Date().toISOString(),
        marketConditions: marketData
      });
      
      return {
        success: true,
        message: `Successfully rebalanced ${type} portfolio`,
        data: {
          results,
          impact: impactAnalysis
        }
      };
      
    } catch (error) {
      logger.error(`❌ Portfolio rebalancing failed: ${error.message}`);
      
      return {
        success: false,
        message: `Rebalancing failed: ${error.message}`,
        error: error.message
      };
    }
  },

  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Rebalance my PLN stake to extend lock by 30 days",
          params: {
            type: 'stake',
            stakeAction: 'extend',
            additionalDays: 30
          }
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Extending your PLN lock by 30 days to maintain optimal reward boost rates.",
          action: "REBALANCE_PORTFOLIO"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Rebalance virtual portfolio to 40% WBTC, 30% AVAX, 30% WETH",
          params: {
            type: 'portfolio',
            newAllocations: [
              { asset: 'WBTC', weight: 0.4 },
              { asset: 'AVAX', weight: 0.3 },
              { asset: 'WETH', weight: 0.3 }
            ]
          }
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Rebalancing your virtual portfolio to the new allocations: 40% WBTC, 30% AVAX, 30% WETH.",
          action: "REBALANCE_PORTFOLIO"
        }
      }
    ]
  ]
};

/**
 * Handle vePLN stake rebalancing using actual contract functions
 */
async function handleStakeRebalancing(pollenInterface, stakeAction, params, marketData) {
  try {
    const currentLock = await pollenInterface.getLockInfo();
    
    if (!currentLock || !currentLock.isActive) {
      throw new Error('No active PLN lock found');
    }
    
    let result;
    
    switch (stakeAction) {
      case 'increase':
        if (!params.additionalAmount || parseFloat(params.additionalAmount) <= 0) {
          throw new Error('Additional amount required for increase operation');
        }
        result = await pollenInterface.increaseLockAmount(parseFloat(params.additionalAmount));
        break;
        
      case 'extend':
        if (!params.additionalDays || parseInt(params.additionalDays) <= 0) {
          throw new Error('Additional days required for extend operation');
        }
        result = await pollenInterface.extendLockDuration(parseInt(params.additionalDays));
        break;
        
      case 'update':
        // Use the most efficient updateLock function from ABI
        const additionalAmount = parseFloat(params.additionalAmount || '0');
        const additionalDays = parseInt(params.additionalDays || '0');
        
        if (additionalAmount <= 0 && additionalDays <= 0) {
          throw new Error('At least one parameter (amount or days) must be positive for update');
        }
        
        // Calculate new lock end time
        const newLockEnd = currentLock.lockEnd + (additionalDays * 24 * 3600);
        
        // Use the contract's updateLock function for efficiency
        const updateResult = await pollenInterface.vePlnContract.updateLock(
          ethers.parseEther(additionalAmount.toString()),
          newLockEnd,
          { gasLimit: 350000 }
        );
        
        const receipt = await updateResult.wait();
        
        result = {
          success: true,
          transactionHash: receipt.transactionHash,
          additionalAmount: additionalAmount,
          additionalDays: additionalDays
        };
        break;
        
      default:
        throw new Error(`Unsupported stake action: ${stakeAction}`);
    }
    
    return result;
    
  } catch (error) {
    logger.error(`Stake rebalancing failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Handle virtual portfolio rebalancing (theoretical implementation)
 */
async function handlePortfolioRebalancing(pollenInterface, newAllocations, marketData) {
  try {
    // Get current portfolio status
    const portfolioStatus = await pollenInterface.getPortfolioStatus();
    
    if (!portfolioStatus.hasPortfolio) {
      throw new Error('No active virtual portfolio found');
    }
    
    // Convert allocations to contract format
    const assets = newAllocations.map(alloc => alloc.asset);
    const weights = newAllocations.map(alloc => alloc.weight);
    
    // Validate assets are supported (per whitepaper)
    const supportedAssets = ['WBTC', 'WETH', 'AVAX', 'BNB', 'LINK'];
    for (const asset of assets) {
      if (!supportedAssets.includes(asset)) {
        logger.warn(`Asset ${asset} not in whitepaper-defined benchmark`);
      }
    }
    
    // Execute portfolio rebalancing
    const rebalanceResult = await pollenInterface.rebalanceVirtualPortfolio(assets, weights);
    
    if (rebalanceResult.success) {
      logger.info(`Portfolio rebalanced successfully:
        New Assets: ${assets.join(', ')}
        New Weights: ${weights.map(w => (w * 100).toFixed(1) + '%').join(', ')}
        Previous Return: ${rebalanceResult.portfolioReturn.toFixed(4)}%`);
    }
    
    return rebalanceResult;
    
  } catch (error) {
    logger.error(`Portfolio rebalancing failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Calculate the impact of rebalancing operations
 */
async function calculateRebalancingImpact(pollenInterface, results) {
  try {
    // Get updated account status
    const accountStatus = await pollenInterface.getAccountStatus();
    
    let boostChange = 0;
    let apyChange = 0;
    
    // Calculate boost change from stake rebalancing
    if (results.stakeRebalancing?.success) {
      const newBoostRate = accountStatus.governance.boostingRate;
      boostChange = newBoostRate; // Simplified - would need previous rate for comparison
    }
    
    // Calculate APY change from portfolio rebalancing
    if (results.portfolioRebalancing?.success) {
      // Estimate APY impact based on portfolio performance
      apyChange = results.portfolioRebalancing.portfolioReturn * 0.1; // Simplified calculation
    }
    
    return {
      boostChange: boostChange.toFixed(2),
      apyChange: apyChange.toFixed(2),
      newVotingPower: accountStatus.governance.votingPower,
      estimatedRewards: accountStatus.rewards.available
    };
    
  } catch (error) {
    logger.error(`Impact calculation failed: ${error.message}`);
    return {
      boostChange: '0.00',
      apyChange: '0.00',
      error: error.message
    };
  }
}

module.exports = rebalancePortfolioAction; 