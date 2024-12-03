require('dotenv').config();
const { Client, Environment } = require('square');
const Shopify = require('shopify-api-node');

// Initialize Square client
const squareClient = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: Environment.Production
});

// Initialize Shopify client
const shopify = new Shopify({
  shopName: process.env.SHOPIFY_SHOP_DOMAIN.split('.')[0], // Extract shop name from domain
  accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
  apiVersion: '2023-10'
});

async function getSquareInventory() {
  try {
    console.log('Fetching Square catalog items...');
    const { result } = await squareClient.catalogApi.searchCatalogItems({
      enabled_for_pos: true
    });
    
    if (!result.items) {
      console.log('No items found in Square');
      return [];
    }

    console.log(`Found ${result.items.length} items in Square catalog`);

    // Get all variation IDs
    const variationIds = result.items.reduce((ids, item) => {
      if (item.itemData.variations) {
        ids.push(...item.itemData.variations.map(v => v.id));
      }
      return ids;
    }, []);

    // Get inventory counts for variations
    const inventoryResponse = await squareClient.inventoryApi.batchRetrieveInventoryCounts({
      catalogObjectIds: variationIds
    });

    // Group items by base product name and sum their quantities
    const productGroups = {};

    for (const item of result.items) {
      const variations = item.itemData.variations || [];
      let totalQuantity = 0;
      let variationDetails = [];

      for (const variation of variations) {
        const inventory = inventoryResponse.result.counts?.find(
          count => count.catalogObjectId === variation.id
        );
        
        const quantity = inventory?.quantity ? Number(inventory.quantity.toString()) : 0;
        const price = variation.itemVariationData?.priceMoney?.amount ? 
          Number(variation.itemVariationData.priceMoney.amount.toString()) : 0;

        totalQuantity += quantity;

        if (quantity > 0) {
          variationDetails.push({
            name: variation.itemVariationData?.name || 'Default',
            sku: variation.itemVariationData?.sku || 'No SKU',
            quantity: quantity,
            price: price
          });
        }
      }

      if (totalQuantity >= 2) {
        if (!productGroups[item.itemData.name]) {
          productGroups[item.itemData.name] = {
            name: item.itemData.name,
            totalQuantity: 0,
            variations: []
          };
        }

        productGroups[item.itemData.name].totalQuantity += totalQuantity;
        productGroups[item.itemData.name].variations.push(...variationDetails);
      }
    }

    return Object.values(productGroups)
      .sort((a, b) => b.totalQuantity - a.totalQuantity); // Sort by quantity descending
  } catch (error) {
    console.error('Error getting Square inventory:', error);
    return [];
  }
}

async function getShopifyProducts() {
  try {
    console.log('\nFetching Shopify products...');
    const products = await shopify.product.list({ limit: 250 });
    
    // Create a map of SKUs to product titles for easy lookup
    const skuMap = new Map();
    products.forEach(product => {
      product.variants.forEach(variant => {
        if (variant.sku) {
          skuMap.set(variant.sku, product.title);
        }
      });
    });
    
    return skuMap;
  } catch (error) {
    console.error('Error getting Shopify products:', error);
    return new Map();
  }
}

async function findItemsWithInventory() {
  console.log('Finding items with 2+ quantity in Square...\n');
  
  const squareItems = await getSquareInventory();
  const shopifySkuMap = await getShopifyProducts();

  console.log('\nItems in Square with 2+ total quantity:');
  console.log('--------------------------------------------------------');
  
  squareItems.forEach(item => {
    console.log(`\nProduct: ${item.name}`);
    console.log('Variations with stock:');
    item.variations.forEach(v => {
      const shopifyProduct = shopifySkuMap.get(v.sku);
      console.log(`  ${v.name}: ${v.quantity} units (SKU: ${v.sku}) - $${(v.price / 100).toFixed(2)}`);
      if (shopifyProduct) {
        console.log(`  → Found in Shopify as: ${shopifyProduct}`);
      } else {
        console.log('  → Not found in Shopify');
      }
    });
    console.log(`Total Quantity: ${item.totalQuantity}`);
    console.log('----------------------------------------');
  });

  console.log(`\nTotal items with 2+ quantity: ${squareItems.length}`);
}

findItemsWithInventory().catch(console.error);
