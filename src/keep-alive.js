/**
 * Keep-alive server for cloud platform deployment (Render, Qoddi, etc.)
 * Prevents the application from sleeping due to inactivity
 */
const http = require('http');
const logger = require('./modules/logger');

// Get port from environment variable (Render and other platforms set this)
const PORT = process.env.PORT || 3001;

// Create a simple HTTP server
const server = http.createServer((req, res) => {
  // Log the request for debugging
  logger.debug(`Keep-alive request received: ${req.method} ${req.url}`);

  // Return a simple status message
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'running',
    timestamp: new Date().toISOString(),
    message: 'Pollen Trading Bot is active',
    platform: process.env.RENDER ? 'Render' : 'Unknown',
    version: require('../package.json').version
  }));

  // For Render.com, we need to return a 200 response to the health check
  if (req.url === '/healthz' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
  }
});

// Handle port conflicts
const startServer = (port) => {
  const httpServer = server.listen(port, '0.0.0.0', () => {
    logger.info(`Keep-alive server running on port ${port}`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.warn(`Port ${port} is busy, trying ${port + 1}`);
      startServer(port + 1);
    } else {
      logger.error('Server error:', err);
    }
  });
  return httpServer;
};

// Start the server
startServer(PORT);

module.exports = {server, startServer};