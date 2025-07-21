
/**
 * Pollen Staking Module
 * Handles PLN token staking, unstaking, and position management
 */
const { ethers } = require('ethers');
const { PLN_TOKEN_ABI, POLLEN_MAIN_CONTRACT_ABI } = require('./pollen-contract-abi');
const logger = require('./logger');

// Verified contract addresses on Avalanche
const CONTRACTS = {
  PLN_TOKEN: '0x7b2B702706D9b361dfE3f00bD138C0CFDA7FB2Cf',
  POLLEN_MAIN: '0x2eCB6F9dF29163758024d416997764922E4528d4',
  // Asset-specific contracts would be added here
  ASSETS: {
    // These would be populated based on supported assets
  }
};

class PollenStaking {
  constructor(provider, wallet) {
    this.provider = provider;
    this.wallet = wallet;
    this.plnToken = new ethers.Contract(CONTRACTS.PLN_TOKEN, PLN_TOKEN_ABI, wallet);
    this.pollenMain = new ethers.Contract(CONTRACTS.POLLEN_MAIN, POLLEN_MAIN_CONTRACT_ABI, wallet);
  }

  /**
   * Check PLN token balance
   */
  async getPlnBalance() {
    try {
      const balance = await this.plnToken.balanceOf(this.wallet.address);
      return ethers.formatEther(balance);
    } catch (error) {
      logger.error('Error getting PLN balance:', error);
      throw error;
    }
  }

  /**
   * Check staked PLN balance (vePLN balance)
   */
  async getStakedBalance() {
    try {
      const balance = await this.pollenMain.balanceOf(this.wallet.address);
      return ethers.formatEther(balance);
    } catch (error) {
      logger.error('Error getting staked balance:', error);
      throw error;
    }
  }

  /**
   * Get detailed lock information
   */
  async getLockDetails() {
    try {
      const lockData = await this.pollenMain.locks(this.wallet.address);
      return {
        lockStart: new Date(Number(lockData[0]) * 1000),
        lockEnd: new Date(Number(lockData[1]) * 1000),
        amount: ethers.formatEther(lockData[2]),
        offset: lockData[3].toString(),
        claimable: ethers.formatEther(lockData[4])
      };
    } catch (error) {
      logger.error('Error getting lock details:', error);
      throw error;
    }
  }

