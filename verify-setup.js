
#!/usr/bin/env node

/**
 * PollenOS Local Setup Verification
 * Verifies local installation and configuration
 */

const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

class SetupVerifier {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.success = [];
  }

  async verify() {
    console.log('🔍 Verifying PollenOS Local Setup\n');

    try {
      this.checkFileStructure();
      this.checkNodeModules();
      await this.checkConfiguration();
      await this.checkWalletConfiguration();
      await this.checkNetworkConnectivity();
      
      this.displayResults();
      
    } catch (error) {
      this.errors.push(`Verification failed: ${error.message}`);
      this.displayResults();
    }
  }

  checkFileStructure() {
    console.log('📁 Checking file structure...');
    
    const requiredFiles = [
      'package.json',
      'multi-bot-launcher.js',
      'backup-config.js',
      'config'
    ];
    
    const requiredDirs = [
      'config',
      'src',
      'logs'
    ];
    
    requiredFiles.forEach(file => {
      if (fs.existsSync(file)) {
        this.success.push(`✅ Found ${file}`);
      } else {
        this.errors.push(`❌ Missing ${file}`);
      }
    });
    
    requiredDirs.forEach(dir => {
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        this.success.push(`✅ Found directory ${dir}`);
      } else {
        this.errors.push(`❌ Missing directory ${dir}`);
      }
    });
  }

  checkNodeModules() {
    console.log('📦 Checking dependencies...');
    
    if (fs.existsSync('node_modules')) {
      this.success.push('✅ Node modules installed');
      
      const requiredPackages = ['ethers', 'dotenv', 'winston'];
      requiredPackages.forEach(pkg => {
        if (fs.existsSync(`node_modules/${pkg}`)) {
          this.success.push(`✅ Found package ${pkg}`);
        } else {
          this.errors.push(`❌ Missing package ${pkg}`);
        }
      });
    } else {
      this.errors.push('❌ Node modules not installed. Run: npm install');
    }
  }

  async checkConfiguration() {
    console.log('⚙️ Checking configuration...');
    
    // Check environment file
    const envPath = 'config/.env';
    if (fs.existsSync(envPath)) {
      this.success.push('✅ Found .env configuration');
      
      const envContent = fs.readFileSync(envPath, 'utf8');
      const requiredVars = [
        'BASE_SEPOLIA_RPC_URL',
        'PLN_TOKEN_ADDRESS',
        'POLLEN_DAO_ADDRESS'
      ];
      
      requiredVars.forEach(varName => {
        if (envContent.includes(varName)) {
          this.success.push(`✅ Found ${varName} in .env`);
        } else {
          this.warnings.push(`⚠️ Missing ${varName} in .env`);
        }
      });
    } else {
      this.warnings.push('⚠️ No .env file found. Using default configuration.');
    }
  }

  async checkWalletConfiguration() {
    console.log('🔐 Checking wallet configuration...');
    
    const walletPath = 'config/wallets.js';
    if (fs.existsSync(walletPath)) {
      try {
        const { BOTS } = require(path.resolve(walletPath));
        
        if (Array.isArray(BOTS) && BOTS.length > 0) {
          this.success.push(`✅ Found ${BOTS.length} bot configurations`);
          
          BOTS.forEach((bot, index) => {
            if (bot.privateKey && bot.privateKey !== 'YOUR_PRIVATE_KEY_' + (index + 1)) {
              try {
                const wallet = new ethers.Wallet(bot.privateKey);
                this.success.push(`✅ Bot ${bot.id} wallet valid: ${wallet.address}`);
              } catch {
                this.errors.push(`❌ Bot ${bot.id} has invalid private key`);
              }
            } else {
              this.warnings.push(`⚠️ Bot ${bot.id} needs private key configuration`);
            }
          });
        } else {
          this.errors.push('❌ No bot configurations found in wallets.js');
        }
      } catch (error) {
        this.errors.push(`❌ Error loading wallets.js: ${error.message}`);
      }
    } else {
      this.warnings.push('⚠️ No wallets.js found. Run setup wizard first.');
    }
  }

  async checkNetworkConnectivity() {
    console.log('🌐 Checking network connectivity...');
    
    try {
      require('dotenv').config({ path: './config/.env' });
      
      const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      
      const network = await provider.getNetwork();
      this.success.push(`✅ Connected to ${network.name} (Chain ID: ${network.chainId})`);
      
      const latestBlock = await provider.getBlockNumber();
      this.success.push(`✅ Latest block: ${latestBlock}`);
      
    } catch (error) {
      this.errors.push(`❌ Network connectivity failed: ${error.message}`);
    }
  }

  displayResults() {
    console.log('\n📊 Verification Results\n');
    
    if (this.success.length > 0) {
      console.log('✅ PASSED:');
      this.success.forEach(msg => console.log(`  ${msg}`));
      console.log();
    }
    
    if (this.warnings.length > 0) {
      console.log('⚠️ WARNINGS:');
      this.warnings.forEach(msg => console.log(`  ${msg}`));
      console.log();
    }
    
    if (this.errors.length > 0) {
      console.log('❌ ERRORS:');
      this.errors.forEach(msg => console.log(`  ${msg}`));
      console.log();
    }
    
    if (this.errors.length === 0) {
      console.log('🎉 Setup verification completed successfully!');
      console.log('Your PollenOS installation is ready to use.');
      console.log('\nNext steps:');
      console.log('1. Fund your bot wallets with ETH and PLN tokens');
      console.log('2. Run: npm start');
    } else {
      console.log('❌ Setup verification failed. Please fix the errors above.');
      console.log('\nFor help:');
      console.log('- Run: npm run setup (for configuration wizard)');
      console.log('- Check documentation in docs/README.md');
    }
  }
}

// Run verification
if (require.main === module) {
  const verifier = new SetupVerifier();
  verifier.verify();
}

module.exports = SetupVerifier;
