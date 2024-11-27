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

// Parse the inventory updates from the raw data
const rawUpdates = `186840Z	1
554054S	0
6657586	0
169836J	0
912918G	0`;  // ... (truncated for example)

// Parse the raw data into an array of updates
const inventoryUpdates = rawUpdates
  .split('\n')
  .map(line => {
    const [sku, quantity] = line.trim().split('\t');
    return {
      sku: sku.trim(),
      quantity: parseInt(quantity) || 0
    };
  })
  .filter(update => update.sku && !isNaN(update.quantity));

async function getLocationId() {
  try {
    const response = await shopify.get('/locations.json');
    const activeLocation = response.data.locations.find(loc => loc.active);
    if (!activeLocation) {
      throw new Error('No active location found');
    }
    return activeLocation.id;
  } catch (error) {
    console.error('Error fetching location:', error.response?.data || error.message);
    throw error;
  }
}

async function getVariantBySKU(sku) {
  try {
    const response = await shopify.get(`/variants.json?sku=${encodeURIComponent(sku)}`);
    if (response.data.variants && response.data.variants.length > 0) {
      return response.data.variants[0];
    }
    return null;
  } catch (error) {
    console.error(`Error getting variant for SKU ${sku}:`, error.response?.data || error.message);
    return null;
  }
}

async function enableInventoryTracking(variantId) {
  try {
    console.log(`Enabling inventory tracking for variant ${variantId}...`);
    const response = await shopify.put(`/variants/${variantId}.json`, {
      variant: {
        id: variantId,
        inventory_management: 'shopify',
        inventory_policy: 'deny'  // deny selling when out of stock
      }
    });
    
    const variant = response.data.variant;
    console.log(`Inventory tracking ${variant.inventory_management === 'shopify' ? 'enabled' : 'failed'}`);
    return variant;
  } catch (error) {
    console.error('Error enabling inventory tracking:', error.response?.data || error.message);
    return null;
  }
}

async function setInventoryLevel(inventoryItemId, locationId, quantity) {
  try {
    const response = await shopify.post('/inventory_levels/set.json', {
      location_id: locationId,
      inventory_item_id: inventoryItemId,
      available: quantity
    });
    return response.data.inventory_level;
  } catch (error) {
    console.error('Error setting inventory:', error.response?.data || error.message);
    return null;
  }
}

async function updateInventory() {
  try {
    console.log(`Starting bulk inventory update for ${inventoryUpdates.length} SKUs...\n`);

    // Get location ID first
    const locationId = await getLocationId();
    console.log('Using location ID:', locationId);

    // Process SKUs in batches to avoid rate limits
    const batchSize = 10;
    const results = [];
    
    for (let i = 0; i < inventoryUpdates.length; i += batchSize) {
      const batch = inventoryUpdates.slice(i, i + batchSize);
      console.log(`\nProcessing batch ${i/batchSize + 1} of ${Math.ceil(inventoryUpdates.length/batchSize)}`);
      
      // Process each SKU in the batch
      await Promise.all(batch.map(async (update) => {
        console.log(`\nProcessing SKU: ${update.sku}`);
        
        // Get variant info
        const variant = await getVariantBySKU(update.sku);
        
        if (variant) {
          console.log(`Found variant: ${variant.title}`);
          console.log(`Current inventory: ${variant.inventory_quantity}`);
          console.log(`Inventory tracking: ${variant.inventory_management || 'disabled'}`);
          
          // Enable inventory tracking if not already enabled
          if (variant.inventory_management !== 'shopify') {
            const updatedVariant = await enableInventoryTracking(variant.id);
            if (!updatedVariant) {
              console.log('✗ Failed to enable inventory tracking');
              results.push({
                sku: update.sku,
                status: 'error',
                message: 'Failed to enable inventory tracking'
              });
              return;
            }
          }
          
          // Update inventory
          const result = await setInventoryLevel(variant.inventory_item_id, locationId, update.quantity);
          
          if (result) {
            console.log(`✓ Updated inventory to ${update.quantity}`);
            results.push({
              sku: update.sku,
              status: 'success',
              quantity: update.quantity
            });
          } else {
            console.log('✗ Failed to update inventory');
            results.push({
              sku: update.sku,
              status: 'error',
              message: 'Failed to set inventory level'
            });
          }
        } else {
          console.log('✗ Variant not found');
          results.push({
            sku: update.sku,
            status: 'error',
            message: 'Variant not found'
          });
        }
      }));
      
      // Add a small delay between batches to avoid rate limits
      if (i + batchSize < inventoryUpdates.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Print summary
    console.log('\n=== Update Summary ===');
    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    
    console.log(`\nSuccessfully updated: ${successCount}`);
    console.log(`Failed to update: ${errorCount}`);
    
    // Log errors for investigation
    if (errorCount > 0) {
      console.log('\nFailed updates:');
      results
        .filter(r => r.status === 'error')
        .forEach(result => {
          console.log(`SKU ${result.sku}: ${result.message}`);
        });
    }
    
  } catch (error) {
    console.error('Error in bulk update:', error.response?.data || error.message);
  }
}

// Start the update process
updateInventory();
