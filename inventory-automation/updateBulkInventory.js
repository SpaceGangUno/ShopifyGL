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

// The variants we need to update with their sizes
const variantSizes = [
  { size: 'S-30', sku: '9567483', quantity: 2 },
  { size: 'M-32', sku: '247856C', quantity: 2 },
  { size: 'L-34', sku: '6298332', quantity: 2 },
  { size: 'XL-36', sku: '628638R', quantity: 2 },
  { size: 'XXL-38', sku: '7424606', quantity: 2 },
  { size: 'XXXL-40', sku: '5175842', quantity: 2 },
  { size: 'XXXXL-42', sku: '835811O', quantity: 2 }
];

async function searchProducts() {
  try {
    console.log('\nSearching for products containing "Multi Cargo Pocket"...');
    const response = await shopify.get('/products/search.json?query=Multi+Cargo+Pocket');
    console.log('Search Response:', JSON.stringify(response.data, null, 2));
    
    if (!response.data.products || response.data.products.length === 0) {
      console.log('No products found with this name');
      return null;
    }
    
    // Log all found products and their variants
    response.data.products.forEach(product => {
      console.log(`\nFound product: ${product.title}`);
      console.log('Product ID:', product.id);
      console.log('Variants:');
      product.variants.forEach(variant => {
        console.log(`- Title: ${variant.title}`);
        console.log(`  SKU: ${variant.sku}`);
        console.log(`  Inventory Management: ${variant.inventory_management}`);
        console.log(`  Inventory Quantity: ${variant.inventory_quantity}`);
      });
    });
    
    return response.data.products;
  } catch (error) {
    console.error('Error searching products:', error.response?.data || error.message);
    return null;
  }
}

// Start the search process
searchProducts();
