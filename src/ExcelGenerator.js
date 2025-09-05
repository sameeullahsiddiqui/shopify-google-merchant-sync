const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs').promises;
const ConfigManager = require('./ConfigManager');

class ExcelGenerator {
    constructor() {
        this.configManager = new ConfigManager(); // Add this
        this.exportsDir = path.join(__dirname, '..', 'exports');
        this.ensureExportsDir();
    }

    async ensureExportsDir() {
        try {
            await fs.mkdir(this.exportsDir, { recursive: true });
        } catch (error) {
            console.error('Error creating exports directory:', error);
        }
    }

    async generateFeed(filters = {}, database) {
        try {
            console.log('Starting Google Merchant feed generation...');
            const startTime = Date.now();

            // Get configuration including shop URL
            const config = await this.configManager.getConfig();
            const shopUrl = config.shopUrl;

            if (!shopUrl) {
                throw new Error('Shop URL not configured. Please configure your shop URL in settings.');
            }

            console.log(`Using shop URL: ${shopUrl}`);

            // Get products from database with variant analysis
            const products = await database.getProductsForFeed(filters);
            console.log(`Found ${products.length} products for feed`);

            if (products.length === 0) {
                throw new Error('No products found matching the specified filters');
            }
            console.log('Analyzing products...');
            const analysisStart = Date.now();

            const productGroups = this.groupProductsByBaseProduct(products);
            const lowestVariantAnalysis = this.identifyLowestPricedVariants(productGroups);
            const productAnalysis = this.analyzeProductsForLabels(products);
            console.log(`Analysis completed in ${Date.now() - analysisStart}ms`);

            // Create Excel workbook
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Google Merchant Feed');

            // Define Google Merchant Center columns
            const columns = this.getGoogleMerchantColumns();
            worksheet.columns = columns;

            // Style the header row
            this.styleHeaderRow(worksheet);

            const batchSize = 500; // Process 500 products at a time
            const batches = Math.ceil(products.length / batchSize);

            console.log(`Processing ${products.length} products in ${batches} batches...`);

            for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
                const batchStart = batchIndex * batchSize;
                const batchEnd = Math.min(batchStart + batchSize, products.length);
                const batch = products.slice(batchStart, batchEnd);

                const formattedRows = batch.map(product =>
                    this.formatProductForGoogleMerchant(
                        product,
                        productAnalysis,
                        lowestVariantAnalysis,
                        shopUrl
                    )
                );

                // Add all rows at once for this batch
                worksheet.addRows(formattedRows);

                // Apply styling to this batch
                this.applyBatchStyling(worksheet, batchStart + 2, batchEnd + 1); // +2 for header row
            }

            // Auto-fit columns (optimized)
            this.optimizeColumnWidths(worksheet);

            // Generate filename and save
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
            const filename = `google_merchant_feed_${timestamp}_${products.length}_products.xlsx`;
            const filepath = path.join(this.exportsDir, filename);

            console.log('Saving Excel file...');
            await workbook.xlsx.writeFile(filepath);

            // Get file stats
            const stats = await fs.stat(filepath);
            const fileSizeKB = Math.round(stats.size / 1024);

            const totalTime = Date.now() - startTime;
            console.log(`Feed generated successfully in ${totalTime}ms: ${filename} (${fileSizeKB}KB)`);

            // Save export history
            try {
                await database.saveExportHistory({
                    filename,
                    products_count: products.length,
                    file_size: stats.size,
                    filters
                });
            } catch (error) {
                console.error('Error saving export history:', error);
            }

            return {
                success: true,
                filename,
                filepath,
                productsCount: products.length,
                fileSizeKB,
                downloadUrl: `/api/download/${filename}`,
                processingTimeMs: totalTime,
                customLabelsApplied: this.getCustomLabelsStats(products, productAnalysis, lowestVariantAnalysis)
            };

        } catch (error) {
            console.error('Error generating Excel feed:', error);
            throw error;
        }
    }

    styleHeaderRow(worksheet) {
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };
    }

    applyBatchStyling(worksheet, startRow, endRow) {
        for (let rowIndex = startRow; rowIndex <= endRow; rowIndex++) {
            if (rowIndex % 2 === 0) {
                worksheet.getRow(rowIndex).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF8F8F8' }
                };
            }
        }
    }

    optimizeColumnWidths(worksheet) {
        // Cache max lengths to avoid recalculating
        const maxLengths = {};

        worksheet.columns.forEach((column, index) => {
            maxLengths[index] = 10; // minimum width
        });

        // Sample rows for width calculation instead of all rows
        const sampleRows = Math.min(100, worksheet.rowCount);
        for (let rowIndex = 1; rowIndex <= sampleRows; rowIndex++) {
            const row = worksheet.getRow(rowIndex);
            row.eachCell((cell, colNumber) => {
                const columnLength = cell.value ? cell.value.toString().length : 0;
                if (columnLength > maxLengths[colNumber - 1]) {
                    maxLengths[colNumber - 1] = columnLength;
                }
            });
        }

        // Apply calculated widths
        worksheet.columns.forEach((column, index) => {
            column.width = Math.min(maxLengths[index] + 2, 50);
        });
    }

    groupProductsByBaseProduct(products) {
        const groups = {};

        products.forEach(product => {
            // Group by product title and vendor to identify variants of the same product
            const baseKey = `${product.title?.toLowerCase().trim()}_${product.vendor?.toLowerCase().trim()}`;

            if (!groups[baseKey]) {
                groups[baseKey] = {
                    baseTitle: product.title,
                    vendor: product.vendor,
                    variants: []
                };
            }

            groups[baseKey].variants.push({
                ...product,
                price: parseFloat(product.price) || 0
            });
        });

        // Filter out groups with only one variant (no comparison needed)
        const multiVariantGroups = {};
        Object.entries(groups).forEach(([key, group]) => {
            if (group.variants.length > 1) {
                multiVariantGroups[key] = group;
            }
        });

        console.log(`Found ${Object.keys(groups).length} total product groups, ${Object.keys(multiVariantGroups).length} with multiple variants`);

        return groups; // Return all groups, we'll handle single variants too
    }

    identifyLowestPricedVariants(productGroups) {
        const lowestVariantMap = {};

        Object.entries(productGroups).forEach(([groupKey, group]) => {
            // Find the variant with the lowest price in each group
            let lowestPriceVariant = null;
            let lowestPrice = Infinity;

            group.variants.forEach(variant => {
                if (variant.price > 0 && variant.price < lowestPrice) {
                    lowestPrice = variant.price;
                    lowestPriceVariant = variant;
                }
            });

            // If we found a lowest price variant, mark it
            if (lowestPriceVariant) {
                lowestVariantMap[lowestPriceVariant.shopify_id] = {
                    isLowestVariant: true,
                    lowestPrice: lowestPrice,
                    totalVariants: group.variants.length,
                    groupKey: groupKey,
                    baseTitle: group.baseTitle,
                    vendor: group.vendor,
                    priceDifference: group.variants.length > 1 ?
                        Math.max(...group.variants.map(v => v.price)) - lowestPrice : 0
                };

                // Mark all other variants in the group as not lowest
                group.variants.forEach(variant => {
                    if (variant.shopify_id !== lowestPriceVariant.shopify_id) {
                        lowestVariantMap[variant.shopify_id] = {
                            isLowestVariant: false,
                            lowestPrice: lowestPrice,
                            currentPrice: variant.price,
                            totalVariants: group.variants.length,
                            groupKey: groupKey,
                            baseTitle: group.baseTitle,
                            vendor: group.vendor,
                            priceDifference: variant.price - lowestPrice
                        };
                    }
                });
            }
        });

        const lowestVariantCount = Object.values(lowestVariantMap).filter(v => v.isLowestVariant).length;
        const higherPriceCount = Object.values(lowestVariantMap).filter(v => !v.isLowestVariant).length;

        console.log(`Lowest variant analysis complete:`);
        console.log(`- ${lowestVariantCount} products identified as lowest-priced variants`);
        console.log(`- ${higherPriceCount} products identified as higher-priced variants`);

        return lowestVariantMap;
    }

    formatProductForGoogleMerchant(product, analysis, lowestVariantAnalysis, shopUrl) {

        // Clean and format description
        const description = this.cleanDescription(product.body_html || product.title);

        // Format price - use compare_at_price as regular price if it exists
        const regularPrice = product.compare_at_price ? parseFloat(product.compare_at_price) : parseFloat(product.price);
        const currentPrice = parseFloat(product.price);

        const price = regularPrice ? `${regularPrice.toFixed(2)} USD` : '';

        // Sale price should only be set if there's actually a discount
        const salePrice = (product.compare_at_price && currentPrice < regularPrice)
            ? `${currentPrice.toFixed(2)} USD`
            : '';

        // Determine availability
        const availability = this.getAvailability(product.inventory_quantity);


        let productHandle = product.handle || product.product_handle || '';
        if (!productHandle && product.title) {
            productHandle = product.title.toLowerCase()
                .replace(/[^a-z0-9]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
        }

        //shop URL and construct product link
        const cleanShopUrl = shopUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
        const link = productHandle
            ? `https://${cleanShopUrl}/products/${productHandle}`
            : `https://${cleanShopUrl}/products/product-${product.shopify_id}`;

        // Format images
        const imageLink = product.image_src || '';

        // Extract variant attributes
        const color = this.extractColor(product);
        const size = this.extractSize(product);
        const material = this.extractMaterial(product);

        // Format shipping weight
        const shippingWeight = product.weight ? `${product.weight} ${product.weight_unit || 'kg'}` : '';

        // Generate intelligent custom labels with lowest variant analysis
        const customLabels = this.generateCustomLabels(product, analysis, lowestVariantAnalysis);

        return {
            id: `${product.shopify_id}_${product.shopify_id}`, // product_id_variant_id format
            title: product.title || 'Untitled Product',
            description: this.truncateText(description, 5000),
            link: link,
            image_link: imageLink,
            additional_image_link: '', // Can be populated with additional product images
            availability: availability,
            price: price,
            sale_price: salePrice,
            brand: product.vendor || product.brand || '',
            gtin: product.barcode || '',
            mpn: product.sku || '',
            condition: 'new',
            adult: 'no',
            multipack: '',
            is_bundle: 'no',
            age_group: '',
            color: color,
            gender: '',
            material: material,
            pattern: '',
            size: size,
            size_type: '',
            size_system: '',
            item_group_id: product.shopify_id, // Use product ID for grouping variants
            google_product_category: product.google_product_category || '',
            product_type: product.product_type || '',
            shipping: '',
            shipping_label: '',
            shipping_weight: shippingWeight,
            shipping_length: '',
            shipping_width: '',
            shipping_height: '',
            tax: '',
            tax_category: '',
            custom_label_0: customLabels.custom_label_0,
            custom_label_1: customLabels.custom_label_1,
            custom_label_2: customLabels.custom_label_2,
            custom_label_3: customLabels.custom_label_3,
            custom_label_4: customLabels.custom_label_4
        };
    }

    generateCustomLabels(product, analysis, lowestVariantAnalysis = null) {
        const labels = {
            custom_label_0: '', // Lowest Variant Status (if analysis provided) OR Price Tier (fallback)
            custom_label_1: '', // Competitive Position
            custom_label_2: '', // Inventory Status
            custom_label_3: '', // Vendor Performance
            custom_label_4: ''  // Seasonal/Special Attributes
        };

        const productPrice = parseFloat(product.price) || 0;
        const inventoryQuantity = product.inventory_quantity || 0;
        const vendor = product.vendor || 'Unknown';
        const productId = product.shopify_id;

        // Custom Label 0: Lowest Variant Status (PREFERRED) or Price Tier (FALLBACK)
        if (lowestVariantAnalysis && lowestVariantAnalysis[productId]) {
            // Use lowest variant analysis (this is what you want for merchant feeds)
            const variantInfo = lowestVariantAnalysis[productId];

            if (variantInfo.isSingleVariant) {
                labels.custom_label_0 = 'Single_Variant';
            } else if (variantInfo.isLowestVariant) {
                labels.custom_label_0 = 'Lowest_Variant';
            } else {
                const priceDiffPercent = ((variantInfo.currentPrice - variantInfo.lowestPrice) / variantInfo.lowestPrice * 100).toFixed(0);
                // labels.custom_label_0 = `Higher_Variant_+${priceDiffPercent}%`;
                labels.custom_label_0 = '';
            }
        } else if (lowestVariantAnalysis) {
            // If analysis is provided but product not found, it's likely a single product
            labels.custom_label_0 = 'Single_Product';
        } else {
            // Fallback to price tiers if no variant analysis is provided
            if (productPrice > 0 && analysis.priceRanges) {
                Object.entries(analysis.priceRanges).forEach(([tier, range]) => {
                    if (productPrice >= range.min && productPrice <= range.max) {
                        labels.custom_label_0 = `Price_${range.label}`;
                    }
                });
            }
        }

        // Custom Label 1: Competitive Position (for performance optimization)
        const competitiveKey = `${product.product_type}_${vendor}`.toLowerCase();
        if (analysis.competitiveAnalysis[competitiveKey]) {
            const competitive = analysis.competitiveAnalysis[competitiveKey];
            if (competitive.competitiveAdvantage === 'Price Leader') {
                labels.custom_label_1 = 'Price_Leader';
            } else if (productPrice < competitive.avgPrice) {
                labels.custom_label_1 = 'Below_Average';
            } else if (productPrice > competitive.avgPrice * 1.1) {
                labels.custom_label_1 = 'Premium_Priced';
            } else {
                labels.custom_label_1 = 'Market_Rate';
            }
        } else {
            labels.custom_label_1 = 'Unique_Product';
        }

        // Custom Label 2: Inventory Status (for campaign optimization)
        if (analysis.inventoryLevels) {
            if (inventoryQuantity <= analysis.inventoryLevels.low.max) {
                labels.custom_label_2 = 'Low_Stock';
            } else if (inventoryQuantity <= analysis.inventoryLevels.medium.max) {
                labels.custom_label_2 = 'Medium_Stock';
            } else {
                labels.custom_label_2 = 'High_Stock';
            }

            // Special cases for inventory alerts
            if (inventoryQuantity === 0) {
                labels.custom_label_2 = 'Out_of_Stock';
            } else if (inventoryQuantity <= 5) {
                labels.custom_label_2 = 'Critical_Stock';
            }
        }

        // Custom Label 3: Vendor Performance Category (for vendor-based campaigns)
        if (analysis.vendorGroups[vendor]) {
            const vendorData = analysis.vendorGroups[vendor];
            const vendorAvgPrice = vendorData.avgPrice;

            if (vendorData.count >= 50) {
                labels.custom_label_3 = 'Major_Brand';
            } else if (vendorData.count >= 10) {
                labels.custom_label_3 = 'Regular_Brand';
            } else {
                labels.custom_label_3 = 'Boutique_Brand';
            }

            // Add price positioning within vendor
            if (productPrice > vendorAvgPrice * 1.2) {
                labels.custom_label_3 += '_Premium';
            } else if (productPrice < vendorAvgPrice * 0.8) {
                labels.custom_label_3 += '_Value';
            }
        }

        // Custom Label 4: Seasonal/Special Attributes (for campaign timing)
        let seasonalLabel = '';

        // Check for seasonal indicators
        if (analysis.seasonalIndicators) {
            Object.entries(analysis.seasonalIndicators).forEach(([season, productIds]) => {
                if (productIds.includes(productId)) {
                    seasonalLabel = this.capitalize(season);
                }
            });
        }

        // Special product attributes
        if (!seasonalLabel) {
            if (product.compare_at_price && parseFloat(product.compare_at_price) > parseFloat(product.price)) {
                seasonalLabel = 'On_Sale';
            } else if (product.tags && product.tags.toLowerCase().includes('new')) {
                seasonalLabel = 'New_Arrival';
            } else if (product.tags && product.tags.toLowerCase().includes('bestseller')) {
                seasonalLabel = 'Bestseller';
            } else if (productPrice > 0 && analysis.priceRanges && analysis.priceRanges.luxury && productPrice >= analysis.priceRanges.luxury.min) {
                seasonalLabel = 'Luxury_Item';
            } else {
                seasonalLabel = 'Standard';
            }
        }

        labels.custom_label_4 = seasonalLabel;

        return labels;
    }


    getCustomLabelsStats(products, analysis, lowestVariantAnalysis) {
        const stats = {
            lowestVariants: {}, // Updated stats for Custom Label 0
            competitivePositions: {},
            inventoryLevels: {},
            vendorCategories: {},
            seasonalAttributes: {}
        };

        products.forEach(product => {
            const labels = this.generateCustomLabels(product, analysis, lowestVariantAnalysis);

            // Count lowest variant status (Custom Label 0)
            if (labels.custom_label_0) {
                stats.lowestVariants[labels.custom_label_0] = (stats.lowestVariants[labels.custom_label_0] || 0) + 1;
            }

            // Count competitive positions
            if (labels.custom_label_1) {
                stats.competitivePositions[labels.custom_label_1] = (stats.competitivePositions[labels.custom_label_1] || 0) + 1;
            }

            // Count inventory levels
            if (labels.custom_label_2) {
                stats.inventoryLevels[labels.custom_label_2] = (stats.inventoryLevels[labels.custom_label_2] || 0) + 1;
            }

            // Count vendor categories
            if (labels.custom_label_3) {
                stats.vendorCategories[labels.custom_label_3] = (stats.vendorCategories[labels.custom_label_3] || 0) + 1;
            }

            // Count seasonal attributes
            if (labels.custom_label_4) {
                stats.seasonalAttributes[labels.custom_label_4] = (stats.seasonalAttributes[labels.custom_label_4] || 0) + 1;
            }
        });

        // Add summary logging
        console.log('Custom Labels Statistics:', {
            'Lowest Variants': stats.lowestVariants['Lowest_Variant'] || 0,
            'Single Variants': stats.lowestVariants['Single_Variant'] || 0,
            'Higher Variants': Object.entries(stats.lowestVariants)
                .filter(([key]) => key.startsWith('Higher_Variant'))
                .reduce((sum, [key, count]) => sum + count, 0)
        });

        return stats;
    }

    analyzeProductsForLabels(products) {
        console.log('Starting product analysis...');

        // Use Map for better performance with large datasets
        const vendorMap = new Map();
        const typeMap = new Map();
        const prices = [];
        const inventoryLevels = [];

        // Single pass through products to gather all data
        products.forEach(product => {
            const vendor = product.vendor || 'Unknown';
            const type = product.product_type || 'Uncategorized';
            const price = parseFloat(product.price) || 0;
            const inventory = product.inventory_quantity || 0;

            // Vendor analysis
            if (!vendorMap.has(vendor)) {
                vendorMap.set(vendor, { count: 0, totalPrice: 0, products: [] });
            }
            const vendorData = vendorMap.get(vendor);
            vendorData.count++;
            vendorData.totalPrice += price;
            vendorData.products.push(product);

            // Type analysis
            if (!typeMap.has(type)) {
                typeMap.set(type, { count: 0, totalPrice: 0 });
            }
            const typeData = typeMap.get(type);
            typeData.count++;
            typeData.totalPrice += price;

            // Collect numeric data
            if (price > 0) prices.push(price);
            inventoryLevels.push(inventory);
        });

        // Calculate averages
        vendorMap.forEach(vendor => {
            vendor.avgPrice = vendor.count > 0 ? vendor.totalPrice / vendor.count : 0;
        });

        typeMap.forEach(type => {
            type.avgPrice = type.count > 0 ? type.totalPrice / type.count : 0;
        });

        // Convert Maps to Objects for compatibility
        const vendorGroups = Object.fromEntries(vendorMap);
        const typeGroups = Object.fromEntries(typeMap);

        return {
            priceRanges: this.calculatePriceRanges(prices),
            vendorGroups,
            typeGroups,
            inventoryLevels: this.calculateInventoryLevels(inventoryLevels),
            competitiveAnalysis: this.analyzeCompetitivePricing(products, vendorGroups, typeGroups),
            seasonalIndicators: this.detectSeasonalProducts(products)
        };
    }

    // 4. Optimized price range calculation
    calculatePriceRanges(prices) {
        if (prices.length === 0) return {};

        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const range = max - min;
        const tierSize = range / 5;

        return {
            budget: { min: min, max: min + tierSize, label: 'Budget' },
            value: { min: min + tierSize, max: min + (tierSize * 2), label: 'Value' },
            standard: { min: min + (tierSize * 2), max: min + (tierSize * 3), label: 'Standard' },
            premium: { min: min + (tierSize * 3), max: min + (tierSize * 4), label: 'Premium' },
            luxury: { min: min + (tierSize * 4), max: max, label: 'Luxury' }
        };
    }

    groupByVendor(products) {
        const vendorGroups = {};
        products.forEach(product => {
            const vendor = product.vendor || 'Unknown';
            if (!vendorGroups[vendor]) {
                vendorGroups[vendor] = {
                    count: 0,
                    avgPrice: 0,
                    totalPrice: 0,
                    products: []
                };
            }

            const price = parseFloat(product.price) || 0;
            vendorGroups[vendor].count++;
            vendorGroups[vendor].totalPrice += price;
            vendorGroups[vendor].avgPrice = vendorGroups[vendor].totalPrice / vendorGroups[vendor].count;
            vendorGroups[vendor].products.push(product);
        });

        return vendorGroups;
    }

    groupByProductType(products) {
        const typeGroups = {};
        products.forEach(product => {
            const type = product.product_type || 'Uncategorized';
            if (!typeGroups[type]) {
                typeGroups[type] = {
                    count: 0,
                    avgPrice: 0,
                    totalPrice: 0
                };
            }

            const price = parseFloat(product.price) || 0;
            typeGroups[type].count++;
            typeGroups[type].totalPrice += price;
            typeGroups[type].avgPrice = typeGroups[type].totalPrice / typeGroups[type].count;
        });

        return typeGroups;
    }

    calculateInventoryLevels(inventoryLevels) {
        if (inventoryLevels.length === 0) return {};

        const sortedInventory = [...inventoryLevels].sort((a, b) => a - b);
        const q1Index = Math.floor(sortedInventory.length * 0.25);
        const q3Index = Math.floor(sortedInventory.length * 0.75);
        const medianIndex = Math.floor(sortedInventory.length * 0.5);

        const q1 = sortedInventory[q1Index];
        const q3 = sortedInventory[q3Index];
        const median = sortedInventory[medianIndex];

        return {
            low: { max: q1, label: 'Low Stock' },
            medium: { min: q1, max: q3, label: 'Medium Stock' },
            high: { min: q3, label: 'High Stock' },
            median: median
        };
    }

    analyzeCompetitivePricing(products) {
        const analysis = {};

        // Group products by similar characteristics for competitive analysis
        const similarProducts = {};

        products.forEach(product => {
            const key = `${product.product_type}_${product.vendor}`.toLowerCase();
            if (!similarProducts[key]) {
                similarProducts[key] = [];
            }
            similarProducts[key].push(product);
        });

        // Analyze pricing within groups
        Object.entries(similarProducts).forEach(([key, groupProducts]) => {
            if (groupProducts.length > 1) {
                const prices = groupProducts.map(p => parseFloat(p.price) || 0).filter(p => p > 0);
                if (prices.length > 1) {
                    const avgPrice = prices.reduce((a, b) => a + b) / prices.length;
                    const minPrice = Math.min(...prices);

                    analysis[key] = {
                        avgPrice,
                        minPrice,
                        competitiveAdvantage: minPrice < avgPrice * 0.9 ? 'Price Leader' : 'Market Rate'
                    };
                }
            }
        });

        return analysis;
    }

    detectSeasonalProducts(products) {
        const seasonalKeywords = {
            spring: ['spring', 'easter', 'fresh', 'bloom', 'renewal'],
            summer: ['summer', 'beach', 'vacation', 'sun', 'outdoor', 'pool'],
            fall: ['fall', 'autumn', 'harvest', 'cozy', 'warm'],
            winter: ['winter', 'holiday', 'christmas', 'warm', 'indoor', 'gift'],
            clearance: ['clearance', 'sale', 'discount', 'end of season', 'final'],
            trending: ['new', 'latest', 'trending', 'popular', 'hot']
        };

        const seasonal = {};

        products.forEach(product => {
            const searchText = `${product.title} ${product.tags || ''} ${product.product_type || ''}`.toLowerCase();

            Object.entries(seasonalKeywords).forEach(([season, keywords]) => {
                keywords.forEach(keyword => {
                    if (searchText.includes(keyword)) {
                        if (!seasonal[season]) seasonal[season] = [];
                        seasonal[season].push(product.shopify_id);
                    }
                });
            });
        });

        return seasonal;
    }


    generateCustomLabels(product, analysis, lowestVariantAnalysis = null) {
        const labels = {
            custom_label_0: '', // Lowest Variant Status (if analysis provided) OR Price Tier (fallback)
            custom_label_1: '', // Competitive Position
            custom_label_2: '', // Inventory Status
            custom_label_3: '', // Vendor Performance
            custom_label_4: ''  // Seasonal/Special Attributes
        };

        const productPrice = parseFloat(product.price) || 0;
        const inventoryQuantity = product.inventory_quantity || 0;
        const vendor = product.vendor || 'Unknown';
        const productId = product.shopify_id;

        // Custom Label 0: Lowest Variant Status (PREFERRED) or Price Tier (FALLBACK)
        if (lowestVariantAnalysis && lowestVariantAnalysis[productId]) {
            // Use lowest variant analysis (this is what you want for merchant feeds)
            const variantInfo = lowestVariantAnalysis[productId];

            if (variantInfo.isSingleVariant) {
                labels.custom_label_0 = 'Single_Variant';
            } else if (variantInfo.isLowestVariant) {
                labels.custom_label_0 = 'Lowest_Variant';
            } else {
                const priceDiffPercent = ((variantInfo.currentPrice - variantInfo.lowestPrice) / variantInfo.lowestPrice * 100).toFixed(0);
                //labels.custom_label_0 = `Higher_Variant_+${priceDiffPercent}%`;
                labels.custom_label_0 = '';
            }
        } else if (lowestVariantAnalysis) {
            // If analysis is provided but product not found, it's likely a single product
            labels.custom_label_0 = 'Single_Product';
        } else {
            // Fallback to price tiers if no variant analysis is provided
            if (productPrice > 0 && analysis.priceRanges) {
                Object.entries(analysis.priceRanges).forEach(([tier, range]) => {
                    if (productPrice >= range.min && productPrice <= range.max) {
                        labels.custom_label_0 = `Price_${range.label}`;
                    }
                });
            }
        }

        // Custom Label 1: Competitive Position (for performance optimization)
        const competitiveKey = `${product.product_type}_${vendor}`.toLowerCase();
        if (analysis.competitiveAnalysis[competitiveKey]) {
            const competitive = analysis.competitiveAnalysis[competitiveKey];
            if (competitive.competitiveAdvantage === 'Price Leader') {
                labels.custom_label_1 = 'Price_Leader';
            } else if (productPrice < competitive.avgPrice) {
                labels.custom_label_1 = 'Below_Average';
            } else if (productPrice > competitive.avgPrice * 1.1) {
                labels.custom_label_1 = 'Premium_Priced';
            } else {
                labels.custom_label_1 = 'Market_Rate';
            }
        } else {
            labels.custom_label_1 = 'Unique_Product';
        }

        // Custom Label 2: Inventory Status (for campaign optimization)
        if (analysis.inventoryLevels) {
            if (inventoryQuantity <= analysis.inventoryLevels.low.max) {
                labels.custom_label_2 = 'Low_Stock';
            } else if (inventoryQuantity <= analysis.inventoryLevels.medium.max) {
                labels.custom_label_2 = 'Medium_Stock';
            } else {
                labels.custom_label_2 = 'High_Stock';
            }

            // Special cases for inventory alerts
            if (inventoryQuantity === 0) {
                labels.custom_label_2 = 'Out_of_Stock';
            } else if (inventoryQuantity <= 5) {
                labels.custom_label_2 = 'Critical_Stock';
            }
        }

        // Custom Label 3: Vendor Performance Category (for vendor-based campaigns)
        if (analysis.vendorGroups[vendor]) {
            const vendorData = analysis.vendorGroups[vendor];
            const vendorAvgPrice = vendorData.avgPrice;

            if (vendorData.count >= 50) {
                labels.custom_label_3 = 'Major_Brand';
            } else if (vendorData.count >= 10) {
                labels.custom_label_3 = 'Regular_Brand';
            } else {
                labels.custom_label_3 = 'Boutique_Brand';
            }

            // Add price positioning within vendor
            if (productPrice > vendorAvgPrice * 1.2) {
                labels.custom_label_3 += '_Premium';
            } else if (productPrice < vendorAvgPrice * 0.8) {
                labels.custom_label_3 += '_Value';
            }
        }

        // Custom Label 4: Seasonal/Special Attributes (for campaign timing)
        let seasonalLabel = '';

        // Check for seasonal indicators
        if (analysis.seasonalIndicators) {
            Object.entries(analysis.seasonalIndicators).forEach(([season, productIds]) => {
                if (productIds.includes(productId)) {
                    seasonalLabel = this.capitalize(season);
                }
            });
        }

        // Special product attributes
        if (!seasonalLabel) {
            if (product.compare_at_price && parseFloat(product.compare_at_price) > parseFloat(product.price)) {
                seasonalLabel = 'On_Sale';
            } else if (product.tags && product.tags.toLowerCase().includes('new')) {
                seasonalLabel = 'New_Arrival';
            } else if (product.tags && product.tags.toLowerCase().includes('bestseller')) {
                seasonalLabel = 'Bestseller';
            } else if (productPrice > 0 && analysis.priceRanges && analysis.priceRanges.luxury && productPrice >= analysis.priceRanges.luxury.min) {
                seasonalLabel = 'Luxury_Item';
            } else {
                seasonalLabel = 'Standard';
            }
        }

        labels.custom_label_4 = seasonalLabel;

        return labels;
    }

    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    cleanDescription(html) {
        if (!html) return '';

        // Remove HTML tags
        let text = html.replace(/<[^>]*>/g, ' ');

        // Clean up whitespace
        text = text.replace(/\s+/g, ' ').trim();

        // Remove special characters that might cause issues
        text = text.replace(/[^\w\s\-.,!?()]/g, '');

        return text;
    }

    getAvailability(inventoryQuantity) {
        if (!inventoryQuantity || inventoryQuantity <= 0) {
            return 'out of stock';
        }
        return 'in stock';
    }

    extractColor(product) {
        // Try to extract color from variant options or title
        const sources = [
            product.option1,
            product.option2,
            product.option3,
            product.title
        ].filter(Boolean).join(' ').toLowerCase();

        const colors = [
            'black', 'white', 'red', 'blue', 'green', 'yellow', 'purple', 'pink',
            'orange', 'brown', 'gray', 'grey', 'silver', 'gold', 'beige', 'navy',
            'maroon', 'teal', 'olive', 'lime', 'aqua', 'fuchsia'
        ];

        for (const color of colors) {
            if (sources.includes(color)) {
                return color;
            }
        }

        return '';
    }

    extractSize(product) {
        // Try to extract size from variant options
        const sources = [
            product.option1,
            product.option2,
            product.option3
        ].filter(Boolean).join(' ').toLowerCase();

        const sizes = [
            'xs', 'sm', 's', 'small', 'md', 'm', 'medium', 'lg', 'l', 'large',
            'xl', 'xxl', 'xxxl', '2xl', '3xl', '4xl', '5xl',
            'one size', 'onesize', 'os', 'free size'
        ];

        for (const size of sizes) {
            if (sources.includes(size)) {
                return size.toUpperCase();
            }
        }

        // Check for numeric sizes
        const numericSize = sources.match(/\b(\d+(?:\.\d+)?)\b/);
        if (numericSize) {
            return numericSize[1];
        }

        return '';
    }

    extractMaterial(product) {
        // Try to extract material from product title, description, or tags
        const sources = [
            product.title,
            product.body_html,
            product.tags,
            product.product_type
        ].filter(Boolean).join(' ').toLowerCase();

        const materials = [
            'cotton', 'polyester', 'wool', 'silk', 'linen', 'denim', 'leather',
            'suede', 'canvas', 'nylon', 'spandex', 'bamboo', 'cashmere',
            'fleece', 'chiffon', 'velvet', 'satin', 'jersey', 'lycra'
        ];

        for (const material of materials) {
            if (sources.includes(material)) {
                return material.charAt(0).toUpperCase() + material.slice(1);
            }
        }

        return '';
    }

    truncateText(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }

    getGoogleMerchantColumns() {
        return [
            { header: 'id', key: 'id', width: 15 },
            { header: 'title', key: 'title', width: 40 },
            { header: 'description', key: 'description', width: 50 },
            { header: 'link', key: 'link', width: 60 },
            { header: 'image_link', key: 'image_link', width: 60 },
            { header: 'additional_image_link', key: 'additional_image_link', width: 60 },
            { header: 'availability', key: 'availability', width: 15 },
            { header: 'price', key: 'price', width: 15 },
            { header: 'sale_price', key: 'sale_price', width: 15 },
            { header: 'brand', key: 'brand', width: 20 },
            { header: 'gtin', key: 'gtin', width: 15 },
            { header: 'mpn', key: 'mpn', width: 20 },
            { header: 'condition', key: 'condition', width: 15 },
            { header: 'adult', key: 'adult', width: 10 },
            { header: 'multipack', key: 'multipack', width: 10 },
            { header: 'is_bundle', key: 'is_bundle', width: 10 },
            { header: 'age_group', key: 'age_group', width: 15 },
            { header: 'color', key: 'color', width: 15 },
            { header: 'gender', key: 'gender', width: 15 },
            { header: 'material', key: 'material', width: 20 },
            { header: 'pattern', key: 'pattern', width: 15 },
            { header: 'size', key: 'size', width: 15 },
            { header: 'size_type', key: 'size_type', width: 15 },
            { header: 'size_system', key: 'size_system', width: 15 },
            { header: 'item_group_id', key: 'item_group_id', width: 20 },
            { header: 'google_product_category', key: 'google_product_category', width: 30 },
            { header: 'product_type', key: 'product_type', width: 30 },
            { header: 'shipping', key: 'shipping', width: 20 },
            { header: 'shipping_label', key: 'shipping_label', width: 20 },
            { header: 'shipping_weight', key: 'shipping_weight', width: 20 },
            { header: 'shipping_length', key: 'shipping_length', width: 20 },
            { header: 'shipping_width', key: 'shipping_width', width: 20 },
            { header: 'shipping_height', key: 'shipping_height', width: 20 },
            { header: 'tax', key: 'tax', width: 15 },
            { header: 'tax_category', key: 'tax_category', width: 20 },
            { header: 'custom_label_0', key: 'custom_label_0', width: 20 },
            { header: 'custom_label_1', key: 'custom_label_1', width: 20 },
            { header: 'custom_label_2', key: 'custom_label_2', width: 20 },
            { header: 'custom_label_3', key: 'custom_label_3', width: 20 },
            { header: 'custom_label_4', key: 'custom_label_4', width: 20 }
        ];
    }

    async getExportHistory(database, limit = 10) {
        try {
            const query = `
        SELECT * FROM export_history
        ORDER BY created_at DESC
        LIMIT ?
      `;

            const history = await database.allQuery(query, [limit]);
            return history;
        } catch (error) {
            console.error('Error getting export history:', error);
            return [];
        }
    }

    async deleteExportFile(filename) {
        try {
            const filepath = path.join(this.exportsDir, filename);
            await fs.unlink(filepath);
            console.log('File deleted from filesystem:', filename);
            return true;
        } catch (error) {
            console.error('Error deleting export file from filesystem:', error);
            if (error.code === 'ENOENT') {
                console.log('File not found, considering as deleted:', filename);
                return true; // File doesn't exist, so it's effectively "deleted"
            }
            return false;
        }
    }

    async getExportFiles() {
        try {
            const files = await fs.readdir(this.exportsDir);
            const fileDetails = [];

            for (const file of files) {
                if (file.endsWith('.xlsx')) {
                    const filepath = path.join(this.exportsDir, file);
                    const stats = await fs.stat(filepath);

                    fileDetails.push({
                        filename: file,
                        size: stats.size,
                        sizeKB: Math.round(stats.size / 1024),
                        created: stats.birthtime,
                        modified: stats.mtime
                    });
                }
            }

            // Sort by creation time, newest first
            fileDetails.sort((a, b) => b.created - a.created);

            return fileDetails;
        } catch (error) {
            console.error('Error getting export files:', error);
            return [];
        }
    }
}

module.exports = ExcelGenerator;