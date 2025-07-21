# Base Sepolia Trading Guide

This guide covers trading strategies and best practices for the Pollen trading bot on Base Sepolia testnet.

## Overview

Base Sepolia serves as the testing environment for Pollen protocol trading strategies. All trades are virtual/simulated, allowing safe strategy development and testing without real financial risk.

## Trading Environment

### Network Characteristics

- **Low Gas Costs**: Base Sepolia typically has very low gas fees (< 1 gwei)
- **Fast Block Times**: ~2 second block times for quick transaction confirmation
- **Stable Network**: Reliable testnet infrastructure maintained by Base team
- **EVM Compatible**: Full Ethereum compatibility for smart contract interactions

### Testnet Limitations

- **No Real Value**: All tokens and ETH are testnet only
- **Potential Resets**: Testnet may be reset, losing historical data
- **Limited Liquidity**: Simulated market conditions may not reflect mainnet
- **Faucet Dependency**: Requires testnet ETH from faucets

## Trading Strategies

### Conservative Strategy (Recommended for Testing)

**Configuration:**
```json
{
  "risk_level": "low",
  "max_allocation": 15,
  "rebalance_threshold": 3,
  "trading_interval": 7200000,
  "simulation_mode": true
}
```

**Features:**
- Small position sizes (max 15% per asset)
- Frequent rebalancing (3% threshold)
- 2-hour trading intervals
- Full simulation mode enabled

**Use Cases:**
- Initial strategy development
- Testing new algorithms
- Learning platform mechanics
- Risk management validation

### Aggressive Strategy (Advanced Testing)

**Configuration:**
```json
{
  "risk_level": "medium",
  "max_allocation": 25,
  "rebalance_threshold": 5,
  "trading_interval": 3600000,
  "simulation_mode": true
}
```

**Features:**
- Larger position sizes (max 25% per asset)
- Less frequent rebalancing (5% threshold)
- 1-hour trading intervals
- Advanced risk algorithms

**Use Cases:**
- Strategy optimization
- Performance testing
- Algorithm validation
- Edge case testing

### High-Frequency Strategy (Expert Testing)

**Configuration:**
```json
{
  "risk_level": "high",
  "max_allocation": 20,
  "rebalance_threshold": 2,
  "trading_interval": 1800000,
  "simulation_mode": true
}
```

**Features:**
- Moderate position sizes (max 20% per asset)
- High-frequency rebalancing (2% threshold)
- 30-minute trading intervals
- Maximum responsiveness to market changes

**Use Cases:**
- Real-time strategy testing
- Market making algorithms
- Arbitrage opportunity testing
- Latency optimization

## Risk Management

### Position Sizing

Base Sepolia recommended position sizes:

| Risk Level | Max Per Asset | Total Exposure | Rebalance Threshold |
|------------|---------------|----------------|-------------------|
| Low | 10% | 75% | 2% |
| Medium | 15% | 85% | 3% |
| High | 20% | 95% | 5% |

### Stop-Loss Configuration

```javascript
const stopLossConfig = {
  enableStopLoss: true,
  stopLossPercentage: 0.10, // 10% loss triggers stop
  enableTakeProfit: true,
  takeProfitPercentage: 0.20, // 20% gain triggers take profit
  maxDailyTrades: 20 // Limit trading frequency
};
```

### Gas Management

```javascript
const gasConfig = {
  gasLimit: 500000,
  maxGasPriceGwei: 20, // High for testnet flexibility
  priorityFeeGwei: 0.05,
  enableGasOptimization: true
};
```

## Market Analysis Integration

### TradingView Data

Base Sepolia strategies can use real market data from TradingView:

```javascript
const tradingViewConfig = {
  updateInterval: 600000, // 10 minutes
  indicators: [
    'RSI',
    'MACD',
    'Moving_Average',
    'Bollinger_Bands'
  ],
  timeframes: ['1h', '4h', '1d']
};
```

### Data Sources

1. **Primary**: TradingView real-time data
2. **Secondary**: CoinGecko price feeds
3. **Fallback**: Mock data for testing
4. **Historical**: Cached data for backtesting

## Performance Metrics

### Key Performance Indicators (KPIs)

1. **Return on Investment (ROI)**
   - Measured against initial virtual portfolio value
   - Annualized returns calculation
   - Risk-adjusted returns (Sharpe ratio)

2. **Trading Efficiency**
   - Win/loss ratio
   - Average trade duration
   - Transaction cost impact

