
#!/usr/bin/env node

/**
 * PollenOS Setup Wizard
 * Interactive configuration for local installations
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

class SetupWizard {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    this.config = {};
  }

  async run() {
    console.log('🌟 Welcome to PollenOS Setup Wizard\n');
    console.log('This wizard will help you configure your multi-bot trading system.\n');

    try {
      await this.collectNetworkSettings();
      await this.collectWalletSettings();
      await this.collectTradingSettings();
      await this.generateConfiguration();
      
      console.log('\n🎉 Setup completed successfully!');
      console.log('Your configuration has been saved to the config directory.');
      console.log('\nRun "npm start" to launch your trading bots.');
      
    } catch (error) {
      console.error('❌ Setup failed:', error.message);
    } finally {
      this.rl.close();
    }
  }

  async question(prompt) {
    return new Promise(resolve => {
      this.rl.question(prompt, resolve);
    });
  }

  async collectNetworkSettings() {
    console.log('🌐 Network Configuration\n');
    
    const useDefault = await this.question('Use default Base Sepolia settings? (y/n): ');
    
    if (useDefault.toLowerCase() === 'y') {
      this.config.network = {
        name: 'Base Sepolia',
        rpcUrl: 'https://sepolia.base.org',
        chainId: 84532,
        explorerUrl: 'https://sepolia.basescan.org'
      };
    } else {
      this.config.network = {
        name: await this.question('Network name: '),
        rpcUrl: await this.question('RPC URL: '),
        chainId: parseInt(await this.question('Chain ID: ')),
        explorerUrl: await this.question('Block explorer URL: ')
      };
    }
    
    console.log('✅ Network configuration saved\n');
  }

  async collectWalletSettings() {
    console.log('🔐 Wallet Configuration\n');
    console.log('You can either:');
    console.log('1. Generate new wallets automatically');
    console.log('2. Import existing private keys');
    console.log('3. Configure manually later\n');
    
    const choice = await this.question('Choose option (1/2/3): ');
    
    switch (choice) {
      case '1':
        await this.generateWallets();
        break;
      case '2':
        await this.importWallets();
        break;
      case '3':
        console.log('✅ Wallet configuration will be done manually\n');
        break;
      default:
        console.log('Invalid choice. Skipping wallet configuration.\n');
    }
  }

  async generateWallets() {
    const botCount = parseInt(await this.question('How many trading bots? (1-11): '));
    
    if (botCount < 1 || botCount > 11) {
      console.log('Invalid number. Using default of 5 bots.');
      this.config.botCount = 5;
    } else {
      this.config.botCount = botCount;
    }

    this.config.bots = [];
    const strategies = ['conservative', 'momentum', 'technical', 'mean-reversion', 'breakout'];
    
    console.log('\n🔑 Generating wallets...');
    
    for (let i = 0; i < this.config.botCount; i++) {
      const wallet = ethers.Wallet.createRandom();
      const strategy = strategies[i % strategies.length];
      
      this.config.bots.push({
        id: i + 1,
        name: `Bot ${i + 1}`,
        privateKey: wallet.privateKey,
        address: wallet.address,
        strategy: strategy,
        risk: this.getRiskLevel(strategy),
        maxAllocation: 15 + (i * 2),
        initialStake: '2'
      });
      
      console.log(`✅ Generated Bot ${i + 1}: ${wallet.address}`);
    }
    
    console.log('\n⚠️  IMPORTANT: Save these private keys securely!');
    console.log('They will be written to config/wallets.js');
  }

  async importWallets() {
    const botCount = parseInt(await this.question('How many bots to import? '));
    this.config.bots = [];
    
    for (let i = 0; i < botCount; i++) {
      console.log(`\n🔑 Bot ${i + 1} Configuration:`);
      const privateKey = await this.question('Private key (with or without 0x): ');
      const strategy = await this.question('Strategy (conservative/momentum/technical/mean-reversion/breakout): ');
      
      try {
        const wallet = new ethers.Wallet(privateKey.startsWith('0x') ? privateKey : '0x' + privateKey);
        
        this.config.bots.push({
          id: i + 1,
          name: `Bot ${i + 1}`,
          privateKey: wallet.privateKey,
          address: wallet.address,
          strategy: strategy || 'conservative',
          risk: this.getRiskLevel(strategy),
          maxAllocation: 15 + (i * 2),
          initialStake: '2'
        });
        
        console.log(`✅ Added Bot ${i + 1}: ${wallet.address}`);
      } catch (error) {
        console.log(`❌ Invalid private key for Bot ${i + 1}. Skipping.`);
      }
    }
  }

  async collectTradingSettings() {
    console.log('📊 Trading Configuration\n');
    
    const gasPrice = await this.question('Default gas price (gwei) [1]: ') || '1';
    const gasLimit = await this.question('Default gas limit [500000]: ') || '500000';
    const tradingEnabled = await this.question('Enable live trading? (y/n) [y]: ') || 'y';
    const webPort = await this.question('Web interface port [5000]: ') || '5000';
    
    this.config.trading = {
      gasPrice: gasPrice,
      gasLimit: parseInt(gasLimit),
      enabled: tradingEnabled.toLowerCase() === 'y',
      logLevel: 'info',
      webPort: parseInt(webPort)
    };
    
    console.log('✅ Trading configuration saved\n');
  }

  getRiskLevel(strategy) {
    const riskMap = {
      'conservative': 'low',
      'momentum': 'moderate', 
      'technical': 'moderate',
      'mean-reversion': 'moderate',
      'breakout': 'high'
    };
    return riskMap[strategy] || 'moderate';
  }

  async generateConfiguration() {
    console.log('💾 Generating configuration files...\n');
    
    // Ensure config directory exists
    if (!fs.existsSync('config')) {
      fs.mkdirSync('config', { recursive: true });
    }
    
    // Create environment file
    const envContent = `# PollenOS Local Configuration
BASE_SEPOLIA_RPC_URL=${this.config.network.rpcUrl}
BASE_SEPOLIA_CHAIN_ID=${this.config.network.chainId}

PLN_TOKEN_ADDRESS=0x9E1c51E1fAa1381D8a7Dbdd19402c5fCce9274C6
POLLEN_DAO_ADDRESS=0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7
VEPLN_ADDRESS=0x3a28AB567b661B3edaF9Ef0bDE9489558EDB3995
LEAGUES_ADDRESS=0x55F04Ee2775925b80125F412C05cF5214Fd1317a

DEFAULT_GAS_PRICE=${this.config.trading.gasPrice}
DEFAULT_GAS_LIMIT=${this.config.trading.gasLimit}
TRADING_ENABLED=${this.config.trading.enabled}
LOG_LEVEL=${this.config.trading.logLevel}
WEB_PORT=${this.config.trading.webPort}
`;

    fs.writeFileSync('config/.env', envContent);
    console.log('✅ Created config/.env');
    
    // Create wallets configuration
    if (this.config.bots) {
      const walletsContent = `/**
 * PollenOS Bot Wallet Configuration
 * Generated by setup wizard
 */

