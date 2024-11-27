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

async function enableTrackingForProduct(productId) {
  try {
    console.log(`\nEnabling tracking for product ${productId}...`);
    
    // Step 1: Get current product data
    const productResponse = await shopify.get(`/products/${productId}.json`);
    const product = productResponse.data.product;
    
    console.log(`Product: ${product.title}`);
    console.log(`Variants: ${product.variants.length}`);
    
    // Step 2: Update product to enable tracking
    await shopify.put(`/products/${productId}.json`, {
      product: {
        id: productId,
        variants: product.variants.map(v => ({
          id: v.id,
          inventory_management: 'shopify'
        }))
      }
    });
    
    await sleep(2000);
    
    // Step 3: Verify tracking is enabled
    const verifyResponse = await shopify.get(`/products/${productId}.json`);
    const updatedProduct = verifyResponse.data.product;
    
    const allEnabled = updatedProduct.variants.every(v => v.inventory_management === 'shopify');
    if (allEnabled) {
      console.log('✓ Inventory tracking enabled successfully');
      return true;
    } else {
      console.log('✗ Failed to enable inventory tracking');
      return false;
    }
    
  } catch (error) {
    if (error.response?.data) {
      console.error('Error enabling tracking:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error enabling tracking:', error.message);
    }
    return false;
  }
}

async function findProductBySKU(sku) {
  try {
    console.log(`\nLooking up product for SKU: ${sku}`);
    
    let cursor = null;
    let found = false;
    
    do {
      await sleep(500);
      
      let queryParams = 'limit=250';
      if (cursor) queryParams += `&page_info=${cursor}`;
      
      const response = await shopify.get(`/products.json?${queryParams}`);
      
      for (const product of response.data.products) {
        const matchingVariant = product.variants.find(v => v.sku === sku);
        if (matchingVariant) {
          console.log('Found product:', product.title);
          return product;
        }
      }
      
      const linkHeader = response.headers['link'];
      cursor = linkHeader ? linkHeader.match(/<[^>]*page_info=([^&>]*)[^>]*>; rel="next"/)?.[1] : null;
      
    } while (cursor && !found);
    
    console.log('No product found with this SKU');
    return null;
    
  } catch (error) {
    console.error('Error finding product:', error.message);
    return null;
  }
}

async function main() {
  // Get list of SKUs from your previous script
  const skus = [
    '7148503', '6185790', '209386S', '9641264', '7874284', '593221J',
    // ... add more SKUs here
  ];
  
  const processedProducts = new Set();
  const results = {
    success: [],
    failed: []
  };
  
  for (const sku of skus) {
    try {
      const product = await findProductBySKU(sku);
      
      if (product && !processedProducts.has(product.id)) {
        processedProducts.add(product.id);
        
        const success = await enableTrackingForProduct(product.id);
        if (success) {
          results.success.push(product.title);
        } else {
          results.failed.push(product.title);
        }
        
        await sleep(2000);
      }
    } catch (error) {
      console.error(`Error processing SKU ${sku}:`, error.message);
      continue;
    }
  }
  
  // Print summary
  console.log('\n=== Summary ===');
  console.log(`\nSuccessfully enabled tracking for ${results.success.length} products:`);
  results.success.forEach(title => console.log(`✓ ${title}`));
  
  if (results.failed.length > 0) {
    console.log(`\nFailed to enable tracking for ${results.failed.length} products:`);
    results.failed.forEach(title => console.log(`✗ ${title}`));
  }
}

main().catch(console.error);
