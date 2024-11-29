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

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function enableTaxForProduct(product) {
  try {
    console.log(`\nEnabling tax for product: ${product.title}`);
    console.log(`Product ID: ${product.id}`);
    console.log(`Variants: ${product.variants.length}`);
    
    // Check if tax is already enabled for all variants
    const allEnabled = product.variants.every(v => v.taxable === true);
    if (allEnabled) {
      console.log('✓ Tax charging already enabled');
      return true;
    }
    
    await sleep(1000); // Rate limit protection
    
    // Update product to enable tax for all variants
    await shopify.put(`/products/${product.id}.json`, {
      product: {
        id: product.id,
        variants: product.variants.map(v => ({
          id: v.id,
          taxable: true
        }))
      }
    });
    
    await sleep(1000); // Rate limit protection
    
    // Verify tax is enabled
    const verifyResponse = await shopify.get(`/products/${product.id}.json`);
    const verifiedProduct = verifyResponse.data.product;
    
    const verifyEnabled = verifiedProduct.variants.every(v => v.taxable === true);
    if (verifyEnabled) {
      console.log('✓ Tax charging enabled successfully');
      return true;
    } else {
      console.log('✗ Failed to enable tax charging');
      return false;
    }
    
  } catch (error) {
    if (error.response?.status === 429) {
      // If rate limited, wait and retry
      console.log('Rate limited, waiting 10 seconds...');
      await sleep(10000);
      return enableTaxForProduct(product);
    }
    
    if (error.response?.data) {
      console.error('Error enabling tax:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error enabling tax:', error.message);
    }
    return false;
  }
}

async function getAllProducts() {
  const products = [];
  let hasNextPage = true;
  let nextPageToken = null;
  
  while (hasNextPage) {
    try {
      await sleep(1000); // Rate limit protection
      
      let url = '/products.json?limit=250';
      if (nextPageToken) {
        url += `&page_info=${nextPageToken}`;
      }
      
      const response = await shopify.get(url);
      
      // Add products to our list
      products.push(...response.data.products);
      
      // Check if there's another page
      const linkHeader = response.headers['link'];
      const nextPageMatch = linkHeader ? linkHeader.match(/<[^>]*page_info=([^&>]*)[^>]*>; rel="next"/) : null;
      
      if (nextPageMatch) {
        nextPageToken = nextPageMatch[1];
        console.log(`Found ${products.length} products so far, fetching next page...`);
      } else {
        hasNextPage = false;
        console.log(`Found total of ${products.length} products`);
      }
      
    } catch (error) {
      if (error.response?.status === 429) {
        // If rate limited, wait and retry
        console.log('Rate limited while fetching products, waiting 10 seconds...');
        await sleep(10000);
        continue;
      }
      console.error('Error fetching products:', error.message);
      hasNextPage = false;
    }
  }
  
  return products;
}

async function processBatch(products, results) {
  const batchPromises = products.map(async (product) => {
    // Check if tax is already enabled
    const allEnabled = product.variants.every(v => v.taxable === true);
    
    if (allEnabled) {
      console.log(`\nSkipping ${product.title} - tax already enabled`);
      results.alreadyEnabled.push(product.title);
      return;
    }
    
    const success = await enableTaxForProduct(product);
    if (success) {
      results.success.push(product.title);
    } else {
      results.failed.push(product.title);
    }
  });
  
  await Promise.all(batchPromises);
}

async function main() {
  try {
    console.log('Fetching all products...');
    const products = await getAllProducts();
    
    const results = {
      success: [],
      failed: [],
      alreadyEnabled: []
    };
    
    // Process products in batches of 5
    const batchSize = 5;
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      await processBatch(batch, results);
      
      // Print progress
      const remaining = products.length - (i + batchSize);
      const progress = ((i + batchSize) / products.length * 100).toFixed(1);
      console.log(`\nProgress: ${progress}% (${remaining} products remaining)`);
      
      // Short delay between batches
      await sleep(2000);
    }
    
    // Print summary
    console.log('\n=== Summary ===');
    
    console.log(`\nSuccessfully enabled tax for ${results.success.length} products:`);
    results.success.forEach(title => console.log(`✓ ${title}`));
    
    console.log(`\nTax already enabled for ${results.alreadyEnabled.length} products:`);
    results.alreadyEnabled.forEach(title => console.log(`• ${title}`));
    
    if (results.failed.length > 0) {
      console.log(`\nFailed to enable tax for ${results.failed.length} products:`);
      results.failed.forEach(title => console.log(`✗ ${title}`));
    }
    
  } catch (error) {
    console.error('Error in main process:', error.message);
  }
}

main().catch(console.error);
