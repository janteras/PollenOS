#!/bin/bash
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
