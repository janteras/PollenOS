import { theme } from '../theme';
import Chart from 'chart.js/auto';

// Reusable chart configuration
const chartConfig = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: theme.colors.textPrimary
      }
    },
    tooltip: {
      backgroundColor: theme.colors.background,
      titleColor: theme.colors.textPrimary,
      bodyColor: theme.colors.textSecondary
    }
  },
  scales: {
    x: {
      grid: {
        color: theme.colors.chart.grid
      },
      ticks: {
        color: theme.colors.chart.axis
      }
    },
    y: {
      grid: {
        color: theme.colors.chart.grid
      },
      ticks: {
        color: theme.colors.chart.axis
      }
    }
  }
};

class Visualizations {
  static createPriceChart(ctx, data) {
    return new Chart(ctx, {
      ...chartConfig,
      type: 'line',
      data: {
        labels: data.timestamps,
        datasets: [
          {
            label: 'Price',
            data: data.prices,
            borderColor: theme.colors.primary,
            backgroundColor: theme.colors.primaryLight,
            fill: true,
            tension: 0.1
          }
        ]
      }
    });
  }

  static createPerformanceChart(ctx, data) {
    return new Chart(ctx, {
      ...chartConfig,
      type: 'bar',
      data: {
        labels: ['Total Return', 'Annualized Return', 'Sharpe Ratio', 'Sortino Ratio'],
        datasets: [
          {
            label: 'Performance',
            data: [
              data.totalReturn * 100,
              data.annualizedReturn * 100,
              data.sharpeRatio,
              data.sortinoRatio
            ],
            backgroundColor: theme.colors.primary,
            borderColor: theme.colors.primaryDark,
            borderWidth: 1
          }
        ]
      },
      options: {
        ...chartConfig.options,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => {
                if (value === 0) return '0%';
                if (value === data.totalReturn * 100) return `${value.toFixed(2)}%`;
                if (value === data.annualizedReturn * 100) return `${value.toFixed(2)}%`;
                return value.toFixed(2);
              }
            }
          }
        }
      }
    });
  }

  static createRiskChart(ctx, data) {
    return new Chart(ctx, {
      ...chartConfig,
      type: 'radar',
      data: {
        labels: ['Volatility', 'Beta', 'VaR', 'Max Drawdown', 'Position Size', 'Liquidity'],
        datasets: [
          {
            label: 'Risk Metrics',
            data: [
              data.volatility * 100,
              data.beta,
              data.valueAtRisk,
              data.maxDrawdown * 100,
              data.positionSize * 100,
              data.liquidity * 100
            ],
            backgroundColor: theme.colors.primaryLight,
            borderColor: theme.colors.primary,
            pointBackgroundColor: theme.colors.primary,
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: theme.colors.primary
          }
        ]
      },
      options: {
        ...chartConfig.options,
        scales: {
          r: {
            angleLines: {
              color: theme.colors.chart.grid
            },
            grid: {
              color: theme.colors.chart.grid
            },
            ticks: {
              color: theme.colors.chart.axis,
              callback: (value) => {
                if (value === 0) return '0%';
                return `${value.toFixed(0)}%`;
              }
            }
          }
        }
      }
    });
  }

  static createCorrelationMatrix(ctx, data) {
    // Create heatmap data
    const labels = Object.keys(data);
    const values = [];
    
    labels.forEach(row => {
      const rowData = [];
      labels.forEach(col => {
        rowData.push(data[row][col] * 100); // Convert to percentage for better visualization
      });
      values.push(rowData);
    });

    return new Chart(ctx, {
      ...chartConfig,
      type: 'heatmap',
      data: {
        labels: labels,
        datasets: [
          {
            data: values,
            backgroundColor: (ctx) => {
              const value = ctx.dataset.data[ctx.dataIndex];
              const color = Chart.helpers.color(theme.colors.primary);
              return color.alpha(value / 100).rgbString();
            }
          }
        ]
      },
      options: {
        ...chartConfig.options,
        scales: {
          x: {
            ticks: {
              color: theme.colors.textSecondary
            }
          },
          y: {
            ticks: {
              color: theme.colors.textSecondary
            }
          }
        }
      }
    });
  }

  static createPortfolioAllocationChart(ctx, data) {
    return new Chart(ctx, {
      ...chartConfig,
      type: 'doughnut',
      data: {
        labels: Object.keys(data),
        datasets: [
          {
            data: Object.values(data),
            backgroundColor: [
              theme.colors.primary,
              theme.colors.chart.primary,
              theme.colors.chart.secondary,
              theme.colors.chart.tertiary,
              theme.colors.chart.background
            ],
            hoverBackgroundColor: [
              theme.colors.primaryDark,
              theme.colors.chart.primary,
              theme.colors.chart.secondary,
              theme.colors.chart.tertiary,
              theme.colors.chart.background
            ]
          }
        ]
      }
    });
  }

  static createPerformanceComparisonChart(ctx, data) {
    return new Chart(ctx, {
      ...chartConfig,
      type: 'line',
      data: {
        labels: data.timestamps,
        datasets: [
          {
            label: 'Bot Performance',
            data: data.botReturns,
            borderColor: theme.colors.primary,
            backgroundColor: theme.colors.primaryLight,
            fill: true,
            tension: 0.1
          },
          {
            label: 'Market Benchmark',
            data: data.marketReturns,
            borderColor: theme.colors.chart.secondary,
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            fill: true,
            tension: 0.1
          }
        ]
      }
    });
  }
}

export default Visualizations;
