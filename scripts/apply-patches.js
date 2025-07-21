const fs = require('fs');
const path = require('path');

// Load the network patch
const networkPatch = require('../src/config/network-patch');

// Path to main config file
const configPath = path.join(__dirname, '../src/config.js');

console.log('🔄 Applying configuration patches...');

// Read the current config
let configContent = fs.readFileSync(configPath, 'utf8');

// Apply network patch
configContent = configContent.replace(
  /network:\s*{[\s\S]*?}(?=,|\s*\})/, 
  `network: ${JSON.stringify(networkPatch.network, null, 2)}`
);

// Apply contract addresses
configContent = configContent.replace(
  /contracts:\s*{[\s\S]*?}(?=,|\s*\})/,
  `contracts: ${JSON.stringify(networkPatch.contracts, null, 2)}`
);

// Add skipNetworkValidation if not present
if (!configContent.includes('skipNetworkValidation')) {
  configContent = configContent.replace(
    /(const config = \{)/,
    `$1
  skipNetworkValidation: true,`
  );
}

// Write the updated config back
fs.writeFileSync(configPath, configContent, 'utf8');

console.log('✅ Configuration patches applied successfully!');
console.log('You can now start the bot with: npm run sepolia:start');
