require('dotenv').config();
const axios = require('axios');

const shopify = axios.create({
  baseURL: `https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/2024-01/graphql.json`,
  headers: {
    'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
    'Content-Type': 'application/json'
  }
});

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function findVariantBySKU(sku) {
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
    console.log(`Finding variant for SKU: ${sku}`);
    const response = await shopify.post('', {
      query,
      variables: {
        query: `sku:${sku}`
      }
    });

    const variants = response.data.data.productVariants.edges;
    if (variants.length === 0) {
      console.log(`No variant found for SKU: ${sku}`);
      return null;
    }

    return variants[0].node;
  } catch (error) {
    console.error(`Error finding variant for SKU ${sku}:`, error.message);
    return null;
  }
}

async function updateInventory(sku, quantity) {
  try {
    console.log(`\nProcessing SKU: ${sku}`);
    
    if (quantity === undefined || quantity === '') {
      console.log(`Skipping SKU ${sku} - no quantity specified`);
      return false;
    }

    const variant = await findVariantBySKU(sku);
    if (!variant) {
      console.log(`No variant found for SKU: ${sku}`);
      return false;
    }

    const inventoryLevel = variant.inventoryItem.inventoryLevels.edges[0]?.node;
    if (!inventoryLevel) {
      console.log(`No inventory level found for SKU: ${sku}`);
      return false;
    }

    const currentQuantity = inventoryLevel.available;
    const adjustment = parseInt(quantity) - currentQuantity;

    console.log(`Current inventory: ${currentQuantity}`);
    console.log(`Target inventory: ${quantity}`);
    console.log(`Adjustment needed: ${adjustment}`);

    if (adjustment !== 0) {
      const mutation = `
        mutation adjustInventoryLevel($input: InventoryAdjustQuantityInput!) {
          inventoryAdjustQuantity(input: $input) {
            inventoryLevel {
              available
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const response = await shopify.post('', {
        query: mutation,
        variables: {
          input: {
            inventoryLevelId: inventoryLevel.id,
            availableDelta: adjustment
          }
        }
      });

      const result = response.data.data.inventoryAdjustQuantity;
      if (result.userErrors.length > 0) {
        console.log(`Error updating inventory:`, result.userErrors);
        return false;
      }

      const newQuantity = result.inventoryLevel.available;
      console.log(`New inventory level: ${newQuantity}`);

      if (newQuantity === parseInt(quantity)) {
        console.log(`✓ Successfully updated inventory for SKU ${sku} to ${quantity}`);
        return true;
      } else {
        console.log(`! Failed to update inventory for SKU ${sku}. Expected: ${quantity}, Got: ${newQuantity}`);
        return false;
      }
    } else {
      console.log(`✓ Inventory already at correct level for SKU ${sku}: ${currentQuantity}`);
      return true;
    }
  } catch (error) {
    console.error(`Error updating inventory for SKU ${sku}:`, error.message);
    if (error.response) {
      console.error('API Error Response:', error.response.data);
    }
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
      console.error(`Error processing SKU ${item.sku}:`, error.message);
      results.push({ sku: item.sku, success: false });
    }
  }
  
  return results;
}

function parseSkuData(rawData) {
  return rawData
    .split('\n')
    .map(line => {
      const [sku, quantity] = line.trim().split('\t');
      if (!sku || sku === '') return null;
      return {
        sku,
        quantity: parseInt(quantity) || 0
      };
    })
    .filter(item => item !== null);
}

async function main() {
  console.log('Starting bulk inventory update...');
  
  const skuData = require('./sku_data.js');
  const inventoryData = parseSkuData(skuData);
  
  console.log(`Found ${inventoryData.length} SKUs to process`);
  
  const batchSize = 5;
  let totalProcessed = 0;
  let totalSuccessful = 0;
  let totalFailed = 0;
  
  for (let i = 0; i < inventoryData.length; i += batchSize) {
    const batch = inventoryData.slice(i, i + batchSize);
    
    console.log(`\nProcessing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(inventoryData.length/batchSize)}`);
    
    const results = await processBatch(batch);
    
    totalProcessed += results.length;
    totalSuccessful += results.filter(r => r.success).length;
    totalFailed += results.filter(r => !r.success).length;
    
    const progress = (totalProcessed / inventoryData.length * 100).toFixed(1);
    console.log(`\nProgress: ${progress}%`);
    console.log(`Updated: ${totalSuccessful}`);
    console.log(`Failed: ${totalFailed}`);
    console.log(`Remaining: ${inventoryData.length - totalProcessed}`);
    
    if (i + batchSize < inventoryData.length) {
      console.log('\nTaking a break between batches...');
      await sleep(30000);
    }
  }
  
  console.log('\n=== Final Summary ===');
  console.log(`Successfully updated: ${totalSuccessful} products`);
  console.log(`Failed to update: ${totalFailed} products`);
  console.log(`Total processed: ${totalProcessed} out of ${inventoryData.length}`);
}

main().catch(console.error);
