const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
require('dotenv').config();

const Database = require('./src/database');
const ShopifyAPI = require('./src/shopifyAPI');
const ExcelGenerator = require('./src/excelGenerator');
const ConfigManager = require('./src/configManager');
const SyncManager = require('./src/syncManager');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000 // limit each IP to 1000 requests per windowMs
});
app.use('/api/', limiter);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize components
const database = new Database();
const configManager = new ConfigManager();
const shopifyAPI = new ShopifyAPI();
const excelGenerator = new ExcelGenerator();
const syncManager = new SyncManager(database, shopifyAPI, excelGenerator);

// API Routes
app.get('/api/status', (req, res) => {
    res.json({
        status: 'running',
        timestamp: new Date().toISOString(),
        database: database.isConnected(),
        version: '1.0.0'
    });
});

// Configuration endpoints
app.get('/api/config', async (req, res) => {
    try {
        const config = await configManager.getConfig();
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/config', async (req, res) => {
    try {
        const config = await configManager.saveConfig(req.body);
        await shopifyAPI.updateConfig(config);
        res.json({ success: true, config });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/test-connection', async (req, res) => {
    try {
        const { shopUrl, accessToken } = req.body;
        const result = await shopifyAPI.testConnection(shopUrl, accessToken);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Sync endpoints
app.post('/api/sync/full', async (req, res) => {
    try {
        const result = await syncManager.performFullSync();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/sync/incremental', async (req, res) => {
    try {
        const result = await syncManager.performIncrementalSync();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/sync/status', async (req, res) => {
    try {
        const status = await syncManager.getSyncStatus();
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Product endpoints
app.get('/api/products', async (req, res) => {
    try {
        const { page = 1, limit = 50, search = '' } = req.query;
        const products = await database.getProducts(
            parseInt(page),
            parseInt(limit),
            search
        );
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/products/stats', async (req, res) => {
    try {
        const stats = await database.getProductStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Excel generation endpoints
app.post('/api/generate-excel', async (req, res) => {
    try {
        const { filters = {} } = req.body;
        const result = await excelGenerator.generateFeed(filters, database);
        res.json(result);
    } catch (error) {
        console.error('Error generating Excel feed:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/download/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(__dirname, 'exports', filename);
        res.download(filePath);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Logs endpoint
app.get('/api/logs', async (req, res) => {
    try {
        const { page = 1, limit = 100 } = req.query;
        const logs = await database.getLogs(parseInt(page), parseInt(limit));
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Serve React app in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'client/build')));

    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
    });
}

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// Initialize database and start server
async function startServer() {
    try {
        await database.initialize();
        console.log('Database initialized successfully');

        // Load configuration
        const config = await configManager.getConfig();
        if (config.shopUrl && config.accessToken) {
            await shopifyAPI.updateConfig(config);
            console.log('Shopify API configured');
        }

        // Schedule daily sync at 2 AM
        cron.schedule('0 2 * * *', async () => {
            console.log('Running scheduled incremental sync...');
            try {
                await syncManager.performIncrementalSync();
                console.log('Scheduled sync completed');
            } catch (error) {
                console.error('Scheduled sync failed:', error);
            }
        });

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();