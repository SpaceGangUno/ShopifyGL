require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const skuData = require('./sku_data.js');

if (!process.env.SHOPIFY_ACCESS_TOKEN || !process.env.SHOPIFY_SHOP_DOMAIN) {
  console.error('Error: Required environment variables are missing.');
  process.exit(1);
}

const shopify = axios.create({
  baseURL: `https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/2024-01`,
  headers: {
    'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
    'Content-Type': 'application/json'
  }
});

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function retryWithBackoff(fn, maxRetries = 3) {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      return await fn();
    } catch (error) {
      if (error.response && error.response.status === 429) {
        retries++;
        if (retries === maxRetries) {
          throw error;
        }
        
        // Exponential backoff starting at 15 seconds
        const delay = 15000 * Math.pow(2, retries);
        console.log(`Rate limited. Attempt ${retries}/${maxRetries}. Waiting ${delay/1000} seconds...`);
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }
}

async function findVariantBySKU(sku) {
  return retryWithBackoff(async () => {
    const response = await shopify.get(`/variants.json?sku=${sku}`);
    const variants = response.data.variants;
    if (variants && variants.length > 0) {
      return variants[0];
    }
    return null;
  });
}

async function updateInventory(sku, quantity) {
  try {
    console.log(`\nProcessing SKU: ${sku}`);
    
    // Skip if quantity is undefined or empty
    if (quantity === undefined || quantity === '') {
      console.log(`Skipping SKU ${sku} - no quantity specified`);
      return false;
    }

    const variant = await findVariantBySKU(sku);
    if (!variant) {
      console.log(`No variant found for SKU: ${sku}`);
      return false;
    }

    const inventoryItemId = variant.inventory_item_id;
    if (!inventoryItemId) {
      console.log(`No inventory item ID found for SKU: ${sku}`);
      return false;
    }

    const response = await retryWithBackoff(() => 
      shopify.get(`/inventory_levels.json?inventory_item_ids=${inventoryItemId}`)
    );
    
    const levels = response.data.inventory_levels;
    if (!levels || levels.length === 0) {
      console.log(`No inventory levels found for SKU: ${sku}`);
      return false;
    }

    const locationId = levels[0].location_id;
    await retryWithBackoff(() => 
      shopify.post('/inventory_levels/set.json', {
        location_id: locationId,
        inventory_item_id: inventoryItemId,
        available: parseInt(quantity)
      })
    );

    console.log(`✓ Updated inventory for SKU ${sku} to ${quantity}`);
    return true;
  } catch (error) {
    console.error(`Error updating inventory for SKU ${sku}:`, error.message);
    return false;
  }
}

async function processBatch(items) {
  const results = [];
  
  for (const item of items) {
    try {
      // Wait 15 seconds between operations
      await sleep(15000);
      const success = await updateInventory(item.sku, item.quantity);
      results.push({ sku: item.sku, success });
    } catch (error) {
      if (error.response && error.response.status === 429) {
        console.log('Rate limit reached. Taking a longer break...');
        await sleep(60000); // Wait 1 minute before retrying
        // Retry this SKU
        continue;
      }
      results.push({ sku: item.sku, success: false });
    }
  }
  
  return results;
}

// Parse the raw SKU data
function parseSkuData(rawData) {
  return rawData
    .split('\n')
    .map(line => {
      const [sku, quantity] = line.trim().split('\t');
      if (!sku || sku === '') return null;
      return {
        sku,
        quantity: parseInt(quantity) || 0
      };
    })
    .filter(item => item !== null);
}

async function main() {
  console.log('Starting bulk inventory update...');
  
  // Parse the SKU data
  const inventoryData = parseSkuData(skuData);
  
  console.log(`Found ${inventoryData.length} SKUs to process`);
  
  // Process in small batches
  const batchSize = 5;
  let totalProcessed = 0;
  let totalSuccessful = 0;
  let totalFailed = 0;
  
  for (let i = 0; i < inventoryData.length; i += batchSize) {
    const batch = inventoryData.slice(i, i + batchSize);
    
    console.log(`\nProcessing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(inventoryData.length/batchSize)}`);
    
    const results = await processBatch(batch);
    
    // Update totals
    totalProcessed += results.length;
    totalSuccessful += results.filter(r => r.success).length;
    totalFailed += results.filter(r => !r.success).length;
    
    // Calculate progress
    const progress = (totalProcessed / inventoryData.length * 100).toFixed(1);
    console.log(`\nProgress: ${progress}%`);
    console.log(`Updated: ${totalSuccessful}`);
    console.log(`Failed: ${totalFailed}`);
    console.log(`Remaining: ${inventoryData.length - totalProcessed}`);
    
    // Take a break between batches
    if (i + batchSize < inventoryData.length) {
      console.log('\nTaking a break between batches...');
      await sleep(30000); // 30 second break between batches
    }
  }
  
  console.log('\n=== Final Summary ===');
  console.log(`Successfully updated: ${totalSuccessful} products`);
  console.log(`Failed to update: ${totalFailed} products`);
  console.log(`Total processed: ${totalProcessed} out of ${inventoryData.length}`);
}

main().catch(console.error);
