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

// Test with a single product first
const inventory = [
  { sku: '6298332', size: 'L-34', quantity: 2, title: 'Multi Cargo Pocket (Qdl-2435)' }
];

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

async function findProductBySKU(sku) {
  try {
    console.log(`\nSearching for product with SKU: ${sku}`);
    
    // Get all products (paginate if necessary)
    const response = await shopify.get('/products.json?limit=250');
    console.log(`Found ${response.data.products.length} products`);
    
    // Search through all variants of all products
    for (const product of response.data.products) {
      console.log(`\nChecking product: ${product.title}`);
      console.log('Variants:', product.variants.map(v => ({ sku: v.sku, title: v.title })));
      
      const variant = product.variants.find(v => v.sku === sku);
      if (variant) {
        console.log('\nFound matching variant:', {
          product_title: product.title,
          variant_title: variant.title,
          sku: variant.sku,
          inventory_management: variant.inventory_management,
          inventory_quantity: variant.inventory_quantity
        });
        return { product, variant };
      }
    }
    
    console.log('\nNo product found with this SKU');
    return null;
  } catch (error) {
    console.error('Error searching products:', error.response?.data || error.message);
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
        inventory_policy: 'deny'
      }
    });
    console.log('Inventory tracking enabled:', response.data.variant.inventory_management === 'shopify');
    return response.data.variant;
  } catch (error) {
    console.error('Error enabling tracking:', error.response?.data || error.message);
    return null;
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
    
    console.log('Inventory level set:', response.data.inventory_level);
    return response.data.inventory_level;
  } catch (error) {
    console.error('Error setting inventory:', error.response?.data || error.message);
    return null;
  }
}

async function verifyInventoryLevel(inventoryItemId, locationId) {
  try {
    console.log(`\nVerifying inventory level for item ID: ${inventoryItemId}`);
    const response = await shopify.get(`/inventory_levels.json?inventory_item_ids=${inventoryItemId}&location_ids=${locationId}`);
    const level = response.data.inventory_levels[0];
    console.log('Current inventory level:', level ? level.available : 'unknown');
    return level;
  } catch (error) {
    console.error('Error verifying inventory:', error.response?.data || error.message);
    return null;
  }
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function updateInventoryLevels() {
  try {
    console.log('=== Testing Inventory Update With Single Product ===\n');
    
    // Get location ID
    const locationId = await getLocationId();
    console.log(`Using location ID: ${locationId}\n`);

    // Process test product
    for (const item of inventory) {
      console.log(`Processing: ${item.title} (SKU: ${item.sku})`);
      console.log(`Size: ${item.size}, Quantity: ${item.quantity}`);

      try {
        // Find product and variant by SKU
        const result = await findProductBySKU(item.sku);
        if (!result) {
          console.log('❌ Product/variant not found\n');
          continue;
        }

        const { product, variant } = result;

        // Enable inventory tracking
        console.log('\nEnabling inventory tracking...');
        const updatedVariant = await enableInventoryTracking(variant.id);
        if (!updatedVariant) {
          console.log('❌ Failed to enable inventory tracking\n');
          continue;
        }

        // Wait a bit after enabling tracking
        await delay(1000);

        // Set inventory level
        console.log('\nSetting inventory level...');
        const inventoryUpdate = await setInventoryLevel(variant.inventory_item_id, locationId, item.quantity);
        
        if (inventoryUpdate) {
          // Verify the inventory level was set correctly
          await delay(1000);
          const verification = await verifyInventoryLevel(variant.inventory_item_id, locationId);
          
          if (verification && verification.available === item.quantity) {
            console.log('✓ Update completed and verified successfully\n');
          } else {
            console.log('❌ Update completed but verification failed\n');
            console.log('Expected quantity:', item.quantity);
            console.log('Actual quantity:', verification ? verification.available : 'unknown');
          }
        } else {
          console.log('❌ Failed to update inventory\n');
        }

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
