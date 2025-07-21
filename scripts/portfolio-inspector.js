require('dotenv').config({ path: require('path').resolve(__dirname, '.wallets') });
const { ethers } = require('ethers');
const { CONFIG } = require('./view-portfolio-details');
const readline = require('readline');

// Contract ABIs with events and state variables
const PORTFOLIO_ABI = [
  // Core functions
  'function depositPLN(uint256 amount, address recipient)',
  'function createPortfolio(uint256 amount, uint256[] calldata weights, bool[] calldata isShort, bool tokenType)',
  'function rebalance(address user, uint256[] calldata newWeights, bool[] calldata newIsShort) external',
  
  // View functions for portfolio state
  'function getPortfolio(address user, address token) view returns (uint256[] memory, uint256, uint256, uint256, bool, uint256, uint256, bool[] memory)',n  'function getPortfolioValue(address user, address token) view returns (uint256)',
  'function getPortfolioState(address user) view returns (uint256 totalValue, uint256 depositPLN, uint256 depositVePLN, uint256 withdrawn, bool isActive, uint256 timestamp, uint256 benchMarkRef, uint256 lastRebalanceTime)',
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function isPortfolioActive(address) view returns (bool)',
  'function getBenchmarkValue() view returns (uint256)',
  'function getLastRebalanceTime() view returns (uint256)',
  
  // Events
  'event PortfolioCreated(address indexed user, address indexed token, uint256 amount, uint256[] weights, bool[] isShort, bool tokenType)',
  'event Deposit(address indexed user, address indexed token, uint256 amount)',
  'event Withdraw(address indexed user, address indexed token, uint256 amount)',
  'event Rebalanced(address indexed user, address indexed token, uint256[] newWeights, bool[] newIsShort)',
  'event PortfolioValueUpdated(address indexed user, uint256 newValue)'
];

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address, address) view returns (uint256)',
  'function approve(address, uint256) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
];

class PortfolioInspector {
  constructor(privateKey, provider) {
    this.wallet = new ethers.Wallet(privateKey, provider);
    this.provider = provider;
    this.plnToken = new ethers.Contract(CONFIG.CONTRACTS.PLN, ERC20_ABI, this.wallet);
    this.portfolio = new ethers.Contract(CONFIG.CONTRACTS.PORTFOLIO, PORTFOLIO_ABI, this.wallet);
    this.plnDecimals = null;
    this.isMonitoring = false;
  }

  async initialize() {
    this.plnDecimals = await this.plnToken.decimals();
    console.log(`\n=== Initialized Portfolio Inspector for ${this.wallet.address} ===`);
    return this;
  }

  // ========== Monitoring Functions ==========
  async startEventMonitor() {
    console.log('\n🔍 Starting event monitor...');
    this.isMonitoring = true;
    
    // Event filters
    const portfolioCreatedFilter = this.portfolio.filters.PortfolioCreated(this.wallet.address);
    const depositFilter = this.portfolio.filters.Deposit(this.wallet.address);
    const rebalancedFilter = this.portfolio.filters.Rebalanced(this.wallet.address);
    const valueUpdatedFilter = this.portfolio.filters.PortfolioValueUpdated(this.wallet.address);
    
    // Set up event listeners
    this.portfolio.on(portfolioCreatedFilter, this.handlePortfolioCreated.bind(this));
    this.portfolio.on(depositFilter, this.handleDeposit.bind(this));
    this.portfolio.on(rebalancedFilter, this.handleRebalanced.bind(this));
    this.portfolio.on(valueUpdatedFilter, this.handleValueUpdated.bind(this));
    
    console.log('✅ Event monitor started. Press Ctrl+C to stop.');
  }
  
  stopEventMonitor() {
    this.isMonitoring = false;
    this.portfolio.removeAllListeners();
    console.log('\n🛑 Event monitor stopped');
  }
  
  // Event handlers
  async handlePortfolioCreated(user, token, amount, weights, isShort, tokenType, event) {
    console.log('\n🎉 Portfolio Created Event:');
    console.log(`- User: ${user}`);
    console.log(`- Token: ${token}`);
    console.log(`- Amount: ${ethers.utils.formatUnits(amount, this.plnDecimals)} PLN`);
    console.log(`- Weights: ${weights.map(w => w.toString())}`);
    console.log(`- Is Short: ${isShort}`);
    console.log(`- Token Type: ${tokenType ? 'vePLN' : 'PLN'}`);
    console.log(`- TX: ${event.transactionHash}`);
    
    // Check portfolio state after creation
    await this.debugPortfolio();
  }
  
  async handleDeposit(user, token, amount, event) {
    console.log('\n💰 Deposit Event:');
    console.log(`- User: ${user}`);
    console.log(`- Token: ${token}`);
    console.log(`- Amount: ${ethers.utils.formatUnits(amount, this.plnDecimals)} PLN`);
    console.log(`- TX: ${event.transactionHash}`);
    
    // Check portfolio state after deposit
    await this.debugPortfolio();
  }
  
