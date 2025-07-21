#!/usr/bin/env node
/**
 * Run Pollen Trading Bot on Base Sepolia Testnet
 * 
 * This script starts the trading bot with Sepolia testnet configuration
 * and monitors its performance.
 */

require('dotenv').config({ path: '../.env.sepolia' });
const { ethers } = require('ethers');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('../src/modules/logger');

// Configuration
const CONFIG = {
  NETWORK: 'base-sepolia',
  LOG_FILE: path.join(__dirname, '../logs/pollen-bot-sepolia.log'),
  MAX_RESTARTS: 3,
  RESTART_DELAY: 5000, // 5 seconds
  HEALTH_CHECK_INTERVAL: 60000, // 1 minute
};

// Ensure logs directory exists
if (!fs.existsSync(path.dirname(CONFIG.LOG_FILE))) {
  fs.mkdirSync(path.dirname(CONFIG.LOG_FILE), { recursive: true });
}

class BotManager {
  constructor() {
    this.botProcess = null;
    this.restartCount = 0;
    this.isShuttingDown = false;
  }

  start() {
    if (this.isShuttingDown) return;

    logger.info(`Starting Pollen Trading Bot on ${CONFIG.NETWORK}...`);
    
    // Start the bot process
    this.botProcess = spawn('node', ['src/index.js', '--network', CONFIG.NETWORK], {
      stdio: ['inherit', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: 'production',
        LOG_LEVEL: process.env.LOG_LEVEL || 'info',
      },
    });

    // Log output to file and console
    const logStream = fs.createWriteStream(CONFIG.LOG_FILE, { flags: 'a' });
    
    this.botProcess.stdout.on('data', (data) => {
      const message = data.toString().trim();
      logStream.write(`[${new Date().toISOString()}] ${message}\n`);
      console.log(`[Bot] ${message}`);
    });

    this.botProcess.stderr.on('data', (data) => {
      const error = data.toString().trim();
      logStream.write(`[${new Date().toISOString()}] [ERROR] ${error}\n`);
      console.error(`[Bot Error] ${error}`);
    });

    // Handle process exit
    this.botProcess.on('close', (code, signal) => {
      logStream.end();
      
      if (this.isShuttingDown) {
        logger.info('Bot process stopped by user');
        return;
      }

      if (this.restartCount >= CONFIG.MAX_RESTARTS) {
        logger.error(`Max restart attempts (${CONFIG.MAX_RESTARTS}) reached. Giving up.`);
        process.exit(1);
      }

      this.restartCount++;
      logger.warn(`Bot process exited with code ${code}. Restarting (${this.restartCount}/${CONFIG.MAX_RESTARTS})...`);
      
      setTimeout(() => this.start(), CONFIG.RESTART_DELAY);
    });
  }

  stop() {
    this.isShuttingDown = true;
    if (this.botProcess) {
      this.botProcess.kill('SIGTERM');
    }
  }
}

// Handle process termination
process.on('SIGINT', () => {
  logger.info('Shutting down bot manager...');
  botManager.stop();
  process.exit(0);
});

// Start the bot manager
const botManager = new BotManager();
botManager.start();

// Health check
setInterval(() => {
  if (!botManager.botProcess || botManager.botProcess.killed) {
    logger.warn('Bot process is not running. Attempting to restart...');
    botManager.start();
  }
}, CONFIG.HEALTH_CHECK_INTERVAL);

logger.info(`Pollen Trading Bot manager started. Logs: ${CONFIG.LOG_FILE}`);
