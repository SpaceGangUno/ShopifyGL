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

async function getAllCollections() {
  try {
    // Get both smart collections and custom collections
    const [smartResponse, customResponse] = await Promise.all([
      shopify.get('/smart_collections.json'),
      shopify.get('/custom_collections.json')
    ]);

    return [
      ...smartResponse.data.smart_collections,
      ...customResponse.data.custom_collections
    ];
  } catch (error) {
    console.error('Error fetching collections:', error.response?.data || error.message);
    throw error;
  }
}

async function getCollectionProducts(collectionId) {
  try {
    const response = await shopify.get(`/collections/${collectionId}/products.json?limit=250`);
    return response.data.products;
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
    console.log('✓ Enabled POS visibility');
  } catch (error) {
    console.error('Error enabling POS:', error.response?.data || error.message);
    throw error;
  }
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function enablePOSForCollection() {
  try {
    console.log('=== Enabling POS for Custom Black Friday Collection ===');
    
    // First get all collections
    console.log('Fetching collections...');
    const collections = await getAllCollections();
    console.log('Available collections:');
    collections.forEach(c => console.log(`- ${c.title} (ID: ${c.id})`));

    // Find the Custom Black Friday collection
    const collection = collections.find(c => c.title === 'Custom Black Friday');

    if (!collection) {
      throw new Error('Custom Black Friday collection not found');
    }

    console.log(`\nFound collection: ${collection.title} (ID: ${collection.id})`);

    // Get products in collection
    console.log('\nFetching products...');
    const products = await getCollectionProducts(collection.id);
    console.log(`Found ${products.length} products in collection`);

    let successCount = 0;
    let errorCount = 0;

    // Process each product
    for (const product of products) {
      try {
        console.log(`\nProcessing: ${product.title}`);
        await enablePOSForProduct(product.id);
        successCount++;
        
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

enablePOSForCollection();
