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

async function verifyProduct() {
  try {
    const productId = 8366403551430;
    console.log(`\nVerifying product ${productId}...`);
    
    const response = await shopify.get(`/products/${productId}.json`);
    const product = response.data.product;
    
    console.log('\nProduct:', product.title);
    console.log('\nVariants:');
    product.variants.forEach(variant => {
      console.log(`\n${variant.title}:`);
      console.log(`- SKU: ${variant.sku}`);
      console.log(`- Inventory Management: ${variant.inventory_management}`);
      console.log(`- Inventory Quantity: ${variant.inventory_quantity}`);
    });
    
  } catch (error) {
    console.error('Error verifying product:', error.response?.data || error.message);
  }
}

verifyProduct();
