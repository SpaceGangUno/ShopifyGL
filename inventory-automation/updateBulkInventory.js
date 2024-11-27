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

// The variants we need to update
const variantSizes = [
  { size: 'S-30', quantity: 2 },
  { size: 'M-32', quantity: 2 },
  { size: 'L-34', quantity: 2 },
  { size: 'XL-36', quantity: 2 },
  { size: 'XXL-38', quantity: 2 },
  { size: 'XXXL-40', quantity: 2 },
  { size: 'XXXXL-42', quantity: 2 }
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

async function searchProducts() {
  try {
    console.log('\nSearching for products...');
    const response = await shopify.get('/products.json?limit=250');
    
    // Log all products and their variants to help identify the correct one
    console.log('\nAll Products:');
    response.data.products.forEach(product => {
      console.log(`\nProduct: ${product.title}`);
      console.log('Variants:');
      product.variants.forEach(variant => {
        console.log(`- Title: ${variant.title}`);
        console.log(`  SKU: ${variant.sku}`);
        console.log(`  Inventory Management: ${variant.inventory_management}`);
        console.log(`  Inventory Quantity: ${variant.inventory_quantity}`);
      });
    });
    
    return response.data.products;
  } catch (error) {
    console.error('Error searching products:', error.response?.data || error.message);
    return [];
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
    console.log('=== Listing All Products and Variants ===\n');
    
    // Get location ID
    const locationId = await getLocationId();
    console.log(`Using location ID: ${locationId}\n`);

    // Get all products first
    const products = await searchProducts();
    
    console.log('\nPlease check the product list above and provide the correct product ID to update.');

  } catch (error) {
    console.error('\n❌ Error in process:', error.message);
    process.exit(1);
  }
}

// Start the process
updateInventoryLevels();
