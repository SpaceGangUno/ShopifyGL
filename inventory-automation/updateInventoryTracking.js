require('dotenv').config();
const axios = require('axios');

if (!process.env.SHOPIFY_ACCESS_TOKEN || !process.env.SHOPIFY_SHOP_DOMAIN) {
  console.error('Error: Required environment variables are missing.');
  console.error('Please ensure SHOPIFY_ACCESS_TOKEN and SHOPIFY_SHOP_DOMAIN are set in .env file');
  process.exit(1);
}

const API_VERSION = '2024-01';
const BATCH_SIZE = 50;
const RATE_LIMIT_DELAY = 500;
const COLLECTION_TITLE = 'Custom Black Friday';

const shopify = axios.create({
  baseURL: `https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/${API_VERSION}/graphql.json`,
  headers: {
    'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
    'Content-Type': 'application/json'
  }
});

async function getCollectionProducts() {
  const query = `
    {
      collections(first: 250, query: "title:'${COLLECTION_TITLE}'") {
        edges {
          node {
            id
            title
            products(first: ${BATCH_SIZE}) {
              edges {
                node {
                  id
                  title
                  variants(first: 10) {
                    edges {
                      node {
                        id
                        inventoryManagement
                        inventoryItem {
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
      }
    }
  `;

  try {
    const response = await shopify.post('', { query });
    return response.data.data;
  } catch (error) {
    console.error('GraphQL Error:', error.response?.data || error.message);
    throw error;
  }
}

async function setInventoryLevel(inventoryItemId) {
  const mutation = `
    mutation adjustInventory {
      inventoryAdjustQuantity(input: {
        inventoryItemId: "${inventoryItemId}",
        availableDelta: 1
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
    const response = await shopify.post('', { query: mutation });
    return response.data.data;
  } catch (error) {
    console.error(`Failed to set inventory:`, error.response?.data || error.message);
    throw error;
  }
}

async function updateVariantInventoryManagement(variantId) {
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

  try {
    const response = await shopify.post('', { query: mutation });
    return response.data.data;
  } catch (error) {
    console.error(`Failed to update variant ${variantId}:`, error.response?.data || error.message);
    throw error;
  }
}

async function updateCollectionInventory() {
  try {
    console.log('=== Shopify Black Friday Collection Inventory Update ===');
    console.log(`Connected to shop: ${process.env.SHOPIFY_SHOP_DOMAIN}`);
    console.log(`\nFetching collection "${COLLECTION_TITLE}" and its products...`);

    const data = await getCollectionProducts();
    const collections = data.collections.edges;

    if (collections.length === 0) {
      console.error(`Collection "${COLLECTION_TITLE}" not found`);
      return;
    }

    const collection = collections[0].node;
    console.log(`Found collection: ${collection.title}`);

    let updatedCount = 0;
    let errorCount = 0;

    for (const productEdge of collection.products.edges) {
      const product = productEdge.node;
      console.log(`\nProcessing product: ${product.title}`);

      for (const variantEdge of product.variants.edges) {
        const variant = variantEdge.node;
        const variantId = variant.id;
        const inventoryItemId = variant.inventoryItem.id;

        try {
          // First ensure inventory tracking is enabled
          await updateVariantInventoryManagement(variantId);
          console.log(`✓ Updated inventory management for variant ${variantId}`);

          // Then set inventory to 1
          await setInventoryLevel(inventoryItemId);
          console.log(`✓ Set inventory quantity to 1 for variant ${variantId}`);
          
          updatedCount++;
          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
        } catch (error) {
          console.error(`Failed to update variant ${variantId}`);
          errorCount++;
        }
      }
    }

    console.log('\n=== Inventory Update Summary ===');
    console.log(`Variants updated: ${updatedCount}`);
    console.log(`Errors encountered: ${errorCount}`);
    console.log('Process completed! ✨');

  } catch (error) {
    console.error('\n❌ Error in update process:', error.message);
    process.exit(1);
  }
}

updateCollectionInventory();
