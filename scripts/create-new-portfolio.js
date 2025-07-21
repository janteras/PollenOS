const { ethers } = require('ethers');
const config = require('./config');
const LockedPollenABI = require('../reference-code/pollen-subgraph-v3/abis/LockedPollen.json');
const PortfolioABI = require('../reference-code/pollen-subgraph-v3/abis/Portfolio.json');
const PollenTokenABI = require('../reference-code/pollen-subgraph-v3/abis/PollenToken.json');

// Initialize provider and wallet
const provider = new ethers.providers.JsonRpcProvider(config.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// Contract addresses from config
const vePLNAddress = config.CONTRACTS.VEPLN;
const portfolioAddress = config.CONTRACTS.PORTFOLIO;
const plnAddress = config.CONTRACTS.PLN;

if (!portfolioAddress) {
  throw new Error('Portfolio contract address not found in config. Please set config.CONTRACTS.PORTFOLIO');
}

// Contract instances
const vePLN = new ethers.Contract(vePLNAddress, LockedPollenABI, wallet);
const portfolio = new ethers.Contract(portfolioAddress, PortfolioABI, wallet);

// Function to create a new portfolio
async function createPortfolio() {
  try {
    console.log('Creating a new portfolio...');
    
    // Parameters for createPortfolio
    const amount = ethers.utils.parseEther('10'); // 10 PLN tokens
    const weights = [10000]; // 100% weight for the first asset (scaled by 100)
    const isShort = [false]; // Not shorting the asset
    const tokenType = false; // false for PLN, true for vePLN
    
    // Approve the Portfolio contract to spend PLN tokens
    console.log('Approving PLN tokens for Portfolio contract...');
    const plnToken = new ethers.Contract(plnAddress, PollenTokenABI, wallet);
    const approveTx = await plnToken.approve(portfolioAddress, amount);
    await approveTx.wait();
    console.log(`Approved ${ethers.utils.formatEther(amount)} PLN for Portfolio`);
    
    // Create the portfolio
    console.log('Creating portfolio...');
    const tx = await portfolio.createPortfolio(amount, weights, isShort, tokenType);
    const receipt = await tx.wait();
    
    console.log('Portfolio created successfully!');
    console.log('Transaction hash:', receipt.transactionHash);
    
    // Check the portfolio details
    const assets = await portfolio.getAssets();
    console.log('Portfolio assets:', assets);
    
  } catch (error) {
    console.error('Error creating portfolio:', error);
    if (error.data) {
      console.error('Error data:', error.data);
    }
  }
}

// Run the function
createPortfolio().catch(console.error);
