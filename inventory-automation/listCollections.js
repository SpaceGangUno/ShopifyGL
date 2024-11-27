require('dotenv').config();
const axios = require('axios');

if (!process.env.SHOPIFY_ACCESS_TOKEN || !process.env.SHOPIFY_SHOP_DOMAIN) {
  console.error('Error: Required environment variables are missing.');
  process.exit(1);
}

const API_VERSION = '2024-01';
const shopify = axios.create({
  baseURL: `https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/${API_VERSION}`,
  headers: {
    'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
    'Content-Type': 'application/json'
  }
});

async function listCollections() {
  try {
    console.log('Fetching all collections...\n');
    const response = await shopify.get('/collections.json');
    const collections = response.data.collections;
    
    console.log('Available Collections:');
    collections.forEach(collection => {
      console.log(`- Title: "${collection.title}"`);
      console.log(`  Handle: ${collection.handle}`);
      console.log(`  ID: ${collection.id}\n`);
    });
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

listCollections();
