#!/usr/bin/env node

/**
 * Multi-bot launcher for Pollen Trading Bot
 * Runs multiple instances of the trading bot with different configurations
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const logger = require('./modules/logger');
const botStatusMonitor = require('./modules/bot-status-monitor');

// Import keep-alive server for cloud platform deployment
let keepAliveServer;
try {
  keepAliveServer = require('./keep-alive');
  console.log('\x1b[32mKeep-alive server initialized to prevent idle timeout\x1b[0m');
} catch (error) {
  // Keep-alive server is optional, no error if not available
  console.log('Keep-alive server not available, skipping initialization');
}

// Start health check server
try {
  require('./health-check');
  console.log('\x1b[32mHealth check server initialized on port 3002\x1b[0m');
} catch (error) {
  console.log('Health check server not available, skipping initialization');
}

// Configuration for each bot
const BOT_COUNT = 5;
const STAGGER_TIME = 2 * 60 * 1000; // 2 minutes between bot starts
const TEST_MODE = process.argv.includes('--test'); // Enable test mode via command line
const EXTENDED_BACKOFF = process.argv.includes('--extended-backoff'); // Enable extended backoff for API calls

// Bot strategy configurations
const BOT_STRATEGIES = [
  {
    name: 'Momentum',
    description: 'Follows market trends using RSI and MACD momentum indicators',
    risk_level: 'medium',
    thesis: 'Trading based on momentum indicators and trend following',
    max_allocation: 25,
    private_key_env: 'ETHEREUM_PRIVATE_KEY'
  },
  {
    name: 'Mean-Reversion',
    description: 'Buys oversold assets and sells overbought assets based on oscillators',
    risk_level: 'medium-high',
    thesis: 'Trading based on mean reversion using oscillator indicators',
    max_allocation: 20,
    private_key_env: 'ETHEREUM_PRIVATE_KEY_BOT2'
  },
  {
    name: 'Technical-Conservative',
    description: 'Conservative approach using multiple indicator confirmation',
    risk_level: 'low',
    thesis: 'Trading based on multiple technical indicators with strict confirmation rules',
    max_allocation: 15,
    private_key_env: 'ETHEREUM_PRIVATE_KEY_BOT3'
  },
  {
    name: 'Breakout',
    description: 'Targets breakouts from key levels and patterns',
    risk_level: 'high',
    thesis: 'Trading based on breakouts from key support/resistance levels',
    max_allocation: 30,
    private_key_env: 'ETHEREUM_PRIVATE_KEY_BOT4'
  },
  {
    name: 'Multi-Timeframe',
    description: 'Analyzes multiple timeframes for confluence',
    risk_level: 'medium',
    thesis: 'Trading based on multi-timeframe analysis for stronger signals',
    max_allocation: 20,
    private_key_env: 'ETHEREUM_PRIVATE_KEY_BOT5'
  }
];

/**
 * Launch multiple bot instances with staggered timing
 */
