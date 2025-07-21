# Pollen Protocol - Pods System Status

*Last Updated: July 3, 2025*

## Overview
This document provides a comprehensive overview of the Pollen Protocol's Pods system, including its architecture, components, and known issues. The system is designed to manage cryptocurrency portfolios on the Base Sepolia testnet.

## System Architecture

### Smart Contracts

#### 1. Portfolio Contract (`Portfolio.sol`)
**Address:** `0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7`  
**Purpose:** Manages user portfolios, including deposits, withdrawals, and rebalancing.

**Key Functions:**
- `createPortfolio(uint256, uint256[], bool[], bool)`: Creates a new portfolio with specified parameters.
- `depositPLN(uint256 amount, address recipient)`: Deposits PLN tokens into a portfolio.
- `withdraw(uint256 amount, address recipient)`: Withdraws funds from a portfolio.
- `rebalance(uint256[] newWeights, bool[] newIsShort)`: Rebalances the portfolio according to new weights.
- `getPortfolio(address user, address token)`: Retrieves portfolio details for a user.

#### 2. PLN Token Contract
**Address:** `0x9E1c51E1fAa1381D8a7Dbdd19402c5fCce9274C6`  
**Purpose:** ERC-20 token used within the Pollen ecosystem.

#### 3. vePLN Contract
**Address:** `0x3a28AB567b661B3edaF9Ef0bDE9489558EDB3995`  
**Purpose:** Handles vePLN (vote-escrowed PLN) token mechanics.

## Scripts Inventory

### Core Testing Scripts

1. **`test-funded-wallets.js`**
   - **Purpose:** Main test script for portfolio operations
   - **Key Functions:**
     - `createPortfolioTester()`: Factory function for test instances
     - `depositPLN()`: Handles PLN deposits
     - `withdrawFunds()`: Manages withdrawals
     - `rebalancePortfolio()`: Handles portfolio rebalancing with retries
   - **Dependencies:** ethers.js v5, dotenv

2. **`check-funded-wallets.js`**
   - Verifies wallet balances and portfolio states
   - Checks token allowances and contract interactions

3. **`test-portfolio-creation.js`**
   - Tests portfolio creation with various parameters
   - Validates portfolio initialization

### Token Management

1. **`approve-pln.js`**
   - Approves PLN token spending for Portfolio contract
   - Handles token allowance management

2. **`check-pln-balance.js`**
   - Checks PLN token balances for specified addresses
   - Verifies token holdings across wallets

3. **`check-vepln-balance.js`**
   - Monitors vePLN token balances
   - Tracks staking positions

### Portfolio Management

1. **`create-portfolio.js`**
   - Creates new portfolio instances
   - Handles portfolio initialization

2. **`check-portfolio-state.js`**
   - Monitors portfolio states and values
   - Tracks portfolio performance metrics

3. **`rebalance-portfolio.js`**
   - Handles portfolio rebalancing operations
   - Manages weight adjustments

### Monitoring & Debugging

1. **`monitor-transactions.js`**
   - Tracks transaction statuses
   - Provides real-time monitoring

2. **`check-tx-status.js`**
   - Verifies transaction confirmations
   - Provides detailed transaction info

3. **`debug-portfolio.js`**
   - Debugging tool for portfolio contracts
   - Helps diagnose contract issues

### Utility Scripts

1. **`config-loader.js`**
   - Manages configuration settings
   - Handles environment variables

2. **`gas-estimator.js`**
   - Estimates gas costs for transactions
   - Optimizes transaction parameters

3. **`wallet-utils.js`**
   - Manages wallet operations
   - Handles key management

### Testing & Simulation

1. **`simulate-deposit.js`**
   - Simulates deposit operations
   - Tests deposit flows

2. **`simulate-withdrawal.js`**
   - Tests withdrawal scenarios
   - Validates withdrawal logic

3. **`load-test.js`**
   - Performs stress testing
   - Measures system performance

### Maintenance Scripts

1. **`cleanup-old-data.js`**
   - Removes outdated test data
   - Maintains system cleanliness

2. **`update-addresses.js`**
   - Manages contract addresses
   - Updates deployment references

3. **`verify-deployment.js`**
   - Verifies contract deployments
   - Validates contract bytecode

### Important Notes
- All scripts require proper environment configuration
- Test scripts should be run on testnet first
- Monitor gas prices when executing transactions
- Keep private keys secure and never commit them to version control

## Configuration

### Environment Variables
Required environment variables (stored in `.env` or `.wallets` file):
- `PRIVATE_KEY`: Private key for the wallet interacting with the contracts.
- `RPC_URL`: RPC endpoint URL (defaults to `https://sepolia.base.org`).

### Contract Addresses
Default contract addresses are defined in the scripts but can be overridden via environment variables.

## Known Issues and Workarounds

### 1. Portfolio State Not Updating
**Issue:** After depositing funds, the portfolio state still shows `depositPLN: '0.0'`.
**Workaround:** This might be a contract-level issue. Verify the contract's deposit function and event emissions.

### 2. Gas Price Issues
**Issue:** "Replacement fee too low" errors during high network congestion.
**Workaround:** The system implements automatic retry logic with increasing gas prices (up to 3 retries with 10% increase each time).

### 3. Transaction Failures
**Issue:** Occasional transaction failures due to nonce issues.
**Workaround:** The system includes error handling to retry failed transactions with updated nonces.

## Testing

### Test Cases
1. **Portfolio Creation**
   - Verify successful portfolio creation
   - Check initial state and parameters

2. **Deposit**
   - Test PLN token deposit
   - Verify balance updates

3. **Rebalancing**
   - Test portfolio rebalancing
   - Verify weight updates

4. **Withdrawal**
   - Test partial and full withdrawals
   - Verify fund returns

## Troubleshooting

### Common Errors
1. **Insufficient Gas**
   - **Symptom:** Transactions fail with "out of gas"
   - **Solution:** Increase gas limit in transaction parameters

2. **Nonce Issues**
   - **Symptom:** "nonce too low" errors
   - **Solution:** Clear pending transactions or wait for them to be mined

3. **Contract Interaction Failures**
   - **Symptom:** "execution reverted" errors
   - **Solution:** Verify contract ABI and function parameters

## Future Improvements

1. **Enhanced Error Handling**
   - Implement more granular error messages
   - Add transaction simulation before execution

2. **Gas Optimization**
   - Implement dynamic gas estimation
   - Add gas price oracles for better fee prediction

3. **Monitoring**
   - Add transaction confirmation monitoring
   - Implement health checks for contract interactions

4. **Documentation**
   - Add inline code documentation
   - Create user guides for common operations

## Contributing

### Development Setup
1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables in `.env` or `.wallets`

3. Run tests:
   ```bash
   node scripts/test-funded-wallets.js
   ```

### Code Style
- Follow JavaScript Standard Style
- Use ES6+ features where applicable
- Add JSDoc comments for all functions

## License
[Specify License]

## Contact
[Team/Developer Contact Information]