  async handleRebalanced(user, token, newWeights, newIsShort, event) {
    console.log('\n⚖️  Rebalanced Event:');
    console.log(`- User: ${user}`);
    console.log(`- Token: ${token}`);
    console.log(`- New Weights: ${newWeights.map(w => w.toString())}`);
    console.log(`- New Is Short: ${newIsShort}`);
    console.log(`- TX: ${event.transactionHash}`);
    
    // Check portfolio state after rebalance
    await this.debugPortfolio();
  }
  
  async handleValueUpdated(user, newValue, event) {
    console.log('\n📈 Portfolio Value Updated:');
    console.log(`- User: ${user}`);
    console.log(`- New Value: ${ethers.utils.formatUnits(newValue, this.plnDecimals)} PLN`);
    console.log(`- TX: ${event.transactionHash}`);
  }

  // ========== Portfolio Creation ==========
  async createPortfolio(amount, weights = [9000, 1000], isShort = [false, false], tokenType = false) {
    console.log(`\n🛠️  Creating portfolio with ${amount} PLN...`);
    
    try {
      const amountWei = ethers.utils.parseUnits(amount.toString(), this.plnDecimals);
      
      // 1. Approve tokens
      console.log('🔏 Approving tokens...');
      const approveTx = await this.plnToken.approve(
        this.portfolio.address,
        amountWei,
        { gasLimit: 250000 }
      );
      await approveTx.wait();
      console.log('✅ Tokens approved');
      
      // 2. Create portfolio
      console.log('🏗️  Creating portfolio...');
      const tx = await this.portfolio.createPortfolio(
        amountWei,
        weights,
        isShort,
        tokenType,
        { gasLimit: 1000000 }
      );
      
      console.log(`📝 Transaction hash: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`✅ Portfolio created in block ${receipt.blockNumber}`);
      
      // 3. Verify portfolio
      await this.debugPortfolio();
      
      return receipt;
      
    } catch (error) {
      console.error('❌ Portfolio creation failed:', error.message);
      if (error.transactionHash) {
        console.log('Transaction hash:', error.transactionHash);
      }
      throw error;
    }
  }

  // ========== Deposit Funds ==========
  async depositFunds(amount) {
    console.log(`\n💸 Depositing ${amount} PLN...`);
    
    try {
      const amountWei = ethers.utils.parseUnits(amount.toString(), this.plnDecimals);
      
      // 1. Approve tokens if needed
      const allowance = await this.plnToken.allowance(this.wallet.address, this.portfolio.address);
      if (allowance.lt(amountWei)) {
        console.log('🔏 Approving tokens...');
        const approveTx = await this.plnToken.approve(
          this.portfolio.address,
          amountWei,
          { gasLimit: 250000 }
        );
        await approveTx.wait();
        console.log('✅ Tokens approved');
      }
      
      // 2. Make deposit
      console.log('📤 Making deposit...');
      const tx = await this.portfolio.depositPLN(
        amountWei,
        this.wallet.address,
        { gasLimit: 500000 }
      );
      
      console.log(`📝 Transaction hash: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`✅ Deposit confirmed in block ${receipt.blockNumber}`);
      
      // 3. Verify deposit
      await this.debugPortfolio();
      
      return receipt;
      
    } catch (error) {
      console.error('❌ Deposit failed:', error.message);
      if (error.transactionHash) {
        console.log('Transaction hash:', error.transactionHash);
      }
      throw error;
    }
  }

  // ========== Debugging Functions ==========
  async debugPortfolio() {
    console.log('\n🔍 Portfolio State:');
    
    try {
      // 1. Check portfolio data
      const portfolioData = await this.portfolio.getPortfolio(
        this.wallet.address,
        ethers.constants.AddressZero
      );
      
      console.log('📊 Portfolio Data:');
      console.log('- Weights:', portfolioData[0].map(w => w.toString()));
      console.log('- Total Value:', ethers.utils.formatUnits(portfolioData[1], this.plnDecimals), 'PLN');
      console.log('- Deposit PLN:', ethers.utils.formatUnits(portfolioData[2], this.plnDecimals), 'PLN');
      console.log('- Withdrawn:', ethers.utils.formatUnits(portfolioData[3], this.plnDecimals), 'PLN');
      console.log('- Active:', portfolioData[4]);
      console.log('- Timestamp:', new Date(Number(portfolioData[5]) * 1000).toISOString());
      console.log('- Benchmark Ref:', portfolioData[6].toString());
      console.log('- Is Short:', portfolioData[7] || []);
      
      // 2. Check portfolio state
      try {
        const portfolioState = await this.portfolio.getPortfolioState(this.wallet.address);
        console.log('\n📈 Portfolio State:');
        console.log('- Total Value:', ethers.utils.formatUnits(portfolioState.totalValue, this.plnDecimals), 'PLN');
        console.log('- Deposit PLN:', ethers.utils.formatUnits(portfolioState.depositPLN, this.plnDecimals), 'PLN');
        console.log('- Deposit vePLN:', ethers.utils.formatUnits(portfolioState.depositVePLN, this.plnDecimals), 'vePLN');
        console.log('- Withdrawn:', ethers.utils.formatUnits(portfolioState.withdrawn, this.plnDecimals), 'PLN');
        console.log('- Active:', portfolioState.isActive);
        console.log('- Last Update:', new Date(Number(portfolioState.timestamp) * 1000).toISOString());
        console.log('- Benchmark Ref:', portfolioState.benchMarkRef.toString());
        console.log('- Last Rebalance:', new Date(Number(portfolioState.lastRebalanceTime) * 1000).toISOString());
      } catch (error) {
        console.log('\n⚠️  Could not get detailed portfolio state:', error.message);
      }
      
      // 3. Check portfolio value
      try {
        const portfolioValue = await this.portfolio.getPortfolioValue(
          this.wallet.address,
          ethers.constants.AddressZero
        );
        console.log('\n💰 Portfolio Value:', ethers.utils.formatUnits(portfolioValue, this.plnDecimals), 'PLN');
      } catch (error) {
        console.log('\n⚠️  Could not get portfolio value:', error.message);
      }
      
      return { portfolioData };
      
    } catch (error) {
      if (error.reason === 'Portfolio does not exist') {
        console.log('No portfolio exists for this wallet');
        return { exists: false };
      }
      console.error('Error debugging portfolio:', error);
      throw error;
    }
  }
  
