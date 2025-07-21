const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.sepolia' });

// Sepolia contract addresses from verification
const SEPOLIA_CONTRACTS = {
  VIRTUAL_CONTRACT_ADDRESS: '0x55F04Ee2775925b80125F412C05cF5214Fd1317a', // Leagues contract
  PLN_TOKEN_ADDRESS: '0x9E1c51E1fAa1381D8a7Dbdd19402c5fCce9274C6',
  POLLEN_DAO_ADDRESS: '0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7',
  LEAGUES_CONTRACT_ADDRESS: '0x55F04Ee2775925b80125F412C05cF5214Fd1317a',
  VEPLN_CONTRACT_ADDRESS: '0x3a28AB567b661B3edaF9Ef0bDE9489558EDB3995'
};

// Path to the main config file
const CONFIG_PATH = path.join(__dirname, '../src/config.js');

// Read the current config file
let configContent = fs.readFileSync(CONFIG_PATH, 'utf8');

console.log('🔄 Updating configuration with Sepolia contract addresses...');

// Update each contract address in the config
Object.entries(SEPOLIA_CONTRACTS).forEach(([key, address]) => {
  const regex = new RegExp(`(${key}:\s*['"]).*?(['"])`, 'g');
  if (configContent.match(regex)) {
    configContent = configContent.replace(regex, `$1${address}$2`);
    console.log(`✅ Updated ${key} to ${address}`);
  } else {
    console.log(`⚠️  Could not find ${key} in config`);
  }
});

// Update the network configuration
const networkUpdate = {
  name: 'base-sepolia',
  chainId: 84532,
  rpcUrl: 'https://sepolia.base.org',
  explorerUrl: 'https://sepolia.basescan.org',
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18
  }
};

// Update network config
configContent = configContent.replace(
  /network:\s*{[\s\S]*?}(?=,|\s*\})/,
  `network: ${JSON.stringify(networkUpdate, null, 2)}`
);
console.log('✅ Updated network configuration for Base Sepolia');

// Write the updated config back to file
fs.writeFileSync(CONFIG_PATH, configContent, 'utf8');

console.log('\n🎉 Configuration updated successfully!');
console.log('You can now start the bot with: npm run sepolia:start');
