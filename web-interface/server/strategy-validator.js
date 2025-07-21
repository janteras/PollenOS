const RiskValidator = require('./risk-validator');

class StrategyValidator {
  static async validateStrategy(strategy) {
    const errors = [];

    // Validate required fields
    if (!strategy.id) {
      errors.push('Strategy ID is required');
    }

    if (!strategy.name) {
      errors.push('Strategy name is required');
    }

    if (!strategy.type) {
      errors.push('Strategy type is required');
    }

    // Validate risk level
    if (strategy.riskLevel) {
      try {
        RiskValidator.validateRiskLevel(strategy.riskLevel);
      } catch (error) {
        errors.push(error.message);
      }
    }
    const riskValidation = await validateRiskLevel(strategy.riskLevel);
    if (!riskValidation.valid) {
      errors.push(...riskValidation.errors);
    }

    // Validate parameters based on strategy type
    const typeValidators = {
      'conservative': this.validateConservativeStrategy,
      'momentum': this.validateMomentumStrategy,
      'technical': this.validateTechnicalStrategy,
      'mean-reversion': this.validateMeanReversionStrategy
    };

    if (!typeValidators[strategy.type]) {
      errors.push(`Unsupported strategy type: ${strategy.type}`);
    } else {
      const typeErrors = await typeValidators[strategy.type](strategy);
      if (typeErrors.length > 0) {
        errors.push(...typeErrors);
      }
    }

    // Validate performance metrics
    if (strategy.performance) {
      const performanceErrors = this.validatePerformanceMetrics(strategy.performance);
      if (performanceErrors.length > 0) {
        errors.push(...performanceErrors);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  static validateConservativeStrategy(strategy) {
    const errors = [];
    if (!strategy.maxAllocation || strategy.maxAllocation > 15) {
      errors.push('Max allocation for conservative strategy must be <= 15%');
    }
    if (!strategy.stopLoss || strategy.stopLoss < 0.02) {
      errors.push('Stop loss for conservative strategy must be >= 2%');
    }
    return errors;
  }

  static validateMomentumStrategy(strategy) {
    const errors = [];
    if (!strategy.momentumPeriod || strategy.momentumPeriod < 7) {
      errors.push('Momentum period must be >= 7 days');
    }
    if (!strategy.maxAllocation || strategy.maxAllocation > 25) {
      errors.push('Max allocation for momentum strategy must be <= 25%');
    }
    return errors;
  }

  static validateTechnicalStrategy(strategy) {
    const errors = [];
    if (!strategy.indicators || !Array.isArray(strategy.indicators) || 
        strategy.indicators.length === 0) {
      errors.push('Technical strategy must have at least one indicator');
    }
    if (!strategy.maxAllocation || strategy.maxAllocation > 30) {
      errors.push('Max allocation for technical strategy must be <= 30%');
    }
    return errors;
  }

  static validateMeanReversionStrategy(strategy) {
    const errors = [];
    if (!strategy.meanPeriod || strategy.meanPeriod < 14) {
      errors.push('Mean reversion period must be >= 14 days');
    }
    if (!strategy.maxAllocation || strategy.maxAllocation > 20) {
      errors.push('Max allocation for mean reversion strategy must be <= 20%');
    }
    return errors;
  }

  static validatePerformanceMetrics(metrics) {
    const errors = [];
    if (!metrics) return errors;

    if (metrics.targetReturn && (metrics.targetReturn < 0 || metrics.targetReturn > 1)) {
      errors.push('Target return must be between 0 and 1');
    }

    if (metrics.maxDrawdown && (metrics.maxDrawdown < 0 || metrics.maxDrawdown > 1)) {
      errors.push('Max drawdown must be between 0 and 1');
    }

    if (metrics.riskFreeRate && (metrics.riskFreeRate < 0 || metrics.riskFreeRate > 0.1)) {
      errors.push('Risk free rate must be between 0 and 0.1');
    }

    return errors;
  }
}

module.exports = StrategyValidator;
