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

const newDescription = `
Elevate your casual wardrobe with our signature 'Beast' 3/4 Sleeve F-Terry Cropped Tee in sleek black. This premium piece combines urban style with exceptional comfort, featuring:

• Luxurious French Terry fabric for ultimate softness
• Modern cropped length for a contemporary silhouette
• Versatile 3/4 sleeves perfect for any season
• High-quality construction for lasting durability
• Stylish black colorway that pairs with everything

Whether you're hitting the streets or lounging in style, this tee delivers the perfect balance of fashion and comfort. The cropped design adds an edge to your look while the premium French Terry material ensures all-day comfort.
`;

async function updateProduct() {
  try {
    console.log('Fetching product...');
    const title = encodeURIComponent('"Beast" 3/4 Sleeve F-Terry Cropped Tee - Black (T1211)');
    const response = await shopify.get(`/products.json?title=${title}`);
    const product = response.data.products[0];

    if (!product) {
      throw new Error('Product not found');
    }

    console.log('Found product:', product.title);
    console.log('\nUpdating description...');

    // Update the product description
    await shopify.put(`/products/${product.id}.json`, {
      product: {
        id: product.id,
        body_html: newDescription
      }
    });

    console.log('✓ Description updated successfully!\n');
    console.log('New description:');
    console.log(newDescription);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response?.data) {
      console.error('API Response:', error.response.data);
    }
    process.exit(1);
  }
}

updateProduct();
