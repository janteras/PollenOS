/**
 * Notification Manager Module
 * Handles alerts and notifications for important events and issues
 */
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

// Notification log directory
const NOTIFICATION_DIR = path.resolve(__dirname, '../../logs/notifications');

// Notification levels
const LEVELS = {
  INFO: 'info',
  WARNING: 'warning',
  ALERT: 'alert',
  CRITICAL: 'critical'
};

// Ensure notifications directory exists
if (!fs.existsSync(NOTIFICATION_DIR)) {
  fs.mkdirSync(NOTIFICATION_DIR, { recursive: true });
  logger.debug(`Created notifications directory at ${NOTIFICATION_DIR}`);
}

/**
 * Create a notification manager for a bot
 * @param {string} botId Bot ID
 * @param {Object} options Notification options
 * @returns {Object} Notification manager instance
 */
function createNotificationManager(botId, options = {}) {
  const {
    enableConsole = true,
    enableLogs = true,
    notifyEmail = false,
    emailAddress = null,
    criticalAlertThreshold = 3 // Number of critical alerts before escalating
  } = options;
  
  // Track critical alert count
  let criticalCount = 0;
  
  // Notification history
  const notificationHistory = [];
  
  return {
    /**
     * Send a notification
     * @param {string} level Notification level
     * @param {string} message Notification message
     * @param {Object} data Additional data
     */
    notify: function(level, message, data = {}) {
      if (!Object.values(LEVELS).includes(level)) {
        level = LEVELS.INFO;
      }
      
      const notification = {
        timestamp: Date.now(),
        botId,
        level,
        message,
        data
      };
      
      // Log to console if enabled
      if (enableConsole) {
        switch (level) {
        case LEVELS.INFO:
          logger.info(`[Notification] Bot ${botId}: ${message}`);
          break;
        case LEVELS.WARNING:
          logger.warn(`[Notification] Bot ${botId}: ${message}`);
          break;
        case LEVELS.ALERT:
        case LEVELS.CRITICAL:
          logger.error(`[${level.toUpperCase()}] Bot ${botId}: ${message}`);
          break;
        }
      }
      
      // Write to log file if enabled
      if (enableLogs) {
        const logFile = path.join(NOTIFICATION_DIR, `bot${botId}_notifications.log`);
        const logEntry = `[${new Date(notification.timestamp).toISOString()}] [${level.toUpperCase()}] ${message}\n`;
        
        try {
          fs.appendFileSync(logFile, logEntry);
        } catch (error) {
          logger.warn(`Failed to write notification to log: ${error.message}`);
        }
      }
      
      // Track notification in history
      notificationHistory.push(notification);
      
      // Trim history if too long (keep last 100)
      if (notificationHistory.length > 100) {
        notificationHistory.shift();
      }
      
      // Handle critical notifications
      if (level === LEVELS.CRITICAL) {
        criticalCount++;
        
        // Check if we need to escalate
        if (criticalCount >= criticalAlertThreshold) {
          this.escalate(message, notificationHistory.slice(-criticalAlertThreshold));
          criticalCount = 0; // Reset after escalation
        }
      }
      
      return notification;
    },
    
    /**
     * Convenience method for info notification
     * @param {string} message Notification message
     * @param {Object} data Additional data
     */
    info: function(message, data = {}) {
      return this.notify(LEVELS.INFO, message, data);
    },
    
    /**
     * Convenience method for warning notification
     * @param {string} message Notification message
     * @param {Object} data Additional data
     */
    warning: function(message, data = {}) {
      return this.notify(LEVELS.WARNING, message, data);
    },
    
    /**
     * Convenience method for alert notification
     * @param {string} message Notification message
     * @param {Object} data Additional data
     */
    alert: function(message, data = {}) {
      return this.notify(LEVELS.ALERT, message, data);
    },
    
    /**
     * Convenience method for critical notification
     * @param {string} message Notification message
     * @param {Object} data Additional data
     */
    critical: function(message, data = {}) {
      return this.notify(LEVELS.CRITICAL, message, data);
    },
    
    /**
     * Escalate critical notifications
     * @param {string} message Escalation message
     * @param {Array} recentNotifications Recent notifications
     */
    escalate: function(message, recentNotifications) {
      logger.error(`[ESCALATION] Bot ${botId}: ${message}`);
      
      // If email notification is enabled, simulate it
      if (notifyEmail && emailAddress) {
        logger.info(`[EMAIL NOTIFICATION] Would send email to ${emailAddress} about critical alerts`);
        
        // In a real implementation, you would send an actual email here
        // This is just a simulation for the example
        const emailContent = `
          Critical Alert: Bot ${botId}
          
          Message: ${message}
          
          Recent critical notifications:
          ${recentNotifications.map(n => `- ${new Date(n.timestamp).toISOString()}: ${n.message}`).join('\n')}
          
          Please check your trading bot immediately.
        `;
        
        // Write email content to a file for demonstration
        const emailFile = path.join(NOTIFICATION_DIR, `bot${botId}_email_${Date.now()}.txt`);
        try {
          fs.writeFileSync(emailFile, emailContent);
          logger.info(`Saved simulated email content to ${emailFile}`);
        } catch (error) {
          logger.warn(`Failed to save email content: ${error.message}`);
        }
      }
    },
    
    /**
     * Get notification history
     * @param {string} level Optional level filter
     * @param {number} limit Maximum number of notifications to return
     * @returns {Array} Notification history
     */
    getHistory: function(level = null, limit = 20) {
      let filtered = notificationHistory;
      
      if (level && Object.values(LEVELS).includes(level)) {
        filtered = filtered.filter(n => n.level === level);
      }
      
      return filtered.slice(-limit);
    }
  };
}

module.exports = {
  createNotificationManager,
  LEVELS
};
