const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;

class ConfigManager {
    constructor() {
        this.configPath = path.join(__dirname, '..', 'data', 'config.json');
        this.encryptionKey = this.getOrCreateEncryptionKey();
    }

    getOrCreateEncryptionKey() {
        // In production, this should be stored as an environment variable
        return process.env.ENCRYPTION_KEY || 'your-32-char-secret-key-here-1234';
    }

    encrypt(text) {
        try {
            const algorithm = 'aes-256-cbc';
            const key = Buffer.from(this.encryptionKey.substring(0, 32));
            const iv = crypto.randomBytes(16);

            const cipher = crypto.createCipher(algorithm, key);
            let encrypted = cipher.update(text, 'utf8', 'hex');
            encrypted += cipher.final('hex');

            return iv.toString('hex') + ':' + encrypted;
        } catch (error) {
            console.error('Encryption error:', error);
            return text; // Fallback to plain text in case of error
        }
    }

    decrypt(encryptedText) {
        try {
            if (!encryptedText.includes(':')) {
                return encryptedText; // Not encrypted
            }

            const algorithm = 'aes-256-cbc';
            const key = Buffer.from(this.encryptionKey.substring(0, 32));
            const textParts = encryptedText.split(':');
            const iv = Buffer.from(textParts.shift(), 'hex');
            const encrypted = textParts.join(':');

            const decipher = crypto.createDecipher(algorithm, key);
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            return decrypted;
        } catch (error) {
            console.error('Decryption error:', error);
            return encryptedText; // Return as-is if decryption fails
        }
    }

    async ensureConfigDir() {
        try {
            await fs.mkdir(path.dirname(this.configPath), { recursive: true });
        } catch (error) {
            console.error('Error creating config directory:', error);
        }
    }

    async getConfig() {
        try {
            await this.ensureConfigDir();

            const configData = await fs.readFile(this.configPath, 'utf8');
            const config = JSON.parse(configData);

            // Decrypt sensitive fields
            if (config.accessToken) {
                config.accessToken = this.decrypt(config.accessToken);
            }

            return this.mergeWithDefaults(config);
        } catch (error) {
            if (error.code === 'ENOENT') {
                // Config file doesn't exist, return defaults
                return this.getDefaultConfig();
            }

            console.error('Error reading config:', error);
            return this.getDefaultConfig();
        }
    }

    async saveConfig(newConfig) {
        try {
            await this.ensureConfigDir();

            const currentConfig = await this.getConfig();
            const mergedConfig = { ...currentConfig, ...newConfig };

            // Encrypt sensitive fields before saving
            const configToSave = { ...mergedConfig };
            if (configToSave.accessToken) {
                configToSave.accessToken = this.encrypt(configToSave.accessToken);
            }

            await fs.writeFile(this.configPath, JSON.stringify(configToSave, null, 2));

            console.log('Configuration saved successfully');
            return mergedConfig; // Return unencrypted config
        } catch (error) {
            console.error('Error saving config:', error);
            throw error;
        }
    }

