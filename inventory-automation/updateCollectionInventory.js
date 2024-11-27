require('dotenv').config();
const axios = require('axios');

if (!process.env.SHOPIFY_ACCESS_TOKEN || !process.env.SHOPIFY_SHOP_DOMAIN) {
  console.error('Error: Required environment variables are missing.');
  process.exit(1);
}

// GraphQL API client
const shopifyGraphQL = axios.create({
  baseURL: `https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/2024-01/graphql.json`,
  headers: {
    'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
    'Content-Type': 'application/json'
  }
});

// REST API client
const shopifyRest = axios.create({
  baseURL: `https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/2024-01`,
  headers: {
    'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
    'Content-Type': 'application/json'
  }
});

async function getCollectionProducts() {
  try {
    const query = `
      {
        collections(first: 1, query: "title:'Custom Black Friday'") {
          edges {
            node {
              id
              products(first: 250) {
                edges {
                  node {
                    id
                    title
                    variants(first: 10) {
                      edges {
                        node {
                          id
                          title
                          inventoryItem {
                            id
                            inventoryLevels(first: 1) {
                              edges {
                                node {
                                  id
                                  available
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
        }
      }
    `;

    const response = await shopifyGraphQL.post('', { query });
    const collection = response.data.data.collections.edges[0]?.node;
    
    if (!collection) {
      throw new Error('Collection not found');
    }

    return collection.products.edges.map(edge => ({
      id: edge.node.id,
      title: edge.node.title,
      variants: edge.node.variants.edges.map(v => ({
        id: v.node.id,
        title: v.node.title,
        inventoryItemId: v.node.inventoryItem.id.split('/').pop()
      }))
    }));
  } catch (error) {
    console.error('Error fetching products:', error.response?.data || error.message);
    throw error;
  }
}

async function getLocationId() {
  try {
    const response = await shopifyRest.get('/locations.json');
    return response.data.locations[0].id;
  } catch (error) {
    console.error('Error fetching location:', error.response?.data || error.message);
    throw error;
  }
}

async function enableInventoryTracking(variantId) {
  try {
    const mutation = `
      mutation {
        productVariantUpdate(input: {
          id: "${variantId}",
          inventoryManagement: SHOPIFY
        }) {
          productVariant {
            id
            inventoryManagement
          }
          userErrors {
            field
            message
          }
        }
      }
    `;
    
    await shopifyGraphQL.post('', { query: mutation });
    console.log('✓ Enabled inventory tracking');
  } catch (error) {
    console.error('Error enabling tracking:', error.response?.data || error.message);
    throw error;
  }
}

async function setInventoryLevel(inventoryItemId, locationId) {
  try {
    // Set to exactly 1
    await shopifyRest.post('/inventory_levels/set.json', {
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

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function updateCollectionInventory() {
  try {
    console.log('=== Updating Custom Black Friday Collection Inventory ===');
    
    // Get all products in collection
    console.log('Fetching products...');
    const products = await getCollectionProducts();
    console.log(`Found ${products.length} products in collection`);

    // Get the location ID
    console.log('\nFetching location...');
    const locationId = await getLocationId();
    console.log(`Using location ID: ${locationId}`);

    let successCount = 0;
    let errorCount = 0;
    let variantCount = 0;

    // Process each product
    for (const product of products) {
      console.log(`\n=== Processing product: ${product.title} ===`);

      // Process each variant
      for (const variant of product.variants) {
        try {
          console.log(`\nProcessing variant: ${variant.title}`);
          variantCount++;

          // Enable inventory tracking
          console.log('Enabling inventory tracking...');
          await enableInventoryTracking(variant.id);
          await delay(1000); // Wait 1 second between operations

          // Set inventory level
          console.log('Setting inventory level...');
          await setInventoryLevel(variant.inventoryItemId, locationId);
          await delay(1000); // Wait 1 second between operations

          successCount++;
          console.log('✓ Successfully updated variant');

        } catch (error) {
          console.error(`Error processing variant ${variant.title}:`, error.message);
          errorCount++;
          await delay(2000); // Wait longer after an error
        }
      }

      // Wait between products
      await delay(1000);
    }

    console.log('\n=== Inventory Update Summary ===');
    console.log(`Total products processed: ${products.length}`);
    console.log(`Total variants processed: ${variantCount}`);
    console.log(`Successfully updated: ${successCount}`);
    console.log(`Errors encountered: ${errorCount}`);
    console.log('\nInventory update completed! ✨');

  } catch (error) {
    console.error('\n❌ Error in update process:', error.message);
    process.exit(1);
  }
}

updateCollectionInventory();
