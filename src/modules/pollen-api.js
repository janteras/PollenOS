/**
 * Pollen API module for interacting with Pollen smart contracts and APIs
 * Handles staking, portfolio management, and token operations on Avalanche network
 */

const { ethers } = require('ethers');
const logger = require('./logger');
const pollenContractABI = require('./pollen-contract-abi');

// Pollen Platform Configuration
const POLLEN_CONFIG = {
  // Main Pollen contract address on Avalanche
  MAIN_CONTRACT: '0x2eCB6F9dF29163758024d416997764922E4528d4',

  // PLN Token contract address
  PLN_TOKEN: '0x7b2B702706D9b361dfE3f00bD138C0CFDA7FB2Cf',

  // Network configuration
  NETWORK: {
    chainId: 43114, // Avalanche mainnet
    name: 'avalanche',
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc'
  },

  // API endpoints
  API_BASE_URL: 'https://api.pollen.co',
  PORTFOLIO_ENDPOINT: '/v1/portfolios',
  STAKING_ENDPOINT: '/v1/staking'
};

class PollenAPI {
  constructor(provider, privateKey) {
    this.provider = provider;
    this.privateKey = privateKey;
    this.wallet = null;
    this.contracts = {};

    // Ensure provider supports transactions
    if (!this.provider.send && !this.provider.sendTransaction) {
      logger.error('Provider does not support sending transactions');
      throw new Error('Provider must support transaction sending');
    }

    // Validate private key format before creating wallet
    if (!privateKey || typeof privateKey !== 'string') {
      throw new Error('Private key is required and must be a string');
    }

    // Clean and validate private key format
    const cleanedKey = privateKey.trim();
    const keyWithoutPrefix = cleanedKey.startsWith('0x') ? cleanedKey.slice(2) : cleanedKey;

    if (keyWithoutPrefix.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(keyWithoutPrefix)) {
      throw new Error('Private key must be exactly 64 hexadecimal characters');
    }

    this.wallet = new ethers.Wallet(cleanedKey, provider);

    // Initialize contract instances
    this.mainContract = new ethers.Contract(
      POLLEN_CONFIG.MAIN_CONTRACT,
      pollenContractABI.POLLEN_MAIN_CONTRACT_ABI,
      this.wallet
    );

    this.plnToken = new ethers.Contract(
      POLLEN_CONFIG.PLN_TOKEN,
      pollenContractABI.PLN_TOKEN_ABI,
      this.wallet
    );

    this.isInitialized = false;
  }

