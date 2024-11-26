require('dotenv').config();
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Validate environment variables
if (!process.env.SHOPIFY_ACCESS_TOKEN || !process.env.SHOPIFY_SHOP_DOMAIN) {
  console.error('Error: Required environment variables are missing.');
  console.error('Please ensure SHOPIFY_ACCESS_TOKEN and SHOPIFY_SHOP_DOMAIN are set in .env file');
  process.exit(1);
}

// Configuration
const API_VERSION = '2024-01';
const BATCH_SIZE = 50; // Reduced batch size to use less memory
const RATE_LIMIT_DELAY = 500; // 500ms between requests
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

// Initialize axios client with base configuration
const shopify = axios.create({
  baseURL: `https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/${API_VERSION}`,
  headers: {
    'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
    'Content-Type': 'application/json'
  },
  timeout: 30000 // 30 second timeout
});

// Function to handle API errors with retry
async function handleApiError(error, retryCount = 0) {
  if (retryCount >= MAX_RETRIES) {
    throw new Error(`Max retries (${MAX_RETRIES}) exceeded`);
  }

  if (error.response) {
    const { status, statusText, data } = error.response;
    
    if (status === 429) {
      console.log('Rate limit reached. Waiting before retrying...');
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return { shouldRetry: true };
    }
    
    console.error('API Error Response:', { status, statusText, data });
  } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
    console.log(`Network error (${error.code}). Retrying in ${RETRY_DELAY/1000} seconds...`);
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    return { shouldRetry: true };
  }
  
  return { shouldRetry: false };
}

// Function to fetch products with retry logic
async function fetchProducts(params, retryCount = 0) {
  try {
    return await shopify.get('/products.json', { params });
  } catch (error) {
    const { shouldRetry } = await handleApiError(error, retryCount);
    if (shouldRetry) {
      return fetchProducts(params, retryCount + 1);
    }
    throw error;
  }
}

// Function to update variant inventory management with retry
async function updateVariantInventoryManagement(variantId, retryCount = 0) {
  try {
    const response = await shopify.put(`/variants/${variantId}.json`, {
      variant: {
        id: variantId,
        inventory_management: 'shopify'
      }
    });
    
    console.log(`✓ Updated inventory management for variant ${variantId}`);
    return response.data;
  } catch (error) {
    const { shouldRetry } = await handleApiError(error, retryCount);
    if (shouldRetry) {
      return updateVariantInventoryManagement(variantId, retryCount + 1);
    }
    throw error;
  }
}

// Function to enable POS for a product
async function enablePOS(productId, retryCount = 0) {
  try {
    const response = await shopify.put(`/products/${productId}.json`, {
      product: {
        id: productId,
        published_scope: 'global',
        published_status: 'published',
        published_at: new Date().toISOString()
      }
    });
    console.log(`✓ Enabled POS for product ${productId}`);
    return response.data;
  } catch (error) {
    const { shouldRetry } = await handleApiError(error, retryCount);
    if (shouldRetry) {
      return enablePOS(productId, retryCount + 1);
    }
    throw error;
  }
}

// Main function to process products and variants
async function updateAllInventoryTracking() {
  try {
    console.log('=== Shopify Inventory Tracking and POS Update Script ===');
    console.log(`Connected to shop: ${process.env.SHOPIFY_SHOP_DOMAIN}`);
    
    let page_info = null;
    let hasMore = true;
    let totalProducts = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let posEnabledCount = 0;
    
    while (hasMore) {
      try {
        const params = {
          limit: BATCH_SIZE
        };
        
        if (page_info) {
          params.page_info = page_info;
        }
        
        const response = await fetchProducts(params);
        const products = response.data.products;
        totalProducts += products.length;
        
        console.log(`\nProcessing batch of ${products.length} products (Total processed: ${totalProducts})`);
        
        // Process each product and its variants
        for (const product of products) {
          console.log(`\nProcessing product: ${product.title} (${product.variants.length} variants)`);
          let hasInventoryTracking = false;
          
          for (const variant of product.variants) {
            try {
              if (variant.inventory_management !== 'shopify') {
                await updateVariantInventoryManagement(variant.id);
                updatedCount++;
                hasInventoryTracking = true;
                await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
              } else {
                console.log(`⚡ Skipping variant ${variant.id} - already using Shopify inventory management`);
                hasInventoryTracking = true;
                skippedCount++;
              }
            } catch (error) {
              console.error(`Failed to update variant ${variant.id}:`, error.message);
              errorCount++;
            }
          }
          
          // If product has inventory tracking, enable it in POS
          if (hasInventoryTracking) {
            try {
              await enablePOS(product.id);
              posEnabledCount++;
              await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
            } catch (error) {
              console.error(`Failed to enable POS for product ${product.id}:`, error.message);
              errorCount++;
            }
          }
        }
        
        // Progress update
        console.log(`\nProgress Update:`);
        console.log(`Total products processed: ${totalProducts}`);
        console.log(`Variants updated: ${updatedCount}`);
        console.log(`Variants skipped: ${skippedCount}`);
        console.log(`Products enabled in POS: ${posEnabledCount}`);
        console.log(`Errors: ${errorCount}`);
        
        // Check for next page
        const link = response.headers['link'];
        if (link && link.includes('rel="next"')) {
          page_info = link.match(/page_info=([^&>]*)/)[1];
        } else {
          hasMore = false;
        }
        
        // Respect rate limits
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
        
      } catch (error) {
        console.error('Error processing batch:', error.message);
        errorCount++;
        // Continue with next batch even if current one fails
        hasMore = false;
      }
    }
    
    console.log('\n=== Inventory Tracking and POS Update Summary ===');
    console.log(`Total products processed: ${totalProducts}`);
    console.log(`Variants updated: ${updatedCount}`);
    console.log(`Variants skipped (already configured): ${skippedCount}`);
    console.log(`Products enabled in POS: ${posEnabledCount}`);
    console.log(`Errors encountered: ${errorCount}`);
    console.log('Process completed! ✨');
    
  } catch (error) {
    console.error('\n❌ Error in update process:', error.message);
    process.exit(1);
  }
}

// Execute the script
updateAllInventoryTracking();
