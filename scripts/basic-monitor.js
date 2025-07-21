require('dotenv').config({ path: require('path').resolve(__dirname, '../base-sepolia.env') });
const express = require('express');
const { ethers } = require('ethers');

const app = express();
const port = 3000;

// Simple status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    network: 'Base Sepolia',
    timestamp: new Date().toISOString()
  });
});

// Simple HTML response
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Pollen Trading Bots</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .status { padding: 20px; margin: 10px 0; background: #f0f0f0; border-radius: 5px; }
      </style>
    </head>
    <body>
      <h1>Pollen Trading Bots - Status</h1>
      <div id="status" class="status">Loading status...</div>
      <p>Network: Base Sepolia</p>
      <p>Last updated: <span id="timestamp">-</span></p>
      <script>
        async function updateStatus() {
          try {
            const response = await fetch('/api/status');
            const data = await response.json();
            document.getElementById('status').textContent = 'Status: ' + data.status.toUpperCase();
            document.getElementById('timestamp').textContent = new Date(data.timestamp).toLocaleString();
          } catch (error) {
            console.error('Error:', error);
          }
        }
        updateStatus();
        setInterval(updateStatus, 5000);
      </script>
    </body>
    </html>
  `);
});

// Start the server
app.listen(port, () => {
  console.log(`Monitor dashboard running at http://localhost:${port}`);
});
