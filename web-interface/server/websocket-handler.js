const WebSocket = require('ws');

module.exports = class WebSocketHandler {
    constructor(server) {
        this.wss = new WebSocket.Server({ server });
        this.clients = new Set();
        this.initializeWebSocket();
    }

    // Event handler for WebSocket connections
    on(event, handler) {
        if (event === 'connection') {
            this.wss.on(event, handler);
        }
    }

    // Broadcast message to all connected clients
    broadcastMessage(message) {
        this.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
            }
        });
    }

    initializeWebSocket() {
        this.wss.on('connection', (ws) => {
            console.log('WebSocket client connected');
            this.clients.add(ws);

            // Send initial connection message
            ws.send(JSON.stringify({
                type: 'connected',
                message: 'WebSocket connection established'
            }));

            // Handle client messages
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    this.handleClientMessage(ws, data);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            });

            // Handle client disconnection
            ws.on('close', () => {
                console.log('WebSocket client disconnected');
                this.clients.delete(ws);
            });
        });
    }

    handleClientMessage(ws, data) {
        switch (data.type) {
            case 'subscribe':
                this.handleSubscription(ws, data);
                break;
            case 'unsubscribe':
                this.handleUnsubscription(ws, data);
                break;
            default:
                console.log('Unknown message type:', data.type);
        }
    }

    handleSubscription(ws, data) {
        // Handle subscription requests
        console.log(`Client subscribed to: ${data.topic}`);
        this.sendRealTimeData(ws, data.topic);
    }

    handleUnsubscription(ws, data) {
        // Handle unsubscription requests
        console.log(`Client unsubscribed from: ${data.topic}`);
    }

    sendRealTimeData(ws, topic) {
        // Send real-time data for the requested topic
        const data = this.getRealTimeData(topic);
        if (data) {
            ws.send(JSON.stringify({
                type: 'real-time-data',
                topic,
                data
            }));
        }
    }

    getRealTimeData(topic) {
        // Get real-time data for the specified topic
        // This should be implemented based on your data sources
        return {
            timestamp: new Date().toISOString(),
            topic
        };
    }

    broadcastMessage(message) {
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
            }
        });
    }

    close() {
        this.wss.close();
        this.clients.clear();
    }
};
