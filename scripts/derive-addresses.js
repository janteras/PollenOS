#!/usr/bin/env node

const { ethers } = require('ethers');

// Private keys provided
const privateKeys = [
  'd74ae2c1a798042c9bbf56f15d2649df6d114e763f9444e2cddcde050900f1d0',
  '241083ae625b93b41b555052840c09458c71704889b22774101d21b4d1482e62',
  '0aa4b2f50b7efc44721b23a2ef7fc3ab11b658369af23381752c6d86b42628b1',
  '7dde37bea0f47ea849c9a7a285f3a277acd81c908accdb501ca036db1a5b11da',
  '64da71a2688d24c0f970ded84d2d744081e467ae493f4c3256c4f8ee9bb959ee'
];

// Function to validate and format private key
function validatePrivateKey(pk) {
  // Remove any whitespace
  const cleanPk = pk.trim();
  // Add leading zero if needed (for keys that are 63 chars long)
  return cleanPk.length === 63 ? '0' + cleanPk : cleanPk;
}

console.log('Deriving wallet addresses from private keys...\n');

// Process each private key
try {
  const results = privateKeys.map((pk, index) => {
    try {
      const validPk = validatePrivateKey(pk);
      const wallet = new ethers.Wallet(validPk);
      
      return {
        privateKey: pk,
        address: wallet.address,
        isValid: true,
        error: null
      };
    } catch (error) {
      return {
        privateKey: pk,
        address: null,
        isValid: false,
        error: error.message
      };
    }
  });

  // Display results
  console.log('='.repeat(80));
  console.log(' DERIVED WALLET ADDRESSES');
  console.log('='.repeat(80));
  
  results.forEach((result, index) => {
    console.log(`\n🔑 Private Key ${index + 1}:`);
    console.log(`   ${result.privateKey}`);
    
    if (result.isValid) {
      console.log(`✅ Valid private key`);
      console.log(`📬 Address: ${result.address}`);
      
      // Generate the .env variable line
      if (index === 0) {
        console.log('\n📋 Add this to your .env.sepolia file:');
        console.log(`BOT_WALLET_ADDRESS=${result.address}`);
      } else {
        console.log(`BOT${index + 1}_WALLET_ADDRESS=${result.address}`);
      }
    } else {
      console.error(`❌ Invalid private key: ${result.error}`);
    }
    
    console.log('─'.repeat(80));
  });
  
  // Generate the complete .env section
  console.log('\n📋 Complete .env.sepolia section:');
  console.log('# Bot Wallets');
  results.forEach((result, index) => {
    if (result.isValid) {
      const varName = index === 0 ? 'BOT_WALLET_ADDRESS' : `BOT${index + 1}_WALLET_ADDRESS`;
      console.log(`${varName}=${result.address}`);
    }
  });
  
} catch (error) {
  console.error('Error deriving addresses:', error);
  process.exit(1);
}
