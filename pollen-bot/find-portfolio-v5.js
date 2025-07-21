const { ethers } = require('ethers');
const PollenDAOABI = require('../reference-code/pollen-subgraph-v3/abis/PollenDAO.json');

const CONFIG = {
    RPC_URL: 'https://sepolia.base.org',
    POLLEN_DAO: '0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7'
};

async function findPortfolio() {
    console.log('=== Searching for Portfolio Contract ===');
    
    // Create provider without ENS
    const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL, {
        name: 'base-sepolia',
        chainId: 84532
    });
    
    const dao = new ethers.Contract(CONFIG.POLLEN_DAO, PollenDAOABI, provider);
    
    // Try different methods that might return the Portfolio address
    const methods = [
        'portfolio',
        'getPortfolio',
        'getModule',
        'getContract',
        'module'
    ];
    
    for (const method of methods) {
        try {
            if (method in dao.functions) {
                const result = await dao[method]();
                if (result && result !== ethers.constants.AddressZero) {
                    const code = await provider.getCode(result);
                    if (code !== '0x') {
                        console.log(`✅ Found potential Portfolio at ${result} via ${method}()`);
                        return result;
                    }
                }
            }
        } catch (error) {
            // Method doesn't exist or failed, continue to next one
            console.log(`Method ${method} failed:`, error.message);
        }
    }
    
    // Check common deployment patterns
    const baseAddress = CONFIG.POLLEN_DAO.toLowerCase().slice(0, -2);
    const patterns = [
        baseAddress + '01',
        baseAddress + '02',
        baseAddress.slice(0, -4) + '0001',
        baseAddress.slice(0, -4) + '0002',
        '0x' + '0'.repeat(38) + '01',  // Common test address
        '0x' + '0'.repeat(38) + '02'   // Common test address
    ];
    
    for (const addr of patterns) {
        try {
            const code = await provider.getCode(addr);
            if (code !== '0x') {
                console.log(`\n🔍 Found contract at: ${addr}`);
                // Try to get assets to verify if it's a Portfolio
                const portfolio = new ethers.Contract(addr, [
                    'function getAssets() view returns (address[])'
                ], provider);
                
                try {
                    const assets = await portfolio.getAssets();
                    console.log(`✅ Confirmed Portfolio at ${addr} (found ${assets.length} assets)`);
                    return addr;
                } catch (e) {
                    console.log(`Not a Portfolio contract: ${e.message}`);
                }
            }
        } catch (e) {
            console.log(`Error checking ${addr}:`, e.message);
        }
    }
    
    console.log('❌ Could not find Portfolio contract');
    return null;
}

findPortfolio().catch(console.error);