    getDefaultConfig() {
        return {
            // Shopify Configuration
            shopUrl: '',
            accessToken: '',

            // Sync Settings
            autoSync: true,
            syncInterval: 'daily', // daily, hourly, manual
            syncTime: '02:00', // Time for daily sync (24h format)

            // Export Settings
            exportFormat: 'xlsx',
            includeOutOfStock: false,
            includeUnpublished: false,

            // Feed Configuration
            feedSettings: {
                currency: 'USD',
                country: 'US',
                language: 'en',
                includeVariants: false, // Only lowest price variant
                maxProducts: 50000,
                imageSize: 'master'
            },

            // Filter Settings
            defaultFilters: {
                minPrice: null,
                maxPrice: null,
                vendor: null,
                productType: null,
                tags: null,
                status: 'active'
            },

            // Google Merchant Settings
            googleMerchant: {
                targetCountry: 'US',
                contentLanguage: 'en',
                channel: 'online',
                includeShipping: false,
                includeTax: false,
                adultContent: false
            },

            // Notification Settings
            notifications: {
                emailNotifications: false,
                email: '',
                notifyOnSuccess: false,
                notifyOnError: true,
                webhookUrl: ''
            },

            // Performance Settings
            performance: {
                batchSize: 250,
                rateLimitDelay: 500,
                maxRetries: 3,
                enableLogging: true,
                logLevel: 'info' // error, warn, info, debug
            },

            // Database Settings
            database: {
                autoCleanup: true,
                cleanupIntervalDays: 30,
                backupEnabled: false,
                backupInterval: 'weekly'
            },

            // UI Settings
            ui: {
                theme: 'light',
                itemsPerPage: 50,
                showAdvancedOptions: false,
                autoRefresh: true,
                refreshInterval: 30000 // 30 seconds
            },

            // Timestamps
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    }

    mergeWithDefaults(config) {
        const defaults = this.getDefaultConfig();

        // Deep merge configuration
        const merged = this.deepMerge(defaults, config);
        merged.updatedAt = new Date().toISOString();

        return merged;
    }

    deepMerge(target, source) {
        const result = { ...target };

        for (const key in source) {
            if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(target[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }

        return result;
    }

    async validateConfig(config) {
        const errors = [];
        const warnings = [];

        // Required fields validation
        if (!config.shopUrl) {
            errors.push('Shop URL is required');
        } else if (!config.shopUrl.includes('myshopify.com')) {
            warnings.push('Shop URL should be in format: yourstore.myshopify.com');
        }

        if (!config.accessToken) {
            errors.push('Access Token is required');
        } else if (config.accessToken.length < 20) {
            warnings.push('Access Token seems too short, please verify');
        }

        // Sync settings validation
        if (config.syncInterval && !['daily', 'hourly', 'manual'].includes(config.syncInterval)) {
            warnings.push('Invalid sync interval, defaulting to daily');
        }

        if (config.syncTime && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(config.syncTime)) {
            warnings.push('Invalid sync time format, use HH:MM (24-hour format)');
        }

        // Feed settings validation
        if (config.feedSettings?.maxProducts && config.feedSettings.maxProducts > 100000) {
            warnings.push('Maximum products limit is very high, this may affect performance');
        }

        // Email validation
        if (config.notifications?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.notifications.email)) {
            warnings.push('Invalid email format for notifications');
        }

        // Performance settings validation
        if (config.performance?.batchSize && config.performance.batchSize > 500) {
            warnings.push('Large batch size may cause rate limiting issues');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    async resetToDefaults() {
        try {
            const defaults = this.getDefaultConfig();
            await this.saveConfig(defaults);
            console.log('Configuration reset to defaults');
            return defaults;
        } catch (error) {
            console.error('Error resetting configuration:', error);
            throw error;
        }
    }

    async backupConfig() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = path.join(
                path.dirname(this.configPath),
                `config_backup_${timestamp}.json`
            );

            const currentConfig = await fs.readFile(this.configPath, 'utf8');
            await fs.writeFile(backupPath, currentConfig);

            console.log(`Configuration backed up to: ${backupPath}`);
            return backupPath;
        } catch (error) {
            console.error('Error backing up configuration:', error);
            throw error;
        }
    }

    async getConfigHistory() {
        try {
            const configDir = path.dirname(this.configPath);
            const files = await fs.readdir(configDir);

            const backupFiles = files
                .filter(file => file.startsWith('config_backup_') && file.endsWith('.json'))
                .map(file => {
                    const filePath = path.join(configDir, file);
                    const timestamp = file.replace('config_backup_', '').replace('.json', '');
                    return {
                        filename: file,
                        path: filePath,
                        timestamp: timestamp.replace(/-/g, ':'),
                        created: timestamp
                    };
                })
                .sort((a, b) => b.created.localeCompare(a.created));

            return backupFiles;
        } catch (error) {
            console.error('Error getting config history:', error);
            return [];
        }
    }

    async exportConfig() {
        try {
            const config = await this.getConfig();

            // Remove sensitive information for export
            const exportConfig = { ...config };
            delete exportConfig.accessToken;

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const exportPath = path.join(
                path.dirname(this.configPath),
                `config_export_${timestamp}.json`
            );

            await fs.writeFile(exportPath, JSON.stringify(exportConfig, null, 2));

            return {
                success: true,
                path: exportPath,
                filename: path.basename(exportPath)
            };
        } catch (error) {
            console.error('Error exporting configuration:', error);
            throw error;
        }
    }

    async importConfig(configData) {
        try {
            // Validate imported configuration
            const validation = await this.validateConfig(configData);

            if (!validation.valid) {
                throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
            }

            // Backup current config before importing
            await this.backupConfig();

            // Merge with current config to avoid losing sensitive data
            const currentConfig = await this.getConfig();
            const mergedConfig = {
                ...configData,
                // Keep current access token if not provided in import
                accessToken: configData.accessToken || currentConfig.accessToken
            };

            await this.saveConfig(mergedConfig);

            return {
                success: true,
                warnings: validation.warnings
            };
        } catch (error) {
            console.error('Error importing configuration:', error);
            throw error;
        }
    }
}

module.exports = ConfigManager;