/**
 * Cache Manager Module
 * Provides local caching functionality to reduce API calls and improve performance
 */
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

// Cache directory
const CACHE_DIR = path.resolve(__dirname, '../../cache');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  logger.debug(`Created cache directory at ${CACHE_DIR}`);
}

/**
 * Store data in cache
 * @param {string} key Cache key
 * @param {any} data Data to cache
 * @param {number} ttlMinutes Time to live in minutes
 */
function storeCache(key, data, ttlMinutes = 15) {
  try {
    const cacheObject = {
      data,
      expires: Date.now() + (ttlMinutes * 60 * 1000),
      createdAt: Date.now()
    };

    const cacheFile = path.join(CACHE_DIR, `${sanitizeKey(key)}.json`);
    fs.writeFileSync(cacheFile, JSON.stringify(cacheObject, null, 2));
    logger.debug(`Cached data for key: ${key}, expires in ${ttlMinutes} minutes`);
  } catch (error) {
    logger.warn(`Failed to cache data for key ${key}: ${error.message}`);
  }
}

/**
 * Retrieve data from cache
 * @param {string} key Cache key
 * @param {boolean} allowExpired Whether to return expired data
 * @returns {any|null} Cached data or null if not found/expired
 */
function retrieveCache(key, allowExpired = false) {
  try {
    const cacheFile = path.join(CACHE_DIR, `${sanitizeKey(key)}.json`);

    if (!fs.existsSync(cacheFile)) {
      return null;
    }

    const cacheObject = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));

    // Check if cache is expired
    if (!allowExpired && cacheObject.expires < Date.now()) {
      logger.debug(`Cache expired for key: ${key}`);
      return null;
    }

    logger.debug(`Retrieved cached data for key: ${key}`);
    return cacheObject.data;
  } catch (error) {
    logger.warn(`Failed to retrieve cache for key ${key}: ${error.message}`);
    return null;
  }
}

/**
 * Delete cache for a specific key
 * @param {string} key Cache key
 */
function deleteCache(key) {
  try {
    const cacheFile = path.join(CACHE_DIR, `${sanitizeKey(key)}.json`);

    if (fs.existsSync(cacheFile)) {
      fs.unlinkSync(cacheFile);
      logger.debug(`Deleted cache for key: ${key}`);
    }
  } catch (error) {
    logger.warn(`Failed to delete cache for key ${key}: ${error.message}`);
  }
}

/**
 * Clear all cache or cache older than specified age
 * @param {number} maxAgeMinutes If provided, only clear cache older than this many minutes
 */
function clearCache(maxAgeMinutes = null) {
  try {
    const files = fs.readdirSync(CACHE_DIR);

    let deletedCount = 0;
    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      if (maxAgeMinutes) {
        // Only delete files older than specified age
        const cacheFile = path.join(CACHE_DIR, file);
        const cacheObject = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));

        const ageMs = Date.now() - cacheObject.createdAt;
        const ageMinutes = ageMs / (60 * 1000);

        if (ageMinutes > maxAgeMinutes) {
          fs.unlinkSync(cacheFile);
          deletedCount++;
        }
      } else {
        // Delete all cache files
        fs.unlinkSync(path.join(CACHE_DIR, file));
        deletedCount++;
      }
    }

    logger.info(`Cleared ${deletedCount} cache files`);
  } catch (error) {
    logger.warn(`Failed to clear cache: ${error.message}`);
  }
}

/**
 * Sanitize cache key to be usable as filename
 * @param {string} key Cache key
 * @returns {string} Sanitized key
 */
function sanitizeKey(key) {
  return key.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 100);
}

module.exports = {
  storeCache,
  retrieveCache,
  deleteCache,
  clearCache
};