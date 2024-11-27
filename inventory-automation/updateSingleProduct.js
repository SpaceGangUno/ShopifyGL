require('dotenv').config();
const axios = require('axios');

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

async function retryWithBackoff(fn, maxRetries = 5) {
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
        
        // Exponential backoff starting at 30 seconds
        const delay = 30000 * Math.pow(2, retries);
        console.log(`Rate limited. Attempt ${retries}/${maxRetries}. Waiting ${delay/1000} seconds...`);
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }
}

async function updateInventory(sku, quantity) {
  try {
    console.log(`\nProcessing SKU: ${sku}`);
    
    // Find the variant by SKU
    const variantResponse = await retryWithBackoff(() => 
      shopify.get(`/variants.json?sku=${sku}`)
    );
    
    const variants = variantResponse.data.variants;
    if (!variants || variants.length === 0) {
      console.log(`No variant found for SKU: ${sku}`);
      return false;
    }

    const variant = variants[0];
    const inventoryItemId = variant.inventory_item_id;
    
    if (!inventoryItemId) {
      console.log(`No inventory item ID found for SKU: ${sku}`);
      return false;
    }

    // Get location ID
    await sleep(5000); // Wait 5 seconds before next API call
    
    const levelsResponse = await retryWithBackoff(() => 
      shopify.get(`/inventory_levels.json?inventory_item_ids=${inventoryItemId}`)
    );
    
    const levels = levelsResponse.data.inventory_levels;
    if (!levels || levels.length === 0) {
      console.log(`No inventory levels found for SKU: ${sku}`);
      return false;
    }

    const locationId = levels[0].location_id;
    
    // Wait another 5 seconds before updating inventory
    await sleep(5000);
    
    // Update inventory
    await retryWithBackoff(() => 
      shopify.post('/inventory_levels/set.json', {
        location_id: locationId,
        inventory_item_id: inventoryItemId,
        available: quantity
      })
    );

    console.log(`✓ Updated inventory for SKU ${sku} to ${quantity}`);
    return true;
  } catch (error) {
    console.error(`Error updating inventory for SKU ${sku}:`, error.message);
    return false;
  }
}

async function main() {
  const sku = '4285161';
  const quantity = 0;
  
  console.log('Attempting to update failed SKU...');
  const success = await updateInventory(sku, quantity);
  
  if (success) {
    console.log('\n✓ Successfully updated the previously failed SKU');
  } else {
    console.log('\n✗ Failed to update the SKU');
  }
}

main().catch(console.error);
