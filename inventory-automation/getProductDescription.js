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

async function getProduct() {
  try {
    console.log('Fetching product details...');
    const title = encodeURIComponent('"Beast" 3/4 Sleeve F-Terry Cropped Tee - Black (T1211)');
    const response = await shopify.get(`/products.json?title=${title}`);
    const product = response.data.products[0];

    if (!product) {
      throw new Error('Product not found');
    }

    console.log('\nCurrent product details:');
    console.log('Title:', product.title);
    console.log('Description:', product.body_html || '(No description)');
    
    return product;
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

getProduct();
