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

async function getProduct() {
  try {
    const response = await shopify.get('/products.json?title=Melton/Pu Varsity Jackets W/ Tapestry Patches - Black (642-552)');
    return response.data.products[0];
  } catch (error) {
    console.error('Error fetching product:', error.response?.data || error.message);
    throw error;
  }
}

async function getInventoryItemId(variantId) {
  try {
    const response = await shopify.get(`/variants/${variantId}.json`);
    return response.data.variant.inventory_item_id;
  } catch (error) {
    console.error('Error fetching inventory item ID:', error.response?.data || error.message);
    throw error;
  }
}

async function getLocationId() {
  try {
    const response = await shopify.get('/locations.json');
    return response.data.locations[0].id;
  } catch (error) {
    console.error('Error fetching location:', error.response?.data || error.message);
    throw error;
  }
}

async function enableInventoryTracking(variantId) {
  try {
    await shopify.put(`/variants/${variantId}.json`, {
      variant: {
        id: variantId,
        inventory_management: 'shopify'
      }
    });
    console.log('✓ Enabled inventory tracking');
  } catch (error) {
    console.error('Error enabling tracking:', error.response?.data || error.message);
    throw error;
  }
}

async function setInventoryLevel(inventoryItemId, locationId) {
  try {
    // First adjust to 0 to ensure clean state
    await shopify.post('/inventory_levels/adjust.json', {
      location_id: locationId,
      inventory_item_id: inventoryItemId,
      available_adjustment: -999999 // Set to large negative number to ensure it goes to 0
    });

    // Then set to exactly 1
    await shopify.post('/inventory_levels/set.json', {
      location_id: locationId,
      inventory_item_id: inventoryItemId,
      available: 1
    });
    console.log('✓ Set inventory level to 1');
  } catch (error) {
    console.error('Error setting inventory:', error.response?.data || error.message);
    throw error;
  }
}

async function verifyInventoryLevel(inventoryItemId, locationId) {
  try {
    const response = await shopify.get(`/inventory_levels.json?inventory_item_ids=${inventoryItemId}&location_ids=${locationId}`);
    const level = response.data.inventory_levels[0];
    console.log(`Current inventory level: ${level.available}`);
    return level.available;
  } catch (error) {
    console.error('Error verifying inventory:', error.response?.data || error.message);
    throw error;
  }
}

async function updateProductInventory() {
  try {
    console.log('=== Updating Product Inventory ===');
    
    // Get the product
    console.log('Fetching product...');
    const product = await getProduct();
    if (!product) {
      console.error('Product not found');
      return;
    }
    console.log(`Found product: ${product.title}`);

    // Get the location ID
    console.log('\nFetching location...');
    const locationId = await getLocationId();
    console.log(`Using location ID: ${locationId}`);

    // Process each variant
    for (const variant of product.variants) {
      console.log(`\nProcessing variant: ${variant.title}`);

      // Enable inventory tracking
      console.log('Enabling inventory tracking...');
      await enableInventoryTracking(variant.id);

      // Get inventory item ID
      console.log('Getting inventory item ID...');
      const inventoryItemId = await getInventoryItemId(variant.id);

      // Set inventory level
      console.log('Setting inventory level...');
      await setInventoryLevel(inventoryItemId, locationId);

      // Verify inventory level
      console.log('Verifying inventory level...');
      const currentLevel = await verifyInventoryLevel(inventoryItemId, locationId);
      if (currentLevel !== 1) {
        console.warn(`⚠️ Warning: Inventory level is ${currentLevel}, expected 1`);
      }

      // Wait between operations
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\nInventory update completed! ✨');

  } catch (error) {
    console.error('\n❌ Error in update process:', error.message);
    process.exit(1);
  }
}

updateProductInventory();
