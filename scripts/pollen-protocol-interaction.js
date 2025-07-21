const { ethers } = require('ethers');
const config = require('./config');

// Import ABIs
const PollenDAOABI = require('../reference-code/pollen-subgraph-v3/abis/PollenDAO.json');
const PollenTokenABI = require('../reference-code/pollen-subgraph-v3/abis/PollenToken.json');
const LockedPollenABI = require('../reference-code/pollen-subgraph-v3/abis/LockedPollen.json');

class PollenProtocol {
    constructor(privateKey) {
        // Initialize provider and wallet
        this.provider = new ethers.providers.JsonRpcProvider(config.RPC_URL);
        this.wallet = new ethers.Wallet(privateKey, this.provider);
        
        // Initialize contracts
        this.dao = new ethers.Contract(
            config.CONTRACTS.POLLEN_DAO,
            PollenDAOABI,
            this.wallet
        );
        
        this.pln = new ethers.Contract(
            config.CONTRACTS.PLN,
            PollenTokenABI,
            this.wallet
        );
        
        this.vePLN = new ethers.Contract(
            config.CONTRACTS.VEPLN,
            LockedPollenABI,
            this.wallet
        );
        
        console.log('🔌 Connected to Pollen Protocol on Base Sepolia');
        console.log(`👛 Wallet: ${this.wallet.address}`);
    }
    
    // ===== PLN Token Functions =====
    
    async getPLNBalance(address = this.wallet.address) {
        const balance = await this.pln.balanceOf(address);
        return ethers.utils.formatEther(balance);
    }
    
    async approvePLN(spender, amount) {
        console.log(`Approving ${amount} PLN for ${spender}...`);
        const tx = await this.pln.approve(
            spender,
            ethers.utils.parseEther(amount.toString())
        );
        await tx.wait();
        return tx.hash;
    }
    
    // ===== vePLN Functions =====
    
    async getLockedBalance() {
        const balance = await this.vePLN.locked(this.wallet.address);
        return {
            amount: ethers.utils.formatEther(balance.amount),
            end: new Date(balance.end * 1000).toISOString()
        };
    }
    
    async lockPLN(amount, weeksToLock = 52) {
        // Approve vePLN to spend PLN
        await this.approvePLN(this.vePLN.address, amount);
        
        console.log(`Locking ${amount} PLN for ${weeksToLock} weeks...`);
        const unlockTime = Math.floor(Date.now() / 1000) + (weeksToLock * 7 * 24 * 60 * 60);
        
        const tx = await this.vePLN.create_lock(
            ethers.utils.parseEther(amount.toString()),
            unlockTime
        );
        
        const receipt = await tx.wait();
        return {
            txHash: tx.hash,
            unlockTime: new Date(unlockTime * 1000).toISOString()
        };
    }
    
    // ===== PollenDAO Functions =====
    
    async getDAODetails() {
        const [owner, proposalCount] = await Promise.all([
            this.dao.owner(),
            this.dao.proposalCount()
        ]);
        
        return {
            owner,
            proposalCount: proposalCount.toNumber()
        };
    }
    
    // ===== Portfolio Functions (when found) =====
    
    async getPortfolioDetails(portfolioAddress) {
        if (!portfolioAddress) {
            throw new Error('Portfolio address not provided');
        }
        
        const portfolio = new ethers.Contract(
            portfolioAddress,
            ['function getAssets() view returns (address[])',
             'function owner() view returns (address)'],
            this.wallet
        );
        
        const [owner, assets] = await Promise.all([
            portfolio.owner(),
            portfolio.getAssets()
        ]);
        
        return {
            owner,
            assetCount: assets.length,
            assets
        };
    }
}

// Example usage
async function main() {
    try {
        // Initialize with your private key from environment variable
        const privateKey = process.env.PRIVATE_KEY;
        if (!privateKey) {
            throw new Error('Please set PRIVATE_KEY environment variable');
        }
        
        const pollen = new PollenProtocol(privateKey);
        
        // Example: Get wallet balances
        console.log('\n=== Wallet Balances ===');
        const plnBalance = await pollen.getPLNBalance();
        console.log(`PLN Balance: ${plnBalance}`);
        
        // Example: Get locked balance
        console.log('\n=== Locked Balances ===');
        try {
            const locked = await pollen.getLockedBalance();
            console.log(`Locked: ${locked.amount} PLN until ${locked.end}`);
        } catch (error) {
            console.log('No locked balance found or error:', error.message);
        }
        
        // Example: Get DAO details
        console.log('\n=== DAO Details ===');
        const daoDetails = await pollen.getDAODetails();
        console.log(`DAO Owner: ${daoDetails.owner}`);
        console.log(`Proposal Count: ${daoDetails.proposalCount}`);
        
        // Example: Check Portfolio (when found)
        if (config.CONTRACTS.PORTFOLIO) {
            console.log('\n=== Portfolio Details ===');
            const portfolio = await pollen.getPortfolioDetails(config.CONTRACTS.PORTFOLIO);
            console.log(`Portfolio Owner: ${portfolio.owner}`);
            console.log(`Assets in Portfolio: ${portfolio.assetCount}`);
        }
        
    } catch (error) {
        console.error('Error:', error.message);
        if (error.transaction) {
            console.error('Transaction hash:', error.transaction.hash);
        }
    }
}

// Run the example
if (require.main === module) {
    main().catch(console.error);
}

module.exports = PollenProtocol;
