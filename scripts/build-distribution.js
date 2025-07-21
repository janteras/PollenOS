
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

class DistributionBuilder {
  constructor() {
    this.distDir = path.join(__dirname, '../dist');
    this.excludePatterns = [
      'node_modules',
      '.git',
      'cache',
      'logs',
      'attached_assets',
      'archives',
      '.replit',
      'replit.nix'
    ];
  }

  async buildDistribution() {
    console.log('🏗️  Building PollenOS Distribution Package...');
    
    // Create dist directory
    if (!fs.existsSync(this.distDir)) {
      fs.mkdirSync(this.distDir, { recursive: true });
    }

    // Create installation script
    this.createInstallScript();
    
    // Create configuration template
    this.createConfigTemplate();
    
    // Create README for distribution
    this.createDistributionReadme();
    
    // Create archive
    await this.createArchive();
    
    console.log('✅ Distribution package created successfully!');
    console.log(`📦 Package location: ${path.join(this.distDir, 'pollenos-distribution.zip')}`);
  }

  createInstallScript() {
    const installScript = `#!/bin/bash
# PollenOS Installation Script

echo "🌻 Installing PollenOS Trading Bot System..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required. Please install Node.js 18+ first."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Install web interface dependencies
cd web-interface
npm install
cd ..

# Copy configuration template
if [ ! -f .env ]; then
    cp .env.example .env
    echo "📝 Configuration template created (.env)"
    echo "⚠️  Please edit .env with your private keys and API settings"
fi

echo "✅ Installation complete!"
echo ""
echo "🚀 Quick Start:"
echo "1. Edit .env with your configuration"
echo "2. Run: npm run setup (optional configuration wizard)"
echo "3. Run: npm start (start trading bots)"
echo "4. Run: npm run config (start web interface)"
echo ""
echo "📖 For detailed setup instructions, see README.md"
`;

    fs.writeFileSync(path.join(this.distDir, 'install.sh'), installScript);
    
    // Windows batch file
    const installBat = `@echo off
echo Installing PollenOS Trading Bot System...

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Node.js is required. Please install Node.js 18+ first.
    exit /b 1
)

echo Installing dependencies...
npm install

cd web-interface
npm install
cd ..

if not exist .env (
    copy .env.example .env
    echo Configuration template created (.env)
    echo Please edit .env with your private keys and API settings
)

echo Installation complete!
echo.
echo Quick Start:
echo 1. Edit .env with your configuration
echo 2. Run: npm run setup (optional configuration wizard)
echo 3. Run: npm start (start trading bots)
echo 4. Run: npm run config (start web interface)
echo.
echo For detailed setup instructions, see README.md
pause
`;

    fs.writeFileSync(path.join(this.distDir, 'install.bat'), installBat);
  }

  createConfigTemplate() {
    const configTemplate = `# PollenOS Configuration Template
# Copy this to .env and update with your settings

# Network Configuration
NETWORK=base-sepolia
RPC_URL=https://sepolia.base.org

# Trading Configuration
TRADING_MODE=simulation
MAX_POSITION_SIZE=100
RISK_LEVEL=moderate

# Bot Private Keys (Required for live trading)
# Generate these using the setup wizard: npm run setup
WALLET_PRIVATE_KEY_1=your_private_key_here
WALLET_PRIVATE_KEY_2=your_private_key_here
WALLET_PRIVATE_KEY_3=your_private_key_here

# Web Interface
WEB_PORT=3001
ENABLE_WEB_INTERFACE=true

# Notifications (Optional)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
EMAIL_NOTIFICATIONS=false

# Advanced Settings
GAS_LIMIT=500000
MAX_GAS_PRICE_GWEI=20
REBALANCE_INTERVAL=300000
`;

    fs.writeFileSync(path.join(this.distDir, '.env.example'), configTemplate);
  }

  createDistributionReadme() {
    const readme = `# PollenOS - AI Trading Bot System

## Quick Installation

### Prerequisites
- Node.js 18+ installed
- Git (optional, for updates)

### Installation Steps

#### On Linux/macOS:
\`\`\`bash
chmod +x install.sh
./install.sh
\`\`\`

#### On Windows:
\`\`\`batch
install.bat
\`\`\`

### Manual Installation:
\`\`\`bash
npm install
cd web-interface && npm install && cd ..
cp .env.example .env
\`\`\`

## Configuration

1. Edit the \`.env\` file with your settings
2. Run the setup wizard: \`npm run setup\`
3. Configure your trading strategies in the web interface

## Running PollenOS

### Start Trading Bots:
\`\`\`bash
npm start
\`\`\`

### Start Web Interface:
\`\`\`bash
npm run config
\`\`\`

### Available Commands:
- \`npm start\` - Start multi-bot trading system
- \`npm run config\` - Start web configuration interface  
- \`npm run setup\` - Run configuration wizard
- \`npm run verify\` - Verify system setup
- \`npm run create-portfolios\` - Create bot portfolios

## Web Interface

Access the web interface at: http://localhost:3001

Features:
- Real-time bot monitoring
- Strategy configuration
- Performance analytics
- Risk management controls

## Support

For issues and documentation: https://github.com/your-repo/pollenos

## License

MIT License - see LICENSE file for details
`;

    fs.writeFileSync(path.join(this.distDir, 'README.md'), readme);
  }

  async createArchive() {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(path.join(this.distDir, 'pollenos-distribution.zip'));
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', resolve);
      archive.on('error', reject);

      archive.pipe(output);

      // Add project files (excluding patterns)
      archive.glob('**/*', {
        cwd: path.join(__dirname, '..'),
        ignore: this.excludePatterns.map(p => `${p}/**`)
      });

      // Add distribution files
      archive.file(path.join(this.distDir, 'install.sh'), { name: 'install.sh' });
      archive.file(path.join(this.distDir, 'install.bat'), { name: 'install.bat' });
      archive.file(path.join(this.distDir, '.env.example'), { name: '.env.example' });
      archive.file(path.join(this.distDir, 'README.md'), { name: 'README.md' });

      archive.finalize();
    });
  }
}

// Run if called directly
if (require.main === module) {
  const builder = new DistributionBuilder();
  builder.buildDistribution().catch(console.error);
}

module.exports = DistributionBuilder;