async function launchBots() {
  console.log('\n\x1b[36m=================================================\x1b[0m');
  console.log('\x1b[36m           Pollen Multi-Bot Launcher\x1b[0m');
  console.log('\x1b[36m=================================================\x1b[0m\n');

  // Check if running on cloud platform (Render, Qoddi, etc)
  if (process.env.RENDER) {
    console.log(`\x1b[33mRunning on Render.com with keep-alive server on port ${process.env.PORT}\x1b[0m\n`);
  } else if (process.env.PORT) {
    console.log(`\x1b[33mRunning in cloud platform mode with keep-alive server on port ${process.env.PORT}\x1b[0m\n`);
  }

  if (TEST_MODE) {
    console.log('\x1b[33mRunning in TEST MODE - using simulated data and transactions\x1b[0m\n');
  }

  if (EXTENDED_BACKOFF) {
    console.log('\x1b[33mRunning with EXTENDED BACKOFF - increasing delays between API calls\x1b[0m\n');
  }

  // Create directories for each bot if they don't exist
  for (let i = 1; i <= BOT_COUNT; i++) {
    const botDir = path.resolve(`./config/bot${i}`);
    if (!fs.existsSync(botDir)) {
      fs.mkdirSync(botDir, { recursive: true });
    }
  }

  // Check if base config exists
  const baseConfigPath = path.resolve('./config/.env');
  if (!fs.existsSync(baseConfigPath)) {
    console.error('\x1b[31mBase configuration not found. Please run setup first.\x1b[0m');
    process.exit(1);
  }

  // Load base configuration
  const baseConfig = fs.readFileSync(baseConfigPath, 'utf8');

  // Configure each bot with its strategy
  for (let i = 1; i <= BOT_COUNT; i++) {
    // Get strategy for this bot (use modulo to handle if BOT_COUNT > strategies)
    const strategyIndex = (i - 1) % BOT_STRATEGIES.length;
    const strategy = BOT_STRATEGIES[strategyIndex];

    console.log(`\x1b[36mConfiguring Bot ${i}: ${strategy.name} Strategy\x1b[0m`);

    // Start with the base config (read fresh each time)
    let botConfig = fs.readFileSync(baseConfigPath, 'utf8');

    // Replace BOT_ID
    botConfig = botConfig.replace(/BOT_ID=\d+/, `BOT_ID=${i}`);

    // Ensure bot-specific configuration
    botConfig = botConfig.replace(/STRATEGY_NAME=.*/, `STRATEGY_NAME="${strategy.name}"`);
    botConfig = botConfig.replace(/BOT_INDEX=.*/, `BOT_INDEX=${i}`);
    botConfig = botConfig.replace(/STRATEGY=.*/, `STRATEGY="${strategy.name.toLowerCase().replace('-', '_')}"`);
    botConfig = botConfig.replace(/RISK_LEVEL=.*/, `RISK_LEVEL="${strategy.risk_level}"`);
    botConfig = botConfig.replace(/NEURON_THESIS=.*/, `NEURON_THESIS="${strategy.thesis}"`);

    // Set the appropriate private key environment variable for this bot
    const privateKeyEnvVar = strategy.private_key_env || 'ETHEREUM_PRIVATE_KEY';
    const privateKeyValue = process.env[privateKeyEnvVar];

    if (privateKeyValue) {
      botConfig = botConfig.replace(
        /ETHEREUM_PRIVATE_KEY=.*/,
        `ETHEREUM_PRIVATE_KEY=${privateKeyValue}`
      );
    } else {
      console.warn(`\x1b[33mWarning: Private key not found for ${privateKeyEnvVar}\x1b[0m`);
    }

    // Replace strategy-specific settings
    botConfig = botConfig.replace(
      /RISK_LEVEL=.*/,
      `RISK_LEVEL=${strategy.risk_level}`
    );

    botConfig = botConfig.replace(
      /MAX_ALLOCATION_PERCENT=.*/,
      `MAX_ALLOCATION_PERCENT=${strategy.max_allocation}`
    );

    botConfig = botConfig.replace(
      /NEURON_THESIS=.*/,
      `NEURON_THESIS="${strategy.thesis}"`
    );

    // Ensure the strategy name is properly mapped
    const strategyMapping = {
      'Momentum': 'momentum',
      'Mean-Reversion': 'mean_reversion', 
      'Technical-Conservative': 'technical_conservative',
      'Breakout': 'breakout',
      'Multi-Timeframe': 'multi_timeframe'
    };

    const strategyKey = strategyMapping[strategy.name] || 'momentum';

    // Update both STRATEGY and STRATEGY_NAME consistently
    if (botConfig.includes('STRATEGY=')) {
      botConfig = botConfig.replace(
        /STRATEGY=.*/,
        `STRATEGY=${strategyKey}`
      );
    } else {
      botConfig += `\nSTRATEGY=${strategyKey}`;
    }

    // Also ensure STRATEGY_NAME is updated
    if (botConfig.includes('STRATEGY_NAME=')) {
      botConfig = botConfig.replace(
        /STRATEGY_NAME=.*/,
        `STRATEGY_NAME=${strategy.name}`
      );
    } else {
      botConfig += `\nSTRATEGY_NAME=${strategy.name}`;
    }

    // Ensure strategy is properly applied
    logger.info(`Bot ${i} configured with strategy: ${strategyKey}`);

    if (botConfig.includes('STRATEGY_NAME=')) {
      botConfig = botConfig.replace(
        /STRATEGY_NAME=.*/,
        `STRATEGY_NAME=${strategy.name}`
      );
    } else {
      botConfig += `\nSTRATEGY_NAME=${strategy.name}`;
    }

    // Also update risk level per strategy
    botConfig = botConfig.replace(
      /RISK_LEVEL=.*/,
      `RISK_LEVEL=${strategy.risk_level}`
    );

    // Also update the thesis to be strategy-specific
    botConfig = botConfig.replace(
      /NEURON_THESIS=.*/,
      `NEURON_THESIS="${strategy.thesis}"`
    );

    // Add strategy name and description
    botConfig += `\n# Strategy Configuration\nSTRATEGY_NAME="${strategy.name}"\nSTRATEGY_DESCRIPTION="${strategy.description}"\n`;

    // Ensure the bot ID is properly set in environment
    botConfig += `\n# Bot Identification\nBOT_INDEX=${i}\n`;

    // Write modified config
    fs.writeFileSync(path.resolve(`./config/bot${i}/.env`), botConfig);
    console.log(`\x1b[32mConfiguration for Bot ${i} prepared\x1b[0m`);
  }

  // Helper functions for bot configuration
  function getBotStrategy(botId) {
    const strategies = ['momentum', 'mean_reversion', 'technical_conservative', 'breakout', 'multi_timeframe'];
    return strategies[botId - 1] || 'momentum';
  }

  function getBotRiskLevel(botId) {
    const riskLevels = ['medium', 'medium-high', 'low', 'high', 'medium'];
    return riskLevels[botId - 1] || 'medium';
  }

  console.log('\n\x1b[32mAll bots scheduled for launch\x1b[0m');
  console.log('Press Ctrl+C to stop all bots\n');

  // Initialize global bot status monitor (import singleton instance)
  global.botStatusMonitor = require('./modules/bot-status-monitor');

  // Register all bots with status monitor
  for (let i = 1; i <= BOT_COUNT; i++) {
    global.botStatusMonitor.updateStatus(i.toString(), {
      status: 'scheduled',
      strategy: getBotStrategy(i),
      riskLevel: getBotRiskLevel(i)
    });
  }

  // Launch bots with extended staggered delays to prevent API overload
  // Increased delays significantly to prevent rate limiting during initialization
  const LAUNCH_DELAY = STAGGER_TIME || 2 * 60 * 1000; // Default to 2 minutes
  const EXTENDED_LAUNCH_DELAY = EXTENDED_BACKOFF ? LAUNCH_DELAY * 3 : LAUNCH_DELAY * 2; // Triple delay for extended backoff

  // Schedule bot launches with staggered delays (increased for stability)
  setTimeout(() => {
    console.log('Launching Bot 1...');
    try {
      launchBot(1);
      console.log('✅ Bot 1 launch initiated successfully');
    } catch (error) {
      console.error(`❌ Failed to launch Bot 1: ${error.message}`);
    }
  }, 0);
  setTimeout(() => {
    console.log('Launching Bot 2...');
    try {
      launchBot(2);
      console.log('✅ Bot 2 launch initiated successfully');
    } catch (error) {
      console.error(`❌ Failed to launch Bot 2: ${error.message}`);
    }
  }, EXTENDED_LAUNCH_DELAY);
  setTimeout(() => {
    console.log('Launching Bot 3...');
    try {
      launchBot(3);
      console.log('✅ Bot 3 launch initiated successfully');
    } catch (error) {
      console.error(`❌ Failed to launch Bot 3: ${error.message}`);
    }
  }, EXTENDED_LAUNCH_DELAY * 2);
  setTimeout(() => {
    console.log('Launching Bot 4...');
    try {
      launchBot(4);
      console.log('✅ Bot 4 launch initiated successfully');
    } catch (error) {
      console.error(`❌ Failed to launch Bot 4: ${error.message}`);
    }
  }, EXTENDED_LAUNCH_DELAY * 3);
  setTimeout(() => {
    console.log('Launching Bot 5...');
    try {
      launchBot(5);
      console.log('✅ Bot 5 launch initiated successfully');
    } catch (error) {
      console.error(`❌ Failed to launch Bot 5: ${error.message}`);
    }
  }, EXTENDED_LAUNCH_DELAY * 4);

  // Log final status after all bots should be launched
  setTimeout(() => {
    console.log('\n📊 Final bot launch status:');
    botStatusMonitor.logStatusSummary();
  }, EXTENDED_LAUNCH_DELAY * 5);

  console.log('\n\x1b[32mAll bots scheduled for launch\x1b[0m');
  console.log('\x1b[32mPress Ctrl+C to stop all bots\x1b[0m\n');

  // Log status summary every 5 minutes
  setInterval(() => {
    botStatusMonitor.logStatusSummary();
  }, 5 * 60 * 1000);

  // Send heartbeats every 2 minutes to prevent false unhealthy status
  setInterval(() => {
    for (let i = 1; i <= BOT_COUNT; i++) {
      botStatusMonitor.heartbeat(i.toString());
    }
  }, 2 * 60 * 1000);
}

