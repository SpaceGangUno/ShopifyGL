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

// Test with the item we know has tracking enabled
const inventory = [
  { sku: '6298332', size: 'L-34', quantity: 2, title: 'Multi Cargo Pocket (Qdl-2435)' }
];

async function getLocationId() {
  try {
    const response = await shopify.get('/locations.json');
    console.log('Location Response:', JSON.stringify(response.data, null, 2));
    return response.data.locations[0].id;
  } catch (error) {
    console.error('Error fetching location:', error.response?.data || error.message);
    throw error;
  }
}

async function findVariantBySKU(sku) {
  try {
    console.log(`\nSearching for variant with SKU: ${sku}`);
    const response = await shopify.get(`/variants.json?sku=${encodeURIComponent(sku)}`);
    console.log('Variant Response:', JSON.stringify(response.data, null, 2));
    
    if (!response.data.variants || response.data.variants.length === 0) {
      console.log('No variant found with this SKU');
      return null;
    }
    
    const variant = response.data.variants[0];
    console.log('\nCurrent variant status:');
    console.log('- Inventory management:', variant.inventory_management);
    console.log('- Inventory policy:', variant.inventory_policy);
    console.log('- Inventory quantity:', variant.inventory_quantity);
    
    return variant;
  } catch (error) {
    console.error(`Error finding variant with SKU ${sku}:`, error.response?.data || error.message);
    return null;
  }
}

async function getProductDetails(productId) {
  try {
    console.log(`\nFetching product details for ID: ${productId}`);
    const response = await shopify.get(`/products/${productId}.json`);
    console.log('Product Response:', JSON.stringify(response.data, null, 2));
    return response.data.product;
  } catch (error) {
    console.error('Error fetching product:', error.response?.data || error.message);
    return null;
  }
}

async function getInventoryLevel(inventoryItemId, locationId) {
  try {
    console.log(`\nChecking current inventory level for item ID: ${inventoryItemId}`);
    const response = await shopify.get(`/inventory_levels.json?inventory_item_ids=${inventoryItemId}&location_ids=${locationId}`);
    console.log('Current Inventory Level:', JSON.stringify(response.data, null, 2));
    return response.data.inventory_levels[0];
  } catch (error) {
    console.error('Error checking inventory:', error.response?.data || error.message);
    return null;
  }
}

async function enableInventoryTracking(variantId) {
  try {
    console.log(`\nEnabling inventory tracking for variant ID: ${variantId}`);
    const response = await shopify.put(`/variants/${variantId}.json`, {
      variant: {
        id: variantId,
        inventory_management: 'shopify',
        inventory_policy: 'deny'  // Added inventory policy
      }
    });
    console.log('Enable Tracking Response:', JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.error('Error enabling tracking:', error.response?.data || error.message);
    return false;
  }
}

async function setInventoryLevel(inventoryItemId, locationId, quantity) {
  try {
    console.log(`\nSetting inventory level for item ID: ${inventoryItemId}`);
    console.log(`Location ID: ${locationId}`);
    console.log(`Quantity: ${quantity}`);
    
    const response = await shopify.post('/inventory_levels/set.json', {
      location_id: locationId,
      inventory_item_id: inventoryItemId,
      available: quantity
    });
    console.log('Set Inventory Response:', JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.error('Error setting inventory:', error.response?.data || error.message);
    return false;
  }
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function updateInventoryLevels() {
  try {
    console.log('=== Testing Inventory Update With Known Item ===\n');
    
    // Get location ID
    const locationId = await getLocationId();
    console.log(`Using location ID: ${locationId}\n`);

    // Process test product
    for (const item of inventory) {
      console.log(`Processing: ${item.title} (SKU: ${item.sku})`);
      console.log(`Size: ${item.size}, Quantity: ${item.quantity}`);

      try {
        // Find variant by SKU
        const variant = await findVariantBySKU(item.sku);
        
        if (!variant) {
          console.log('❌ Variant not found\n');
          continue;
        }

        // Get full product details
        const product = await getProductDetails(variant.product_id);
        if (product) {
          console.log('\nProduct tracking settings:');
          console.log('- Track quantity:', product.variants.some(v => v.inventory_management === 'shopify'));
        }

        // Check current inventory level
        const currentLevel = await getInventoryLevel(variant.inventory_item_id, locationId);
        console.log('\nCurrent inventory level:', currentLevel ? currentLevel.available : 'unknown');

        // Enable inventory tracking
        console.log('\nEnabling inventory tracking...');
        const trackingEnabled = await enableInventoryTracking(variant.id);
        if (!trackingEnabled) {
          console.log('❌ Failed to enable inventory tracking\n');
          continue;
        }

        // Wait a bit after enabling tracking
        await delay(1000);

        // Set inventory level
        console.log('\nSetting inventory level...');
        const success = await setInventoryLevel(variant.inventory_item_id, locationId, item.quantity);
        
        if (success) {
          // Verify the change
          await delay(1000);
          const newLevel = await getInventoryLevel(variant.inventory_item_id, locationId);
          console.log('\nNew inventory level:', newLevel ? newLevel.available : 'unknown');
        }

        // Wait between operations
        await delay(1000);

      } catch (error) {
        console.error(`Error processing ${item.title}:`, error.message);
      }
    }

    console.log('\nTest completed! Check the logs above for detailed API responses.');

  } catch (error) {
    console.error('\n❌ Error in update process:', error.message);
    process.exit(1);
  }
}

// Start the update process
updateInventoryLevels();
