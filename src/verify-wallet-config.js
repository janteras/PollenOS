
#!/usr/bin/env node

const { ethers } = require('ethers');

async function verifyWalletConfig() {
  console.log('🔍 Verifying Wallet Configuration...');
  
  const mainWallet = '0x561529036AB886c1FD3D112360383D79fBA9E71c';
  const provider = new ethers.JsonRpcProvider('https://avalanche-mainnet.infura.io/v3/60755064a92543a1ac7aaf4e20b71cdf');
  
  // Check if environment wallet matches console output
  const privateKey = process.env.ETHEREUM_PRIVATE_KEY;
  if (privateKey) {
    const wallet = new ethers.Wallet(privateKey);
    console.log(`Environment Wallet: ${wallet.address}`);
    console.log(`Console Log Wallet: ${mainWallet}`);
    console.log(`Match: ${wallet.address.toLowerCase() === mainWallet.toLowerCase() ? '✅' : '❌'}`);
  }
  
  // Check balances
  const avaxBalance = await provider.getBalance(mainWallet);
  console.log(`AVAX Balance: ${ethers.formatEther(avaxBalance)} AVAX`);
  
  const plnContract = new ethers.Contract(
    '0x7b2B702706D9b361dfE3f00bD138C0CFDA7FB2Cf',
    ['function balanceOf(address) view returns (uint256)'],
    provider
  );
  
  const plnBalance = await plnContract.balanceOf(mainWallet);
  console.log(`PLN Balance: ${ethers.formatEther(plnBalance)} PLN`);
  
  if (parseFloat(ethers.formatEther(plnBalance)) === 0) {
    console.log('❌ CRITICAL: No PLN tokens available for trading');
    console.log('🔧 Action Required: Fund wallet with PLN tokens');
  }
}

verifyWalletConfig().catch(console.error);
