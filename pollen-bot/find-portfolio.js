const { ethers } = require('ethers');
const PollenDAOABI = require('../reference-code/pollen-subgraph-v3/abis/PollenDAO.json');

const CONFIG = {
    RPC_URL: 'https://sepolia.base.org',
    POLLEN_DAO: '0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7'
};

const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL, {
    name: 'base-sepolia',
    chainId: 84532,
    ensAddress: undefined // Disable ENS
});

async function findPortfolio() {
    console.log('=== Searching for Portfolio Contract ===');
    
    const dao = new ethers.Contract(CONFIG.POLLEN_DAO, PollenDAOABI, provider);
    
    // Try different methods that might return the Portfolio address
    const methods = [
        'portfolio',
        'getPortfolio',
        'getModule',
        'getContract'
    ];
    
    for (const method of methods) {
        try {
            if (method in dao) {
                const result = await dao[method]();
                if (result && result !== ethers.ZeroAddress) {
                    const code = await provider.getCode(result);
                    if (code !== '0x') {
                        console.log(`✅ Found potential Portfolio at ${result} via ${method}()`);
                        return result;
                    }
                }
            }
        } catch (error) {
            // Method doesn't exist or failed, continue to next one
        }
    }
    
    // Check common deployment patterns
    const baseAddress = CONFIG.POLLEN_DAO.toLowerCase().slice(0, -2);
    const patterns = [
        baseAddress + '01',
        baseAddress + '02',
        baseAddress.slice(0, -4) + '0001',
        baseAddress.slice(0, -4) + '0002'
    ];
    
    for (const addr of patterns) {
        const code = await provider.getCode(addr);
        if (code !== '0x') {
            console.log(`✅ Found contract at common pattern: ${addr}`);
            // Verify if it's a Portfolio by checking for Portfolio methods
            const portfolio = new ethers.Contract(addr, ['function getAssets() view returns (address[])'], provider);
            try {
                const assets = await portfolio.getAssets();
                if (Array.isArray(assets)) {
                    console.log(`✅ Confirmed Portfolio at ${addr} (found ${assets.length} assets)`);
                    return addr;
                }
            } catch (e) {
                // Not a Portfolio contract
            }
        }
    }
    
    console.log('❌ Could not find Portfolio contract');
    return null;
}

findPortfolio().catch(console.error);
