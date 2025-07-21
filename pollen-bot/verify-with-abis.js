const { ethers } = require('ethers');

// Load ABIs from reference code
const PollenTokenABI = require('../reference-code/pollen-subgraph-v3/abis/PollenToken.json');
const PortfolioABI = require('../reference-code/pollen-subgraph-v3/abis/Portfolio.json');
const PollenDAOABI = require('../reference-code/pollen-subgraph-v3/abis/PollenDAO.json');
const LockedPollenABI = require('../reference-code/pollen-subgraph-v3/abis/LockedPollen.json');

// Configuration from base-sepolia.json
const CONFIG = {
    RPC_URL: 'https://sepolia.base.org',
    CONTRACTS: {
        POLLEN_DAO: '0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7',
        LEAGUES: '0x55F04Ee2775925b80125F412C05cF5214Fd1317a',
        VEPLN: '0x3a28AB567b661B3edaF9Ef0bDE9489558EDB3995',
        // These need to be found or derived
        PLN: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0', // Placeholder
        PORTFOLIO: '0x5FbDB2315678afecb367f032d93F642f64180aa3' // Placeholder
    }
};

async function verifyContract(address, abi, name) {
    try {
        const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
        const contract = new ethers.Contract(address, abi, provider);
        
        // Check if contract has code
        const code = await provider.getCode(address);
        if (code === '0x') {
            console.log(`❌ ${name}: No code at address ${address}`);
            return false;
        }
        
        // Try to call name() if it exists
        if ('name' in contract) {
            const nameResult = await contract.name().catch(() => null);
            if (nameResult) {
                console.log(`✅ ${name}: Verified at ${address} (Name: ${nameResult})`);
                return true;
            }
        }
        
        // Try to call owner() if it exists
        if ('owner' in contract) {
            const owner = await contract.owner().catch(() => null);
            if (owner) {
                console.log(`✅ ${name}: Verified at ${address} (Owner: ${owner})`);
                return true;
            }
        }
        
        console.log(`⚠️ ${name}: Has code at ${address} but couldn't verify with standard methods`);
        return true;
        
    } catch (error) {
        console.error(`❌ ${name}: Error verifying ${address} - ${error.message}`);
        return false;
    }
}

async function findPlnToken(provider, pollenDAO) {
    console.log('\n=== Searching for PLN Token ===');
    
    // Try to get PLN token from PollenDAO
    try {
        const daoContract = new ethers.Contract(pollenDAO, PollenDAOABI, provider);
        const plnToken = await daoContract.pollenToken().catch(() => null);
        
        if (plnToken && plnToken !== ethers.ZeroAddress) {
            const code = await provider.getCode(plnToken);
            if (code !== '0x') {
                console.log(`✅ Found PLN Token at: ${plnToken}`);
                return plnToken;
            }
        }
    } catch (error) {
        console.log('Could not get PLN token from PollenDAO:', error.message);
    }
    
    console.log('❌ Could not find PLN token automatically');
    return null;
}

async function findPortfolio(provider, pollenDAO) {
    console.log('\n=== Searching for Portfolio Contract ===');
    
    // Try to get Portfolio from PollenDAO
    try {
        const daoContract = new ethers.Contract(pollenDAO, PollenDAOABI, provider);
        const portfolio = await daoContract.portfolio().catch(() => null);
        
        if (portfolio && portfolio !== ethers.ZeroAddress) {
            const code = await provider.getCode(portfolio);
            if (code !== '0x') {
                console.log(`✅ Found Portfolio at: ${portfolio}`);
                return portfolio;
            }
        }
    } catch (error) {
        console.log('Could not get Portfolio from PollenDAO:', error.message);
    }
    
    console.log('❌ Could not find Portfolio contract automatically');
    return null;
}

async function main() {
    console.log('=== Verifying Pollen Protocol Contracts on Base Sepolia ===');
    console.log(`RPC URL: ${CONFIG.RPC_URL}\n`);
    
    const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
    
    // 1. Verify PollenDAO
    console.log('\n--- Verifying PollenDAO ---');
    await verifyContract(CONFIG.CONTRACTS.POLLEN_DAO, PollenDAOABI, 'PollenDAO');
    
    // 2. Find and verify PLN Token
    const plnToken = await findPlnToken(provider, CONFIG.CONTRACTS.POLLEN_DAO);
    if (plnToken) {
        await verifyContract(plnToken, PollenTokenABI, 'PLN Token');
    }
    
    // 3. Find and verify Portfolio
    const portfolio = await findPortfolio(provider, CONFIG.CONTRACTS.POLLEN_DAO);
    if (portfolio) {
        await verifyContract(portfolio, PortfolioABI, 'Portfolio');
    }
    
    // 4. Verify vePLN
    console.log('\n--- Verifying vePLN ---');
    await verifyContract(CONFIG.CONTRACTS.VEPLN, LockedPollenABI, 'vePLN');
    
    console.log('\n=== Verification Complete ===');
}

main().catch(console.error);
