require('dotenv').config({ path: require('path').resolve(__dirname, '.wallets') });
const { ethers } = require('ethers');

// Configuration
const CONFIG = {
  RPC_URL: 'https://sepolia.base.org',
  CHAIN_ID: 84532,
  CONTRACTS: {
    PLN: '0x9E1c51E1fAa1381D8a7Dbdd19402c5fCce9274C6',
    PORTFOLIO: '0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7',
  },
  WALLETS: [
    process.env.PRIVATE_KEY_1,
    process.env.PRIVATE_KEY_2,
    process.env.PRIVATE_KEY_3,
    process.env.PRIVATE_KEY_4,
    process.env.PRIVATE_KEY_5
  ].filter(Boolean)
};

// Contract ABIs
const PORTFOLIO_ABI = [
  'function depositPLN(uint256 amount, address recipient)',
  'function createPortfolio(uint256 amount, uint256[] calldata weights, bool[] calldata isShort, bool tokenType)', 
  'function getPortfolio(address user, address token) view returns (uint256[] memory, uint256, uint256, uint256, bool, uint256, uint256, bool[] memory)',
  'function getPortfolioValue(address user, address token) view returns (uint256)',
  'function getPortfolioWeights(address user, address token) view returns (uint256[] memory)',
  'function getPortfolioIsShort(address user, address token) view returns (bool[] memory)',
  'event PortfolioCreated(address indexed user, address indexed token, uint256 amount, uint256[] weights, bool[] isShort, bool tokenType)',
  'event Deposit(address indexed user, address indexed token, uint256 amount, uint256 timestamp)'
];

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address, address) view returns (uint256)',
  'function approve(address, uint256) returns (bool)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'event Transfer(address indexed from, address indexed to, uint256 value)'
];

// Enhanced logger with colors
const logger = {
  info: (message, data = '') => console.log(`ℹ️  ${message}`, data),
  success: (message) => console.log(`✅ ${message}`),
  error: (message, error = '') => console.error(`❌ ${message}`, error),
  warning: (message) => console.log(`⚠️  ${message}`),
  section: (title) => console.log(`\n📌 ${title}\n`),
  divider: () => console.log('\n' + '='.repeat(80) + '\n')
};

class EnhancedPortfolioTester {
  constructor(privateKey, provider) {
    this.wallet = new ethers.Wallet(privateKey, provider);
    this.plnToken = new ethers.Contract(CONFIG.CONTRACTS.PLN, ERC20_ABI, this.wallet);
    this.portfolio = new ethers.Contract(CONFIG.CONTRACTS.PORTFOLIO, PORTFOLIO_ABI, this.wallet);
    this.plnDecimals = null;
  }

  async initialize() {
    this.plnDecimals = await this.plnToken.decimals();
    logger.info(`Initialized tester for wallet: ${this.wallet.address}`);
    return this;
  }

  async getDetailedPortfolioInfo() {
    try {
      // First check if portfolio exists using a simpler call
      let portfolioData;
      try {
        portfolioData = await this.portfolio.getPortfolio(this.wallet.address, ethers.constants.AddressZero);
      } catch (error) {
        if (error.reason === 'Portfolio does not exist') {
          return { exists: false };
        }
        throw error;
      }
      
      // Try to get portfolio value, but handle if the function doesn't exist
      let portfolioValue = '0';
      try {
        const value = await this.portfolio.getPortfolioValue(this.wallet.address, ethers.constants.AddressZero);
        portfolioValue = ethers.utils.formatUnits(value, this.plnDecimals);
      } catch (error) {
        logger.warning('getPortfolioValue not available, using default value');
        // Try to get value from portfolio data if available
        if (portfolioData && portfolioData[1]) {
          portfolioValue = ethers.utils.formatUnits(portfolioData[1], this.plnDecimals);
        }
      }

      return {
        exists: true,
        isActive: portfolioData[4],
        totalValue: portfolioValue,
        weights: portfolioData[0].map(w => w.toString()),
        isShort: portfolioData[7] || [],
        timestamp: portfolioData[6] ? new Date(Number(portfolioData[6]) * 1000).toISOString() : 'N/A',
        rawData: portfolioData
      };
    } catch (error) {
      if (error.reason === 'Portfolio does not exist') {
        return { exists: false };
      }
      throw error;
    }
  }

  async checkBalances() {
    const [ethBalance, plnBalance] = await Promise.all([
      this.wallet.getBalance(),
      this.plnToken.balanceOf(this.wallet.address)
    ]);
    
    const balances = {
      ETH: ethers.utils.formatEther(ethBalance),
      PLN: ethers.utils.formatUnits(plnBalance, this.plnDecimals)
    };
    
    logger.info('Current Balances:', balances);
    return balances;
  }

