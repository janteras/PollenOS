
#!/usr/bin/env node

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

console.log('🔑 Generating new private keys for Bot 6 and Bot 7...\n');

// Generate Bot 6 (Scalping Strategy)
const bot6Wallet = ethers.Wallet.createRandom();
const bot6PrivateKey = bot6Wallet.privateKey.slice(2); // Remove 0x prefix
const bot6Address = bot6Wallet.address;

// Generate Bot 7 (Grid Trading Strategy)
const bot7Wallet = ethers.Wallet.createRandom();
const bot7PrivateKey = bot7Wallet.privateKey.slice(2); // Remove 0x prefix
const bot7Address = bot7Wallet.address;

console.log('✅ Generated Bot 6 (Scalping Strategy):');
console.log(`   Private Key: ${bot6PrivateKey}`);
console.log(`   Address: ${bot6Address}`);
console.log();

console.log('✅ Generated Bot 7 (Grid Trading Strategy):');
console.log(`   Private Key: ${bot7PrivateKey}`);
console.log(`   Address: ${bot7Address}`);
console.log();

// Update base-sepolia-pods-default.env
const envPath = path.join(__dirname, '..', 'config', 'base-sepolia-pods-default.env');
let envContent = fs.readFileSync(envPath, 'utf8');

// Replace Bot 6 placeholders
envContent = envContent.replace('BOT6_WALLET_ADDRESS=WILL_BE_GENERATED', `BOT6_WALLET_ADDRESS=${bot6Address}`);
envContent = envContent.replace('BOT6_PRIVATE_KEY=WILL_BE_GENERATED', `BOT6_PRIVATE_KEY=${bot6PrivateKey}`);

// Replace Bot 7 placeholders
envContent = envContent.replace('BOT7_WALLET_ADDRESS=WILL_BE_GENERATED', `BOT7_WALLET_ADDRESS=${bot7Address}`);
envContent = envContent.replace('BOT7_PRIVATE_KEY=WILL_BE_GENERATED', `BOT7_PRIVATE_KEY=${bot7PrivateKey}`);

fs.writeFileSync(envPath, envContent);
console.log('✅ Updated config/base-sepolia-pods-default.env');

// Update multi-bot-launcher.js
const launcherPath = path.join(__dirname, '..', 'multi-bot-launcher.js');
let launcherContent = fs.readFileSync(launcherPath, 'utf8');

// Replace Bot 6 placeholders
launcherContent = launcherContent.replace(
  /privateKey: 'WILL_BE_GENERATED', \/\/ Update after key generation[\s\S]*?address: 'WILL_BE_GENERATED',   \/\/ Update after key generation/,
  `privateKey: '${bot6PrivateKey}',
    address: '${bot6Address}',`
);

// Replace Bot 7 placeholders (find the second occurrence)
const bot7Pattern = /privateKey: 'WILL_BE_GENERATED', \/\/ Update after key generation[\s\S]*?address: 'WILL_BE_GENERATED',   \/\/ Update after key generation/;
const matches = launcherContent.match(new RegExp(bot7Pattern.source, 'g'));
if (matches && matches.length >= 2) {
  // Replace the second occurrence (Bot 7)
  let count = 0;
  launcherContent = launcherContent.replace(bot7Pattern, (match) => {
    count++;
    if (count === 2) {
      return `privateKey: '${bot7PrivateKey}',
    address: '${bot7Address}',`;
    }
    return match;
  });
}

fs.writeFileSync(launcherPath, launcherContent);
console.log('✅ Updated multi-bot-launcher.js');

// Update config/wallets.js
const walletsPath = path.join(__dirname, '..', 'config', 'wallets.js');
let walletsContent = fs.readFileSync(walletsPath, 'utf8');

walletsContent = walletsContent.replace(/privateKey: 'WILL_BE_GENERATED' \/\/ Update after key generation/g, (match, offset) => {
  // First occurrence is Bot 6, second is Bot 7
  const beforeMatch = walletsContent.substring(0, offset);
  const bot6Count = (beforeMatch.match(/name: 'scalping'/g) || []).length;
  
  if (bot6Count > 0) {
    return `privateKey: '${bot7PrivateKey}'`;
  } else {
    return `privateKey: '${bot6PrivateKey}'`;
  }
});

fs.writeFileSync(walletsPath, walletsContent);
console.log('✅ Updated config/wallets.js');

console.log('\n🎉 Successfully generated and configured 2 new bots!');
console.log('\n📋 Summary:');
console.log(`Bot 6 (Scalping): ${bot6Address}`);
console.log(`Bot 7 (Grid Trading): ${bot7Address}`);
console.log('\n💡 Next steps:');
console.log('1. Fund these wallets with ETH on Base Sepolia');
console.log('2. Fund them with PLN tokens for trading');
console.log('3. Monitor their progress on https://beta.pollen.id/');
console.log('4. Run the multi-bot system to start trading');
