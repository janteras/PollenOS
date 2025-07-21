// Real-time Alerts Component
const RealTimeAlerts = {
    init() {
        this.bindEvents();
        this.initializeWebSocket();
        this.loadSettings();
    },

    bindEvents() {
        // Filter events
        document.getElementById('alert-type-filter').addEventListener('change', () => this.filterAlerts());
        document.querySelectorAll('.alert-severity-filter input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => this.filterAlerts());
        });

        // Settings events
        document.getElementById('save-settings-btn').addEventListener('click', () => this.saveSettings());
    },

    initializeWebSocket() {
        this.ws = new WebSocket(`ws://${window.location.host}`);
        
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'alert') {
                this.addAlert(data.alert);
            }
        };

        this.ws.onclose = () => {
            console.log('WebSocket connection closed. Attempting to reconnect...');
            setTimeout(() => this.initializeWebSocket(), 5000);
        };
    },

    addAlert(alertData) {
        const alertContainer = document.getElementById('alerts-list');
        const alertElement = this.createAlertElement(alertData);
        
        // Add to top of list
        alertContainer.insertBefore(alertElement, alertContainer.firstChild);
        
        // Remove old alerts if we have too many
        const alerts = alertContainer.children;
        if (alerts.length > 50) {
            alertContainer.removeChild(alerts[alerts.length - 1]);
        }
    },

    createAlertElement(alertData) {
        const severityMap = {
            low: 'severity-low',
            medium: 'severity-medium',
            high: 'severity-high'
        };

        const alertElement = document.createElement('div');
        alertElement.className = `alert-item ${severityMap[alertData.severity]}`;

        const iconMap = {
            risk: '⚠️',
            trade: '🔄',
            market: '📈'
        };

        alertElement.innerHTML = `
            <div class="alert-icon">${iconMap[alertData.type]}</div>
            <div class="alert-details">
                <div class="alert-type">${alertData.type.toUpperCase()}</div>
                <div class="alert-message">${alertData.message}</div>
                <div class="alert-timestamp">${new Date(alertData.timestamp).toLocaleString()}</div>
            </div>
        `;

        return alertElement;
    },

    filterAlerts() {
        const typeFilter = document.getElementById('alert-type-filter').value;
        const severityFilters = {
            low: document.getElementById('low-severity').checked,
            medium: document.getElementById('medium-severity').checked,
            high: document.getElementById('high-severity').checked
        };

        const alerts = document.querySelectorAll('.alert-item');
        alerts.forEach(alert => {
            const type = alert.querySelector('.alert-type').textContent.toLowerCase();
            const severity = alert.className.split(' ')[1].replace('severity-', '');

            const typeMatch = typeFilter === 'all' || type === typeFilter;
            const severityMatch = severityFilters[severity];

            alert.style.display = typeMatch && severityMatch ? 'flex' : 'none';
        });
    },

    loadSettings() {
        const settings = JSON.parse(localStorage.getItem('alert-settings') || '{}');
        Object.entries(settings).forEach(([key, value]) => {
            const input = document.getElementById(key);
            if (input) input.value = value;
        });
    },

    saveSettings() {
        const settings = {
            volatility_threshold: document.getElementById('volatility-threshold').value,
            concentration_threshold: document.getElementById('concentration-threshold').value,
            position_size_limit: document.getElementById('position-size-limit').value,
            stop_loss_level: document.getElementById('stop-loss-level').value,
            price_change_threshold: document.getElementById('price-change-threshold').value,
            volume_alert: document.getElementById('volume-alert').value
        };

        localStorage.setItem('alert-settings', JSON.stringify(settings));

        // Send settings to server
        fetch('/api/alerts/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(settings)
        });

        // Update UI
        document.getElementById('save-settings-btn').textContent = 'Saved!';
        setTimeout(() => {
            document.getElementById('save-settings-btn').textContent = 'Save Settings';
        }, 2000);
    }
};

// Initialize alerts when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    RealTimeAlerts.init();
});