  async testDeposit(amountPLN) {
    const amountWei = ethers.utils.parseUnits(amountPLN, this.plnDecimals);
    
    // 1. Check initial state
    logger.section('Initial State');
    await this.checkBalances();
    
    // Get initial portfolio state
    let initialPortfolio;
    try {
      initialPortfolio = await this.getDetailedPortfolioInfo();
      logger.info('Initial Portfolio:', {
        exists: initialPortfolio.exists,
        isActive: initialPortfolio.isActive,
        totalValue: initialPortfolio.totalValue,
        timestamp: initialPortfolio.timestamp || 'N/A'
      });
    } catch (error) {
      logger.warning('Could not get initial portfolio state:', error.message);
      initialPortfolio = { exists: false };
    }

    // 2. Approve tokens if needed
    const allowance = await this.plnToken.allowance(
      this.wallet.address,
      CONFIG.CONTRACTS.PORTFOLIO
    );

    if (allowance.lt(amountWei)) {
      logger.info('Approving tokens...');
      const approveTx = await this.plnToken.approve(
        CONFIG.CONTRACTS.PORTFOLIO,
        amountWei,
        { gasLimit: 200000 }
      );
      logger.info(`Approval tx: ${approveTx.hash}`);
      await approveTx.wait();
    }

    // 3. Make deposit
    logger.section('Making Deposit');
    const depositTx = await this.portfolio.depositPLN(
      amountWei,
      this.wallet.address,
      { gasLimit: 500000 }
    );
    logger.info(`Deposit tx: ${depositTx.hash}`);
    const receipt = await depositTx.wait();
    
    // 4. Check final state
    logger.section('Final State');
    await this.checkBalances();
    const finalPortfolio = await this.getDetailedPortfolioInfo();
    
    // 5. Verify deposit
    const depositEvent = receipt.events?.find(e => e.event === 'Deposit');
    const depositSuccessful = !!depositEvent;
    
    logger.info('Deposit Verification:', {
      blockNumber: receipt.blockNumber,
      depositSuccessful,
      depositAmount: depositEvent ? ethers.utils.formatUnits(depositEvent.args.amount, this.plnDecimals) + ' PLN' : 'N/A',
      newPortfolioValue: finalPortfolio.totalValue + ' PLN',
      portfolioUpdated: finalPortfolio.timestamp > initialPortfolio.timestamp
    });

    return {
      success: depositSuccessful,
      txHash: depositTx.hash,
      initialPortfolio,
      finalPortfolio,
      receipt
    };
  }
}

async function runEnhancedTest() {
  if (CONFIG.WALLETS.length === 0) {
    logger.error('No valid private keys found in .wallets file');
    process.exit(1);
  }

  const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL, {
    name: 'base-sepolia',
    chainId: CONFIG.CHAIN_ID,
  });

  logger.divider();
  logger.section('ENHANCED PORTFOLIO TESTING SUITE');
  logger.info(`Testing with ${CONFIG.WALLETS.length} wallets\n`);

  for (let i = 0; i < Math.min(2, CONFIG.WALLETS.length); i++) {
    const walletNum = i + 1;
    logger.divider();
    logger.section(`TESTING WALLET ${walletNum}`);
    
    try {
      const tester = await new EnhancedPortfolioTester(CONFIG.WALLETS[i], provider).initialize();
      
      // Test with a small amount first
      const testAmount = '0.1';
      logger.info(`Testing with ${testAmount} PLN`);
      
      const result = await tester.testDeposit(testAmount);
      
      if (result.success) {
        logger.success(`✅ Wallet ${walletNum} test completed successfully`);
        logger.info(`Transaction: https://sepolia.basescan.org/tx/${result.txHash}`);
        
        // Log detailed portfolio info
        const portfolio = await tester.getDetailedPortfolioInfo();
        logger.info('\n📊 Final Portfolio Details:', {
          totalValue: portfolio.totalValue + ' PLN',
          weights: portfolio.weights,
          isShort: portfolio.isShort,
          lastUpdated: portfolio.timestamp
        });
      } else {
        logger.warning(`⚠️  Wallet ${walletNum} test completed with issues`);
      }
      
    } catch (error) {
      logger.error(`❌ Error testing wallet ${walletNum}:`, error.message);
      if (error.transactionHash) {
        logger.error('Transaction hash:', error.transactionHash);
      }
    }
    
    // Add delay between wallet tests
    if (i < CONFIG.WALLETS.length - 1) {
      logger.info('\nWaiting 10 seconds before next wallet...');
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
  
  logger.divider();
  logger.section('TESTING COMPLETE');
  logger.info('Check the results above for any issues.\n');
}

// Run enhanced test
runEnhancedTest().catch(error => {
  logger.error('Fatal error in test:', error);
  process.exit(1);
});
