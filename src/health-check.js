const express = require('express');
const app = express();
const PORT = process.env.HEALTH_CHECK_PORT || 3002;

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

try {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Health check server running on port ${PORT}`);
  });
} catch (error) {
  console.warn(`Health check server failed to start: ${error.message}`);
  // Continue without health check server
}

module.exports = app;