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
const BATCH_SIZE = 250; // Maximum allowed by Shopify
const RATE_LIMIT_DELAY = 500; // 500ms between requests
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds
const CHECKPOINT_FILE = path.join(__dirname, 'checkpoint.json');
const TEST_MODE = true; // Set to false for processing all products

// Initialize axios client with base configuration
const shopify = axios.create({
  baseURL: `https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/${API_VERSION}`,
  headers: {
    'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
    'Content-Type': 'application/json'
  },
  timeout: 30000 // 30 second timeout
});

// Function to save checkpoint
async function saveCheckpoint(data) {
  try {
    await fs.writeFile(CHECKPOINT_FILE, JSON.stringify(data, null, 2));
    console.log('\nCheckpoint saved');
  } catch (error) {
    console.error('Error saving checkpoint:', error.message);
  }
}

// Function to load checkpoint
async function loadCheckpoint() {
  try {
    const data = await fs.readFile(CHECKPOINT_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    console.error('Error loading checkpoint:', error.message);
    return null;
  }
}

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

// Function to fetch all products with pagination
async function getAllProducts(startAfter = null) {
  let products = [];
  let page_info = startAfter;
  let hasMore = true;
  
  console.log('\nFetching products...');
  
  while (hasMore) {
    try {
      const params = {
        limit: BATCH_SIZE
      };
      
      if (page_info) {
        params.page_info = page_info;
      }
      
      const response = await fetchProducts(params);
      const newProducts = response.data.products;
      products = products.concat(newProducts);
      
      // Progress update
      console.log(`Fetched ${products.length} products so far...`);
      
      // Save checkpoint
      await saveCheckpoint({
        lastPageInfo: page_info,
        totalFetched: products.length,
        lastUpdateTime: new Date().toISOString()
      });
      
      // Check for next page
      const link = response.headers['link'];
      if (link && link.includes('rel="next"')) {
        page_info = link.match(/page_info=([^&>]*)/)[1];
        
        // In test mode, limit the number of products
        if (TEST_MODE && products.length >= 10) {
          console.log('\nTest mode: Limiting to 10 products');
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
      
      // Respect rate limits
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
      
    } catch (error) {
      console.error('Error fetching products:', error.message);
      throw error;
    }
  }
  
  return products;
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

// Main function to process all products and variants
async function updateAllInventoryTracking() {
  try {
    console.log('=== Shopify Inventory Tracking Update Script ===');
    console.log(`Connected to shop: ${process.env.SHOPIFY_SHOP_DOMAIN}`);
    console.log(`Running in ${TEST_MODE ? 'TEST MODE' : 'PRODUCTION MODE'}`);
    
    // Check for existing checkpoint
    const checkpoint = await loadCheckpoint();
    let startAfter = null;
    
    if (checkpoint) {
      console.log('\nFound existing checkpoint:');
      console.log(`Last processed: ${checkpoint.totalFetched} products`);
      console.log(`Last update: ${checkpoint.lastUpdateTime}`);
      console.log('Resuming from last checkpoint...\n');
      startAfter = checkpoint.lastPageInfo;
    }
    
    // Get products
    const products = await getAllProducts(startAfter);
    console.log(`\nFound ${products.length} products to process`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // Process each product and its variants
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      console.log(`\nProcessing product ${i + 1}/${products.length}: ${product.title} (${product.variants.length} variants)`);
      
      for (const variant of product.variants) {
        try {
          if (variant.inventory_management !== 'shopify') {
            await updateVariantInventoryManagement(variant.id);
            updatedCount++;
            await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
          } else {
            console.log(`⚡ Skipping variant ${variant.id} - already using Shopify inventory management`);
            skippedCount++;
          }
        } catch (error) {
          console.error(`Failed to update variant ${variant.id}:`, error.message);
          errorCount++;
        }
      }
      
      // Progress update
      if ((i + 1) % 10 === 0) {
        console.log(`\nProgress: ${((i + 1) / products.length * 100).toFixed(1)}% complete`);
        console.log(`Updated: ${updatedCount} | Skipped: ${skippedCount} | Errors: ${errorCount}`);
      }
    }
    
    // Clean up checkpoint file after successful completion
    await fs.unlink(CHECKPOINT_FILE).catch(() => {});
    
    console.log('\n=== Inventory Tracking Update Summary ===');
    console.log(`Total products processed: ${products.length}`);
    console.log(`Variants updated: ${updatedCount}`);
    console.log(`Variants skipped (already configured): ${skippedCount}`);
    console.log(`Errors encountered: ${errorCount}`);
    console.log('Process completed! ✨');
    
    if (TEST_MODE) {
      console.log('\nTest mode completed successfully.');
      console.log('To process all products, set TEST_MODE to false and run the script again.');
    }
    
  } catch (error) {
    console.error('\n❌ Error in update process:', error.message);
    process.exit(1);
  }
}

// Execute the script
updateAllInventoryTracking();
