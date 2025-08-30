class SyncManager {
    constructor(database, shopifyAPI, excelGenerator) {
        this.database = database;
        this.shopifyAPI = shopifyAPI;
        this.excelGenerator = excelGenerator;
        this.currentSync = null;
    }

    async performFullSync() {
        if (this.currentSync) {
            throw new Error('Sync already in progress');
        }

        const startTime = new Date().toISOString();
        const syncLog = {
            sync_type: 'full',
            status: 'running',
            products_processed: 0,
            products_added: 0,
            products_updated: 0,
            products_skipped: 0,
            errors_count: 0,
            start_time: startTime,
            end_time: null,
            duration_seconds: 0,
            error_message: null
        };

        try {
            this.currentSync = syncLog;
            console.log('Starting full sync...');

            // Get total product count first
            const totalProducts = await this.shopifyAPI.getProductsCount();
            console.log(`Total products in Shopify: ${totalProducts}`);

            // Fetch all products from Shopify
            const products = await this.shopifyAPI.getAllProducts();
            console.log(`Fetched ${products.length} products from Shopify`);

            syncLog.products_processed = products.length;

            // Process each product
            for (const product of products) {
                try {
                    await this.processProduct(product, syncLog);
                } catch (error) {
                    console.error(`Error processing product ${product.id}:`, error);
                    syncLog.errors_count++;
                }
            }

            // Mark sync as completed
            const endTime = new Date().toISOString();
            syncLog.end_time = endTime;
            syncLog.status = 'completed';
            syncLog.duration_seconds = Math.round(
                (new Date(endTime) - new Date(startTime)) / 1000
            );

            console.log('Full sync completed:', {
                processed: syncLog.products_processed,
                added: syncLog.products_added,
                updated: syncLog.products_updated,
                errors: syncLog.errors_count,
                duration: syncLog.duration_seconds + 's'
            });

            // Log the sync
            await this.database.logSync(syncLog);

            this.currentSync = null;
            return syncLog;

        } catch (error) {
            console.error('Full sync failed:', error);

            syncLog.status = 'failed';
            syncLog.error_message = error.message;
            syncLog.end_time = new Date().toISOString();
            syncLog.duration_seconds = Math.round(
                (new Date(syncLog.end_time) - new Date(startTime)) / 1000
            );

            await this.database.logSync(syncLog);
            this.currentSync = null;

            throw error;
        }
    }

    async performIncrementalSync() {
        if (this.currentSync) {
            throw new Error('Sync already in progress');
        }

        const startTime = new Date().toISOString();
        const syncLog = {
            sync_type: 'incremental',
            status: 'running',
            products_processed: 0,
            products_added: 0,
            products_updated: 0,
            products_skipped: 0,
            errors_count: 0,
            start_time: startTime,
            end_time: null,
            duration_seconds: 0,
            error_message: null
        };

        try {
            this.currentSync = syncLog;
            console.log('Starting incremental sync...');

            // Get last sync time
            const lastSyncTime = await this.database.getLastSyncTime();

            if (!lastSyncTime) {
                console.log('No previous sync found, performing full sync instead');
                return await this.performFullSync();
            }

            console.log(`Fetching products updated since: ${lastSyncTime}`);

            // Fetch only updated products from Shopify
            const products = await this.shopifyAPI.getProductsUpdatedSince(lastSyncTime);
            console.log(`Found ${products.length} updated products`);

            syncLog.products_processed = products.length;

            if (products.length === 0) {
                console.log('No products to update');
                syncLog.status = 'completed';
                syncLog.end_time = new Date().toISOString();
                syncLog.duration_seconds = 1;

                await this.database.logSync(syncLog);
                this.currentSync = null;
                return syncLog;
            }

            // Process each updated product
            for (const product of products) {
                try {
                    await this.processProduct(product, syncLog);
                } catch (error) {
                    console.error(`Error processing product ${product.id}:`, error);
                    syncLog.errors_count++;
                }
            }

            // Mark sync as completed
            const endTime = new Date().toISOString();
            syncLog.end_time = endTime;
            syncLog.status = 'completed';
            syncLog.duration_seconds = Math.round(
                (new Date(endTime) - new Date(startTime)) / 1000
            );

            console.log('Incremental sync completed:', {
                processed: syncLog.products_processed,
                added: syncLog.products_added,
                updated: syncLog.products_updated,
                errors: syncLog.errors_count,
                duration: syncLog.duration_seconds + 's'
            });

            // Log the sync
            await this.database.logSync(syncLog);

            this.currentSync = null;
            return syncLog;

        } catch (error) {
            console.error('Incremental sync failed:', error);

            syncLog.status = 'failed';
            syncLog.error_message = error.message;
            syncLog.end_time = new Date().toISOString();
            syncLog.duration_seconds = Math.round(
                (new Date(syncLog.end_time) - new Date(startTime)) / 1000
            );

            await this.database.logSync(syncLog);
            this.currentSync = null;

            throw error;
        }
    }

    async processProduct(product, syncLog) {
        try {
            // Check if product exists in database
            const existingProduct = await this.database.getQuery(
                'SELECT shopify_id FROM products WHERE shopify_id = ?',
                [product.id.toString()]
            );

            const isUpdate = !!existingProduct;

            // Save product
            await this.database.saveProduct(product);

            // Save variants - keep only the lowest priced variant per product
            if (product.variants && product.variants.length > 0) {
                // Find the variant with the lowest price
                const lowestPriceVariant = product.variants.reduce((lowest, current) => {
                    const currentPrice = parseFloat(current.price) || 0;
                    const lowestPrice = parseFloat(lowest.price) || 0;

                    if (currentPrice > 0 && (lowestPrice === 0 || currentPrice < lowestPrice)) {
                        return current;
                    }
                    return lowest;
                }, product.variants[0]);

                if (lowestPriceVariant) {
                    await this.database.saveVariant(lowestPriceVariant, product.id);
                }
            }

            // Save images (first image only for performance)
            if (product.images && product.images.length > 0) {
                await this.database.saveImage(product.images[0], product.id);
            }

            // Update sync counters
            if (isUpdate) {
                syncLog.products_updated++;
            } else {
                syncLog.products_added++;
            }

        } catch (error) {
            console.error(`Error processing product ${product.id}:`, error);
            syncLog.products_skipped++;
            throw error;
        }
    }

    async getSyncStatus() {
        try {
            const status = {
                isRunning: !!this.currentSync,
                currentSync: this.currentSync,
                lastSync: null,
                productStats: await this.database.getProductStats(),
                recentLogs: []
            };

            // Get last sync information
            const lastSyncLog = await this.database.getQuery(
                'SELECT * FROM sync_logs ORDER BY created_at DESC LIMIT 1'
            );

            if (lastSyncLog) {
                status.lastSync = lastSyncLog;
            }

            // Get recent sync logs
            const recentLogs = await this.database.allQuery(
                'SELECT * FROM sync_logs ORDER BY created_at DESC LIMIT 5'
            );
            status.recentLogs = recentLogs;

            return status;

        } catch (error) {
            console.error('Error getting sync status:', error);
            return {
                isRunning: false,
                currentSync: null,
                lastSync: null,
                productStats: {},
                recentLogs: [],
                error: error.message
            };
        }
    }

    async cancelCurrentSync() {
        if (this.currentSync) {
            console.log('Canceling current sync...');

            // Mark current sync as canceled
            this.currentSync.status = 'canceled';
            this.currentSync.end_time = new Date().toISOString();
            this.currentSync.duration_seconds = Math.round(
                (new Date(this.currentSync.end_time) - new Date(this.currentSync.start_time)) / 1000
            );
            this.currentSync.error_message = 'Sync canceled by user';

            // Log the canceled sync
            await this.database.logSync(this.currentSync);

            this.currentSync = null;
            return true;
        }
        return false;
    }

    async cleanupOldProducts(daysOld = 30) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);
            const cutoffISO = cutoffDate.toISOString();

            console.log(`Cleaning up products older than ${daysOld} days (${cutoffISO})`);

            // Delete old products that haven't been updated
            const deleteQuery = `
        DELETE FROM products
        WHERE updated_locally < ?
        AND sync_status != 'synced'
      `;

            const result = await this.database.runQuery(deleteQuery, [cutoffISO]);
            console.log(`Cleaned up ${result.changes} old products`);

            // Also cleanup orphaned variants and images
            await this.database.runQuery(`
        DELETE FROM variants
        WHERE product_id NOT IN (SELECT shopify_id FROM products)
      `);

            await this.database.runQuery(`
        DELETE FROM images
        WHERE product_id NOT IN (SELECT shopify_id FROM products)
      `);

            return result.changes;
        } catch (error) {
            console.error('Error cleaning up old products:', error);
            throw error;
        }
    }

    async validateProductData() {
        try {
            console.log('Validating product data...');

            const issues = [];

            // Check for products without variants
            const productsWithoutVariants = await this.database.allQuery(`
        SELECT p.shopify_id, p.title
        FROM products p
        LEFT JOIN variants v ON p.shopify_id = v.product_id
        WHERE v.id IS NULL
      `);

            if (productsWithoutVariants.length > 0) {
                issues.push({
                    type: 'missing_variants',
                    count: productsWithoutVariants.length,
                    description: 'Products without variants',
                    items: productsWithoutVariants.slice(0, 10) // Show first 10
                });
            }

            // Check for variants without prices
            const variantsWithoutPrices = await this.database.allQuery(`
        SELECT v.shopify_id, p.title
        FROM variants v
        JOIN products p ON v.product_id = p.shopify_id
        WHERE v.price IS NULL OR v.price <= 0
      `);

            if (variantsWithoutPrices.length > 0) {
                issues.push({
                    type: 'invalid_prices',
                    count: variantsWithoutPrices.length,
                    description: 'Variants with missing or invalid prices',
                    items: variantsWithoutPrices.slice(0, 10)
                });
            }

            // Check for products without images
            const productsWithoutImages = await this.database.allQuery(`
        SELECT p.shopify_id, p.title
        FROM products p
        LEFT JOIN images i ON p.shopify_id = i.product_id
        WHERE i.id IS NULL
      `);

            if (productsWithoutImages.length > 0) {
                issues.push({
                    type: 'missing_images',
                    count: productsWithoutImages.length,
                    description: 'Products without images',
                    items: productsWithoutImages.slice(0, 10)
                });
            }

            // Check for duplicate SKUs
            const duplicateSkus = await this.database.allQuery(`
        SELECT sku, COUNT(*) as count
        FROM variants
        WHERE sku IS NOT NULL AND sku != ''
        GROUP BY sku
        HAVING COUNT(*) > 1
      `);

            if (duplicateSkus.length > 0) {
                issues.push({
                    type: 'duplicate_skus',
                    count: duplicateSkus.length,
                    description: 'Duplicate SKUs found',
                    items: duplicateSkus.slice(0, 10)
                });
            }

            console.log(`Data validation completed. Found ${issues.length} issue types.`);

            return {
                valid: issues.length === 0,
                issues: issues,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('Error validating product data:', error);
            throw error;
        }
    }

    async generateFeedWithValidation(filters = {}) {
        try {
            // First validate the data
            const validation = await this.validateProductData();

            if (!validation.valid) {
                console.warn('Data validation found issues, but proceeding with feed generation...');
                console.warn('Issues found:', validation.issues.map(i => i.description));
            }

            // Generate the feed
            const result = await this.excelGenerator.generateFeed(filters, this.database);

            return {
                ...result,
                validation: validation
            };

        } catch (error) {
            console.error('Error generating feed with validation:', error);
            throw error;
        }
    }

    async getProductSyncHistory(productId) {
        try {
            const history = await this.database.allQuery(`
        SELECT
          sync_type,
          status,
          start_time,
          end_time,
          duration_seconds,
          error_message
        FROM sync_logs
        WHERE products_processed > 0
        ORDER BY created_at DESC
        LIMIT 10
      `);

            return history;
        } catch (error) {
            console.error('Error getting product sync history:', error);
            return [];
        }
    }

    async exportSyncReport() {
        try {
            const stats = await this.database.getProductStats();
            const recentLogs = await this.database.allQuery(
                'SELECT * FROM sync_logs ORDER BY created_at DESC LIMIT 20'
            );

            const validation = await this.validateProductData();

            const report = {
                timestamp: new Date().toISOString(),
                statistics: stats,
                recentSyncs: recentLogs,
                dataValidation: validation,
                summary: {
                    totalProducts: stats.totalProducts,
                    totalVariants: stats.totalVariants,
                    avgPrice: stats.avgPrice ? parseFloat(stats.avgPrice).toFixed(2) : 0,
                    lastSync: stats.lastSyncTime,
                    dataQuality: validation.valid ? 'Good' : 'Issues Found'
                }
            };

            return report;
        } catch (error) {
            console.error('Error generating sync report:', error);
            throw error;
        }
    }
}

module.exports = SyncManager;