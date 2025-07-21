// PollenOS Dashboard JavaScript
class PollenOSDashboard {
    constructor() {
        this.ws = null;
        this.bots = new Map();
        this.strategies = new Set();
        this.systemRunning = false;

        this.init();
    }

    init() {
        this.setupWebSocket();
        this.setupEventListeners();
        this.loadInitialData();
        this.startPeriodicUpdates();
    }

    setupWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.updateConnectionStatus(true);
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleWebSocketMessage(data);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };

        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.updateConnectionStatus(false);
            // Attempt to reconnect after 5 seconds
            setTimeout(() => this.setupWebSocket(), 5000);
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateConnectionStatus(false);
        };
    }

    setupEventListeners() {
        // Network configuration
        document.getElementById('saveNetwork').addEventListener('click', () => {
            this.saveNetworkConfiguration();
        });

        // Bot management
        document.getElementById('addBot').addEventListener('click', () => {
            this.showAddBotModal();
        });

        // Modal controls
        document.querySelector('.close').addEventListener('click', () => {
            this.hideAddBotModal();
        });

        document.getElementById('cancelBot').addEventListener('click', () => {
            this.hideAddBotModal();
        });

        document.getElementById('addBotForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addNewBot();
        });

        // System controls
        document.getElementById('startSystem').addEventListener('click', () => {
            this.startSystem();
        });

        document.getElementById('restartSystem').addEventListener('click', () => {
            this.restartSystem();
        });

        document.getElementById('stopSystem').addEventListener('click', () => {
            this.stopSystem();
        });

        // Refresh controls
        document.getElementById('refreshStatus').addEventListener('click', () => {
            this.refreshBotStatus();
        });

        // Strategy template selection
        document.querySelectorAll('.strategy-card').forEach(card => {
            card.addEventListener('click', () => {
                this.selectStrategyTemplate(card.dataset.strategy);
            });
        });

        // Custom strategy upload
        document.getElementById('customStrategyUpload').addEventListener('click', () => {
            document.getElementById('strategyFile').click();
        });

        document.getElementById('strategyFile').addEventListener('change', (e) => {
            this.uploadCustomStrategy(e.target.files[0]);
        });

        // Configuration management
        document.getElementById('uploadConfig').addEventListener('click', () => {
            this.uploadConfiguration();
        });

        document.getElementById('saveConfig').addEventListener('click', () => {
            this.saveConfiguration();
        });

        document.getElementById('configFile').addEventListener('change', (e) => {
            this.handleConfigurationUpload(e.target.files[0]);
        });

        // Modal click outside to close
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('addBotModal');
            if (e.target === modal) {
                this.hideAddBotModal();
            }
        });
    }

    async loadInitialData() {
        try {
            // Load bot configurations
            const botsResponse = await fetch('/api/bots');
            if (botsResponse.ok) {
                const bots = await botsResponse.json();
                this.updateBotList(bots);
            }

            // Load system status
            const statusResponse = await fetch('/api/status');
            if (statusResponse.ok) {
                const status = await statusResponse.json();
                this.updateSystemStatus(status);
            }

            // Set initial network info and show faucet buttons for Base Sepolia
            const networkSelect = document.getElementById('networkSelect');
            if (networkSelect) {
                this.updateNetworkInfo(networkSelect.value);
            }

            this.updateStrategyUsage();
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showAlert('Error loading initial data. Please refresh the page.', 'error');
        }
    }

    startPeriodicUpdates() {
        // Update metrics every 30 seconds
        setInterval(() => {
            this.updateMetrics();
            this.updateBotStatus();
            this.updateRecentTransactions();
        }, 30000);

        // Update connection status every 10 seconds
        setInterval(() => {
            this.checkConnectionStatus();
        }, 10000);
    }

    updateConnectionStatus(connected) {
        const statusDot = document.getElementById('connectionStatus');
        const statusText = document.getElementById('connectionText');

        if (statusDot && statusText) {
            if (connected) {
                statusDot.style.background = '#48bb78';
                statusText.textContent = 'Connected';
            } else {
                statusDot.style.background = '#f56565';
                statusText.textContent = 'Disconnected';
            }
        }
    }

    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'bot_updated':
                this.updateBotInList(data.data);
                break;
            case 'trading_start':
                this.systemRunning = true;
                this.updateSystemControlButtons();
                break;
            case 'trading_stop':
                this.systemRunning = false;
                this.updateSystemControlButtons();
                break;
            case 'metrics_update':
                this.updateDashboardMetrics(data.data);
                break;
            case 'transaction':
                this.addRecentTransaction(data.data);
                break;
        }
    }

    async saveNetworkConfiguration() {
        const networkSelect = document.getElementById('networkSelect');
        const selectedNetwork = networkSelect.value;

        try {
            this.showLoading(document.getElementById('saveNetwork'));

            // Here you would typically save to backend
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call

            this.updateNetworkInfo(selectedNetwork);
            this.showAlert('Network configuration saved successfully!', 'success');
        } catch (error) {
            console.error('Error saving network configuration:', error);
            this.showAlert('Error saving network configuration.', 'error');
        } finally {
            this.hideLoading(document.getElementById('saveNetwork'));
        }
    }

    updateNetworkInfo(network) {
        const networkInfo = document.getElementById('networkInfo');
        const faucetButtons = document.getElementById('faucetButtons');
        const networkNames = {
            'base-sepolia': 'Connected to Base Sepolia Testnet',
            'base-mainnet': 'Connected to Base Mainnet',
            'avalanche-mainnet': 'Connected to Avalanche Mainnet'
        };

        if (networkInfo) {
            networkInfo.textContent = networkNames[network] || 'Connected to Unknown Network';
        }

        // Show faucet buttons only for Base Sepolia
        if (faucetButtons) {
            if (network === 'base-sepolia') {
                faucetButtons.style.display = 'block';
            } else {
                faucetButtons.style.display = 'none';
            }
        }
    }

    showAddBotModal() {
        document.getElementById('addBotModal').style.display = 'block';
        document.getElementById('botName').focus();
    }

    hideAddBotModal() {
        document.getElementById('addBotModal').style.display = 'none';
        document.getElementById('addBotForm').reset();
    }

    async addNewBot() {
        const formData = new FormData(document.getElementById('addBotForm'));
        const botData = {
            name: formData.get('botName') || document.getElementById('botName').value,
            privateKey: document.getElementById('privateKey').value,
            strategy: document.getElementById('strategySelect').value,
            riskLevel: document.getElementById('riskLevel').value,
            enabled: true
        };

        try {
            this.showLoading(document.querySelector('#addBotForm button[type="submit"]'));

            // Validate private key format
            if (!this.validatePrivateKey(botData.privateKey)) {
                throw new Error('Invalid private key format');
            }

            // Generate bot ID
            const botId = this.generateBotId();

            // Add to local storage (in production, this would be sent to backend)
            this.bots.set(botId, { ...botData, id: botId, status: 'configured' });
            this.strategies.add(botData.strategy);

            // Update UI
            this.updateBotList(Object.fromEntries(this.bots));
            this.updateStrategyUsage();

            this.showAlert(`Bot "${botData.name}" added successfully!`, 'success');
            this.hideAddBotModal();
        } catch (error) {
            console.error('Error adding bot:', error);
            this.showAlert(`Error adding bot: ${error.message}`, 'error');
        } finally {
            this.hideLoading(document.querySelector('#addBotForm button[type="submit"]'));
        }
    }

    validatePrivateKey(privateKey) {
        // Basic validation for Ethereum private key
        const cleanKey = privateKey.replace('0x', '');
        return /^[a-fA-F0-9]{64}$/.test(cleanKey);
    }

    generateBotId() {
        return Date.now().toString() + Math.random().toString(36).substr(2, 9);
    }

    updateBotList(bots) {
        const botList = document.getElementById('botList');
        if (!botList) return;

        botList.innerHTML = '';

        Object.entries(bots).forEach(([id, bot]) => {
            const botElement = this.createBotElement(id, bot);
            botList.appendChild(botElement);
        });

        if (Object.keys(bots).length === 0) {
            botList.innerHTML = '<p style="text-align: center; color: #718096; padding: 20px;">No bots configured. Click "Add New Bot" to get started.</p>';
        }
    }

    createBotElement(id, bot) {
        const div = document.createElement('div');
        div.className = 'bot-item';
        div.innerHTML = `
            <div class="bot-info">
                <div class="bot-field">
                    <label>Bot Name</label>
                    <span>${bot.name || `Bot ${id}`}</span>
                </div>
                <div class="bot-field">
                    <label>Strategy</label>
                    <span>${this.formatStrategyName(bot.strategy)}</span>
                </div>
                <div class="bot-field">
                    <label>Risk Level</label>
                    <span>${this.formatRiskLevel(bot.risk || bot.riskLevel)}</span>
                </div>
                <div class="bot-field">
                    <label>Status</label>
                    <span class="bot-status-badge ${this.getBotStatusClass(bot.status || 'inactive')}">${this.formatStatus(bot.status || 'inactive')}</span>
                </div>
            </div>
            <div class="bot-actions">
                <button class="btn btn-secondary" onclick="dashboard.editBot('${id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-danger" onclick="dashboard.removeBot('${id}')">
                    <i class="fas fa-trash"></i> Remove
                </button>
            </div>
        `;
        return div;
    }

    formatStrategyName(strategy) {
        return strategy.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }

    formatRiskLevel(risk) {
        if (!risk) return 'Medium';
        return risk.charAt(0).toUpperCase() + risk.slice(1);
    }

    formatStatus(status) {
        return status.charAt(0).toUpperCase() + status.slice(1);
    }

    getBotStatusClass(status) {
        switch (status) {
            case 'active': return '';
            case 'inactive': return 'inactive';
            case 'error': return 'warning';
            default: return 'inactive';
        }
    }

    updateStrategyUsage() {
        document.querySelectorAll('.strategy-card').forEach(card => {
            const strategy = card.dataset.strategy;
            const indicator = card.querySelector('.usage-indicator');

            if (this.strategies.has(strategy)) {
                indicator.classList.add('in-use');
                card.classList.add('active');
            } else {
                indicator.classList.remove('in-use');
                card.classList.remove('active');
            }
        });
    }

    async startSystem() {
        try {
            this.showLoading(document.getElementById('startSystem'));

            const response = await fetch('/api/trading/start', { method: 'POST' });
            if (response.ok) {
                this.systemRunning = true;
                this.updateSystemControlButtons();
                this.showAlert('Multi-bot system started successfully!', 'success');
            } else {
                throw new Error('Failed to start system');
            }
        } catch (error) {
            console.error('Error starting system:', error);
            this.showAlert('Error starting system. Please try again.', 'error');
        } finally {
            this.hideLoading(document.getElementById('startSystem'));
        }
    }

    async restartSystem() {
        try {
            this.showLoading(document.getElementById('restartSystem'));

            // Stop then start
            await fetch('/api/trading/stop', { method: 'POST' });
            await new Promise(resolve => setTimeout(resolve, 2000));
            await fetch('/api/trading/start', { method: 'POST' });

            this.systemRunning = true;
            this.updateSystemControlButtons();
            this.showAlert('Multi-bot system restarted successfully!', 'success');
        } catch (error) {
            console.error('Error restarting system:', error);
            this.showAlert('Error restarting system. Please try again.', 'error');
        } finally {
            this.hideLoading(document.getElementById('restartSystem'));
        }
    }

    async stopSystem() {
        try {
            this.showLoading(document.getElementById('stopSystem'));

            const response = await fetch('/api/trading/stop', { method: 'POST' });
            if (response.ok) {
                this.systemRunning = false;
                this.updateSystemControlButtons();
                this.showAlert('Multi-bot system stopped successfully!', 'success');
            } else {
                throw new Error('Failed to stop system');
            }
        } catch (error) {
            console.error('Error stopping system:', error);
            this.showAlert('Error stopping system. Please try again.', 'error');
        } finally {
            this.hideLoading(document.getElementById('stopSystem'));
        }
    }

    updateSystemControlButtons() {
        const startBtn = document.getElementById('startSystem');
        const restartBtn = document.getElementById('restartSystem');
        const stopBtn = document.getElementById('stopSystem');
        const statusDiv = document.getElementById('systemStatus');

        if (this.systemRunning) {
            startBtn.disabled = true;
            restartBtn.disabled = false;
            stopBtn.disabled = false;
            statusDiv.textContent = 'System Running';
            statusDiv.style.background = '#f0fff4';
            statusDiv.style.borderColor = '#9ae6b4';
            statusDiv.style.color = '#22543d';
        } else {
            startBtn.disabled = false;
            restartBtn.disabled = true;
            stopBtn.disabled = true;
            statusDiv.textContent = 'System Stopped';
            statusDiv.style.background = '#fed7d7';
            statusDiv.style.borderColor = '#feb2b2';
            statusDiv.style.color = '#742a2a';
        }
    }

    async updateMetrics() {
        try {
            const response = await fetch('/api/status');
            if (response.ok) {
                const data = await response.json();
                this.updateDashboardMetrics(data);
            }
        } catch (error) {
            console.error('Error updating metrics:', error);
        }
    }

    updateDashboardMetrics(data) {
        const activeBots = document.getElementById('activeBots');
        const totalValue = document.getElementById('totalValue');
        const performance24h = document.getElementById('performance24h');
        const recentTxs = document.getElementById('recentTxs');

        if (activeBots) activeBots.textContent = Object.keys(data.bots || {}).length;
        if (totalValue) totalValue.textContent = this.formatCurrency(data.totalValue || 0);
        if (performance24h) performance24h.textContent = this.formatPercentage(data.performance24h || 0);
        if (recentTxs) recentTxs.textContent = data.recentTransactions || 0;
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    }

    formatPercentage(value) {
        const sign = value >= 0 ? '+' : '';
        return `${sign}${value.toFixed(2)}%`;
    }

    async updateBotStatus() {
        try {
            const response = await fetch('/api/bots');
            if (response.ok) {
                const bots = await response.json();
                this.updateBotStatusList(bots);
            }
        } catch (error) {
            console.error('Error updating bot status:', error);
        }
    }

    updateBotStatusList(bots) {
        const statusList = document.getElementById('botStatusList');
        statusList.innerHTML = '';

        Object.entries(bots).forEach(([id, bot]) => {
            const statusCard = this.createBotStatusCard(id, bot);
            statusList.appendChild(statusCard);
        });

        if (Object.keys(bots).length === 0) {
            statusList.innerHTML = '<p style="text-align: center; color: #718096; padding: 20px;">No bots configured.</p>';
        }
    }

    createBotStatusCard(id, bot) {
        const div = document.createElement('div');
        div.className = `bot-status-card ${this.getBotStatusClass(bot.status || 'inactive')}`;
        div.innerHTML = `
            <div class="bot-status-info">
                <h4>${bot.name || `Bot ${id}`}</h4>
                <p>Strategy: ${this.formatStrategyName(bot.strategy)}</p>
                <div class="bot-status-metrics">
                    <span>Last Trade: ${bot.lastTrade || 'Never'}</span>
                    <span>Performance: ${this.formatPercentage(bot.performance || 0)}</span>
                </div>
            </div>
            <div class="bot-status-badge ${this.getBotStatusClass(bot.status || 'inactive')}">
                ${this.formatStatus(bot.status || 'inactive')}
            </div>
        `;
        return div;
    }

    async updateRecentTransactions() {
        // Mock transaction data for demonstration
        const mockTransactions = [
            {
                id: 1,
                type: 'buy',
                asset: 'PLN',
                amount: '1,250',
                price: '$0.045',
                bot: 'Momentum Bot',
                time: '2 minutes ago'
            },
            {
                id: 2,
                type: 'sell',
                asset: 'ETH',
                amount: '0.5',
                price: '$2,145.30',
                bot: 'Technical Bot',
                time: '5 minutes ago'
            }
        ];

        this.updateTransactionList(mockTransactions);
    }

    updateTransactionList(transactions) {
        const transactionList = document.getElementById('transactionList');
        if (!transactionList) return;

        transactionList.innerHTML = '';

        transactions.forEach(tx => {
            const txElement = this.createTransactionElement(tx);
            transactionList.appendChild(txElement);
        });

        if (transactions.length === 0) {
            transactionList.innerHTML = '<p style="text-align: center; color: #718096; padding: 20px;">No recent transactions.</p>';
        }
    }

    createTransactionElement(tx) {
        const div = document.createElement('div');
        div.className = 'transaction-item';
        div.innerHTML = `
            <div class="transaction-icon ${tx.type}">
                <i class="fas fa-arrow-${tx.type === 'buy' ? 'down' : 'up'}"></i>
            </div>
            <div class="transaction-info">
                <h5>${tx.type.toUpperCase()} ${tx.asset}</h5>
                <p>${tx.bot}</p>
            </div>
            <div class="transaction-amount">
                <div>${tx.amount} ${tx.asset}</div>
                <div style="font-size: 0.8rem; color: #718096;">${tx.price}</div>
            </div>
            <div class="transaction-time">${tx.time}</div>
        `;
        return div;
    }

    selectStrategyTemplate(strategy) {
        // Visual feedback for strategy selection
        document.querySelectorAll('.strategy-card').forEach(card => {
            if (card.dataset.strategy === strategy) {
                card.style.transform = 'scale(1.05)';
                setTimeout(() => {
                    card.style.transform = '';
                }, 200);
            }
        });

        this.showAlert(`${this.formatStrategyName(strategy)} strategy template selected.`, 'success');
    }

    async uploadCustomStrategy(file) {
        if (!file) return;

        try {
            this.showAlert('Uploading custom strategy...', 'warning');

            // Mock upload process
            await new Promise(resolve => setTimeout(resolve, 2000));

            this.showAlert(`Custom strategy "${file.name}" uploaded successfully!`, 'success');
        } catch (error) {
            console.error('Error uploading strategy:', error);
            this.showAlert('Error uploading custom strategy.', 'error');
        }
    }

    uploadConfiguration() {
        document.getElementById('configFile').click();
    }

    async handleConfigurationUpload(file) {
        if (!file) return;

        try {
            this.showAlert('Uploading configuration...', 'warning');

            const text = await file.text();
            const config = JSON.parse(text);

            // Validate configuration structure
            if (!config.bots || !config.network || !config.timestamp) {
                throw new Error('Invalid configuration file format');
            }

            // Apply the configuration
            this.bots.clear();
            this.strategies.clear();

            Object.entries(config.bots).forEach(([id, botConfig]) => {
                // Remove sensitive data display
                const sanitizedConfig = { ...botConfig };
                delete sanitizedConfig.privateKey;
                sanitizedConfig.privateKey = '***HIDDEN***';

                this.bots.set(id, sanitizedConfig);
                this.strategies.add(botConfig.strategy);
            });

            // Update UI
            this.updateBotList(Object.fromEntries(this.bots));
            this.updateStrategyUsage();

            // Update network selection
            if (config.network && config.network.name) {
                const networkSelect = document.getElementById('networkSelect');
                if (config.network.name.includes('Base Sepolia')) {
                    networkSelect.value = 'base-sepolia';
                } else if (config.network.name.includes('Base Mainnet')) {
                    networkSelect.value = 'base-mainnet';
                } else if (config.network.name.includes('Avalanche')) {
                    networkSelect.value = 'avalanche-mainnet';
                }
                this.updateNetworkInfo(networkSelect.value);
            }

            this.showAlert(`Configuration "${file.name}" loaded successfully! ${Object.keys(config.bots).length} bots configured.`, 'success');
        } catch (error) {
            console.error('Error uploading configuration:', error);
            this.showAlert(`Error loading configuration: ${error.message}`, 'error');
        }
    }

    async saveConfiguration() {
        try {
            this.showLoading(document.getElementById('saveConfig'));

            const response = await fetch('/api/export');
            if (!response.ok) {
                throw new Error('Failed to export configuration');
            }

            const configData = await response.json();

            // Create downloadable file
            const blob = new Blob([JSON.stringify(configData, null, 2)], {
                type: 'application/json'
            });

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `pollen-os-config-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showAlert('Configuration saved successfully!', 'success');
        } catch (error) {
            console.error('Error saving configuration:', error);
            this.showAlert('Error saving configuration. Please try again.', 'error');
        }
    }

    editBot(id) {
        // Implementation for editing bot configuration
        this.showAlert('Bot editing functionality coming soon!', 'warning');
    }

    removeBot(id) {
        if (confirm('Are you sure you want to remove this bot?')) {
            this.bots.delete(id);
            this.updateBotList(Object.fromEntries(this.bots));
            this.updateStrategyUsage();
            this.showAlert('Bot removed successfully!', 'success');
        }
    }

    refreshBotStatus() {
        this.showLoading(document.getElementById('refreshStatus'));
        setTimeout(() => {
            this.updateBotStatus();
            this.hideLoading(document.getElementById('refreshStatus'));
            this.showAlert('Bot status refreshed!', 'success');
        }, 1000);
    }

    async checkConnectionStatus() {
        try {
            const response = await fetch('/api/status');
            this.updateConnectionStatus(response.ok);
        } catch (error) {
            this.updateConnectionStatus(false);
        }
    }

    showLoading(element) {
        const originalText = element.innerHTML;
        element.innerHTML = '<span class="spinner"></span> Loading...';
        element.disabled = true;
        element.dataset.originalText = originalText;
    }

    hideLoading(element) {
        element.innerHTML = element.dataset.originalText || element.innerHTML;
        element.disabled = false;
        delete element.dataset.originalText;
    }

    showAlert(message, type = 'success') {
        // Remove existing alerts
        document.querySelectorAll('.alert').forEach(alert => alert.remove());

        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        alert.innerHTML = `
            <i class="fas fa-${this.getAlertIcon(type)}"></i>
            ${message}
            <button style="float: right; background: none; border: none; font-size: 1.2rem; cursor: pointer;" onclick="this.parentElement.remove()">&times;</button>
        `;

        // Insert at the top of the dashboard
        const dashboard = document.querySelector('.dashboard');
        dashboard.insertBefore(alert, dashboard.firstChild);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (alert.parentElement) {
                alert.remove();
            }
        }, 5000);
    }

    getAlertIcon(type) {
        switch (type) {
            case 'success': return 'check-circle';
            case 'error': return 'exclamation-circle';
            case 'warning': return 'exclamation-triangle';
            default: return 'info-circle';
        }
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new PollenOSDashboard();
});

// Safe chart initialization function
function initializeChartsWhenReady() {
    const performanceCtx = document.getElementById('performanceChart');
    const activityCtx = document.getElementById('activityChart');
    const riskCtx = document.getElementById('riskChart');
    const returnsCtx = document.getElementById('returnsChart');

    if (performanceCtx && activityCtx && riskCtx && returnsCtx && window.Chart) {
        // Charts are initialized in the PollenOSInterface class
        console.log('Charts ready for initialization');
    }
}

// Add some sample data for demonstration
window.addEventListener('load', () => {
    // Simulate some initial bots for demo purposes
    setTimeout(() => {
        if (window.dashboard && window.dashboard.bots.size === 0) {
            // Add sample bots if none exist
            const sampleBots = {
                'bot1': {
                    name: 'Conservative Bot',
                    strategy: 'conservative',
                    risk: 'low',
                    status: 'active',
                    lastTrade: '5 minutes ago',
                    performance: 2.5
                },
                'bot2': {
                    name: 'Momentum Bot',
                    strategy: 'momentum',
                    risk: 'medium',
                    status: 'active',
                    lastTrade: '1 minute ago',
                    performance: 5.2
                }
            };

            window.dashboard.updateBotList(sampleBots);
            window.dashboard.strategies.add('conservative');
            window.dashboard.strategies.add('momentum');
            window.dashboard.updateStrategyUsage();
            window.dashboard.updateDashboardMetrics({
                bots: sampleBots,
                totalValue: 15420.50,
                performance24h: 3.7,
                recentTransactions: 12
            });
        }
    }, 1000);
});

// Performance Charts Implementation
    const performanceSection = document.getElementById('performance-charts');
    performanceSection.innerHTML = `
        <div class="chart-container">
            <canvas id="profitChart" width="400" height="200"></canvas>
        </div>
        <div class="chart-container">
            <canvas id="tradeVolumeChart" width="400" height="200"></canvas>
        </div>
    `;

    // Initialize profit chart
    const profitCtx = document.getElementById('profitChart').getContext('2d');
    window.profitChart = new Chart(profitCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Portfolio Value (PLN)',
                data: [],
                borderColor: '#4CAF50',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: false
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Portfolio Performance Over Time'
                }
            }
        }
    });

    // Initialize trade volume chart
    const volumeCtx = document.getElementById('tradeVolumeChart').getContext('2d');
    window.volumeChart = new Chart(volumeCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Daily Trade Volume',
                data: [],
                backgroundColor: '#2196F3'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Daily Trading Volume'
                }
            }
        }
    });

// PollenOS Web Interface with Real-time Data
class PollenOSInterface {
    constructor() {
        this.ws = null;
        this.bots = {};
        this.status = {};
        this.charts = {};
        this.performanceData = [];
        this.init();
    }

    async init() {
        await this.loadBots();
        await this.loadStatus();
        this.renderBots();
        this.renderStatus();
        this.initializeCharts();
        await this.setupWebSocket();
    }

    async setupWebSocket() {
        try {
            this.ws = new WebSocket(`ws://${window.location.hostname}:${window.location.port || 5000}`);

            this.ws.onopen = () => {
                console.log('🔗 Connected to PollenOS data stream');
                this.updateConnectionStatus(true);
            };

            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleRealtimeData(data);
            };

            this.ws.onclose = () => {
                console.log('❌ Disconnected from data stream');
                this.updateConnectionStatus(false);
                // Reconnect after 5 seconds
                setTimeout(() => this.setupWebSocket(), 5000);
            };
        } catch (error) {
            console.error('WebSocket connection failed:', error);
        }
    }

    handleRealtimeData(data) {
        switch (data.type) {
            case 'bot_status':
                this.updateBotStatus(data.payload);
                break;
            case 'portfolio_update':
                this.updatePortfolioData(data.payload);
                break;
            case 'transaction':
                this.updateTransactionLog(data.payload);
                break;
            case 'performance':
                this.updatePerformanceMetrics(data.payload);
                break;
        }
    }

    updateBotStatus(bots) {
        const statusContainer = document.getElementById('bot-status-container');
        if (!statusContainer) return;

        statusContainer.innerHTML = '';

        bots.forEach(bot => {
            const botCard = this.createBotStatusCard(bot);
            statusContainer.appendChild(botCard);
        });
    }

    createBotStatusCard(bot) {
        const card = document.createElement('div');
        card.className = 'bot-status-card';
        card.innerHTML = `
            <div class="bot-header">
                <h3>${bot.name}</h3>
                <span class="status-indicator ${bot.status}">${bot.status}</span>
            </div>
            <div class="bot-metrics">
                <div class="metric"><label>Portfolio Value:</label>
                    <span class="value">$${bot.portfolioValue?.toLocaleString() || '0'}</span>
                </div>
                <div class="metric">
                    <label>24h P&L:</label>
                    <span class="value ${bot.pnl24h >= 0 ? 'positive' : 'negative'}">
                        ${bot.pnl24h >= 0 ? '+' : ''}${bot.pnl24h?.toFixed(2) || '0'}%
                    </span>
                </div>
                <div class="metric">
                    <label>Strategy:</label>
                    <span class="value">${bot.strategy || 'Unknown'}</span>
                </div>
                <div class="metric">
                    <label>Last Rebalance:</label>
                    <span class="value">${this.formatTimestamp(bot.lastRebalance)}</span>
                </div>
            </div>
        `;
        return card;
    }

    updatePerformanceMetrics(data) {
        // Update performance dashboard
        const performanceElement = document.getElementById('performance-summary');
        if (performanceElement) {
            performanceElement.innerHTML = `
                <div class="performance-grid">
                    <div class="metric-card">
                        <h4>Total Portfolio Value</h4>
                        <span class="big-number">$${data.totalValue?.toLocaleString() || '0'}</span>
                    </div>
                    <div class="metric-card">
                        <h4>Active Bots</h4>
                        <span class="big-number">${data.activeBots || 0}</span>
                    </div>
                    <div class="metric-card">
                        <h4>24h Performance</h4>
                        <span class="big-number ${data.performance24h >= 0 ? 'positive' : 'negative'}">
                            ${data.performance24h >= 0 ? '+' : ''}${data.performance24h?.toFixed(2) || '0'}%
                        </span>
                    </div>
                    <div class="metric-card">
                        <h4>Transactions Today</h4>
                        <span class="big-number">${data.transactionsToday || 0}</span>
                    </div>
                </div>
            `;
        }
    }

    updateTransactionLog(transaction) {
        const logContainer = document.getElementById('transaction-log');
        if (!logContainer) return;

        const txElement = document.createElement('div');
        txElement.className = 'transaction-item';
        txElement.innerHTML = `
            <div class="tx-info">
                <span class="tx-type">${transaction.type}</span>
                <span class="tx-bot">${transaction.botName}</span>
                <span class="tx-amount">${transaction.amount}</span>
            </div>
            <div class="tx-meta">
                <span class="tx-time">${this.formatTimestamp(transaction.timestamp)}</span>
                <a href="${transaction.explorerUrl}" target="_blank" class="tx-hash">
                    ${transaction.hash?.substring(0, 10)}...
                </a>
            </div>
        `;

        logContainer.insertBefore(txElement, logContainer.firstChild);

        // Keep only last 50 transactions
        while (logContainer.children.length > 50) {
            logContainer.removeChild(logContainer.lastChild);
        }
    }

    setupEventListeners() {
        // Strategy card selection
        document.querySelectorAll('.strategy-card').forEach(card => {
            card.addEventListener('click', () => {
                this.selectStrategy(card.dataset.strategy);
            });
        });

        // Bot control buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('start-bot-btn')) {
                this.startBot(e.target.dataset.botId);
            }
            if (e.target.classList.contains('stop-bot-btn')) {
                this.stopBot(e.target.dataset.botId);
            }
        });
    }

    async loadBotStatus() {
        try {
            const response = await fetch('/api/bots/status');
            const bots = await response.json();
            this.updateBotStatus(bots);
        } catch (error) {
            console.error('Failed to load bot status:', error);
        }
    }

    startDataRefresh() {
        // Refresh data every 30 seconds if WebSocket is not available
        setInterval(() => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                this.loadBotStatus();
            }
        }, 30000);
    }

    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('connection-status');
        if (statusElement) {
            statusElement.className = connected ? 'connected' : 'disconnected';
            statusElement.textContent = connected ? 'Connected' : 'Disconnected';
        }
    }

    formatTimestamp(timestamp) {
        if (!timestamp) return 'Never';
        return new Date(timestamp).toLocaleTimeString();
    }

    selectStrategy(strategy) {
        document.querySelectorAll('.strategy-card').forEach(card => {
            card.classList.remove('selected');
        });
        document.querySelector(`[data-strategy="${strategy}"]`).classList.add('selected');

        // Update strategy info
        this.displayStrategyInfo(strategy);
    }

    displayStrategyInfo(strategy) {
        const infoElement = document.getElementById('strategy-info');
        if (infoElement) {
            const strategyData = this.getStrategyInfo(strategy);
            infoElement.innerHTML = `
                <h3>${strategyData.name}</h3>
                <p>${strategyData.description}</p>
                <div class="strategy-params">
                    <h4>Parameters:</h4>
                    <ul>
                        ${strategyData.params.map(param => `<li>${param}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
    }

    getStrategyInfo(strategy) {
        const strategies = {
            'conservative': {
                name: 'Conservative Strategy',
                description: 'Low-risk approach focusing on stable returns',
                params: ['Risk Level: Low', 'Rebalance Frequency: Daily', 'Max Position: 25%']
            },
            'momentum': {
                name: 'Momentum Strategy',
                description: 'Follows trending markets for momentum-based trades',
                params: ['Risk Level: Medium', 'Trend Following: Yes', 'Stop Loss: 5%']
            },
            'high-frequency': {
                name: 'High Frequency Strategy',
                description: 'Ultra-fast execution for small profit margins',
                params: ['Risk Level: High', 'Execution Speed: <1s', 'Trade Frequency: High']
            },
            'arbitrage': {
                name: 'Arbitrage Strategy',
                description: 'Exploits price differences across markets',
                params: ['Risk Level: Low', 'Market Scanning: Multi-DEX', 'Min Profit: 0.5%']
            }
        };
        return strategies[strategy] || { name: 'Unknown Strategy', description: '', params: [] };
    }

    updateStatus(data) {
        this.status = data;
        this.renderStatus();
        this.updateCharts();
    }

    initializeCharts() {
        // Performance Chart
        const performanceCtx = document.getElementById('performanceChart').getContext('2d');
        this.charts.performance = new Chart(performanceCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Total Portfolio Value',
                    data: [],
                    borderColor: '#FFD700',
                    backgroundColor: 'rgba(255, 215, 0, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#fff' }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#fff' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    y: {
                        ticks: { color: '#fff' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    }
                }
            }
        });

        // Activity Chart
        const activityCtx = document.getElementById('activityChart').getContext('2d');
        this.charts.activity = new Chart(activityCtx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Trades per Hour',
                    data: [],
                    backgroundColor: 'rgba(75, 192, 192, 0.8)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#fff' }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#fff' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    y: {
                        ticks: { color: '#fff' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    }
                }
            }
        });

        // Risk Chart
        const riskCtx = document.getElementById('riskChart').getContext('2d');
        this.charts.risk = new Chart(riskCtx, {
            type: 'doughnut',
            data: {
                labels: ['Low Risk', 'Moderate Risk', 'High Risk'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: [
                        'rgba(54, 162, 235, 0.8)',
                        'rgba(255, 206, 86, 0.8)',
                        'rgba(255, 99, 132, 0.8)'
                    ],
                    borderColor: [
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 206, 86, 1)',
                        'rgba(255, 99, 132, 1)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#fff' }
                    }
                }
            }
        });

        // Returns Chart
        const returnsCtx = document.getElementById('returnsChart').getContext('2d');
        this.charts.returns = new Chart(returnsCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Daily Returns (%)',
                    data: [],
                    borderColor: '#9966FF',
                    backgroundColor: 'rgba(153, 102, 255, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#fff' }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#fff' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    y: {
                        ticks: { color: '#fff' },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    }
                }
            }
        });

        // Initialize with sample data
        this.updateCharts();
    }

    updateCharts() {
        if (!this.charts.performance) return;

        // Update performance chart with sample data
        const now = new Date();
        const timeLabels = Array.from({length: 24}, (_, i) => {
            const time = new Date(now.getTime() - (23 - i) * 60 * 60 * 1000);
            return time.getHours() + ':00';
        });

        // Generate sample performance data
        const performanceData = Array.from({length: 24}, (_, i) => {
            return 1000 + Math.sin(i * 0.5) * 100 + Math.random() * 50;
        });

        this.charts.performance.data.labels = timeLabels;
        this.charts.performance.data.datasets[0].data = performanceData;
        this.charts.performance.update();

        // Update activity chart
        const botNames = Object.keys(this.bots).map(id => this.bots[id].name || `Bot ${id}`);
        const activityData = botNames.map(() => Math.floor(Math.random() * 10) + 1);

        this.charts.activity.data.labels = botNames;
        this.charts.activity.data.datasets[0].data = activityData;
        this.charts.activity.update();

        // Update risk distribution
        const riskLevels = Object.values(this.bots).reduce((acc, bot) => {
            const risk = bot.riskLevel || 'moderate';
            if (risk === 'low') acc[0]++;
            else if (risk === 'moderate') acc[1]++;
            else acc[2]++;
            return acc;
        }, [0, 0, 0]);

        this.charts.risk.data.datasets[0].data = riskLevels;
        this.charts.risk.update();

        // Update returns chart
        const returnsData = Array.from({length: 7}, () => (Math.random() - 0.5) * 10);
        const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

        this.charts.returns.data.labels = dayLabels;
        this.charts.returns.data.datasets[0].data = returnsData;
        this.charts.returns.update();
    }
}

// Initialize interface when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('🌸 PollenOS Web Interface Loading...');
    new PollenOSInterface();
});