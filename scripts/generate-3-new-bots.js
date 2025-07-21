
const { ethers } = require('ethers');

console.log('🔑 Generating 3 new wallet addresses for additional bots...\n');

// Generate Bot 8 (High-Frequency Trading Strategy)
const bot8Wallet = ethers.Wallet.createRandom();
const bot8PrivateKey = bot8Wallet.privateKey.slice(2); // Remove 0x prefix
const bot8Address = bot8Wallet.address;

// Generate Bot 9 (Liquidity Provision Strategy)
const bot9Wallet = ethers.Wallet.createRandom();
const bot9PrivateKey = bot9Wallet.privateKey.slice(2); // Remove 0x prefix
const bot9Address = bot9Wallet.address;

// Generate Bot 10 (Cross-Chain Arbitrage Strategy)
const bot10Wallet = ethers.Wallet.createRandom();
const bot10PrivateKey = bot10Wallet.privateKey.slice(2); // Remove 0x prefix
const bot10Address = bot10Wallet.address;

console.log('✅ Generated Bot 8 (High-Frequency Trading):');
console.log(`   Private Key: ${bot8PrivateKey}`);
console.log(`   Address: ${bot8Address}`);
console.log();

console.log('✅ Generated Bot 9 (Liquidity Provision):');
console.log(`   Private Key: ${bot9PrivateKey}`);
console.log(`   Address: ${bot9Address}`);
console.log();

console.log('✅ Generated Bot 10 (Cross-Chain Arbitrage):');
console.log(`   Private Key: ${bot10PrivateKey}`);
console.log(`   Address: ${bot10Address}`);
console.log();

console.log('📋 Configuration for wallets.js:');
console.log(`{
  id: 8,
  name: 'high_frequency',
  privateKey: '${bot8PrivateKey}'
},
{
  id: 9,
  name: 'liquidity_provision',
  privateKey: '${bot9PrivateKey}'
},
{
  id: 10,
  name: 'cross_chain_arbitrage',
  privateKey: '${bot10PrivateKey}'
}`);

console.log('\n📋 Configuration for multi-bot-launcher.js:');
console.log(`{
  id: 8,
  name: 'High-Frequency Bot',
  strategy: 'high-frequency',
  privateKey: '${bot8PrivateKey}',
  address: '${bot8Address}',
  rebalanceInterval: 30000, // 30 seconds for high-frequency
  enabled: true
},
{
  id: 9,
  name: 'Liquidity Provision Bot',
  strategy: 'liquidity-provision',
  privateKey: '${bot9PrivateKey}',
  address: '${bot9Address}',
  rebalanceInterval: 300000, // 5 minutes
  enabled: true
},
{
  id: 10,
  name: 'Cross-Chain Arbitrage Bot',
  strategy: 'cross-chain-arbitrage',
  privateKey: '${bot10PrivateKey}',
  address: '${bot10Address}',
  rebalanceInterval: 120000, // 2 minutes
  enabled: true
}`);

console.log('\n📋 .env configuration:');
console.log(`BOT8_PRIVATE_KEY=${bot8PrivateKey}`);
console.log(`BOT8_WALLET_ADDRESS=${bot8Address}`);
console.log(`BOT9_PRIVATE_KEY=${bot9PrivateKey}`);
console.log(`BOT9_WALLET_ADDRESS=${bot9Address}`);
console.log(`BOT10_PRIVATE_KEY=${bot10PrivateKey}`);
console.log(`BOT10_WALLET_ADDRESS=${bot10Address}`);

console.log('\n💡 Next steps:');
console.log('1. Fund these wallets with ETH on Base Sepolia');
console.log('2. Fund them with PLN tokens for trading');
console.log('3. Add the configurations above to your bot files');
console.log('4. Monitor their progress on https://beta.pollen.id/');

console.log('\n🎉 3 new bot wallets generated successfully!');
