// Development overrides for the Pollen trading bot
module.exports = {
  // Skip balance checks during development
  skipBalanceCheck: true,
  
  // Enable development mode for more verbose logging
  developmentMode: true,
  
  // Reduce logging verbosity if needed
  logLevel: 'info',
  
  // Disable certain features that might cause issues in development
  features: {
    balanceChecks: false,
    gasPriceOptimization: true,
    transactionBatching: true
  },
  
  // Testing configuration
  testing: {
    mockResponses: true,
    skipContractVerification: true
  }
};
