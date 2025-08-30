const axios = require('axios');

class ShopifyAPI {
    constructor() {
        this.shopUrl = null;
        this.accessToken = null;
        this.rateLimitDelay = 500; // 500ms delay between requests (2 req/sec)
        this.lastRequestTime = 0;
    }

    async updateConfig(config) {
        this.shopUrl = config.shopUrl;
        this.accessToken = config.accessToken;
    }

    async rateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;

        if (timeSinceLastRequest < this.rateLimitDelay) {
            const waitTime = this.rateLimitDelay - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        this.lastRequestTime = Date.now();
    }

    async makeRequest(endpoint, params = {}) {
        if (!this.shopUrl || !this.accessToken) {
            throw new Error('Shopify configuration not set');
        }

        await this.rateLimit();

        const url = `https://${this.shopUrl}/admin/api/2023-10/${endpoint}`;

        try {
            const response = await axios.get(url, {
                headers: {
                    'X-Shopify-Access-Token': this.accessToken,
                    'Content-Type': 'application/json'
                },
                params,
                timeout: 30000
            });

            // Handle rate limiting from Shopify
            const callLimit = response.headers['x-shopify-shop-api-call-limit'];
            if (callLimit) {
                const [used, limit] = callLimit.split('/').map(Number);
                if (used / limit > 0.8) {
                    // Slow down if approaching rate limit
                    this.rateLimitDelay = 1000;
                } else {
                    this.rateLimitDelay = 500;
                }
            }

            return response.data;
        } catch (error) {
            if (error.response?.status === 429) {
                // Rate limited, wait longer
                console.log('Rate limited, waiting 2 seconds...');
                await new Promise(resolve => setTimeout(resolve, 2000));
                return this.makeRequest(endpoint, params);
            }

            console.error('Shopify API error:', {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                endpoint,
                params
            });

            throw new Error(`Shopify API error: ${error.response?.data?.errors || error.message}`);
        }
    }

