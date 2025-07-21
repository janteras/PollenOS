class RiskValidator {
  static validateRiskLevel(riskLevel) {
    if (!riskLevel) {
      throw new Error('Risk level is required');
    }

    if (typeof riskLevel !== 'number') {
      throw new Error('Risk level must be a number');
    }

    if (riskLevel < 0 || riskLevel > 100) {
      throw new Error('Risk level must be between 0 and 100');
    }

    return true;
  }

  static validateMaxAllocation(maxAllocation) {
    if (!maxAllocation) {
      throw new Error('Max allocation is required');
    }

    if (typeof maxAllocation !== 'number') {
      throw new Error('Max allocation must be a number');
    }

    if (maxAllocation < 0 || maxAllocation > 100) {
      throw new Error('Max allocation must be between 0 and 100');
    }

    return true;
  }

  static validatePositionSize(positionSize) {
    if (!positionSize) {
      throw new Error('Position size is required');
    }

    if (typeof positionSize !== 'number') {
      throw new Error('Position size must be a number');
    }

    if (positionSize < 0) {
      throw new Error('Position size must be positive');
    }

    return true;
  }
}

module.exports = RiskValidator;
