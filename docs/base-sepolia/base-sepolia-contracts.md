# Base Sepolia Pollen Contracts

This document outlines the Pollen protocol smart contracts deployed on Base Sepolia testnet.

## Network Information

- **Network Name**: Base Sepolia
- **Chain ID**: 84532
- **RPC URL**: https://sepolia.base.org
- **Block Explorer**: https://sepolia.basescan.org
- **Currency**: ETH (testnet)

## Contract Addresses

### Core Pollen Contracts

| Contract | Address | Description |
|----------|---------|-------------|
| PollenDAO | `0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7` | Main governance and protocol management contract |
| Leagues | `0x55F04Ee2775925b80125F412C05cF5214Fd1317a` | Competition and league management system |
| vePLN | `0x3a28AB567b661B3edaF9Ef0bDE9489558EDB3995` | Vote-escrowed PLN token for governance |
| PLN Token | `0x9E1c51E1fAa1381D8a7Dbdd19402c5fCce9274C6` | Base Sepolia PLN token contract |

## Contract Interactions

### PollenDAO Contract

The PollenDAO contract manages the core protocol functionality including:

- Governance proposals and voting
- Protocol parameter updates
- Treasury management
- User registrations and permissions

**Key Functions:**
- `registerUser(address user)` - Register a new user in the system
- `createProposal(string memory description, bytes memory data)` - Create governance proposal
- `vote(uint256 proposalId, bool support)` - Vote on proposals
- `executeProposal(uint256 proposalId)` - Execute approved proposals

### Leagues Contract

Manages trading competitions and leagues:

- League creation and management
- Participant registration
- Performance tracking
- Reward distribution

**Key Functions:**
- `createLeague(string memory name, uint256 duration)` - Create new league
- `joinLeague(uint256 leagueId)` - Join existing league
- `submitPerformance(uint256 leagueId, uint256 score)` - Submit performance data
- `claimRewards(uint256 leagueId)` - Claim league rewards

### vePLN Contract

Vote-escrowed PLN token for governance participation:

- Lock PLN tokens for voting power
- Manage lock durations and amounts
- Calculate voting weights
- Handle lock extensions and withdrawals

**Key Functions:**
- `createLock(uint256 amount, uint256 duration)` - Lock PLN for voting power
- `increaseLockAmount(uint256 amount)` - Increase locked amount
- `increaseLockTime(uint256 duration)` - Extend lock duration
- `withdraw()` - Withdraw after lock expires

### PLN Token Contract

ERC-20 token contract for the Pollen ecosystem:

- Standard ERC-20 functionality
- Minting and burning capabilities
- Transfer restrictions (if any)
- Integration with other protocol contracts

**Key Functions:**
- `transfer(address to, uint256 amount)` - Transfer tokens
- `approve(address spender, uint256 amount)` - Approve spending
- `mint(address to, uint256 amount)` - Mint new tokens (if authorized)
- `burn(uint256 amount)` - Burn tokens

## Security Considerations

### Contract Verification

All contracts should be verified on Basescan before interaction:
1. Visit https://sepolia.basescan.org
2. Search for the contract address
3. Verify the contract code matches expected implementation
4. Check for any recent security audits

### Gas Optimization

Base Sepolia typically has low gas costs, but consider:
- Batch operations when possible
- Use appropriate gas limits (default: 500,000)
- Monitor gas price fluctuations
- Set reasonable maximum gas price (recommended: 20 gwei)

### Error Handling

Common error scenarios and handling:
- **Network connectivity issues**: Implement retry logic with exponential backoff
- **Gas price spikes**: Monitor and pause operations if gas exceeds thresholds
- **Contract pauses**: Check contract status before transactions
- **Insufficient balances**: Validate balances before operations

## Testing and Validation

### Contract Validation Script

Use the provided validation script to verify contract accessibility:

```javascript
const { BaseSepoliaContractValidator } = require('../src/actions/validate_contracts_base_sepolia');

async function validateContracts() {
    const validator = new BaseSepoliaContractValidator();
    const results = await validator.checkContractsAccessibility();
    console.log('Validation Results:', results);
}

validateContracts();
```

### Health Checks

Regular health checks should verify:
- RPC endpoint connectivity
- Contract code presence
- Basic function calls (view functions)
- Gas price monitoring
- Block height progression

## Integration Guidelines

### ElizaOS Framework Integration

When integrating with ElizaOS:

1. **Configuration**: Use `base-sepolia.env` for environment variables
2. **Actions**: Implement Base Sepolia specific actions in `src/actions/base-sepolia/`
3. **Memory**: Store data in `memories/base-sepolia/` directory
4. **Validation**: Run contract validation before each trading session

### Risk Management

For Base Sepolia testing:
- Start with small amounts
- Use simulation mode initially
- Monitor all transactions
- Keep detailed logs
- Test emergency stop procedures

## Troubleshooting

### Common Issues

1. **RPC Connection Failures**
   - Try alternative RPC endpoints
   - Check network connectivity
   - Verify firewall settings

2. **Transaction Failures**
   - Check gas limits and prices
   - Verify contract addresses
   - Ensure sufficient balance

3. **Contract Interaction Errors**
   - Validate ABI compatibility
   - Check function signatures
   - Verify parameter types

### Debug Mode

Enable debug mode for detailed logging:
```bash
export ENABLE_DEBUG_MODE=true
export LOG_LEVEL=debug
```

## Resources

- [Base Sepolia Faucet](https://bridge.base.org/deposit) - Get testnet ETH
- [Base Documentation](https://docs.base.org/) - Official Base docs
- [Basescan](https://sepolia.basescan.org) - Block explorer
- [MetaMask Setup](https://docs.base.org/using-base/) - Wallet configuration

## Updates and Maintenance

This documentation should be updated when:
- Contract addresses change
- New contracts are deployed
- Protocol upgrades occur
- Security recommendations change

Last updated: $(date)
Network: Base Sepolia Testnet 