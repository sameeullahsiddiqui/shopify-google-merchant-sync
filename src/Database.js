const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;

class Database {
    constructor() {
        this.db = null;
        this.dbPath = path.join(__dirname, '..', 'data', 'shopify_sync.db');
    }

    async initialize() {
        try {
            // Ensure data directory exists
            await fs.mkdir(path.dirname(this.dbPath), { recursive: true });

            this.db = new sqlite3.Database(this.dbPath);
            await this.createTables();
            console.log('Database connection established');
            return true;
        } catch (error) {
            console.error('Database initialization failed:', error);
            throw error;
        }
    }

    isConnected() {
        return this.db !== null;
    }

    async createTables() {
        const queries = [
            // Products table
            `CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY,
        shopify_id TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        handle TEXT,
        body_html TEXT,
        vendor TEXT,
        product_type TEXT,
        created_at TEXT,
        updated_at TEXT,
        published_at TEXT,
        status TEXT,
        tags TEXT,
        seo_title TEXT,
        seo_description TEXT,
        google_product_category TEXT,
        condition_value TEXT DEFAULT 'new',
        brand TEXT,
        gtin TEXT,
        mpn TEXT,
        sync_status TEXT DEFAULT 'pending',
        last_synced TEXT,
        created_locally TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_locally TEXT DEFAULT CURRENT_TIMESTAMP
      )`,

            // Variants table
            `CREATE TABLE IF NOT EXISTS variants (
        id INTEGER PRIMARY KEY,
        shopify_id TEXT UNIQUE NOT NULL,
        product_id TEXT NOT NULL,
        title TEXT,
        price REAL,
        compare_at_price REAL,
        sku TEXT,
        position INTEGER,
        inventory_policy TEXT,
        fulfillment_service TEXT,
        inventory_management TEXT,
        option1 TEXT,
        option2 TEXT,
        option3 TEXT,
        created_at TEXT,
        updated_at TEXT,
        taxable BOOLEAN,
        barcode TEXT,
        grams INTEGER,
        image_id TEXT,
        weight REAL,
        weight_unit TEXT,
        inventory_item_id TEXT,
        inventory_quantity INTEGER,
        old_inventory_quantity INTEGER,
        requires_shipping BOOLEAN,
        admin_graphql_api_id TEXT,
        is_selected_for_feed BOOLEAN DEFAULT 0,
        created_locally TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_locally TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products (shopify_id)
      )`,

            // Images table
            `CREATE TABLE IF NOT EXISTS images (
        id INTEGER PRIMARY KEY,
        shopify_id TEXT UNIQUE NOT NULL,
        product_id TEXT NOT NULL,
        position INTEGER,
        src TEXT,
        width INTEGER,
        height INTEGER,
        alt TEXT,
        created_at TEXT,
        updated_at TEXT,
        created_locally TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products (shopify_id)
      )`,

            // Sync logs table
            `CREATE TABLE IF NOT EXISTS sync_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sync_type TEXT NOT NULL,
        status TEXT NOT NULL,
        products_processed INTEGER,
        products_added INTEGER,
        products_updated INTEGER,
        products_skipped INTEGER,
        errors_count INTEGER,
        start_time TEXT,
        end_time TEXT,
        duration_seconds INTEGER,
        error_message TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,

            // Configuration table
            `CREATE TABLE IF NOT EXISTS configuration (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,

            // Export history table
            `CREATE TABLE IF NOT EXISTS export_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        products_count INTEGER,
        file_size INTEGER,
        filters TEXT,
        status TEXT DEFAULT 'completed',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`
        ];

        for (const query of queries) {
            await this.runQuery(query);
        }

        // Create indexes for better performance
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_products_shopify_id ON products(shopify_id)',
            'CREATE INDEX IF NOT EXISTS idx_products_updated_at ON products(updated_at)',
            'CREATE INDEX IF NOT EXISTS idx_variants_product_id ON variants(product_id)',
            'CREATE INDEX IF NOT EXISTS idx_variants_price ON variants(price)',
            'CREATE INDEX IF NOT EXISTS idx_images_product_id ON images(product_id)',
            'CREATE INDEX IF NOT EXISTS idx_sync_logs_created_at ON sync_logs(created_at)'
        ];

        for (const index of indexes) {
            await this.runQuery(index);
        }
    }

