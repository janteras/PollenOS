# PollenOS - AI Trading Bot System

## Quick Installation

### Prerequisites
- Node.js 18+ installed
- Git (optional, for updates)

### Installation Steps

#### On Linux/macOS:
```bash
chmod +x install.sh
./install.sh
```

#### On Windows:
```batch
install.bat
```

### Manual Installation:
```bash
npm install
cd web-interface && npm install && cd ..
cp .env.example .env
```

## Configuration

1. Edit the `.env` file with your settings
2. Run the setup wizard: `npm run setup`
3. Configure your trading strategies in the web interface

## Running PollenOS

### Start Trading Bots:
```bash
npm start
```

### Start Web Interface:
```bash
npm run config
```

### Available Commands:
- `npm start` - Start multi-bot trading system
- `npm run config` - Start web configuration interface  
- `npm run setup` - Run configuration wizard
- `npm run verify` - Verify system setup
- `npm run create-portfolios` - Create bot portfolios

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
