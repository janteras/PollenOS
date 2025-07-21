const { ethers } = require('ethers');

// Main contract ABIs
const LockedPollenABI = require('../reference-code/pollen-subgraph-v3/abis/LockedPollen.json');
const PortfolioABI = require('../reference-code/pollen-subgraph-v3/abis/Portfolio.json');
const PollenTokenABI = require('../reference-code/pollen-subgraph-v3/abis/PollenToken.json');
const ERC20ABI = require('../reference-code/pollen-subgraph-v3/abis/ERC20.json');

// Contract addresses from config
const config = require('./config');

// Contract factories
const getLockedPollenContract = (provider) => {
  return new ethers.Contract(
    config.CONTRACTS.VEPLN,
    LockedPollenABI,
    provider
  );
};

const getPortfolioContract = (provider) => {
  return new ethers.Contract(
    config.CONTRACTS.PORTFOLIO,
    PortfolioABI,
    provider
  );
};

const getPollenTokenContract = (provider) => {
  return new ethers.Contract(
    config.CONTRACTS.PLN,
    PollenTokenABI,
    provider
  );
};

const getERC20Contract = (address, provider) => {
  return new ethers.Contract(
    address,
    ERC20ABI,
    provider
  );
};

// Export contract interfaces
module.exports = {
  getLockedPollenContract,
  getPortfolioContract,
  getPollenTokenContract,
  getERC20Contract,
  // Export ABIs for potential direct use
  LockedPollenABI,
  PortfolioABI,
  PollenTokenABI,
  ERC20ABI
};
