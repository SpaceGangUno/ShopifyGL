require('dotenv').config();
const axios = require('axios');

if (!process.env.SHOPIFY_ACCESS_TOKEN || !process.env.SHOPIFY_SHOP_DOMAIN) {
  console.error('Error: Required environment variables are missing.');
  process.exit(1);
}

const shopifyGraphQL = axios.create({
  baseURL: `https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/2024-01/graphql.json`,
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
                          price
                          compareAtPrice
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
        price: v.node.price,
        compareAtPrice: v.node.compareAtPrice
      }))
    }));
  } catch (error) {
    console.error('Error fetching products:', error.response?.data || error.message);
    throw error;
  }
}

async function removeSalePrice(variantId) {
  try {
    const mutation = `
      mutation {
        productVariantUpdate(input: {
          id: "${variantId}",
          compareAtPrice: null
        }) {
          productVariant {
            id
            price
            compareAtPrice
          }
          userErrors {
            field
            message
          }
        }
      }
    `;
    
    const response = await shopifyGraphQL.post('', { query: mutation });
    const result = response.data.data.productVariantUpdate;
    
    if (result.userErrors.length > 0) {
      throw new Error(result.userErrors[0].message);
    }
    
    return result.productVariant;
  } catch (error) {
    console.error('Error removing sale price:', error.response?.data || error.message);
    throw error;
  }
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function removeSalePrices() {
  try {
    console.log('=== Removing Sale Prices from Custom Black Friday Collection ===');
    
    // Get all products in collection
    console.log('Fetching products...');
    const products = await getCollectionProducts();
    console.log(`Found ${products.length} products in collection`);

    let successCount = 0;
    let errorCount = 0;
    let variantCount = 0;
    let salePricesRemoved = 0;

    // Process each product
    for (const product of products) {
      console.log(`\n=== Processing product: ${product.title} ===`);

      // Process each variant
      for (const variant of product.variants) {
        try {
          console.log(`\nProcessing variant: ${variant.title}`);
          variantCount++;

          if (variant.compareAtPrice) {
            console.log(`Found sale price: Regular $${variant.price}, Sale $${variant.compareAtPrice}`);
            console.log('Removing sale price...');
            await removeSalePrice(variant.id);
            console.log('✓ Sale price removed');
            salePricesRemoved++;
          } else {
            console.log('No sale price found');
          }

          successCount++;
          await delay(500); // Wait 0.5 second between operations

        } catch (error) {
          console.error(`Error processing variant ${variant.title}:`, error.message);
          errorCount++;
          await delay(2000); // Wait longer after an error
        }
      }

      // Wait between products
      await delay(1000);
    }

    console.log('\n=== Price Update Summary ===');
    console.log(`Total products processed: ${products.length}`);
    console.log(`Total variants processed: ${variantCount}`);
    console.log(`Sale prices removed: ${salePricesRemoved}`);
    console.log(`Successfully processed: ${successCount}`);
    console.log(`Errors encountered: ${errorCount}`);
    console.log('\nPrice update completed! ✨');

  } catch (error) {
    console.error('\n❌ Error in update process:', error.message);
    process.exit(1);
  }
}

removeSalePrices();
