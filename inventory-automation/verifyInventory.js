require('dotenv').config();
const axios = require('axios');

const shopify = axios.create({
  baseURL: `https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/2024-01`,
  headers: {
    'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
    'Content-Type': 'application/json'
  }
});

async function verifyInventory(sku) {
  try {
    const response = await shopify.get(`/variants.json?sku=${sku}`);
    const variant = response.data.variants[0];
    if (variant) {
      const inventoryResponse = await shopify.get(`/inventory_levels.json?inventory_item_ids=${variant.inventory_item_id}`);
      const level = inventoryResponse.data.inventory_levels[0];
      console.log(`SKU: ${sku} - Current inventory: ${level.available}`);
      return level.available;
    }
    console.log(`SKU: ${sku} - Not found`);
    return null;
  } catch (error) {
    console.error(`Error checking SKU ${sku}:`, error.message);
    return null;
  }
}

// Verify all SKUs that should have quantity 1
async function main() {
  console.log('Verifying inventory levels for updated SKUs...\n');
  
  const skusToCheck = [
    'F936660',
    'R072066',
    '515917C',
    '184099K',
    '977838N',
    'A945673',
    'B136873',
    '278810M',
    '8179805',
    '778043G',
    '7117',
    '507865D'
  ];

  for (const sku of skusToCheck) {
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between checks
    await verifyInventory(sku);
  }
}

main().catch(console.error);