/**
 * Launch a single bot instance
 */
function launchBot(botId) {
  const configPath = path.resolve(`./config/bot${botId}/.env`);

  console.log(`\x1b[33mLaunching Bot ${botId}...\x1b[0m`);

  // Command arguments based on options
  const args = ['src/index.js'];
  if (TEST_MODE) {
    args.push('--test');
  }
  if (EXTENDED_BACKOFF) {
    args.push('--extended-backoff');
  }

  const strategy = BOT_STRATEGIES[(botId - 1) % BOT_STRATEGIES.length];
  const botProcess = spawn('node', args, {
    env: {
      ...process.env,
      DOTENV_CONFIG_PATH: configPath,
      BOT_ID: botId.toString(),
      STRATEGY_NAME: strategy.name,
      STRATEGY: strategy.name.toLowerCase().replace('-', '_'),
      RISK_LEVEL: strategy.risk_level
    },
    stdio: 'pipe'
  });

  // Log prefix for this bot
  const prefix = `\x1b[33m[Bot ${botId}]\x1b[0m `;

  // Handle stdout
  botProcess.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      console.log(`${prefix}${line}`);

      // Update bot status based on log messages
      if (line.includes('Starting new trading cycle')) {
        botStatusMonitor.updateStatus(botId.toString(), {
          status: 'trading',
          lastActivity: 'trading_cycle_started',
          strategy: BOT_STRATEGIES[(botId - 1) % BOT_STRATEGIES.length].name
        });
      } else if (line.includes('Market data summary') || line.includes('Real-time data for')) {
        botStatusMonitor.updateStatus(botId.toString(), {
          status: 'active',
          lastActivity: 'market_data_collected',
          strategy: BOT_STRATEGIES[(botId - 1) % BOT_STRATEGIES.length].name
        });
      } else if (line.includes('Bot successfully started')) {
        botStatusMonitor.updateStatus(botId.toString(), {
          status: 'running',
          lastActivity: 'bot_started',
          strategy: BOT_STRATEGIES[(botId - 1) % BOT_STRATEGIES.length].name
        });
      } else if (line.includes('Pollen API initialized successfully')) {
        botStatusMonitor.updateStatus(botId.toString(), {
          status: 'initializing',
          lastActivity: 'api_initialized',
          strategy: BOT_STRATEGIES[(botId - 1) % BOT_STRATEGIES.length].name
        });
      }
    });
  });

  // Handle stderr
  botProcess.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => console.error(`${prefix}\x1b[31m${line}\x1b[0m`));
  });

  // Handle process exit
  botProcess.on('exit', (code) => {
    if (code !== 0) {
      console.error(`${prefix}\x1b[31mBot exited with code ${code}\x1b[0m`);

      // Update bot status to unhealthy
      botStatusMonitor.updateStatus(botId.toString(), {
        status: 'error',
        lastActivity: 'bot_crashed',
        strategy: BOT_STRATEGIES[(botId - 1) % BOT_STRATEGIES.length].name,
        errorCode: code
      });
    } else {
      console.log(`${prefix}Bot completed successfully`);
    }

    // Implement exponential backoff for restart delays
    const restartDelay = Math.min(10000 * Math.pow(2, (code || 0)), 300000); // Max 5 minutes
    setTimeout(() => {
      console.log(`${prefix}Restarting bot after ${restartDelay}ms delay...`);
      launchBot(botId);
    }, restartDelay);
  });

  return botProcess;
}

// Start the multi-bot system
launchBots().catch(err => {
  console.error('\x1b[31mError starting multi-bot system:', err.message, '\x1b[0m');
  process.exit(1);
});