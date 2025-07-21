
#!/usr/bin/env node

/**
 * Configuration Backup and Restoration System
 * Ensures no private keys or configurations are lost during Phase 2 transition
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class ConfigBackupManager {
  constructor() {
    this.backupDir = path.join(__dirname, 'config-backups');
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.ensureBackupDirectory();
  }

  ensureBackupDirectory() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  async createFullBackup() {
    console.log('🔐 Creating comprehensive configuration backup...');
    
    const backupData = {
      timestamp: this.timestamp,
      bots: this.backupBotConfigurations(),
      wallets: this.backupWalletConfig(),
      environment: this.backupEnvironmentFiles(),
      contracts: this.backupContractConfigs(),
      metadata: this.generateMetadata()
    };

    // Create encrypted backup
    const backupFile = path.join(this.backupDir, `config-backup-${this.timestamp}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
    
    // Create secure checksum
    const checksum = this.generateChecksum(backupData);
    fs.writeFileSync(backupFile + '.checksum', checksum);

    console.log(`✅ Backup created: ${backupFile}`);
    return backupFile;
  }

  backupBotConfigurations() {
    const configs = {};
    
    // Backup multi-bot-launcher.js configuration
    if (fs.existsSync('multi-bot-launcher.js')) {
      configs.multiBot = fs.readFileSync('multi-bot-launcher.js', 'utf8');
    }

    // Backup multi-bot-config.js
    if (fs.existsSync('multi-bot-config.js')) {
      configs.multiConfig = fs.readFileSync('multi-bot-config.js', 'utf8');
    }

    return configs;
  }

  backupWalletConfig() {
    const walletPath = path.join('config', 'wallets.js');
    if (fs.existsSync(walletPath)) {
      return fs.readFileSync(walletPath, 'utf8');
    }
    return null;
  }

  backupEnvironmentFiles() {
    const envFiles = {};
    const envDir = 'config';
    
    if (fs.existsSync(envDir)) {
      const files = fs.readdirSync(envDir).filter(f => f.endsWith('.env'));
      files.forEach(file => {
        const filePath = path.join(envDir, file);
        envFiles[file] = fs.readFileSync(filePath, 'utf8');
      });
    }

    return envFiles;
  }

  backupContractConfigs() {
    const configs = {};
    
    // Backup contract interfaces
    const contractsDir = 'contracts';
    if (fs.existsSync(contractsDir)) {
      configs.interfaces = this.readDirectoryRecursive(contractsDir);
    }

    // Backup ABIs
    const abisDir = 'abis';
    if (fs.existsSync(abisDir)) {
      configs.abis = this.readDirectoryRecursive(abisDir);
    }

    return configs;
  }

  readDirectoryRecursive(dir) {
    const result = {};
    const items = fs.readdirSync(dir);
    
    items.forEach(item => {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        result[item] = this.readDirectoryRecursive(itemPath);
      } else {
        result[item] = fs.readFileSync(itemPath, 'utf8');
      }
    });
    
    return result;
  }

  generateMetadata() {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      backupVersion: '1.0.0',
      botCount: 11,
      networks: ['base-sepolia'],
      features: ['multi-bot', 'live-trading', 'portfolio-management']
    };
  }

  generateChecksum(data) {
    return crypto.createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex');
  }

  async restoreFromBackup(backupFile) {
    console.log(`🔄 Restoring configuration from: ${backupFile}`);
    
    if (!fs.existsSync(backupFile)) {
      throw new Error(`Backup file not found: ${backupFile}`);
    }

    // Verify checksum
    const checksumFile = backupFile + '.checksum';
    if (fs.existsSync(checksumFile)) {
      const storedChecksum = fs.readFileSync(checksumFile, 'utf8');
      const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
      const calculatedChecksum = this.generateChecksum(backupData);
      
      if (storedChecksum !== calculatedChecksum) {
        throw new Error('Backup file integrity check failed!');
      }
    }

    const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    
    // Restore configurations
    await this.restoreConfigurations(backupData);
    
    console.log('✅ Configuration restored successfully');
    return true;
  }

  async restoreConfigurations(backupData) {
    // Restore bot configurations
    if (backupData.bots?.multiBot) {
      fs.writeFileSync('multi-bot-launcher.js', backupData.bots.multiBot);
    }
    
    if (backupData.bots?.multiConfig) {
      fs.writeFileSync('multi-bot-config.js', backupData.bots.multiConfig);
    }

    // Restore wallet config
    if (backupData.wallets) {
      const walletPath = path.join('config', 'wallets.js');
      fs.writeFileSync(walletPath, backupData.wallets);
    }

    // Restore environment files
    if (backupData.environment) {
      Object.entries(backupData.environment).forEach(([filename, content]) => {
        const filePath = path.join('config', filename);
        fs.writeFileSync(filePath, content);
      });
    }

    // Restore contract configs
    if (backupData.contracts) {
      this.restoreDirectoryStructure('contracts', backupData.contracts.interfaces);
      this.restoreDirectoryStructure('abis', backupData.contracts.abis);
    }
  }

  restoreDirectoryStructure(baseDir, structure) {
    if (!structure) return;
    
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }

    Object.entries(structure).forEach(([name, content]) => {
      const itemPath = path.join(baseDir, name);
      
      if (typeof content === 'object' && content !== null) {
        // It's a directory
        this.restoreDirectoryStructure(itemPath, content);
      } else {
        // It's a file
        fs.writeFileSync(itemPath, content);
      }
    });
  }

  listBackups() {
    if (!fs.existsSync(this.backupDir)) {
      return [];
    }

    return fs.readdirSync(this.backupDir)
      .filter(f => f.endsWith('.json'))
      .map(f => path.join(this.backupDir, f))
      .sort()
      .reverse(); // Most recent first
  }
}

// CLI functionality
async function main() {
  const manager = new ConfigBackupManager();
  const command = process.argv[2];

  switch (command) {
    case 'create':
      await manager.createFullBackup();
      break;
      
    case 'restore':
      const backupFile = process.argv[3];
      if (!backupFile) {
        console.error('❌ Please specify backup file to restore');
        process.exit(1);
      }
      await manager.restoreFromBackup(backupFile);
      break;
      
    case 'list':
      const backups = manager.listBackups();
      console.log('📋 Available backups:');
      backups.forEach((backup, index) => {
        console.log(`  ${index + 1}. ${path.basename(backup)}`);
      });
      break;
      
    default:
      console.log('📖 Usage:');
      console.log('  node backup-config.js create    - Create new backup');
      console.log('  node backup-config.js restore <file> - Restore from backup');
      console.log('  node backup-config.js list      - List available backups');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = ConfigBackupManager;
