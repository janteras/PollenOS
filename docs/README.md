# Pollen Trading Bot Documentation

## Table of Contents

1. [Introduction](#introduction)
2. [System Architecture](#system-architecture)
3. [Key Features](#key-features)
4. [Developer Guide](#developer-guide)
   - [Project Structure](#project-structure)
   - [Key Components](#key-components)
   - [Running Locally](#running-locally)
5. [Configuration](#configuration)
   - [Environment Variables](#environment-variables)
   - [Bot Settings](#bot-settings)
6. [Trading Strategies](#trading-strategies)
7. [Performance Monitoring](#performance-monitoring)
8. [Security Considerations](#security-considerations)
9. [Troubleshooting](#troubleshooting)
10. [FAQ](#faq)

---

## Introduction

The Pollen Trading Bot is an automated trading system built on the elizaOS framework that connects to TradingView for market data and executes trades on the Pollen app. The bot supports multiple trading strategies across various cryptocurrencies and can run multiple bot instances simultaneously, each with unique configurations and risk profiles.

This document provides a comprehensive guide to understanding, configuring, and deploying the Pollen Trading Bot.

---

## System Architecture

The Pollen Trading Bot is designed with a modular architecture focusing on reliability, performance, and risk management. It consists of the following core systems:

1. **Data Provider Layer**: Fetches market data from multiple sources (TradingView, CoinGecko, CryptoCompare, Binance) with automatic failover
2. **Strategy Layer**: Analyzes market data and generates trading decisions
3. **Execution Layer**: Connects to the blockchain and executes trades on the Pollen platform
4. **Management Layer**: Multi-bot launcher that manages multiple trading instances
5. **Risk Management Layer**: Monitors performance and implements safety measures like stop-loss
6. **Support Systems**: Caching, validation, notifications, and logging

The following diagram shows how these components interact:

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│                 │      │                  │      │                 │
│  Data Sources   │─────▶│  Trading Engine  │─────▶│  Pollen Smart   │
│  (Market Data)  │      │  (Strategies)    │      │  Contracts      │
│                 │      │                  │      │                 │
└─────────────────┘      └──────────────────┘      └─────────────────┘
        ▲                        ▲                         ▲
        │                        │                         │
        │                        │                         │
        │                        │                         │
        │                 ┌──────────────────────────────────────────┐
        │                 │                                          │
        └─────────────────│           Multi-Bot Launcher             │◀───┐
                          │                                          │    │
                          └──────────────────────────────────────────┘    │
                                              ▲                           │
                                              │                           │
                                              │                           │
                                     ┌────────────────────┐               │
                                     │                    │               │
                                     │  Configuration &   │───────────────┘
                                     │  Environment       │
                                     │                    │
                                     └────────────────────┘
```

---

## Key Features

### Multi-Bot System
- Run up to 5 trading bots from a single instance
- Each bot operates with a unique private key and configuration
- Staggered execution to prevent API rate limiting

### Advanced Trading Strategies
- **Momentum**: Allocates more to assets with positive price momentum
- **Mean-Reversion**: Buys oversold assets expecting a return to mean
- **Technical-Conservative**: Uses technical indicators for safer trades
- **Breakout**: Identifies assets breaking through resistance levels
- **Multi-Timeframe**: Combines multiple strategies for balanced approach

### Risk Management
- Stop-loss protection to limit downside
- Performance tracking across strategies
- Anomaly detection for unusual market conditions
- Defensive portfolio allocation during high-risk periods

### Data Management
- Local caching to reduce API calls by 70-80%
- Data validation to protect against corrupted data
- Multi-source data provider with automatic failover

### System Reliability
- Extended backoff for API requests to avoid rate limiting
- Comprehensive error handling and recovery mechanisms
- Detailed logging and notifications

---

## Developer Guide

### Project Structure

```
pollen-bot/
├── config/            # Configuration files and .env files
│   ├── bot1/          # Bot 1 specific configuration
│   ├── bot2/          # Bot 2 specific configuration
│   └── ...
├── cache/             # Local cache storage
├── data/              # Data storage for performance metrics
│   └── performance/   # Performance tracking data
├── docs/              # Documentation
├── elizaos/           # elizaOS framework files
├── logs/              # Log files
│   └── notifications/ # Notification logs
├── src/               # Source code
│   ├── modules/       # Core modules
│   │   ├── cache-manager.js       # Caching system
│   │   ├── data-validator.js      # Data validation
│   │   ├── logger.js              # Logging utilities
│   │   ├── market-data-sources.js # Market data providers
│   │   ├── mock-data.js           # Test mode data generator
│   │   ├── notification-manager.js # Notification system
│   │   ├── performance-tracker.js # Performance monitoring
│   │   ├── pollen-api.js          # Pollen smart contract interface
│   │   ├── rpcProvider.js         # Blockchain provider interface
│   │   └── tradingview.js         # TradingView integration
│   ├── index.js       # Main bot logic
│   ├── multi-bot.js   # Multi-bot launcher
│   └── setup.js       # Setup wizard
└── package.json       # Dependencies and scripts
```

### Key Components

#### 1. Multi-Bot Launcher (`src/multi-bot.js`)

The multi-bot launcher is responsible for initializing and running multiple bot instances with different configurations. It:

- Creates separate configuration directories for each bot
- Launches bot processes with staggered timing to avoid API rate limits
- Manages environment variables for each bot instance
- Provides command line options for test mode and extended backoff

#### 2. Trading Engine (`src/index.js`)

The main trading engine that:

- Connects to blockchain and smart contracts
- Fetches and analyzes market data
- Implements trading strategies
- Executes portfolio updates
- Manages risk through stop-loss and other measures

#### 3. Market Data Module (`src/modules/tradingview.js` and `src/modules/market-data-sources.js`)

Responsible for:

- Fetching market data from TradingView and other sources
- Implementing data caching and validation
- Providing failover mechanisms when primary sources fail
- Calculating technical indicators for trading decisions

#### 4. Pollen API Module (`src/modules/pollen-api.js`)

Handles all interactions with the Pollen smart contracts:

- Connects to the blockchain with correct wallet
- Retrieves current portfolio status
- Executes portfolio updates and rebalances
- Handles transaction signing and submission

#### 5. Performance Tracker (`src/modules/performance-tracker.js`)

Tracks trading performance:

- Records portfolio value over time
- Calculates key metrics (returns, win/loss ratio)
- Implements stop-loss mechanisms
- Generates performance reports

### Running Locally

To run the Pollen Trading Bot locally:

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd pollen-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up configuration**
   ```bash
   # Copy example .env file
   cp config/.env.example config/.env
   
   # Edit the .env file with your credentials
   nano config/.env
   ```

4. **Run the setup wizard** (optional)
   ```bash
   npm run setup
   ```

5. **Start the bot**
   
   To run a single bot:
   ```bash
   npm start
   ```
   
   To run the multi-bot system:
   ```bash
   npm run multi
   ```
   
   To run in test mode with simulated data:
   ```bash
   npm run multi -- --test
   ```
   
   To run with extended backoff for API requests:
   ```bash
   npm run multi -- --extended-backoff
   ```

---

## Configuration

### Environment Variables

The Pollen Trading Bot requires several environment variables to operate. These should be stored in the `.env` file in the `config` directory for the main bot, or in bot-specific directories (e.g., `config/bot1/.env`) for multi-bot setups.

#### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NETWORK` | Blockchain network to use | `avalanche` |
| `INFURA_API_KEY` | Infura API key for blockchain access | `abcd1234...` |
| `ETHEREUM_PRIVATE_KEY` | Private key for the trading wallet | `0x123...` |
| `POLLEN_CONTRACT_AVALANCHE` | Pollen contract address on Avalanche | `0xabc...` |
| `BOT_ID` | Unique identifier for this bot | `1` |

#### Optional Environment Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `TRADING_THESIS` | Trading thesis description | `"Trading based on technical indicators"` | `"Mean reversion strategy"` |
| `STRATEGY` | Trading strategy to use | `"momentum"` | `"mean-reversion"` |
| `RISK_LEVEL` | Risk level for trading | `"moderate"` | `"conservative"` |
| `STOP_LOSS_PERCENT` | Stop-loss threshold percentage | `5` | `3` |
| `MAX_ALLOCATION` | Maximum portfolio allocation percentage | `80` | `70` |
| `TRADING_INTERVAL_MS` | Interval between trading cycles (ms) | `43200000` (12 hours) | `3600000` (1 hour) |
| `LOG_LEVEL` | Logging verbosity | `"info"` | `"debug"` |
| `TEST_MODE` | Enable test mode with simulated data | `"false"` | `"true"` |
| `EXTENDED_BACKOFF` | Use extended backoff for API requests | `"false"` | `"true"` |
| `NOTIFY_EMAIL` | Enable email notifications | `"false"` | `"true"` |
| `EMAIL_ADDRESS` | Email address for notifications | `null` | `"user@example.com"` |

### Bot Settings

The `BOT_STRATEGIES` array in `multi-bot.js` defines the characteristics of each bot:

```javascript
const BOT_STRATEGIES = [
  {
    name: 'Momentum',
    thesis: 'Trading based on technical indicators and market trends',
    riskLevel: 'moderate',
    maxAllocation: 80 // percentage
  },
  {
    name: 'Mean-Reversion',
    thesis: 'Buying oversold assets and selling overbought assets',
    riskLevel: 'conservative',
    maxAllocation: 70
  },
  // ...other strategies
];
```

---

## Trading Strategies

The Pollen Trading Bot implements multiple trading strategies to adapt to different market conditions:

### Momentum Strategy

**Description**: Allocates more to assets with positive price momentum.

**Implementation**:
- Assets are ranked by 24h price change
- 40% allocation to top-performing asset
- 30% to second performer
- Remaining allocation distributed among other assets
- Aggressive configuration skips assets with negative momentum

**Risk Level**:
- Conservative: Uses all assets with even allocation
- Moderate: Focuses on top 4 performers
- Aggressive: Focuses on top 3 performers with positive momentum only

### Mean-Reversion Strategy

**Description**: Buys oversold assets expecting a return to the mean.

**Implementation**:
- Assets are ranked by negative 24h price change (most oversold first)
- RSI below 30 indicates oversold conditions
- 35% allocation to most oversold asset
- 25% to second most oversold
- Remaining allocation distributed among other assets

**Risk Level**:
- Conservative: Buys all oversold assets
- Moderate: Focuses on top 4 oversold assets
- Aggressive: Only buys assets with RSI below 30

### Technical-Conservative Strategy

**Description**: Uses technical indicators for safer trading decisions.

**Implementation**:
- Assets are scored based on technical indicators:
  - Price above EMA200 (+1 point)
  - Price above EMA50 (+1 point)
  - EMA20 above EMA50 (+1 point)
  - RSI between 40-60 (+1 point)
  - MACD positive (+1 point)
- Allocates to assets with highest scores

### Breakout Strategy

**Description**: Identifies assets breaking through resistance levels.

**Implementation**:
- Identifies breakout conditions:
  - Price above upper Bollinger Band
  - Strong volume increase
  - RSI not overbought (below 70)
- Allocates evenly among breakout assets
- Falls back to momentum strategy if no breakouts found

### Multi-Timeframe Strategy

**Description**: Combines multiple strategies for a balanced approach.

**Implementation**:
- 50% allocation using momentum strategy
- 50% allocation using technical-conservative strategy
- Combines allocations for final portfolio

---

## Performance Monitoring

The Pollen Trading Bot includes comprehensive performance monitoring:

### Metrics Tracked

- **Portfolio Value**: Tracked over time
- **Total Return**: Percentage return since inception
- **Daily Change**: Day-to-day percentage changes
- **Win/Loss Ratio**: Ratio of winning to losing trades
- **Maximum Drawdown**: Largest peak-to-trough decline
- **Sharpe Ratio**: Risk-adjusted return metric

### Stop-Loss Mechanism

The stop-loss system protects capital during adverse market conditions:

1. Continuously monitors portfolio value
2. Compares current value to historical value (typically 24h lookback)
3. Triggers defensive action when decline exceeds threshold (default 5%)
4. Reallocates to safer assets (primarily BTC and ETH)
5. Records stop-loss events for analysis

### Performance Reports

Performance reports are generated automatically and include:

- Strategy effectiveness
- Asset allocation
- Return metrics
- Risk metrics
- Stop-loss events
- Daily returns analysis

---

## Security Considerations

### Private Key Management

Private keys are extremely sensitive information. The Pollen Trading Bot implements several security measures:

1. Private keys are stored in `.env` files which are not committed to version control
2. Each bot has its own private key in a separate directory
3. Keys are loaded into memory only when needed
4. No plaintext storage of keys in logs or regular files

### API Key Security

Similar to private keys, API keys should be treated securely:

1. Store in `.env` files, not in code
2. Use separate API keys for different purposes when possible
3. Implement rate limiting to avoid API key bans

### Network Security

- The bot connects to blockchain networks using secure RPC endpoints
- Infura API provides secure, reliable access to the blockchain
- Multiple RPC providers ensure continuity if one provider fails

---

## Troubleshooting

### Common Issues and Solutions

#### API Rate Limiting

**Symptoms**: Frequent 403 Forbidden errors, failed API calls

**Solutions**:
- Use `--extended-backoff` flag to increase delays between API calls
- Consider subscribing to paid API services for higher rate limits
- Implement API keys for services that offer them
- Reduce the number of concurrent bots

#### Blockchain Connection Issues

**Symptoms**: Failed transactions, "cannot connect to provider" errors

**Solutions**:
- Check Infura API key validity
- Ensure network settings are correct
- Verify private key is valid and has funds
- Check for blockchain network outages

#### Transaction Failures

**Symptoms**: "Transaction reverted", "Out of gas", or other blockchain errors

**Solutions**:
- Check wallet balance for sufficient funds
- Verify contract addresses are correct
- Ensure slippage parameters are reasonable
- Check if smart contract is paused or upgraded

#### ENS Network Errors

**Symptoms**: "network does not support ENS" errors, failed portfolio updates

**Solutions**:
- Ensure network configuration explicitly disables ENS with `ensAddress: null`
- Verify network name matches expected values ('avalanche', 'base')
- Check that all providers use consistent network configuration
- Restart bot after configuration changes

#### Strategy Performance

**Symptoms**: Poor trading results, unexpected allocations

**Solutions**:
- Review performance metrics and adjust strategy parameters
- Consider changing risk level
- Check if market conditions match strategy assumptions
- Implement a different strategy better suited to current market

---

## FAQ

**Q: How many bots can I run simultaneously?**

A: The system supports up to 5 bots by default, but this can be adjusted in the `multi-bot.js` file by changing the `BOT_COUNT` constant. Be mindful of API rate limits when increasing this number.

**Q: Do I need a TradingView subscription?**

A: No, the bot uses public TradingView data by default. However, a subscription can provide access to more indicators and higher data resolution.

**Q: How much cryptocurrency do I need to run the bot?**

A: This depends on the network you're using. You'll need enough native tokens (e.g., AVAX for Avalanche) to cover transaction fees, plus the assets you want to trade.

**Q: How often does the bot trade?**

A: By default, the bot trades every 12 hours, but this can be adjusted using the `TRADING_INTERVAL_MS` environment variable.

**Q: Is the bot profitable?**

A: Profitability depends on market conditions, chosen strategy, and risk settings. The bot includes performance tracking to help you evaluate and optimize your strategies.

**Q: Can I run the bot in the cloud?**

A: Yes, the bot can run on any system with Node.js. Cloud deployment is recommended for 24/7 operation, but ensure you secure your environment variables and private keys.

**Q: Does the bot support tokens other than those listed?**

A: Yes, you can modify the `SUPPORTED_ASSETS` array in the `tradingview.js` file to add support for additional tokens. Ensure they are available on both TradingView and Pollen.

---

*This documentation is current as of May 2025. For the latest updates, please refer to the project repository.*
