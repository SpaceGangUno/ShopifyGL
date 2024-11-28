require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

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

// Save progress to a file
function saveProgress(processedSKUs) {
  fs.writeFileSync('inventory_progress.json', JSON.stringify(processedSKUs, null, 2));
}

// Load progress from file
function loadProgress() {
  try {
    if (fs.existsSync('inventory_progress.json')) {
      return JSON.parse(fs.readFileSync('inventory_progress.json', 'utf8'));
    }
  } catch (error) {
    console.error('Error loading progress file:', error);
  }
  return {};
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

// Next batch of inventory data
const inventoryData = [
  { sku: "580752T", quantity: 1 },
  { sku: "284213D", quantity: 1 },
  { sku: "477357Y", quantity: 1 },
  { sku: "P862692", quantity: 0 },
  { sku: "2239253", quantity: 0 },
  { sku: "801384E", quantity: 0 },
  { sku: "579000Y", quantity: 2 },
  { sku: "538864V", quantity: 2 },
  { sku: "6542867", quantity: 3 },
  { sku: "1609692", quantity: 2 },
  { sku: "T009021", quantity: 1 },
  { sku: "4289121", quantity: 0 },
  { sku: "418064Q", quantity: 1 },
  { sku: "666285Z", quantity: 3 },
  { sku: "J840368", quantity: 1 },
  { sku: "9922838", quantity: 4 },
  { sku: "5325688", quantity: 0 },
  { sku: "6621773", quantity: 1 },
  { sku: "841105L", quantity: 1 },
  { sku: "386730B", quantity: 1 },
  { sku: "8658277", quantity: 1 },
  { sku: "9372", quantity: 0 },
  { sku: "9373", quantity: 1 },
  { sku: "9374", quantity: 0 },
  { sku: "9375", quantity: 0 },
  { sku: "813982Z", quantity: 0 },
  { sku: "806781F", quantity: 2 },
  { sku: "984135E", quantity: 0 },
  { sku: "E822405", quantity: 1 },
  { sku: "A595296", quantity: 0 },
  { sku: "2512185", quantity: 1 },
  { sku: "5767240", quantity: 1 },
  { sku: "958966D", quantity: 1 },
  { sku: "2541053", quantity: 1 },
  { sku: "522717L", quantity: 0 }
];

async function main() {
  console.log('Starting bulk inventory update...');
  
  // Clear previous progress
  const processedSKUs = {};
  
  // Get remaining SKUs to process
  const remainingSKUs = inventoryData.filter(item => !processedSKUs[item.sku]);
  
  console.log(`Found ${remainingSKUs.length} SKUs to process`);
  console.log(`Previously processed: ${Object.keys(processedSKUs).length} SKUs`);
  
  // Process in small batches
  const batchSize = 5;
  for (let i = 0; i < remainingSKUs.length; i += batchSize) {
    const batch = remainingSKUs.slice(i, i + batchSize);
    
    console.log(`\nProcessing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(remainingSKUs.length/batchSize)}`);
    
    const results = await processBatch(batch);
    
    // Update progress
    results.forEach(({ sku, success }) => {
      processedSKUs[sku] = success;
    });
    
    // Save progress after each batch
    saveProgress(processedSKUs);
    
    // Calculate overall progress
    const totalProcessed = Object.keys(processedSKUs).length;
    const totalSuccessful = Object.values(processedSKUs).filter(v => v).length;
    const totalFailed = Object.values(processedSKUs).filter(v => !v).length;
    
    console.log(`\nProgress: ${(totalProcessed / inventoryData.length * 100).toFixed(1)}%`);
    console.log(`Updated: ${totalSuccessful}`);
    console.log(`Failed: ${totalFailed}`);
    console.log(`Remaining: ${inventoryData.length - totalProcessed}`);
    
    // Take a break between batches
    if (i + batchSize < remainingSKUs.length) {
      console.log('\nTaking a break between batches...');
      await sleep(30000); // 30 second break between batches
    }
  }
  
  console.log('\n=== Final Summary ===');
  const finalSuccessful = Object.values(processedSKUs).filter(v => v).length;
  const finalFailed = Object.values(processedSKUs).filter(v => !v).length;
  console.log(`Successfully updated: ${finalSuccessful} products`);
  console.log(`Failed to update: ${finalFailed} products`);
  console.log(`Total processed: ${Object.keys(processedSKUs).length} out of ${inventoryData.length}`);
}

main().catch(console.error);
