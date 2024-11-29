require('dotenv').config();
const axios = require('axios');

// Initialize Shopify client
const shopify = axios.create({
  baseURL: `https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/2023-10`,
  headers: {
    'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
    'Content-Type': 'application/json'
  }
});

async function getLocations() {
  try {
    console.log('=== Fetching Shopify Locations ===\n');
    
    const response = await shopify.get('/locations.json');
    const locations = response.data.locations;
    
    console.log('Available locations:');
    locations.forEach(location => {
      console.log(`- ${location.name}`);
      console.log(`  ID: ${location.id}`);
      console.log(`  Address: ${location.address1}`);
      console.log('');
    });

  } catch (error) {
    console.error('\nError:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

getLocations();
