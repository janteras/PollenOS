require('dotenv').config({ path: require('path').resolve(__dirname, '../base-sepolia.env') });
const express = require('express');
const { ethers } = require('ethers');
const config = require('./config');

class SimpleMonitor {
  constructor() {
    this.app = express();
    this.provider = new ethers.JsonRpcProvider(config.RPC_URL);
    this.setupServer();
  }

  setupServer() {
    // Middleware
    this.app.use(express.json());
    
    // API Endpoint for bot status
    this.app.get('/api/status', (req, res) => {
      res.json({
        status: 'running',
        network: config.RPC_URL,
        timestamp: new Date().toISOString()
      });
    });
    
    // Serve a simple status page
    this.app.get('/', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Pollen Trading Bots - Status</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .container { max-width: 800px; margin: 0 auto; }
            .status { padding: 20px; margin: 10px 0; border-radius: 5px; }
            .online { background-color: #d4edda; color: #155724; }
            .offline { background-color: #f8d7da; color: #721c24; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Pollen Trading Bots - Status</h1>
            <div id="status" class="status">Loading status...</div>
            <div>
              <h3>Network: ${config.RPC_URL}</h3>
              <p>Last updated: <span id="timestamp">-</span></p>
            </div>
          </div>
          <script>
            async function updateStatus() {
              try {
                const response = await fetch('/api/status');
                const data = await response.json();
                
                const statusDiv = document.getElementById('status');
                statusDiv.textContent = `Status: ${data.status.toUpperCase()}`;
                statusDiv.className = `status ${data.status === 'running' ? 'online' : 'offline'}`;
                
                document.getElementById('timestamp').textContent = new Date(data.timestamp).toLocaleString();
              } catch (error) {
                console.error('Error fetching status:', error);
                document.getElementById('status').textContent = 'Error fetching status';
              }
            }
            
            // Update status immediately and then every 30 seconds
            updateStatus();
            setInterval(updateStatus, 30000);
          </script>
        </body>
        </html>
      `);
    });
  }
  
  start(port = 3000) {
    this.server = this.app.listen(port, () => {
      console.log(`Monitor dashboard running on http://localhost:${port}`);
    });
    
    // Handle graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }
  
  shutdown() {
    if (this.server) {
      this.server.close();
      console.log('Monitor dashboard stopped');
      process.exit(0);
    }
  }
}

// Start the monitor if this file is run directly
if (require.main === module) {
  const monitor = new SimpleMonitor();
  monitor.start(3000);
}

module.exports = { SimpleMonitor };