    async testConnection(shopUrl, accessToken) {
        try {
            const tempUrl = this.shopUrl;
            const tempToken = this.accessToken;

            this.shopUrl = shopUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
            this.accessToken = accessToken;

            const response = await this.makeRequest('shop.json');

            // Restore original values
            this.shopUrl = tempUrl;
            this.accessToken = tempToken;

            return {
                success: true,
                shop: response.shop,
                message: `Successfully connected to ${response.shop.name}`
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getProductsCount() {
        try {
            const response = await this.makeRequest('products/count.json');
            return response.count;
        } catch (error) {
            console.error('Error getting products count:', error);
            return 0;
        }
    }

    async getAllProducts(sinceId = null, limit = 250) {
        const allProducts = [];
        let hasMore = true;
        let currentSinceId = sinceId;

        while (hasMore) {
            try {
                const params = {
                    limit,
                    fields: 'id,title,handle,body_html,vendor,product_type,created_at,updated_at,published_at,status,tags,variants,images'
                };

                if (currentSinceId) {
                    params.since_id = currentSinceId;
                }

                console.log(`Fetching products... (since_id: ${currentSinceId || 'none'})`);
                const response = await this.makeRequest('products.json', params);

                if (response.products && response.products.length > 0) {
                    allProducts.push(...response.products);
                    currentSinceId = response.products[response.products.length - 1].id;

                    console.log(`Fetched ${response.products.length} products (total: ${allProducts.length})`);

                    // If we got less than the limit, we've reached the end
                    if (response.products.length < limit) {
                        hasMore = false;
                    }
                } else {
                    hasMore = false;
                }
            } catch (error) {
                console.error('Error fetching products:', error);
                throw error;
            }
        }

        return allProducts;
    }

    async getProductsUpdatedSince(sinceDate, limit = 250) {
        const allProducts = [];
        let hasMore = true;
        let page = 1;

        while (hasMore) {
            try {
                const params = {
                    limit,
                    updated_at_min: sinceDate,
                    fields: 'id,title,handle,body_html,vendor,product_type,created_at,updated_at,published_at,status,tags,variants,images',
                    page
                };

                console.log(`Fetching updated products... (page: ${page}, since: ${sinceDate})`);
                const response = await this.makeRequest('products.json', params);

                if (response.products && response.products.length > 0) {
                    allProducts.push(...response.products);
                    page++;

                    console.log(`Fetched ${response.products.length} updated products (total: ${allProducts.length})`);

                    // If we got less than the limit, we've reached the end
                    if (response.products.length < limit) {
                        hasMore = false;
                    }
                } else {
                    hasMore = false;
                }
            } catch (error) {
                console.error('Error fetching updated products:', error);
                throw error;
            }
        }

        return allProducts;
    }

    async getProduct(productId) {
        try {
            const response = await this.makeRequest(`products/${productId}.json`);
            return response.product;
        } catch (error) {
            console.error(`Error fetching product ${productId}:`, error);
            return null;
        }
    }

    async getVariants(productId) {
        try {
            const response = await this.makeRequest(`products/${productId}/variants.json`);
            return response.variants;
        } catch (error) {
            console.error(`Error fetching variants for product ${productId}:`, error);
            return [];
        }
    }

    async getInventoryLevels(inventoryItemIds) {
        try {
            const response = await this.makeRequest('inventory_levels.json', {
                inventory_item_ids: inventoryItemIds.join(',')
            });
            return response.inventory_levels;
        } catch (error) {
            console.error('Error fetching inventory levels:', error);
            return [];
        }
    }

    async getShopInfo() {
        try {
            const response = await this.makeRequest('shop.json');
            return response.shop;
        } catch (error) {
            console.error('Error fetching shop info:', error);
            return null;
        }
    }

    // Webhook methods for real-time updates
    async createWebhook(topic, address) {
        try {
            const webhookData = {
                webhook: {
                    topic,
                    address,
                    format: 'json'
                }
            };

            const response = await axios.post(
                `https://${this.shopUrl}/admin/api/2023-10/webhooks.json`,
                webhookData,
                {
                    headers: {
                        'X-Shopify-Access-Token': this.accessToken,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return response.data.webhook;
        } catch (error) {
            console.error('Error creating webhook:', error);
            throw error;
        }
    }

    async getWebhooks() {
        try {
            const response = await this.makeRequest('webhooks.json');
            return response.webhooks;
        } catch (error) {
            console.error('Error fetching webhooks:', error);
            return [];
        }
    }

    async deleteWebhook(webhookId) {
        try {
            await axios.delete(
                `https://${this.shopUrl}/admin/api/2023-10/webhooks/${webhookId}.json`,
                {
                    headers: {
                        'X-Shopify-Access-Token': this.accessToken
                    }
                }
            );
            return true;
        } catch (error) {
            console.error('Error deleting webhook:', error);
            return false;
        }
    }

    // Utility methods
    formatProductUrl(handle) {
        return `https://${this.shopUrl.replace('.myshopify.com', '')}.myshopify.com/products/${handle}`;
    }

    getImageUrl(src, size = 'master') {
        if (!src) return '';

        // Remove existing size parameter if present
        let cleanSrc = src.replace(/_\d+x\d*\.(jpg|jpeg|png|gif|webp)$/i, '.$1');

        // Add size parameter
        if (size !== 'master') {
            cleanSrc = cleanSrc.replace(/\.(jpg|jpeg|png|gif|webp)$/i, `_${size}.$1`);
        }

        return cleanSrc;
    }

    // Batch processing helper
    async processInBatches(items, batchSize, processingFunction) {
        const results = [];

        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)}`);

            try {
                const batchResults = await Promise.all(
                    batch.map(item => processingFunction(item))
                );
                results.push(...batchResults);
            } catch (error) {
                console.error(`Error processing batch starting at index ${i}:`, error);
                // Continue with next batch
            }

            // Small delay between batches
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        return results;
    }

    // Error recovery helper
    async retryRequest(requestFunction, maxRetries = 3, delay = 1000) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await requestFunction();
            } catch (error) {
                if (attempt === maxRetries) {
                    throw error;
                }

                console.log(`Request failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay * attempt));
            }
        }
    }
}

module.exports = ShopifyAPI;