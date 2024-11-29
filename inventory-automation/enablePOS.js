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

const graphqlClient = axios.create({
  baseURL: `https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/2024-01/graphql.json`,
  headers: {
    'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
    'Content-Type': 'application/json'
  }
});

async function getProductsWithInventory() {
  const query = `
    {
      products(first: 250) {
        edges {
          node {
            id
            title
            variants(first: 1) {
              edges {
                node {
                  inventoryQuantity
                  inventoryManagement
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
    const products = response.data.data.products.edges;
    
    // Filter products that have inventory tracking enabled and quantity > 0
    return products.filter(({ node: product }) => {
      const variant = product.variants.edges[0]?.node;
      return variant && 
             variant.inventoryManagement === 'SHOPIFY' && 
             variant.inventoryQuantity > 0;
    });
  } catch (error) {
    console.error('Error fetching products:', error.response?.data || error.message);
    throw error;
  }
}

async function enablePOSForProduct(productId) {
  try {
    await shopify.put(`/products/${productId}.json`, {
      product: {
        id: productId,
        published_scope: 'global',
        published_status: 'published',
        published_at: new Date().toISOString()
      }
    });
    return true;
  } catch (error) {
    console.error('Error enabling POS:', error.response?.data || error.message);
    return false;
  }
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function enablePOSForAllProducts() {
  try {
    console.log('=== Enabling POS for All Products with Inventory ===');
    
    // Get all products with inventory
    console.log('Fetching products with inventory...');
    const products = await getProductsWithInventory();
    console.log(`Found ${products.length} products with inventory`);

    let successCount = 0;
    let errorCount = 0;

    // Process each product
    for (const { node: product } of products) {
      try {
        console.log(`\nProcessing: ${product.title}`);
        const productId = product.id.split('/').pop(); // Extract numeric ID from GraphQL ID
        const success = await enablePOSForProduct(productId);
        
        if (success) {
          successCount++;
          console.log('✓ Enabled POS visibility');
        } else {
          errorCount++;
          console.log('✗ Failed to enable POS');
        }
        
        // Wait between operations to respect rate limits
        await delay(500);
      } catch (error) {
        console.error(`Error processing ${product.title}:`, error.message);
        errorCount++;
        await delay(1000); // Wait longer after an error
      }
    }

    console.log('\n=== POS Update Summary ===');
    console.log(`Total products processed: ${products.length}`);
    console.log(`Successfully enabled: ${successCount}`);
    console.log(`Errors encountered: ${errorCount}`);
    console.log('\nPOS update completed! ✨');

  } catch (error) {
    console.error('\n❌ Error in update process:', error.message);
    process.exit(1);
  }
}

enablePOSForAllProducts();
