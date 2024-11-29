require('dotenv').config();
const { Client, Environment } = require('square');
const axios = require('axios');

// Initialize Square client
const squareClient = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: Environment.Sandbox
});

// Initialize Shopify client
const shopify = axios.create({
  baseURL: `https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/2024-01`,
  headers: {
    'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
    'Content-Type': 'application/json'
  }
});

async function getSquareInventory() {
  try {
    // Get catalog items
    const catalogResponse = await squareClient.catalogApi.listCatalog(undefined, 'ITEM');
    const items = catalogResponse.result.objects || [];
    
    // Get inventory levels
    const inventoryResponse = await squareClient.inventoryApi.retrieveInventoryCounts();
    const inventory = inventoryResponse.result.counts || [];
    
    // Map inventory to catalog items
    const itemsWithInventory = items.map(item => {
      const variants = item.itemData.variations.map(variation => {
        const inventoryItem = inventory.find(inv => inv.catalogObjectId === variation.id);
        return {
          id: variation.id,
          sku: variation.itemVariationData.sku || '',
          name: variation.itemVariationData.name,
          price: variation.itemVariationData.priceMoney?.amount || 0,
          quantity: inventoryItem?.quantity || 0
        };
      });

      return {
        id: item.id,
        name: item.itemData.name,
        description: item.itemData.description || '',
        variants: variants,
        category: item.itemData.category?.name || 'Default'
      };
    });

    return itemsWithInventory;
  } catch (error) {
    console.error('Error fetching Square inventory:', error);
    throw error;
  }
}

async function createShopifyProduct(item) {
  try {
    // Format variants for Shopify
    const variants = item.variants.map(variant => ({
      sku: variant.sku,
      price: (variant.price / 100).toFixed(2),
      inventory_management: 'shopify',
      inventory_quantity: variant.quantity,
      title: variant.name,
      option1: variant.name // Use variant name as option1
    }));

    // Create product in Shopify
    const productData = {
      product: {
        title: item.name,
        body_html: item.description,
        vendor: 'Square Import',
        product_type: item.category,
        variants: variants,
        options: [{
          name: 'Size',
          values: variants.map(v => v.title)
        }]
      }
    };

    const response = await shopify.post('/products.json', productData);
    return response.data.product;
  } catch (error) {
    console.error(`Error creating Shopify product ${item.name}:`, error.response?.data || error.message);
    throw error;
  }
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function importInventory() {
  try {
    console.log('=== Importing Inventory from Square to Shopify ===');
    
    // Get Square inventory
    console.log('Fetching inventory from Square...');
    const squareItems = await getSquareInventory();
    console.log(`Found ${squareItems.length} items in Square`);

    let successCount = 0;
    let errorCount = 0;

    // Process each item
    for (const item of squareItems) {
      try {
        console.log(`\nProcessing: ${item.name}`);
        
        if (item.variants.some(v => v.quantity > 0)) {
          // Create product in Shopify
          const shopifyProduct = await createShopifyProduct(item);
          console.log(`✓ Created product in Shopify: ${shopifyProduct.title}`);
          successCount++;
        } else {
          console.log('- Skipping item with no inventory');
        }
        
        // Respect rate limits
        await delay(500);
      } catch (error) {
        console.error(`Error processing ${item.name}:`, error.message);
        errorCount++;
        await delay(1000);
      }
    }

    console.log('\n=== Import Summary ===');
    console.log(`Successfully imported: ${successCount} products`);
    console.log(`Errors encountered: ${errorCount}`);
    console.log('\nImport completed! ✨');

  } catch (error) {
    console.error('\n❌ Error in import process:', error.message);
    process.exit(1);
  }
}

importInventory();
