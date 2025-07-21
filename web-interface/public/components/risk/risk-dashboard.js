// Risk Dashboard Component
const RiskDashboard = {
    init() {
        this.bindEvents();
        this.initializeChart();
        this.fetchRiskData();
    },

    bindEvents() {
        // Position sizing strategy buttons
        document.querySelectorAll('.sizing-strategy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.sizing-strategy-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.updatePositionSizingChart(btn.dataset.strategy);
            });
        });

        // Control update buttons
        document.querySelectorAll('.control-update-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const controlType = btn.closest('.control-card').querySelector('h3').textContent.toLowerCase();
                const value = btn.previousElementSibling.value;
                this.updateControl(controlType, value);
            });
        });
    },

    initializeChart() {
        const ctx = document.getElementById('position-sizing-chart').getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Asset 1', 'Asset 2', 'Asset 3', 'Asset 4', 'Asset 5'],
                datasets: [{
                    label: 'Position Size',
                    data: [0, 0, 0, 0, 0],
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    },

    async fetchRiskData() {
        try {
            const [assessment, sizing, controls] = await Promise.all([
                this.fetchRiskAssessment(),
                this.fetchPositionSizing(),
                this.fetchRiskControls()
            ]);

            this.updateRiskMeter(assessment.riskLevel);
            this.updateRiskFactors(assessment.factors);
            this.updateRecommendations(assessment.recommendations);
            this.updatePositionSizingChart(sizing.strategy);
            this.updateControls(controls);

            // Set up periodic updates
            setInterval(() => this.fetchRiskData(), 60000); // Update every minute
        } catch (error) {
            console.error('Error fetching risk data:', error);
        }
    },

    async fetchRiskAssessment() {
        const response = await fetch('/api/risk/assessment/latest?botId=1');
        return await response.json();
    },

    async fetchPositionSizing() {
        const response = await fetch('/api/risk/position-size', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                botId: 1,
                portfolio: {
                    symbols: ['WBTC', 'WETH', 'USDC', 'LINK', 'DAI'],
                    weights: [0.2, 0.3, 0.2, 0.2, 0.1],
                    volatilities: [0.05, 0.03, 0.01, 0.04, 0.02]
                },
                riskProfile: {
                    sizingStrategy: 'volatility-based',
                    totalRiskBudget: 0.05
                }
            })
        });
        return await response.json();
    },

    async fetchRiskControls() {
        const response = await fetch('/api/risk/control/evaluate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                botId: 1,
                metrics: {
                    price_change: 0.02,
                    position_size: 0.15,
                    volatility: 0.04,
                    liquidity_ratio: 0.85
                }
            })
        });
        return await response.json();
    },

    updateRiskMeter(level) {
        const meter = document.querySelector('.risk-meter-fill');
        const levelDisplay = document.getElementById('current-risk-level');
        
        // Map risk level to percentage
        const percentage = (level / 5) * 100;
        meter.style.width = `${percentage}%`;
        
        // Update risk level display
        levelDisplay.textContent = level;
    },

    updateRiskFactors(factors) {
        Object.entries(factors).forEach(([factor, value]) => {
            const valueElement = document.getElementById(`${factor}-value`);
            const statusElement = document.getElementById(`${factor}-status`);
            
            valueElement.textContent = `${(value * 100).toFixed(2)}%`;
            
            // Determine status color
            const threshold = this.getThreshold(factor);
            const status = value > threshold ? 'HIGH' : 'NORMAL';
            statusElement.textContent = status;
            statusElement.style.color = status === 'HIGH' ? '#dc2626' : '#10b981';
        });
    },

    getThreshold(factor) {
        const thresholds = {
            volatility: 0.2,
            concentration: 0.5,
            liquidity: 0.1,
            correlation: 0.7
        };
        return thresholds[factor] || 0.5;
    },

    updateRecommendations(recommendations) {
        const recommendationsList = document.getElementById('risk-recommendations');
        recommendationsList.innerHTML = recommendations.map(rec => `
            <div class="recommendation-item">${rec}</div>
        `).join('');
    },

    updatePositionSizingChart(strategy) {
        // Update chart data based on strategy
        const data = this.getSampleData(strategy);
        this.chart.data.datasets[0].data = data;
        this.chart.update();
    },

    getSampleData(strategy) {
        switch (strategy) {
            case 'volatility-based':
                return [0.3, 0.25, 0.2, 0.15, 0.1];
            case 'var':
                return [0.25, 0.25, 0.2, 0.15, 0.15];
            case 'equal':
                return [0.2, 0.2, 0.2, 0.2, 0.2];
            default:
                return [0.3, 0.25, 0.2, 0.15, 0.1];
        }
    },

    async updateControl(controlType, value) {
        try {
            const response = await fetch('/api/risk/control/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    botId: 1,
                    controlType,
                    parameters: {
                        threshold: parseFloat(value)
                    }
                })
            });
            const result = await response.json();
            console.log(`Updated ${controlType} control:`, result);
        } catch (error) {
            console.error('Error updating control:', error);
        }
    },

    updateControls(controls) {
        controls.forEach(control => {
            const statusElement = document.getElementById(`${control.type}-status`);
            if (statusElement) {
                statusElement.textContent = control.active ? 'Active' : 'Inactive';
                statusElement.style.backgroundColor = control.active ? '#10b981' : '#dc2626';
            }
        });
    }
};

// Initialize the risk dashboard when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    RiskDashboard.init();
});
