
#!/usr/bin/env node

/**
 * PollenOS Local Installation Script
 * Sets up the multi-bot trading system for local execution
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class PollenOSInstaller {
  constructor() {
    this.installDir = process.cwd();
    this.configDir = path.join(this.installDir, 'config');
  }

  async install() {
    console.log('🌟 Installing PollenOS Multi-Bot Trading System...\n');

    try {
      // Step 1: Verify Node.js version
      this.verifyNodeVersion();

      // Step 2: Install dependencies
      this.installDependencies();

      // Step 3: Create configuration structure
      this.createConfigStructure();

      // Step 4: Set up environment files
      this.setupEnvironmentFiles();

      // Step 5: Generate example wallet configuration
      this.generateWalletConfig();

      // Step 6: Create startup scripts
      this.createStartupScripts();

      console.log('\n🎉 PollenOS installation completed successfully!');
      console.log('\n📋 Next Steps:');
      console.log('1. Configure your environment variables in config/.env');
      console.log('2. Add your bot private keys to config/wallets.js');
      console.log('3. Fund your bot wallets with ETH and PLN tokens');
      console.log('4. Run: npm start');

    } catch (error) {
      console.error('❌ Installation failed:', error.message);
      process.exit(1);
    }
  }

  verifyNodeVersion() {
    console.log('🔍 Verifying Node.js version...');
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

    if (majorVersion < 14) {
      throw new Error(`Node.js version ${nodeVersion} is not supported. Please upgrade to Node.js 14 or higher.`);
    }

    console.log(`✅ Node.js ${nodeVersion} is compatible`);
  }

  installDependencies() {
    console.log('📦 Installing dependencies...');
    
    try {
      execSync('npm install', { stdio: 'inherit' });
      console.log('✅ Dependencies installed successfully');
    } catch (error) {
      throw new Error('Failed to install dependencies');
    }
  }

  createConfigStructure() {
    console.log('📁 Creating configuration structure...');

    const dirs = [
      'config',
      'logs',
      'data/performance',
      'config-backups'
    ];

    dirs.forEach(dir => {
      const fullPath = path.join(this.installDir, dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`✅ Created directory: ${dir}`);
      }
    });
  }

  setupEnvironmentFiles() {
    console.log('⚙️ Setting up environment configuration...');

    const envExample = `# PollenOS Configuration
# Base Sepolia Network Settings
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASE_SEPOLIA_CHAIN_ID=84532

# Contract Addresses (Base Sepolia)
PLN_TOKEN_ADDRESS=0x9E1c51E1fAa1381D8a7Dbdd19402c5fCce9274C6
POLLEN_DAO_ADDRESS=0xEF789258233E6cFBB5E0bb093FC9537E69e81Bb7
VEPLN_ADDRESS=0x3a28AB567b661B3edaF9Ef0bDE9489558EDB3995
LEAGUES_ADDRESS=0x55F04Ee2775925b80125F412C05cF5214Fd1317a

# Trading Configuration
DEFAULT_GAS_PRICE=1
DEFAULT_GAS_LIMIT=500000
TRADING_ENABLED=true
LOG_LEVEL=info

# Optional: Notification Settings
# TELEGRAM_BOT_TOKEN=your_telegram_bot_token
# TELEGRAM_CHAT_ID=your_chat_id
`;

    const envPath = path.join(this.configDir, '.env');
    if (!fs.existsSync(envPath)) {
      fs.writeFileSync(envPath, envExample);
      console.log('✅ Created .env configuration file');
    }
  }

  generateWalletConfig() {
    console.log('🔐 Generating wallet configuration template...');

    const walletConfigTemplate = `/**
 * PollenOS Wallet Configuration
 * 
 * SECURITY WARNING: 
 * - Never commit private keys to version control
 * - Use environment variables for production deployments
 * - Keep this file secure and backed up
 */

const BOTS = [
  {
    id: 1,
    name: 'Conservative Bot',
    privateKey: 'YOUR_PRIVATE_KEY_1', // Replace with actual private key
    strategy: 'conservative',
    risk: 'low',
    maxAllocation: 15,
    initialStake: '2'
  },
  {
    id: 2,
    name: 'Momentum Bot', 
    privateKey: 'YOUR_PRIVATE_KEY_2', // Replace with actual private key
    strategy: 'momentum',
    risk: 'moderate',
    maxAllocation: 20,
    initialStake: '3'
  }
  // Add more bots as needed...
];

module.exports = { BOTS };
`;

    const walletPath = path.join(this.configDir, 'wallets.example.js');
    fs.writeFileSync(walletPath, walletConfigTemplate);
    console.log('✅ Created wallet configuration template');
  }

  createStartupScripts() {
    console.log('🚀 Creating startup scripts...');

    // Update package.json scripts for local execution
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    packageJson.scripts = {
      ...packageJson.scripts,
      "start": "node multi-bot-launcher.js",
      "setup": "node setup-wizard.js",
      "verify": "node verify-setup.js",
      "backup": "node backup-config.js create",
      "restore": "node backup-config.js restore",
      "install:local": "node install.js"
    };

    fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
    console.log('✅ Updated package.json scripts');
  }
}

// Run installer
if (require.main === module) {
  const installer = new PollenOSInstaller();
  installer.install();
}

module.exports = PollenOSInstaller;