  async checkBalances() {
    const [ethBalance, plnBalance, plnAllowance] = await Promise.all([
      this.wallet.getBalance(),
      this.plnToken.balanceOf(this.wallet.address),
      this.plnToken.allowance(this.wallet.address, this.portfolio.address)
    ]);
    
    console.log('\n💰 Balances:');
    console.log(`- ETH:      ${ethers.utils.formatEther(ethBalance)}`);
    console.log(`- PLN:      ${ethers.utils.formatUnits(plnBalance, this.plnDecimals)}`);
    console.log(`- Allowance: ${ethers.utils.formatUnits(plnAllowance, this.plnDecimals)} PLN`);
    
    return { ethBalance, plnBalance, plnAllowance };
  }
}

// ========== Main Function ==========
async function main() {
  console.log('=== Portfolio Inspector ===');
  
  // Set up provider
  const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL, {
    name: 'base-sepolia',
    chainId: 84532,
  });
  
  // Load private keys from environment variables
  const PRIVATE_KEYS = [
    process.env.PRIVATE_KEY_1,
    process.env.PRIVATE_KEY_2,
    process.env.PRIVATE_KEY_3,
    process.env.PRIVATE_KEY_4,
    process.env.PRIVATE_KEY_5
  ].filter(Boolean);
  
  if (PRIVATE_KEYS.length === 0) {
    console.error('No private keys found in .wallets file');
    process.exit(1);
  }
  
  // Use the first wallet by default
  const wallet = new ethers.Wallet(PRIVATE_KEYS[0], provider);
  const inspector = await new PortfolioInspector(PRIVATE_KEYS[0], provider).initialize();
  
  // Set up command line interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  function showMenu() {
    console.log('\n=== Menu ===');
    console.log('1. Check Balances');
    console.log('2. Debug Portfolio');
    console.log('3. Create Portfolio');
    console.log('4. Deposit Funds');
    console.log('5. Start Event Monitor');
    console.log('6. Stop Event Monitor');
    console.log('7. Exit');
    console.log('============');
    
    rl.question('Select an option (1-7): ', async (answer) => {
      try {
        switch(answer.trim()) {
          case '1':
            await inspector.checkBalances();
            break;
            
          case '2':
            await inspector.debugPortfolio();
            break;
            
          case '3':
            const amount = await new Promise(resolve => {
              rl.question('Enter amount to deposit (PLN): ', resolve);
            });
            await inspector.createPortfolio(parseFloat(amount));
            break;
            
          case '4':
            const depositAmount = await new Promise(resolve => {
              rl.question('Enter amount to deposit (PLN): ', resolve);
            });
            await inspector.depositFunds(parseFloat(depositAmount));
            break;
            
          case '5':
            await inspector.startEventMonitor();
            break;
            
          case '6':
            inspector.stopEventMonitor();
            break;
            
          case '7':
            console.log('Exiting...');
            rl.close();
            process.exit(0);
            
          default:
            console.log('Invalid option. Please try again.');
        }
      } catch (error) {
        console.error('Error:', error.message);
      }
      
      // Show menu again if not exiting
      if (answer.trim() !== '7') {
        showMenu();
      }
    });
  }
  
  // Show initial menu
  showMenu();
  
  // Handle process termination
  process.on('SIGINT', () => {
    console.log('\nCaught interrupt signal');
    if (inspector.isMonitoring) {
      inspector.stopEventMonitor();
    }
    rl.close();
    process.exit(0);
  });
}

// Run the main function
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
