require('dotenv').config();
const axios = require('axios');

const shopify = axios.create({
  baseURL: `https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/2024-01/graphql.json`,
  headers: {
    'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
    'Content-Type': 'application/json'
  }
});

async function verifyInventory(sku) {
  const query = `
    query getVariantBySKU($query: String!) {
      productVariants(first: 1, query: $query) {
        edges {
          node {
            id
            sku
            inventoryItem {
              id
              inventoryLevels(first: 1) {
                edges {
                  node {
                    id
                    available
                    location {
                      id
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await shopify.post('', {
      query,
      variables: {
        query: `sku:${sku}`
      }
    });

    const variants = response.data.data.productVariants.edges;
    if (variants.length > 0) {
      const variant = variants[0].node;
      const inventoryLevel = variant.inventoryItem.inventoryLevels.edges[0]?.node;
      if (inventoryLevel) {
        console.log(`SKU: ${sku} - Current inventory: ${inventoryLevel.available}`);
        return inventoryLevel.available;
      }
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
