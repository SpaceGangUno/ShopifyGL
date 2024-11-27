require('dotenv').config();
const axios = require('axios');

if (!process.env.SHOPIFY_ACCESS_TOKEN || !process.env.SHOPIFY_SHOP_DOMAIN) {
  console.error('Error: Required environment variables are missing.');
  console.error('Please ensure SHOPIFY_ACCESS_TOKEN and SHOPIFY_SHOP_DOMAIN are set in .env file');
  process.exit(1);
}

const COLLECTION_TITLE = 'Custom Black Friday';
const BATCH_SIZE = 50;
const RATE_LIMIT_DELAY = 500;

const shopify = axios.create({
  baseURL: `https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/2024-01/graphql.json`,
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

async function updateCollectionInventoryTracking() {
  try {
    console.log('=== Shopify Black Friday Collection Inventory Tracking Update ===');
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
    let skippedCount = 0;
    let errorCount = 0;

    for (const productEdge of collection.products.edges) {
      const product = productEdge.node;
      console.log(`\nProcessing product: ${product.title}`);

      for (const variantEdge of product.variants.edges) {
        const variant = variantEdge.node;
        const variantId = variant.id;

        try {
          if (variant.inventoryManagement !== 'SHOPIFY') {
            await updateVariantInventoryManagement(variantId);
            console.log(`✓ Updated inventory management for variant ${variantId}`);
            updatedCount++;
            await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
          } else {
            console.log(`⚡ Skipping variant ${variantId} - already using Shopify inventory management`);
            skippedCount++;
          }
        } catch (error) {
          console.error(`Failed to update variant ${variantId}`);
          errorCount++;
        }
      }
    }

    console.log('\n=== Inventory Update Summary ===');
    console.log(`Variants updated: ${updatedCount}`);
    console.log(`Variants skipped: ${skippedCount}`);
    console.log(`Errors encountered: ${errorCount}`);
    console.log('Process completed! ✨');

  } catch (error) {
    console.error('\n❌ Error in update process:', error.message);
    process.exit(1);
  }
}

updateCollectionInventoryTracking();
