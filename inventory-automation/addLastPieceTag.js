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
const LAST_PIECE_TAG = 'Last Piece';

const shopify = axios.create({
  baseURL: `https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/${API_VERSION}/graphql.json`,
  headers: {
    'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
    'Content-Type': 'application/json'
  }
});

async function getProducts(cursor = null) {
  const query = `
    {
      products(first: ${BATCH_SIZE}${cursor ? `, after: "${cursor}"` : ''}) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            title
            tags
            status
            variants(first: 100) {
              edges {
                node {
                  id
                  inventoryQuantity
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
    return response.data.data.products;
  } catch (error) {
    console.error('GraphQL Error:', error.response?.data || error.message);
    throw error;
  }
}

async function updateProductTags(productId, tags, shouldAdd) {
  const mutation = `
    mutation productUpdate {
      productUpdate(input: {
        id: "${productId}",
        tags: ${JSON.stringify(tags)}
      }) {
        product {
          id
          tags
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
    console.error(`Failed to update tags for product ${productId}:`, error.response?.data || error.message);
    throw error;
  }
}

async function updateProductStatus(productId, status) {
  const mutation = `
    mutation productUpdate {
      productUpdate(input: {
        id: "${productId}",
        status: ${status}
      }) {
        product {
          id
          status
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
    console.error(`Failed to update status for product ${productId}:`, error.response?.data || error.message);
    throw error;
  }
}

async function processProducts() {
  try {
    console.log('=== Shopify Product Status and Tag Update ===');
    console.log(`Connected to shop: ${process.env.SHOPIFY_SHOP_DOMAIN}\n`);

    let hasNextPage = true;
    let cursor = null;
    let processedCount = 0;
    let taggedCount = 0;
    let untaggedCount = 0;
    let draftedCount = 0;
    let activatedCount = 0;
    let errorCount = 0;

    while (hasNextPage) {
      const productsData = await getProducts(cursor);
      hasNextPage = productsData.pageInfo.hasNextPage;
      cursor = productsData.pageInfo.endCursor;

      for (const productEdge of productsData.edges) {
        const product = productEdge.node;
        processedCount++;

        try {
          // Calculate total quantity across all variants
          const totalQuantity = product.variants.edges.reduce((sum, variantEdge) => {
            return sum + (variantEdge.node.inventoryQuantity || 0);
          }, 0);

          // Handle status update
          if (totalQuantity === 0 && product.status !== 'DRAFT') {
            await updateProductStatus(product.id, 'DRAFT');
            console.log(`✓ Set to DRAFT: ${product.title} (No inventory)`);
            draftedCount++;
          } else if (totalQuantity > 0 && product.status === 'DRAFT') {
            await updateProductStatus(product.id, 'ACTIVE');
            console.log(`✓ Set to ACTIVE: ${product.title} (Has inventory)`);
            activatedCount++;
          }

          // Handle tag update
          const currentTags = product.tags || [];
          const hasLastPieceTag = currentTags.includes(LAST_PIECE_TAG);
          const shouldHaveTag = totalQuantity > 0 && totalQuantity <= 2;

          if (shouldHaveTag && !hasLastPieceTag) {
            // Add tag
            const newTags = [...currentTags, LAST_PIECE_TAG];
            await updateProductTags(product.id, newTags, true);
            console.log(`✓ Added "${LAST_PIECE_TAG}" tag to: ${product.title} (Quantity: ${totalQuantity})`);
            taggedCount++;
          } else if (!shouldHaveTag && hasLastPieceTag) {
            // Remove tag
            const newTags = currentTags.filter(tag => tag !== LAST_PIECE_TAG);
            await updateProductTags(product.id, newTags, false);
            console.log(`✓ Removed "${LAST_PIECE_TAG}" tag from: ${product.title} (Quantity: ${totalQuantity})`);
            untaggedCount++;
          }

          await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
        } catch (error) {
          console.error(`Failed to process product ${product.title}:`, error.message);
          errorCount++;
        }
      }
    }

    console.log('\n=== Update Summary ===');
    console.log(`Products processed: ${processedCount}`);
    console.log(`Products tagged with "${LAST_PIECE_TAG}": ${taggedCount}`);
    console.log(`Tags removed: ${untaggedCount}`);
    console.log(`Products set to DRAFT: ${draftedCount}`);
    console.log(`Products set to ACTIVE: ${activatedCount}`);
    console.log(`Errors encountered: ${errorCount}`);
    console.log('Process completed! ✨');

  } catch (error) {
    console.error('\n❌ Error in update process:', error.message);
    process.exit(1);
  }
}

processProducts();
