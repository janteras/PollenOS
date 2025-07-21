
#!/usr/bin/env node

/**
 * Replit Secrets Migration Tool
 * Migrates sensitive configurations to Replit Secrets for enhanced security
 */

const fs = require('fs');
const path = require('path');

class SecretsMigrationTool {
  constructor() {
    this.secretsToMigrate = new Map();
    this.migrationReport = [];
  }

  analyzeCriticalSecrets() {
    console.log('🔍 Analyzing critical secrets that should be migrated to Replit Secrets...');

    // Extract bot private keys from wallets.js
    this.extractBotPrivateKeys();
    
    // Extract from environment files
    this.extractFromEnvFiles();
    
    // Generate migration recommendations
    this.generateMigrationPlan();
  }

  extractBotPrivateKeys() {
    const walletsPath = path.join('config', 'wallets.js');
    if (fs.existsSync(walletsPath)) {
      const walletsContent = fs.readFileSync(walletsPath, 'utf8');
      
      // Extract bot configurations
      const botRegex = /id:\s*(\d+),[\s\S]*?privateKey:\s*'([^']+)'/g;
      let match;
      
      while ((match = botRegex.exec(walletsContent)) !== null) {
        const botId = match[1];
        const privateKey = match[2];
        
        this.secretsToMigrate.set(`BOT${botId}_PRIVATE_KEY`, {
          value: privateKey,
          description: `Private key for Bot ${botId}`,
          critical: true,
          source: 'config/wallets.js'
        });
      }
    }
  }

  extractFromEnvFiles() {
    const envPath = path.join('config', 'base-sepolia-pods-default.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const lines = envContent.split('\n');
      
      lines.forEach(line => {
        if (line.includes('PRIVATE_KEY=') && !line.startsWith('#')) {
          const [key, value] = line.split('=');
          if (value && value.length > 10) {
            this.secretsToMigrate.set(key.trim(), {
              value: value.trim(),
              description: `Private key for ${key.replace('_PRIVATE_KEY', '')}`,
              critical: true,
              source: 'config/base-sepolia-pods-default.env'
            });
          }
        }
      });
    }
  }

  generateMigrationPlan() {
    console.log('\n📋 SECRETS MIGRATION PLAN:');
    console.log('==========================================');
    
    this.secretsToMigrate.forEach((secret, key) => {
      console.log(`🔑 ${key}`);
      console.log(`   Description: ${secret.description}`);
      console.log(`   Source: ${secret.source}`);
      console.log(`   Critical: ${secret.critical ? '⚠️  YES' : 'No'}`);
      console.log('');
      
      this.migrationReport.push({
        key,
        description: secret.description,
        source: secret.source,
        critical: secret.critical
      });
    });
  }

  generateSecretsMigrationScript() {
    const instructions = `
# REPLIT SECRETS MIGRATION INSTRUCTIONS
# =====================================

## Phase 2 Preparation - Critical Secrets Migration

To ensure no private keys are lost during Phase 2 transition, follow these steps:

### 1. Open Replit Secrets Manager
   - Navigate to Tools → Secrets (or use the + button and type "Secrets")

### 2. Add the following secrets:

${Array.from(this.secretsToMigrate.entries()).map(([key, secret]) => 
`   Secret Key: ${key}
   Secret Value: ${secret.value}
   Description: ${secret.description}
`).join('\n')}

### 3. Update Configuration Files
   After adding secrets, update your configuration files to use process.env:

\`\`\`javascript
// Example: Replace hardcoded private keys with environment variables
const privateKey = process.env.BOT1_PRIVATE_KEY || 'fallback_key';
\`\`\`

### 4. Verification
   Run the verification script to ensure all secrets are properly configured:
   \`\`\`bash
   node verify-secrets-migration.js
   \`\`\`

## Benefits of Using Replit Secrets:
✅ Enhanced security - secrets are encrypted at rest
✅ Easy collaboration - secrets are shared with collaborators
✅ No accidental commits - secrets won't appear in code
✅ Centralized management - all secrets in one place
`;

    fs.writeFileSync('SECRETS-MIGRATION-GUIDE.md', instructions);
    console.log('📄 Created SECRETS-MIGRATION-GUIDE.md with detailed instructions');
  }

  createVerificationScript() {
    const verificationScript = `#!/usr/bin/env node

/**
 * Secrets Migration Verification
 * Verifies all critical secrets are properly configured in Replit Secrets
 */

const requiredSecrets = [
${Array.from(this.secretsToMigrate.keys()).map(key => `  '${key}'`).join(',\n')}
];

function verifySecrets() {
  console.log('🔍 Verifying secrets migration...');
  
  const missing = [];
  const configured = [];
  
  requiredSecrets.forEach(secretKey => {
    if (process.env[secretKey]) {
      configured.push(secretKey);
      console.log(\`✅ \${secretKey} - CONFIGURED\`);
    } else {
      missing.push(secretKey);
      console.log(\`❌ \${secretKey} - MISSING\`);
    }
  });
  
  console.log(\`\\n📊 Summary:\`);
  console.log(\`   Configured: \${configured.length}/\${requiredSecrets.length}\`);
  console.log(\`   Missing: \${missing.length}\`);
  
  if (missing.length === 0) {
    console.log('\\n🎉 All secrets successfully migrated!');
    return true;
  } else {
    console.log('\\n⚠️  Please add missing secrets to Replit Secrets manager');
    return false;
  }
}

if (require.main === module) {
  const success = verifySecrets();
  process.exit(success ? 0 : 1);
}

module.exports = { verifySecrets, requiredSecrets };
`;

    fs.writeFileSync('verify-secrets-migration.js', verificationScript);
    console.log('📄 Created verify-secrets-migration.js');
  }
}

// Run migration analysis
const migrationTool = new SecretsMigrationTool();
migrationTool.analyzeCriticalSecrets();
migrationTool.generateSecretsMigrationScript();
migrationTool.createVerificationScript();

console.log('\n🔐 Secrets migration preparation complete!');
console.log('📋 Review SECRETS-MIGRATION-GUIDE.md for next steps');
