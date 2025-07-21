# Trading Strategies Guide

This document provides information about the trading strategies implemented in the Pollen Bot and how to customize them for your specific needs.

## Overview

The Pollen Bot implements technical analysis-based trading strategies that analyze market data from TradingView and other sources to make informed trading decisions on the Pollen platform. These strategies generate trading signals, determine portfolio allocation, and decide when rebalancing is needed.

## Available Strategies

### 1. Technical Indicator Strategy

This strategy uses a combination of technical indicators to generate trading signals:

- **RSI (Relative Strength Index)**: Identifies overbought (>70) and oversold (<30) conditions
- **Moving Average Crossovers**: Analyzes EMA20, EMA50, and EMA200 crossovers
- **Price Momentum**: Uses 24-hour price changes to identify strong momentum

#### Configuration Parameters:

- `RISK_LEVEL`: low, medium, or high (affects signal strength)
- `MAX_ALLOCATION_PERCENT`: Maximum percentage allocated to a single asset

### 2. Rebalancing Strategy

Automatically rebalances your portfolio when asset allocations deviate significantly from the target:

#### Configuration Parameters:

- `AUTO_REBALANCE`: true or false
- `REBALANCE_THRESHOLD`: Minimum percentage difference to trigger rebalancing

## Customizing Strategies

### Risk Levels

The bot supports three risk levels:

1. **Low Risk:**
   - Lower position sizes
   - Stricter criteria for buy/sell signals
   - More diversified portfolio

2. **Medium Risk:**
   - Balanced position sizes
   - Standard criteria for buy/sell signals
   - Moderately diversified portfolio

3. **High Risk:**
   - Larger position sizes
   - More aggressive buy/sell signals
   - Higher concentration in fewer assets

### Signal Processing

Each asset receives a signal strength score (-10 to 10) and a confidence score (0 to 1):

- Negative scores suggest selling/reducing position
- Positive scores suggest buying/increasing position
- The confidence score affects the magnitude of allocation changes

## Example Allocation Logic

The allocation engine follows this process:

1. Generate signals for each asset based on technical indicators
2. Sort assets by signal strength (highest to lowest)
3. Allocate to assets with positive signals based on their strength
4. Ensure diversification by respecting max allocation limits
5. If all signals are negative, allocate to a stable asset

## Implementing Your Own Strategy

You can customize the strategy by modifying `src/modules/strategy.js`:

### Custom Signal Generation

To implement your own signal generation logic:

```javascript
function myCustomSignalLogic(assetData, riskLevel) {
  let signal = 0;
  let confidence = 0;
  
  // Your custom logic here
  // Example:
  if (assetData.price > assetData.EMA50 && assetData.RSI < 60) {
    signal = 5;
    confidence = 0.8;
  }
  
  return { signal, confidence };
}
```

Then update the `generateSignals` function to use your custom logic.

### Custom Allocation Logic

To implement your own allocation logic:

```javascript
function myCustomAllocationLogic(signals, maxAllocationPercent) {
  const allocation = {};
  
  // Your custom logic here
  // Example:
  for (const [asset, signal] of Object.entries(signals)) {
    allocation[asset] = calculateMyAllocation(signal, maxAllocationPercent);
  }
  
  return allocation;
}
```

Then update the `determineAllocation` function to use your custom logic.

## Neuron Thesis Configuration

Your Neuron Thesis defines your trading strategy's fundamental approach in the Pollen ecosystem. Examples:

- "Technical analysis based on momentum indicators and moving averages"
- "Value investing focusing on undervalued L2 ecosystem tokens"
- "Trend-following strategy with adaptive position sizing"

## Performance Tracking

The bot tracks the performance of your strategy over time. Performance metrics are stored in log files and can be analyzed to refine your strategy.

## Network-Specific Considerations

Different networks may have different asset availability and liquidity characteristics. Consider these factors when deploying your strategy:

- **Avalanche**: High-performance network with a diverse ecosystem
- **Base**: Ethereum L2 with lower fees and growing ecosystem
- **Testnets**: Use for testing strategies without risking real assets

## Best Practices

1. **Test on Testnets First**: Always test new strategies on testnets before using real assets
2. **Start Small**: Begin with smaller allocation percentages until you're confident in the strategy
3. **Monitor Regularly**: Check the bot's performance and adjust parameters as needed
4. **Diversify**: Don't allocate too much to a single asset
5. **Manage Risk**: Use stop-loss mechanisms and proper position sizing