const BOTS = ${JSON.stringify(this.config.bots, null, 2)};

module.exports = { BOTS };
`;
      
      fs.writeFileSync('config/wallets.js', walletsContent);
      console.log('✅ Created config/wallets.js');
      
      // Display funding instructions
      console.log('\n💰 FUNDING INSTRUCTIONS:');
      console.log('Your bots need funding to operate. For each bot wallet:');
      console.log('1. Send Base Sepolia ETH for gas fees (0.01 ETH minimum)');
      console.log('2. Send PLN tokens for trading (10 PLN minimum)');
      console.log('\nBot addresses:');
      this.config.bots.forEach(bot => {
        console.log(`  Bot ${bot.id}: ${bot.address}`);
      });
    }

    // Create launch script
    const launchScript = `#!/usr/bin/env node
/**
 * PollenOS Quick Launch Script
 */

const { spawn } = require('child_process');

console.log('🌸 Starting PollenOS System...');

// Start multi-bot system
const botProcess = spawn('node', ['multi-bot-launcher.js'], {
  stdio: 'inherit'
});

// Start web interface
const webProcess = spawn('node', ['web-interface/server/config-server.js'], {
  stdio: 'inherit'
});

console.log('🚀 PollenOS is now running!');
console.log('📊 Web interface: http://localhost:${this.config.trading.webPort}');

process.on('SIGINT', () => {
  console.log('\\n🛑 Shutting down PollenOS...');
  botProcess.kill();
  webProcess.kill();
  process.exit();
});
`;

    fs.writeFileSync('launch-pollenos.js', launchScript);
    fs.chmodSync('launch-pollenos.js', '755');
    console.log('✅ Created launch-pollenos.js');
  }
}

// Run setup wizard
if (require.main === module) {
  const wizard = new SetupWizard();
  wizard.run().catch(console.error);
}

module.exports = SetupWizard;
