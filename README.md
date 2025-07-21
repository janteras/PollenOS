
# PollenOS - Multi-Bot AI Trading System

PollenOS is an open-source platform for training and evaluating AI trading bots in a virtual onchain environment powered by the Pollen app on the Base blockchain.

PollenOS enables the deployment of multiple agentic trading bots—each with distinct neural architectures and trading strategies—to simulate cryptocurrency trading in real-time. Bots can take both long and short positions, with every action recorded as a verifiable onchain transaction.

Beyond simulation, PollenOS evaluates bot performance, ranks strategy effectiveness, and identifies the most capable agents tailored to user-defined objectives.

## Who is it for and why use it?

PollenOS is designed for developers, traders, and organizations looking to build, test, and operationalize AI-driven trading systems in a transparent and measurable way.

Once bots have been trained and validated, users can:

1. **Deploy bots for live trading** with higher confidence in their performance
2. **Create prediction markets** that suggest which cryptocurrencies to buy or sell
3. **Generate APIs** delivering market prediction data and actionable trading insights

## System Overview

The current implementation manages 11 trading bots with different strategies on Base Sepolia testnet, each operating with unique configurations and risk profiles. A web-based configuration interface is available for easy setup and monitoring.

## 🌐 Web Interface

The PollenOS web interface provides a user-friendly dashboard to monitor and control your trading bots. Here's how to set it up:

### Prerequisites
- Node.js v14 or higher
- All main project dependencies installed

### Installation

1. First, ensure you have the main project dependencies installed:
   ```bash
   npm install
   ```

2. Navigate to the web interface directory and install its dependencies:
   ```bash
   cd web-interface
   npm install
   cd ..
   ```

### Starting the System

#### Prerequisites
Before starting the web interface, ensure the multi-bot launcher is running to provide real-time data to the web interface.

1. **Start the Multi-Bot Launcher** (in a separate terminal):
   ```bash
   # In the project root directory
   node multi-bot-launcher.js
   ```
   This will initialize and start all configured trading bots.

2. **Start the Web Interface** (in a new terminal):
   ```bash
   # Using npm script (recommended)
   npm run web-interface
   
   # OR manually
   cd web-interface
   node server/config-server.js
   ```
   
   The web interface will be available at: http://localhost:5000

### Accessing the Web Interface
Once started, open your web browser and navigate to:
```
http://localhost:5000
```

### Features
- Real-time bot monitoring
- Portfolio management
- Trading strategy configuration
- Performance analytics
- System status overview

### Troubleshooting
- If port 5000 is in use, you can change it by setting the `PORT` environment variable
- Ensure all required environment variables are properly configured in your `.env` file
- Check the terminal output for any error messages

## 🚀 Quick Start - Launching the Multi-Bot System

### Prerequisites

- Node.js v14 or higher
- Base Sepolia ETH for gas fees
- PLN tokens for trading
- All bot wallets funded and configured

### Step 1: Verify System Configuration

The system is pre-configured with 10 trading bots on Base Sepolia testnet. Check that all configurations are properly set:

```bash
# Verify wallet configurations
node scripts/check-all-wallets.js

# Check funding status
node scripts/check-all-balances.js
```

### Step 2: Launch the Multi-Bot System

**Option 1: Web Interface (User-Friendly)**
- Start the configuration interface: `npm run web-interface`
- Navigate to the provided URL to configure and launch bots
- Use the visual dashboard for monitoring and control

**Option 2: Command Line**
```bash
# Start all 10 bots with live trading
node multi-bot-launcher.js
```

**Option 3: Individual Bot Management**
```bash
# Run single bot for testing
node src/index.js

# Create portfolios if needed
node create-live-portfolios.js

# Advanced live trading engine
node live-trading-engine.js
```

## 🤖 Bot Configuration Overview

The system runs 11 specialized trading bots:

| Bot ID | Name | Strategy | Risk Level | Allocation |
|--------|------|----------|------------|------------|
| 1 | Conservative Bot | Conservative | Low | 15% |
| 2 | Momentum Bot | Momentum | Moderate | 20% |
| 3 | Technical Bot | Technical | Moderate | 20% |
| 4 | Mean Reversion Bot | Mean-Reversion | Moderate | 20% |
| 5 | Breakout Bot | Breakout | High | 25% |
| 6 | Scalping Bot | Scalping | Moderate | 15% |
| 7 | Grid Trading Bot | Grid-Trading | Low | 18% |
| 8 | High-Frequency Bot | High-Frequency | High | 20% |
| 9 | Liquidity Provision Bot | Liquidity-Provision | Moderate | 18% |
| 10 | Cross-Chain Arbitrage Bot | Cross-Chain-Arbitrage | High | 22% |
| 11 | Test Integration Bot | Technical | Moderate | 20% |