3. **Risk Metrics**
   - Maximum drawdown
   - Volatility measures
   - Value at Risk (VaR)

### Monitoring Dashboard

```javascript
const performanceMetrics = {
  totalTrades: 0,
  winningTrades: 0,
  losingTrades: 0,
  totalPnL: 0,
  maxDrawdown: 0,
  sharpeRatio: 0,
  lastUpdated: new Date()
};
```

## Testing Protocols

### Strategy Validation Process

1. **Initial Testing** (1-2 days)
   - Deploy with minimal allocation
   - Monitor basic functionality
   - Verify contract interactions

2. **Extended Testing** (1 week)
   - Increase allocation gradually
   - Test various market conditions
   - Validate risk management

3. **Stress Testing** (2 weeks)
   - Maximum allocation testing
   - Edge case scenarios
   - Performance under load

### Automated Testing

```bash
# Run validation suite
npm run test:base-sepolia

# Validate contract interactions
node src/actions/validate_contracts_base_sepolia.js

# Monitor gas prices
node src/actions/monitor_gas_prices.js
```

## Environment Setup

### Prerequisites

1. **Base Sepolia ETH**: Get from [Base Bridge](https://bridge.base.org/deposit)
2. **Wallet Setup**: Configure MetaMask for Base Sepolia
3. **API Keys**: TradingView, CoinGecko (optional)
4. **Node.js**: Version 14+ required

### Configuration Files

1. **Environment**: `base-sepolia.env`
2. **ElizaOS Config**: `elizaos/base-sepolia-agent.json`
3. **Hardhat Network**: `hardhat.config.js`

### Deployment Steps

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp base-sepolia.env.example base-sepolia.env
# Edit with your settings

# 3. Validate configuration
node src/loaders/load_base_sepolia_config.js

# 4. Start trading bot
npm run start:base-sepolia
```

## Troubleshooting

### Common Issues

1. **RPC Connection Timeouts**
   ```bash
   # Switch to backup RPC
   export BASE_SEPOLIA_RPC_URL=https://base-sepolia-rpc.publicnode.com
   ```

2. **Gas Estimation Failures**
   ```bash
   # Increase gas limit
   export GAS_LIMIT=750000
   ```

3. **Contract Interaction Errors**
   ```bash
   # Validate contracts first
   node src/actions/validate_contracts_base_sepolia.js
   ```

### Debug Mode

Enable comprehensive logging:

```bash
export ENABLE_DEBUG_MODE=true
export LOG_LEVEL=debug
export VERBOSE_LOGGING=true
```

### Performance Issues

Monitor system resources:

```bash
# Check memory usage
node --max-old-space-size=4096 src/index.js

# Monitor event loop lag
npm install -g clinic
clinic doctor -- node src/index.js
```

## Security Best Practices

### Private Key Management

- Use dedicated testnet wallets only
- Never use mainnet private keys
- Rotate keys regularly
- Store keys securely (environment variables)

### Contract Interaction Safety

- Always validate contract addresses
- Use simulation mode initially
- Monitor transaction receipts
- Implement circuit breakers

### Data Protection

- Encrypt sensitive configuration
- Use secure API endpoints
- Implement rate limiting
- Monitor for anomalous activity

## Migration to Mainnet

### Preparation Checklist

- [ ] Strategy thoroughly tested on Base Sepolia
- [ ] Risk management validated
- [ ] Performance metrics satisfactory
- [ ] Security audit completed
- [ ] Mainnet configuration prepared
- [ ] Emergency procedures tested

### Configuration Changes

Key differences for mainnet deployment:

1. **Network**: Change to Base mainnet
2. **Gas Prices**: Use mainnet-appropriate values
3. **Position Sizes**: Reduce for real money
4. **Risk Level**: Start conservative
5. **Monitoring**: Increase alerting

## Resources

- [Base Sepolia Faucet](https://bridge.base.org/deposit)
- [Trading Bot Documentation](../README.md)
- [Risk Management Guide](./risk-management.md)
- [ElizaOS Framework](https://github.com/ai16z/eliza)

## Support

For testing support:
- GitHub Issues: [Pods Repository](https://github.com/janteras/Pods/issues)
- Discord: [Pollen Community](https://discord.gg/pollen)
- Documentation: [Pollen Docs](https://docs.pollen.com)

---

**Note**: This guide is specific to Base Sepolia testnet. All strategies and configurations should be thoroughly tested before any mainnet deployment. 