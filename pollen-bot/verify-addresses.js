const { ethers } = require('ethers');

// Configuration
const CONFIG = {
    RPC_URL: 'https://sepolia.base.org',
    CONTRACTS: {
        POLLEN_DAO: '0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7',
        LEAGUES: '0x55F04Ee2775925b80125F412C05cF5214Fd1317a',
        VEPLN: '0x3a28AB567b661B3edaF9Ef0bDE9489558EDB3995',
        PLN: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
        PORTFOLIO: '0x5FbDB2315678afecb367f032d93F642f64180aa3'
    }
};

// Common ABIs for verification
const ERC20_ABI = [
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function balanceOf(address) view returns (uint256)'
];

const PORTFOLIO_ABI = [
    'function getAssets() view returns (address[] memory)',
    'function owner() view returns (address)'
];

const POLLEN_DAO_ABI = [
    'function owner() view returns (address)'
];

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
        
        // Get the first view function from ABI
        const viewFn = abi.find(fn => 
            fn.startsWith('function ') && 
            fn.includes(' view ')
        );
        
        if (viewFn) {
            const fnName = viewFn.split('(')[0].replace('function ', '').trim();
            const result = await contract[fnName].staticCall();
            console.log(`✅ ${name}: Verified at ${address} (${fnName}: ${JSON.stringify(result, null, 2)})`);
            return true;
        }
        
        console.log(`⚠️ ${name}: Has code at ${address} but no suitable view function to verify`);
        return true;
        
    } catch (error) {
        console.error(`❌ ${name}: Error verifying ${address} - ${error.message}`);
        return false;
    }
}

async function main() {
    console.log('=== Verifying Contract Addresses on Base Sepolia ===');
    console.log(`RPC URL: ${CONFIG.RPC_URL}\n`);
    
    // Verify PLN Token
    await verifyContract(
        CONFIG.CONTRACTS.PLN,
        ERC20_ABI,
        'PLN Token'
    );
    
    // Verify Portfolio Contract
    await verifyContract(
        CONFIG.CONTRACTS.PORTFOLIO,
        PORTFOLIO_ABI,
        'Portfolio Contract'
    );
    
    // Verify PollenDAO
    await verifyContract(
        CONFIG.CONTRACTS.POLLEN_DAO,
        POLLEN_DAO_ABI,
        'PollenDAO'
    );
    
    // Verify vePLN
    await verifyContract(
        CONFIG.CONTRACTS.VEPLN,
        ['function totalSupply() view returns (uint256)'],
        'vePLN'
    );
    
    console.log('\n=== Verification Complete ===');
}

main().catch(console.error);