## 📊 System Features

### Multi-Bot Orchestration
- **10 Independent Bots**: Each with unique private keys and strategies
- **Staggered Execution**: Prevents API rate limiting
- **Real-time Monitoring**: Live transaction tracking and portfolio updates
- **Automatic Rebalancing**: Strategy-specific portfolio optimization

### Trading Strategies
- **Conservative**: Low-risk, stable allocation patterns
- **Momentum**: Trend-following with RSI and MACD indicators
- **Technical**: Multi-indicator confirmation system
- **Mean-Reversion**: Oversold/overbought asset targeting
- **Breakout**: Support/resistance level analysis
- **Scalping**: High-frequency short-term trading
- **Grid Trading**: Systematic buy/sell grid patterns
- **High-Frequency**: Ultra-fast execution (30-second intervals)
- **Liquidity Provision**: Market-making strategies
- **Cross-Chain Arbitrage**: Multi-chain opportunity detection

### Risk Management
- **Individual Risk Profiles**: Conservative to aggressive settings
- **Portfolio Diversification**: Asset allocation based on strategy
- **Gas Optimization**: Smart gas price management
- **Stop-loss Protection**: Automated risk mitigation

## 🔧 Configuration Files

### Main Configuration
- `config/base-sepolia-pods-default.env` - Primary environment variables
- `config/wallets.js` - Bot wallet configurations
- `multi-bot-launcher.js` - Main orchestration script

### Bot-Specific Configuration
Each bot has its own configuration directory:
- `config/bot1/.env` through `config/bot7/.env`
- Individual wallet private keys and settings

## 🌐 Base Sepolia Integration

### Smart Contracts
- **PLN Token**: `0x9E1c51E1fAa1381D8a7Dbdd19402c5fCce9274C6`
- **Pollen DAO**: `0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7`
- **vePLN Staking**: `0x3a28AB567b661B3edaF9Ef0bDE9489558EDB3995`
- **Leagues**: `0x55F04Ee2775925b80125F412C05cF5214Fd1317a`

### Network Details
- **Chain ID**: 84532 (Base Sepolia)
- **RPC URL**: https://sepolia.base.org
- **Explorer**: https://sepolia.basescan.org

## 📈 Monitoring and Logging

### Real-time Monitoring
```bash
# View live system logs
tail -f logs/multi-bot.log

# Check bot performance
node scripts/bot-status-monitor.js

# Portfolio value tracking
node scripts/check-portfolio-balance.js
```

### Performance Tracking
- Individual bot performance metrics
- Portfolio value monitoring
- Gas cost optimization
- Trading success rates

## 🚨 Troubleshooting

### Common Issues

**1. Bot Validation Errors**
```bash
# Check wallet configurations
node scripts/check-funded-wallets.js
```

**2. Portfolio Creation Issues**
```bash
# Diagnose portfolio problems
node diagnose-bot-portfolios.js

# Create missing portfolios
node create-live-portfolios.js
```

**3. Network Connection Problems**
- Verify Base Sepolia RPC connectivity
- Check wallet funding (ETH for gas, PLN for trading)
- Ensure contract addresses are correct

**4. Trading Failures**
- Monitor gas prices and adjust if needed
- Check for sufficient PLN token balances
- Verify contract interactions are not paused

### Emergency Controls
```bash
# Stop all bots
# Use Ctrl+C in the terminal or stop the workflow

# Check system status
node scripts/comprehensive-portfolio-diagnosis.js

# Verify wallet states
node scripts/diagnose-wallet-state.js
```

## 📝 Development and Testing

### Test Mode
```bash
# Run with test data (no real transactions)
node multi-bot-launcher.js --test
```

### Portfolio Management
```bash
# Check existing portfolios
node verify-existing-portfolios.js

# Analyze portfolio performance
node scripts/analyze-portfolio-creation.js
```

## 🔐 Security Considerations

- **Private Key Management**: Each bot uses separate private keys
- **Environment Variables**: Sensitive data stored in .env files
- **Transaction Limits**: Built-in safety mechanisms
- **Rate Limiting**: API request management

## 📚 Additional Resources

- `docs/README.md` - Comprehensive technical documentation
- `docs/strategies.md` - Detailed strategy explanations
- `Sepolia-Developer-Guide.md` - Base Sepolia development guide
- `logs/` directory - Detailed system logs

## 🎯 Success Indicators

When the system is running correctly, you should see:

✅ All 10 bots validated and funded
✅ Portfolio creation or detection completed
✅ Real-time rebalancing transactions
✅ Strategy-specific trading intervals
✅ Live blockchain transaction confirmations