    runQuery(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(query, params, function (error) {
                if (error) {
                    reject(error);
                } else {
                    resolve({ lastID: this.lastID, changes: this.changes });
                }
            });
        });
    }

    getQuery(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(query, params, (error, row) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(row);
                }
            });
        });
    }

    allQuery(query, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(query, params, (error, rows) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async saveProduct(product) {
        const query = `
      INSERT OR REPLACE INTO products (
        shopify_id, title, handle, body_html, vendor, product_type,
        created_at, updated_at, published_at, status, tags,
        seo_title, seo_description, brand, sync_status, last_synced,
        updated_locally
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

        const params = [
            product.id.toString(),
            product.title,
            product.handle,
            product.body_html,
            product.vendor,
            product.product_type,
            product.created_at,
            product.updated_at,
            product.published_at,
            product.status,
            product.tags,
            product.seo_title || product.title,
            product.seo_description || product.body_html?.substring(0, 160),
            product.vendor,
            'synced',
            new Date().toISOString()
        ];

        return await this.runQuery(query, params);
    }

    async saveVariant(variant, productId) {
        const query = `
      INSERT OR REPLACE INTO variants (
        shopify_id, product_id, title, price, compare_at_price, sku,
        position, inventory_policy, fulfillment_service, inventory_management,
        option1, option2, option3, created_at, updated_at, taxable,
        barcode, grams, image_id, weight, weight_unit, inventory_item_id,
        inventory_quantity, requires_shipping, admin_graphql_api_id,
        updated_locally
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

        const params = [
            variant.id.toString(),
            productId.toString(),
            variant.title,
            parseFloat(variant.price) || 0,
            variant.compare_at_price ? parseFloat(variant.compare_at_price) : null,
            variant.sku,
            variant.position,
            variant.inventory_policy,
            variant.fulfillment_service,
            variant.inventory_management,
            variant.option1,
            variant.option2,
            variant.option3,
            variant.created_at,
            variant.updated_at,
            variant.taxable ? 1 : 0,
            variant.barcode,
            variant.grams,
            variant.image_id?.toString(),
            variant.weight,
            variant.weight_unit,
            variant.inventory_item_id?.toString(),
            variant.inventory_quantity || 0,
            variant.requires_shipping ? 1 : 0,
            variant.admin_graphql_api_id
        ];

        return await this.runQuery(query, params);
    }

    async saveImage(image, productId) {
        const query = `
      INSERT OR REPLACE INTO images (
        shopify_id, product_id, position, src, width, height,
        alt, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

        const params = [
            image.id.toString(),
            productId.toString(),
            image.position,
            image.src,
            image.width,
            image.height,
            image.alt,
            image.created_at,
            image.updated_at
        ];

        return await this.runQuery(query, params);
    }

    async getProducts(page = 1, limit = 50, search = '') {
        const offset = (page - 1) * limit;
        let whereClause = '';
        let params = [];

        if (search) {
            whereClause = 'WHERE p.title LIKE ? OR p.vendor LIKE ? OR p.tags LIKE ?';
            params = [`%${search}%`, `%${search}%`, `%${search}%`];
        }

        const query = `
      SELECT
        p.*,
        COUNT(v.id) as variant_count,
        MIN(v.price) as min_price,
        MAX(v.price) as max_price,
        SUM(v.inventory_quantity) as total_inventory
      FROM products p
      LEFT JOIN variants v ON p.shopify_id = v.product_id
      ${whereClause}
      GROUP BY p.id
      ORDER BY p.updated_locally DESC
      LIMIT ? OFFSET ?
    `;

        params.push(limit, offset);

        const products = await this.allQuery(query, params);

        // Get total count
        const countQuery = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM products p
      ${whereClause}
    `;

        const countParams = search ? [`%${search}%`, `%${search}%`, `%${search}%`] : [];
        const countResult = await this.getQuery(countQuery, countParams);

        return {
            products,
            pagination: {
                page,
                limit,
                total: countResult.total,
                pages: Math.ceil(countResult.total / limit)
            }
        };
    }

    async getProductStats() {
        const queries = {
            totalProducts: 'SELECT COUNT(*) as count FROM products',
            totalVariants: 'SELECT COUNT(*) as count FROM variants',
            publishedProducts: "SELECT COUNT(*) as count FROM products WHERE status = 'active'",
            lastSyncTime: 'SELECT MAX(last_synced) as last_sync FROM products WHERE last_synced IS NOT NULL',
            avgPrice: 'SELECT AVG(price) as avg_price FROM variants WHERE price > 0',
            totalInventory: 'SELECT SUM(inventory_quantity) as total FROM variants'
        };

        const stats = {};
        for (const [key, query] of Object.entries(queries)) {
            const result = await this.getQuery(query);
            stats[key] = result[Object.keys(result)[0]];
        }

        return stats;
    }

    async getProductsForFeed(filters = {}) {
        debugger;

        let whereConditions = ['p.status = ?'];
        let params = ['active'];

        if (filters.vendor) {
            whereConditions.push('p.vendor = ?');
            params.push(filters.vendor);
        }

        if (filters.productType) {
            whereConditions.push('p.product_type = ?');
            params.push(filters.productType);
        }

        if (filters.minPrice) {
            whereConditions.push('v.price >= ?');
            params.push(filters.minPrice);
        }

        if (filters.maxPrice) {
            whereConditions.push('v.price <= ?');
            params.push(filters.maxPrice);
        }

        const query = `
      SELECT
        p.*,
        v.*,
        i.src as image_src,
        i.alt as image_alt
      FROM products p
      INNER JOIN (
        SELECT
          product_id,
          MIN(price) as min_price,
          shopify_id,
          title,
          price,
          compare_at_price,
          sku,
          inventory_quantity,
          barcode,
          weight,
          weight_unit
        FROM variants
        WHERE price > 0
        GROUP BY product_id
        HAVING price = min_price
      ) v ON p.shopify_id = v.product_id
      LEFT JOIN images i ON p.shopify_id = i.product_id AND i.position = 1
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY p.title
    `;

        return await this.allQuery(query, params);
    }

    async logSync(syncData) {
        const query = `
      INSERT INTO sync_logs (
        sync_type, status, products_processed, products_added,
        products_updated, products_skipped, errors_count,
        start_time, end_time, duration_seconds, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

        return await this.runQuery(query, [
            syncData.sync_type,
            syncData.status,
            syncData.products_processed || 0,
            syncData.products_added || 0,
            syncData.products_updated || 0,
            syncData.products_skipped || 0,
            syncData.errors_count || 0,
            syncData.start_time,
            syncData.end_time,
            syncData.duration_seconds,
            syncData.error_message
        ]);
    }

    async getLogs(page = 1, limit = 100) {
        const offset = (page - 1) * limit;

        const query = `
      SELECT * FROM sync_logs
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

        const logs = await this.allQuery(query, [limit, offset]);

        const countResult = await this.getQuery('SELECT COUNT(*) as total FROM sync_logs');

        return {
            logs,
            pagination: {
                page,
                limit,
                total: countResult.total,
                pages: Math.ceil(countResult.total / limit)
            }
        };
    }

    async getLastSyncTime() {
        const result = await this.getQuery(
            'SELECT MAX(updated_at) as last_sync FROM products WHERE sync_status = "synced"'
        );
        return result?.last_sync;
    }

    async saveExportHistory(exportData) {
        const query = `
      INSERT INTO export_history (filename, products_count, file_size, filters)
      VALUES (?, ?, ?, ?)
    `;

        return await this.runQuery(query, [
            exportData.filename,
            exportData.products_count,
            exportData.file_size,
            JSON.stringify(exportData.filters)
        ]);
    }

    async close() {
        if (this.db) {
            return new Promise((resolve) => {
                this.db.close((err) => {
                    if (err) {
                        console.error('Error closing database:', err);
                    }
                    resolve();
                });
            });
        }
    }
}

module.exports = Database;