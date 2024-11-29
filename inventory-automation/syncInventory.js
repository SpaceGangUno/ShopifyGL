require('dotenv').config();
const axios = require('axios');

if (!process.env.SHOPIFY_ACCESS_TOKEN || !process.env.SHOPIFY_SHOP_DOMAIN) {
  console.error('Error: Required environment variables are missing.');
  process.exit(1);
}

const graphqlClient = axios.create({
  baseURL: `https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/2024-01/graphql.json`,
  headers: {
    'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
    'Content-Type': 'application/json'
  }
});

async function getAllProducts() {
  const query = `
    {
      products(first: 250) {
        edges {
          node {
            id
            title
            variants(first: 10) {
              edges {
                node {
                  id
                  inventoryQuantity
                  inventoryItem {
                    id
                    tracked
                    inventoryLevels(first: 10) {
                      edges {
                        node {
                          id
                          available
                          location {
                            id
                            name
                          }
                        }
                      }
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
    const response = await graphqlClient.post('', { query });
    return response.data.data.products.edges;
  } catch (error) {
    console.error('Error fetching products:', error.response?.data || error.message);
    throw error;
  }
}

async function syncInventoryLevel(inventoryItemId, quantity) {
  const mutation = `
    mutation adjustInventory {
      inventoryAdjustQuantityAtLocation(input: {
        inventoryItemId: "${inventoryItemId}",
        locationId: "gid://shopify/Location/81825243424", # Default location ID
        availableDelta: ${quantity}
      }) {
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

  try {
    const response = await graphqlClient.post('', { query: mutation });
    return response.data.data;
  } catch (error) {
    console.error(`Failed to sync inventory:`, error.response?.data || error.message);
    throw error;
  }
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function syncAllInventory() {
  try {
    console.log('=== Syncing Inventory Between Online and POS ===');
    
    // Get all products
    console.log('Fetching all products...');
    const products = await getAllProducts();
    console.log(`Found ${products.length} products`);

    let successCount = 0;
    let errorCount = 0;

    // Process each product
    for (const { node: product } of products) {
      console.log(`\nProcessing: ${product.title}`);
      
      for (const { node: variant } of product.variants.edges) {
        try {
          const inventoryItem = variant.inventoryItem;
          
          if (inventoryItem.tracked) {
            const onlineQuantity = variant.inventoryQuantity;
            const posLevels = inventoryItem.inventoryLevels.edges;
            
            // Check if POS inventory level exists and differs
            const posLevel = posLevels.find(edge => 
              edge.node.location.id === 'gid://shopify/Location/81825243424'
            );
            
            if (!posLevel || posLevel.node.available !== onlineQuantity) {
              console.log(`Syncing inventory for variant - Current: ${onlineQuantity}`);
              
              // Set POS inventory to match online
              await syncInventoryLevel(inventoryItem.id, onlineQuantity);
              console.log('✓ Inventory synchronized');
              successCount++;
            } else {
              console.log('✓ Inventory already in sync');
              successCount++;
            }
          } else {
            console.log('- Variant not tracked, skipping');
          }
          
          await delay(500); // Respect rate limits
        } catch (error) {
          console.error(`Error processing variant:`, error.message);
          errorCount++;
          await delay(1000); // Wait longer after an error
        }
      }
    }

    console.log('\n=== Inventory Sync Summary ===');
    console.log(`Successfully synced: ${successCount} variants`);
    console.log(`Errors encountered: ${errorCount}`);
    console.log('\nInventory sync completed! ✨');

  } catch (error) {
    console.error('\n❌ Error in sync process:', error.message);
    process.exit(1);
  }
}

syncAllInventory();
