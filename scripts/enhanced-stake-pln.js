require('dotenv').config({ path: require('path').resolve(__dirname, '../base-sepolia.env') });
const { ethers } = require('ethers');

// Contract ABIs
const PLN_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)'
];

const VEPLN_ABI = [
  'function stake(uint256 amount, uint256 lockDuration) external',
  'function getLockInfo(address) view returns (uint256 amount, uint256 lockEnd)'
];

// Contract addresses (Base Sepolia)
const CONTRACTS = {
  PLN: '0x...', // Replace with actual PLN token address
  vePLN: '0x3a28AB567b661B3edaF9Ef0bDE9489558EDB3995'
};

// Configuration
const CONFIG = {
  RPC_URL: 'https://sepolia.base.org',
  GAS_LIMIT: 500000,
  GAS_MULTIPLIER: 1.2
};

class PollenStaker {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
    this.wallet = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, this.provider);
    
    // Initialize contracts
    this.pln = new ethers.Contract(CONTRACTS.PLN, PLN_ABI, this.wallet);
    this.vePLN = new ethers.Contract(CONTRACTS.vePLN, VEPLN_ABI, this.wallet);
  }

  async checkAllowance() {
    try {
      const allowance = await this.pln.allowance(this.wallet.address, CONTRACTS.vePLN);
      console.log(`Current allowance: ${ethers.formatEther(allowance)} PLN`);
      return allowance;
    } catch (error) {
      console.error('Error checking allowance:', error.message);
      throw error;
    }
  }

  async approvePLN(amount) {
    try {
      console.log(`Approving ${ethers.formatEther(amount)} PLN...`);
      const tx = await this.pln.approve(CONTRACTS.vePLN, amount, {
        gasLimit: CONFIG.GAS_LIMIT,
        gasPrice: await this.getAdjustedGasPrice()
      });
      
      console.log(`Approval tx sent: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`Approval confirmed in block ${receipt.blockNumber}`);
      return receipt.status === 1;
    } catch (error) {
      console.error('Error approving PLN:', error.message);
      throw error;
    }
  }

  async getLockInfo() {
    try {
      return await this.vePLN.getLockInfo(this.wallet.address);
    } catch (error) {
      console.error('Error getting lock info:', error.message);
      throw error;
    }
  }

  async stakePLN(amount, lockDuration) {
    try {
      // Check current lock status
      const lockInfo = await this.getLockInfo();
      
      if (lockInfo.amount > 0) {
        const unlockDate = new Date(Number(lockInfo.lockEnd) * 1000);
        throw new Error(`Already has ${ethers.formatEther(lockInfo.amount)} PLN locked until ${unlockDate}`);
      }

      // Check and approve allowance if needed
      const allowance = await this.checkAllowance();
      if (allowance < amount) {
        console.log('Insufficient allowance. Requesting approval...');
        await this.approvePLN(amount);
      }

      // Execute stake
      console.log(`Staking ${ethers.formatEther(amount)} PLN for ${lockDuration / (24 * 60 * 60)} days...`);
      const tx = await this.vePLN.stake(amount, lockDuration, {
        gasLimit: CONFIG.GAS_LIMIT,
        gasPrice: await this.getAdjustedGasPrice()
      });

      console.log(`Stake tx sent: ${tx.hash}`);
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        console.log(`✅ Successfully staked ${ethers.formatEther(amount)} PLN`);
        const newLockInfo = await this.getLockInfo();
        console.log(`Locked until: ${new Date(Number(newLockInfo.lockEnd) * 1000)}`);
      } else {
        throw new Error('Transaction reverted');
      }

      return receipt;
    } catch (error) {
      console.error('Error staking PLN:', error.message);
      throw error;
    }
  }

  async getAdjustedGasPrice() {
    const feeData = await this.provider.getFeeData();
    return feeData.gasPrice * BigInt(Math.floor(CONFIG.GAS_MULTIPLIER * 10)) / 10n;
  }
}

// Main execution
async function main() {
  try {
    console.log('=== Pollen PLN Staking on Base Sepolia ===');
    console.log(`Wallet: ${process.env.WALLET_ADDRESS || 'Not set'}`);
    
    const staker = new PollenStaker();
    
    // Configuration
    const amountToStake = ethers.parseEther('1'); // 1 PLN
    const lockDuration = 30 * 24 * 60 * 60; // 30 days in seconds
    
    // Execute staking
    await staker.stakePLN(amountToStake, lockDuration);
    
  } catch (error) {
    console.error('❌ Error in main execution:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
