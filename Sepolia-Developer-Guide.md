# Pollen Base Sepolia Developer Guide

## Table of Contents
1. [Introduction](#introduction)
2. [Network Configuration](#network-configuration)
3. [Contract Addresses](#contract-addresses)
4. [ABIs](#abis)
5. [Core Functions](#core-functions)
6. [Integration Examples](#integration-examples)
7. [Common Issues & Solutions](#common-issues--solutions)
8. [Best Practices](#best-practices)

## Introduction
This guide provides comprehensive information for developers looking to interact with the Pollen protocol on the Base Sepolia testnet. It covers contract addresses, ABIs, function calls, and example implementations.

## Network Configuration

### Network Details
- **Network Name**: Base Sepolia
- **RPC URL**: `https://sepolia.base.org`
- **Chain ID**: 84532
- **Currency**: ETH (for gas)
- **Block Explorer**: https://sepolia.basescan.org

### Adding to Metamask
```javascript
{
  "chainId": "0x14A34",
  "chainName": "Base Sepolia",
  "rpcUrls": ["https://sepolia.base.org"],
  "nativeCurrency": {
    "name": "Ether",
    "symbol": "ETH",
    "decimals": 18
  },
  "blockExplorerUrls": ["https://sepolia.basescan.org"]
}
```

## Contract Addresses

| Contract | Address |
|----------|---------|
| PLN Token | `0x9E1c51E1fAa1381D8a7Dbdd19402c5fCce9274C6` |
| Portfolio | `0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7` |
| vePLN | `0x3a28AB567b661B3edaF9Ef0bDE9489558EDB3995` |
| Leagues | `0x55F04Ee2775925b80125F412C05cF5214Fd1317a` |

## ABIs

### PLN Token (ERC-20)
```json
[
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address, address) view returns (uint256)",
  "function approve(address, uint256) returns (bool)",
  "function transfer(address, uint256) returns (bool)",
  "function transferFrom(address, address, uint256) returns (bool)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)"
]
```

### Portfolio Contract
```json
[
  "function createPortfolio(uint256 amount, uint256[] calldata weights, bool[] calldata isShort, bool tokenType)",
  "function depositPLN(uint256 amount, address recipient)",
  "function getPortfolio(address user, address token) view returns (uint256[], uint256, uint256, uint256, bool, uint256, uint256, bool[])",
  "function rebalancePortfolio(uint256[] calldata newWeights, bool[] calldata newIsShort)",
  "function withdraw(uint256 amount, address recipient)",
  "event PortfolioCreated(address indexed user, address indexed token, uint256 amount, uint256[] weights, bool[] isShort, bool tokenType)"
]
```

## Core Functions

### 1. Portfolio Creation
```javascript
async function createPortfolio(wallet, amount, weights, isShort, tokenType = false) {
  const portfolio = new ethers.Contract(CONTRACTS.PORTFOLIO, PORTFOLIO_ABI, wallet);
  const plnToken = new ethers.Contract(CONTRACTS.PLN, ERC20_ABI, wallet);
  
  // Approve first
  const approveTx = await plnToken.approve(CONTRACTS.PORTFOLIO, amount);
  await approveTx.wait();
  
  // Create portfolio
  const tx = await portfolio.createPortfolio(
    amount,
    weights,
    isShort,
    tokenType,
    { gasLimit: 1000000 }
  );
  
  return await tx.wait();
}
```

### 2. Deposit to Portfolio
```javascript
async function depositToPortfolio(wallet, amount) {
  const portfolio = new ethers.Contract(CONTRACTS.PORTFOLIO, PORTFOLIO_ABI, wallet);
  const plnToken = new ethers.Contract(CONTRACTS.PLN, ERC20_ABI, wallet);
  
  // Approve first
  const allowance = await plnToken.allowance(wallet.address, CONTRACTS.PORTFOLIO);
  if (allowance.lt(amount)) {
    const approveTx = await plnToken.approve(CONTRACTS.PORTFOLIO, amount);
    await approveTx.wait();
  }
  
  // Deposit
  const tx = await portfolio.depositPLN(
    amount,
    wallet.address, // recipient
    { gasLimit: 500000 }
  );
  
  return await tx.wait();
}
```

### 3. Query Portfolio
```javascript
async function getPortfolio(wallet) {
  const portfolio = new ethers.Contract(CONTRACTS.PORTFOLIO, PORTFOLIO_ABI, wallet);
  const plnToken = new ethers.Contract(CONTRACTS.PLN, ERC20_ABI, wallet);
  const decimals = await plnToken.decimals();
  
  const [weights, totalValue] = await portfolio.getPortfolio(
    wallet.address,
    ethers.constants.AddressZero
  );
  
  return {
    weights: weights.map(w => w.toString()),
    totalValue: ethers.utils.formatUnits(totalValue, decimals)
  };
}
```

## Integration Examples

### 1. Complete Portfolio Lifecycle
```javascript
const { ethers } = require('ethers');

// Configuration
const CONFIG = {
  RPC_URL: 'https://sepolia.base.org',
  CHAIN_ID: 84532,
  CONTRACTS: {
    PLN: '0x9E1c51E1fAa1381D8a7Dbdd19402c5fCce9274C6',
    PORTFOLIO: '0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7',
  }
};

async function main() {
  // Initialize provider and wallet
  const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL, {
    name: 'base-sepolia',
    chainId: CONFIG.CHAIN_ID,
  });
  
  const privateKey = 'YOUR_PRIVATE_KEY';
  const wallet = new ethers.Wallet(privateKey, provider);
  
  // 1. Create a portfolio
  const amount = ethers.utils.parseUnits('10', 18); // 10 PLN
  const weights = [16, 14, 14, 14, 14, 14, 14]; // Must sum to 100
  const isShort = [false, false, false, false, false, false, false];
  
  console.log('Creating portfolio...');
  await createPortfolio(wallet, amount, weights, isShort);
  
  // 2. Deposit more funds
  console.log('Depositing more funds...');
  await depositToPortfolio(wallet, amount);
  
  // 3. Check portfolio
  console.log('Fetching portfolio...');
  const portfolio = await getPortfolio(wallet);
  console.log('Portfolio:', portfolio);
}

main().catch(console.error);
```

## Common Issues & Solutions

### 1. Insufficient Gas
- **Symptom**: Transactions fail with "out of gas"
- **Solution**: Increase gas limit (recommended: 1,000,000 for createPortfolio, 500,000 for deposits)

### 2. Allowance Issues
- **Symptom**: "ERC20: transfer amount exceeds allowance"
- **Solution**: Call `approve()` before `createPortfolio` or `depositPLN`

### 3. Portfolio Already Exists
- **Symptom**: "Portfolio has been initialized"
- **Solution**: Check if portfolio exists before creating a new one

### 4. Weight Validation
- **Symptom**: "Weights should sum to 100"
- **Solution**: Ensure weights array sums to exactly 100

## Best Practices

1. **Always Check Balances**
   - Verify ETH balance for gas
   - Check token balances before transactions

2. **Use Proper Error Handling**
   - Catch and log transaction errors
   - Check transaction receipts for status

3. **Gas Optimization**
   - Use appropriate gas limits
   - Consider gas prices (2-5 Gwei recommended for testnet)

4. **Security**
   - Never hardcode private keys
   - Use environment variables for sensitive data
   - Verify contract addresses before transactions

5. **Testing**
   - Test with small amounts first
   - Verify transactions on the block explorer
   - Monitor gas usage

## Additional Resources
- [Pollen Documentation](https://docs.pollen.id/)
- [Base Sepolia Faucet](https://www.quicknode.com/faucet/base-sepolia)
- [Ethers.js Documentation](https://docs.ethers.io/v5/)

---
*Last Updated: July 3, 2025*