  /**
   * Initialize the API connection and verify contracts
   */
  async initialize() {
    try {
      logger.info('Initializing Pollen API...');

      // Verify network connection
      const network = await this.provider.getNetwork();
      const networkChainId = Number(network.chainId);
      if (networkChainId !== POLLEN_CONFIG.NETWORK.chainId) {
        throw new Error(`Wrong network. Expected Avalanche (${POLLEN_CONFIG.NETWORK.chainId}), got ${networkChainId}`);
      }

      // Verify wallet balance
      const balance = await this.provider.getBalance(this.wallet.address);
      logger.info(`Wallet balance: ${ethers.formatEther(balance)} AVAX`);

      // Check PLN token balance
      const plnBalance = await this.getPlnBalance();
      logger.info(`PLN token balance: ${plnBalance}`);

      // Ensure contracts are connected to wallet for transactions
      this.mainContract = this.mainContract.connect(this.wallet);
      this.plnToken = this.plnToken.connect(this.wallet);

      // Test transaction capability
      try {
        const gasEstimate = await this.provider.estimateGas({
          to: this.wallet.address,
          value: 0
        });
        logger.info(`Transaction capability verified, gas estimate: ${gasEstimate}`);
      } catch (gasError) {
        logger.warn(`Gas estimation failed: ${gasError.message}`);
      }

      this.isInitialized = true;
      logger.info('Pollen API initialized successfully');

      return true;
    } catch (error) {
      logger.error(`Failed to initialize Pollen API: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get PLN token balance for the connected wallet
   */
  async getPlnBalance() {
    try {
      const balance = await this.plnToken.balanceOf(this.wallet.address);
      return ethers.formatEther(balance);
    } catch (error) {
      logger.error(`Error getting PLN balance: ${error.message}`);
      return '0';
    }
  }

  /**
   * Stake PLN tokens in a virtual portfolio
   */
  async stakePlnTokens(amount, portfolioId = 'default') {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      logger.info(`Staking ${amount} PLN tokens to portfolio ${portfolioId}...`);

      // Convert amount to wei
      const amountWei = ethers.parseEther(amount.toString());

      // Check allowance first
      const allowance = await this.plnToken.allowance(
        this.wallet.address,
        POLLEN_CONFIG.MAIN_CONTRACT
      );

      if (allowance < amountWei) {
        logger.info('Approving PLN token spending...');
        const approveTx = await this.plnToken.approve(
          POLLEN_CONFIG.MAIN_CONTRACT,
          amountWei
        );
        await approveTx.wait();
        logger.info('PLN token approval confirmed');
      }

      // Execute staking transaction
      const stakeTx = await this.mainContract.stake(amountWei, portfolioId);
      const receipt = await stakeTx.wait();

      logger.info(`Staking successful! TX: ${receipt.transactionHash}`);

      return {
        success: true,
        transactionHash: receipt.transactionHash,
        amount: amount,
        portfolioId: portfolioId
      };

    } catch (error) {
      logger.error(`Staking failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check staking status and rewards
   */
  async getStakingInfo() {
    try {
      const stakedAmount = await this.mainContract.getStakedAmount(this.wallet.address);
      const pendingRewards = await this.mainContract.getPendingRewards(this.wallet.address);

      return {
        stakedAmount: ethers.formatEther(stakedAmount),
        pendingRewards: ethers.formatEther(pendingRewards),
        walletAddress: this.wallet.address
      };

    } catch (error) {
      logger.error(`Error getting staking info: ${error.message}`);
      return {
        stakedAmount: '0',
        pendingRewards: '0',
        walletAddress: this.wallet.address
      };
    }
  }

  /**
   * Create or update virtual portfolio allocation
   */
  async updatePortfolioAllocation(allocation) {
    try {
      logger.info('Updating portfolio allocation...');

      // Validate allocation format
      if (!allocation || typeof allocation !== 'object') {
        throw new Error('Invalid allocation format');
      }

      // Convert allocation to contract format
      const assets = Object.keys(allocation);
      const weights = Object.values(allocation);

      // Ensure weights sum to 100%
      const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
      if (Math.abs(totalWeight - 100) > 0.01) {
        throw new Error(`Portfolio weights must sum to 100%, got ${totalWeight}%`);
      }

      // Execute portfolio update
      const updateTx = await this.mainContract.updatePortfolio(assets, weights);
      const receipt = await updateTx.wait();

      logger.info(`Portfolio updated! TX: ${receipt.transactionHash}`);

      return {
        success: true,
        transactionHash: receipt.transactionHash,
        allocation: allocation
      };

    } catch (error) {
      logger.error(`Portfolio update failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get current portfolio information
   */
  async getPortfolioInfo() {
    try {
      const portfolioData = await this.mainContract.getPortfolio(this.wallet.address);

      return {
        assets: portfolioData.assets || [],
        weights: portfolioData.weights || [],
        totalValue: ethers.formatEther(portfolioData.totalValue || 0),
        lastUpdate: portfolioData.lastUpdate || 0
      };

    } catch (error) {
      logger.error(`Error getting portfolio info: ${error.message}`);
      return {
        assets: [],
        weights: [],
        totalValue: '0',
        lastUpdate: 0
      };
    }
  }

  /**
   * Execute a virtual trade within the portfolio
   */
  async executeVirtualTrade(fromAsset, toAsset, amount) {
    try {
      logger.info(`Executing virtual trade: ${amount} ${fromAsset} -> ${toAsset}`);

      const amountWei = ethers.parseEther(amount.toString());

      const tradeTx = await this.mainContract.executeTrade(
        fromAsset,
        toAsset,
        amountWei
      );

      const receipt = await tradeTx.wait();

      logger.info(`Virtual trade successful! TX: ${receipt.transactionHash}`);

      return {
        success: true,
        transactionHash: receipt.transactionHash,
        fromAsset,
        toAsset,
        amount
      };

    } catch (error) {
      logger.error(`Virtual trade failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get wallet address
   */
  getWalletAddress() {
    return this.wallet.address;
  }

  /**
   * Check if API is properly initialized
   */
  isReady() {
    return this.isInitialized;
  }
}

module.exports = PollenAPI;