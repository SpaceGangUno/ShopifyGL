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

async function getLocationId() {
  try {
    const response = await shopify.get('/locations.json');
    return response.data.locations[0].id;
  } catch (error) {
    console.error('Error fetching location:', error.response?.data || error.message);
    throw error;
  }
}

async function setInventoryLevel(inventoryItemId, locationId, quantity) {
  try {
    await shopify.post('/inventory_levels/set.json', {
      location_id: locationId,
      inventory_item_id: inventoryItemId,
      available: quantity
    });
    console.log(`✓ Set inventory level to ${quantity}`);
  } catch (error) {
    console.error('Error setting inventory:', error.response?.data || error.message);
    throw error;
  }
}

async function updateInventory() {
  try {
    console.log('=== Updating Beast 3/4 Sleeve F-Terry Cropped Tee Inventory ===');
    
    // Get location ID
    console.log('Fetching location...');
    const locationId = await getLocationId();
    console.log(`Using location ID: ${locationId}`);

    // Search for the product
    console.log('\nFetching product...');
    const title = encodeURIComponent('"Beast" 3/4 Sleeve F-Terry Cropped Tee - Black (T1211)');
    const response = await shopify.get(`/products.json?title=${title}`);
    
    console.log('Products found:', response.data.products.length);
    const product = response.data.products[0];

    if (!product) {
      throw new Error('Product not found');
    }

    console.log(`Found product: ${product.title}`);

    // Define the quantities for each size
    const quantities = {
      'M': 3,
      'L': 3,
      'XL': 3
    };

    // Update each variant
    for (const variant of product.variants) {
      const size = variant.title;
      if (quantities[size] !== undefined) {
        console.log(`\nProcessing size ${size}:`);
        await setInventoryLevel(variant.inventory_item_id, locationId, quantities[size]);
      }
    }

    console.log('\nInventory update completed! ✨');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response?.data) {
      console.error('API Response:', error.response.data);
    }
    process.exit(1);
  }
}

updateInventory();
