
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🏗️  Building PollenOS Local Distribution...');

// Create distribution directory
const distDir = path.join(__dirname, 'pollen-os-local');
if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true });
}
fs.mkdirSync(distDir);

// Copy essential files
const filesToCopy = [
    'src/',
    'web-interface/',
    'config/',
    'bots/',
    'contracts/',
    'abis/',
    'package.json',
    'README.md',
    'LOCAL_DEPLOYMENT.md',
    'multi-bot-launcher.js',
    'config.js'
];

console.log('📁 Copying core files...');
filesToCopy.forEach(file => {
    const src = path.join(__dirname, file);
    const dest = path.join(distDir, file);
    
    if (fs.existsSync(src)) {
        if (fs.statSync(src).isDirectory()) {
            fs.cpSync(src, dest, { recursive: true });
        } else {
            fs.copyFileSync(src, dest);
        }
        console.log(`   ✅ ${file}`);
    }
});

// Create startup script
const startupScript = `#!/usr/bin/env node

const express = require('express');
const path = require('path');
const { spawn } = require('child_process');

console.log('🌸 Starting PollenOS Local Environment...');

// Start web interface server
const webServer = express();
webServer.use(express.static(path.join(__dirname, 'web-interface/public')));
webServer.listen(5000, '0.0.0.0', () => {
    console.log('🌐 Web interface available at http://localhost:5000');
});

// Start configuration server
const configServer = spawn('node', [path.join(__dirname, 'web-interface/server/config-server.js')], {
    stdio: 'inherit'
});

console.log('⚙️  Configuration server started');
console.log('🤖 To start trading bots, run: node multi-bot-launcher.js');
console.log('📊 Access dashboard at: http://localhost:5000');
`;

fs.writeFileSync(path.join(distDir, 'start-pollen-os.js'), startupScript);
fs.chmodSync(path.join(distDir, 'start-pollen-os.js'), '755');

// Create package.json for distribution
const distPackageJson = {
    "name": "pollen-os-local",
    "version": "1.0.0",
    "description": "PollenOS Local Trading Bot Environment",
    "main": "start-pollen-os.js",
    "scripts": {
        "start": "node start-pollen-os.js",
        "install-deps": "npm install",
        "setup": "node src/setup.js"
    },
    "dependencies": {
        "express": "^4.18.2",
        "ethers": "^6.7.1",
        "winston": "^3.10.0",
        "ws": "^8.13.0"
    }
};

fs.writeFileSync(path.join(distDir, 'package.json'), JSON.stringify(distPackageJson, null, 2));

// Create installation instructions
const installInstructions = `# PollenOS Local Installation

## Quick Start

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Run setup wizard:
   \`\`\`bash
   npm run setup
   \`\`\`

3. Start PollenOS:
   \`\`\`bash
   npm start
   \`\`\`

4. Open browser to: http://localhost:5000

## Configuration

- Edit \`config/.env\` for network settings
- Configure wallets in \`config/wallets.js\`
- Adjust strategies in \`src/modules/strategy.js\`

## Support

For issues and documentation, visit: https://github.com/pollen-os/pollen-os
`;

fs.writeFileSync(path.join(distDir, 'INSTALL.md'), installInstructions);

console.log('✅ Distribution built successfully!');
console.log(`📦 Package location: ${distDir}`);
console.log('🚀 Ready for local deployment!');