  /**
   * Approve PLN spending for staking
   */
  async approvePlnSpending(amount) {
    try {
      const amountWei = ethers.parseEther(amount.toString());
      
      // Check current allowance
      const currentAllowance = await this.plnToken.allowance(
        this.wallet.address, 
        CONTRACTS.POLLEN_MAIN
      );

      if (currentAllowance >= amountWei) {
        logger.info(`Sufficient allowance already exists: ${ethers.formatEther(currentAllowance)} PLN`);
        return null;
      }

      logger.info(`Approving ${amount} PLN for staking...`);
      const tx = await this.plnToken.approve(CONTRACTS.POLLEN_MAIN, amountWei);
      
      logger.info(`Approval transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      
      logger.info(`PLN approval confirmed in block ${receipt.blockNumber}`);
      return receipt;
    } catch (error) {
      logger.error('Error approving PLN spending:', error);
      throw error;
    }
  }

  /**
   * Lock PLN tokens for vePLN (equivalent to staking)
   */
  async stakePln(amount, lockDuration = 7776000) { // Default 90 days
    try {
      const amountWei = ethers.parseEther(amount.toString());
      const lockEnd = Math.floor(Date.now() / 1000) + lockDuration;
      
      // First approve if needed
      await this.approvePlnSpending(amount);
      
      logger.info(`Locking ${amount} PLN for vePLN until ${new Date(lockEnd * 1000).toLocaleDateString()}...`);
      const tx = await this.pollenMain.lock(amountWei, lockEnd);
      
      logger.info(`Lock transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      
      logger.info(`PLN locking confirmed in block ${receipt.blockNumber}`);
      return receipt;
    } catch (error) {
      logger.error('Error locking PLN:', error);
      throw error;
    }
  }

  /**
   * Unlock expired PLN locks (equivalent to unstaking)
   */
  async unstakePln() {
    try {
      // Check if lock has expired
      const lockDetails = await this.getLockDetails();
      const now = new Date();
      
      if (lockDetails.lockEnd > now) {
        throw new Error(`Lock not expired yet. Unlock available on ${lockDetails.lockEnd.toLocaleDateString()}`);
      }
      
      logger.info('Unlocking expired PLN lock...');
      const tx = await this.pollenMain.unlock();
      
      logger.info(`Unlock transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      
      logger.info(`PLN unlock confirmed in block ${receipt.blockNumber}`);
      return receipt;
    } catch (error) {
      logger.error('Error unlocking PLN:', error);
      throw error;
    }
  }

  /**
   * Open a position on specific asset
   */
  async openPosition(assetAddress, amount, isLong, leverage = 1) {
    try {
      const amountWei = ethers.parseEther(amount.toString());
      
      logger.info(`Opening ${isLong ? 'long' : 'short'} position: ${amount} PLN on asset ${assetAddress} with ${leverage}x leverage`);
      
      const tx = await this.pollenMain.openPosition(
        assetAddress,
        amountWei,
        isLong,
        leverage
      );
      
      logger.info(`Position opening transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      
      logger.info(`Position opened in block ${receipt.blockNumber}`);
      return receipt;
    } catch (error) {
      logger.error('Error opening position:', error);
      throw error;
    }
  }

  /**
   * Close a position on specific asset
   */
  async closePosition(assetAddress) {
    try {
      logger.info(`Closing position on asset ${assetAddress}`);
      
      const tx = await this.pollenMain.closePosition(assetAddress);
      
      logger.info(`Position closing transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      
      logger.info(`Position closed in block ${receipt.blockNumber}`);
      return receipt;
    } catch (error) {
      logger.error('Error closing position:', error);
      throw error;
    }
  }

  /**
   * Get current position for an asset
   */
  async getPosition(assetAddress) {
    try {
      const position = await this.pollenMain.getPosition(this.wallet.address, assetAddress);
      return {
        amount: ethers.formatEther(position.amount),
        isLong: position.isLong,
        leverage: position.leverage.toString(),
        entryPrice: ethers.formatEther(position.entryPrice),
        timestamp: new Date(Number(position.timestamp) * 1000)
      };
    } catch (error) {
      logger.error('Error getting position:', error);
      throw error;
    }
  }

  /**
   * Update virtual portfolio (for prediction market)
   */
  async updateVirtualPortfolio(tokenAddresses, allocations) {
    try {
      logger.info(`Updating virtual portfolio with ${tokenAddresses.length} assets`);
      
      const tx = await this.pollenMain.updatePortfolio(tokenAddresses, allocations);
      
      logger.info(`Portfolio update transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      
      logger.info(`Virtual portfolio updated in block ${receipt.blockNumber}`);
      return receipt;
    } catch (error) {
      logger.error('Error updating virtual portfolio:', error);
      throw error;
    }
  }

  /**
   * Set up event listeners for position and staking events
   */
  setupEventListeners() {
    // Staking events
    this.pollenMain.on('Staked', (user, amount, event) => {
      if (user.toLowerCase() === this.wallet.address.toLowerCase()) {
        logger.info(`Staked: ${ethers.formatEther(amount)} PLN`);
      }
    });

    this.pollenMain.on('Unstaked', (user, amount, event) => {
      if (user.toLowerCase() === this.wallet.address.toLowerCase()) {
        logger.info(`Unstaked: ${ethers.formatEther(amount)} PLN`);
      }
    });

    // Position events
    this.pollenMain.on('PositionOpened', (user, asset, amount, isLong, leverage, event) => {
      if (user.toLowerCase() === this.wallet.address.toLowerCase()) {
        logger.info(`Position opened: ${ethers.formatEther(amount)} PLN ${isLong ? 'long' : 'short'} on ${asset} with ${leverage}x leverage`);
      }
    });

    this.pollenMain.on('PositionClosed', (user, asset, pnl, event) => {
      if (user.toLowerCase() === this.wallet.address.toLowerCase()) {
        logger.info(`Position closed on ${asset}: P&L = ${ethers.formatEther(pnl)} PLN`);
      }
    });

    logger.info('Event listeners set up for Pollen staking and trading');
  }
}

module.exports = PollenStaking;
