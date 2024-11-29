require('dotenv').config();
const { Client, Environment } = require('square');
const axios = require('axios');

// Initialize Square client
const squareClient = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: Environment.Production
});

// Initialize Shopify client
const shopify = axios.create({
  baseURL: `https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/2023-10`,
  headers: {
    'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
    'Content-Type': 'application/json'
  }
});

const GEAR_LOCKER_LA_ID = 'E5PKC0ETHRCZQ';

async function getSquareItems() {
  // Get all catalog items from Square
  const { result: { objects = [] } } = await squareClient.catalogApi.listCatalog(
    undefined,
    'ITEM'
  );
  
  // Get variation IDs for all items
  const variationIds = objects.reduce((ids, item) => {
    if (item.type === 'ITEM' && item.itemData.variations) {
      item.itemData.variations.forEach(variation => {
        ids.push(variation.id);
      });
    }
    return ids;
  }, []);

  // Get inventory for all variations
  const inventoryResponse = await squareClient.inventoryApi.batchRetrieveInventoryCounts({
    catalogObjectIds: variationIds,
    locationIds: [GEAR_LOCKER_LA_ID]
  });
  
  const inventoryCounts = inventoryResponse.result.counts || [];
  const inventoryMap = new Map(
    inventoryCounts.map(count => [count.catalogObjectId, String(count.quantity || '0')])
  );

  return { objects, inventoryMap };
}

async function getShopifyProducts() {
  const response = await shopify.get('/products.json?limit=250&status=active');
  return response.data.products;
}

async function createShopifyProduct(item, inventoryMap) {
  const variations = item.itemData.variations || [];
  const variants = variations.map(variation => {
    const quantity = parseInt(inventoryMap.get(variation.id) || '0', 10);
    let price = '0.00';
    
    if (variation.itemVariationData.priceMoney) {
      const amount = parseInt(variation.itemVariationData.priceMoney.amount || 0, 10);
      price = (amount / 100).toFixed(2);
    }
    
    return {
      option1: variation.itemVariationData.name,
      price: String(price),
      sku: variation.itemVariationData.sku || '',
      barcode: variation.itemVariationData.sku || '',
      inventory_management: 'shopify',
      inventory_quantity: quantity,
      inventory_policy: 'deny',
      requires_shipping: true,
      taxable: true
    };
  });

  const productData = {
    product: {
      title: item.itemData.name,
      body_html: item.itemData.description || '',
      vendor: 'Square Import',
      product_type: item.itemData.category?.name || 'Apparel',
      variants: variants,
      options: [{
        name: 'Size',
        values: variants.map(v => v.option1)
      }],
      status: 'active',
      tags: 'Square Import, POS Enabled',
      published: true,
      published_scope: 'web'
    }
  };

  return shopify.post('/products.json', productData);
}

async function syncInventory() {
  try {
    console.log('=== Adding Square Items to Shopify ===\n');
    
    // Get Square items
    console.log('Fetching Square inventory...');
    const { objects, inventoryMap } = await getSquareItems();
    
    // Get Shopify products
    console.log('Fetching Shopify products...');
    const shopifyProducts = await getShopifyProducts();
    const shopifySkus = new Set(
      shopifyProducts.flatMap(p => p.variants.map(v => v.sku))
    );

    // Find items to add
    const itemsToAdd = objects.filter(item => {
      if (item.type !== 'ITEM') return false;

      // Check if any variations have stock
      const hasStock = (item.itemData.variations || []).some(variation => {
        const quantity = parseInt(inventoryMap.get(variation.id) || '0', 10);
        return quantity > 0;
      });

      if (!hasStock) return false;

      // Check if already in Shopify
      const skus = (item.itemData.variations || [])
        .map(v => v.itemVariationData.sku)
        .filter(Boolean);
      
      // If no SKUs, check by name
      if (skus.length === 0) {
        return !shopifyProducts.some(p => 
          p.title.toLowerCase() === item.itemData.name.toLowerCase()
        );
      }
      
      // Check if any SKUs exist in Shopify
      return !skus.some(sku => shopifySkus.has(sku));
    });

    console.log(`\nFound ${itemsToAdd.length} items to add to Shopify`);

    // Add items to Shopify
    let successCount = 0;
    let errorCount = 0;

    for (const item of itemsToAdd) {
      try {
        console.log(`\nAdding: ${item.itemData.name}`);
        console.log('Variants:');
        const variations = item.itemData.variations || [];
        variations.forEach(variation => {
          const quantity = parseInt(inventoryMap.get(variation.id) || '0', 10);
          let price = 'N/A';
          if (variation.itemVariationData.priceMoney) {
            const amount = parseInt(variation.itemVariationData.priceMoney.amount || 0, 10);
            price = `$${(amount / 100).toFixed(2)}`;
          }
          console.log(`- ${variation.itemVariationData.name}: ${price}, Stock: ${quantity}, SKU: ${variation.itemVariationData.sku || 'N/A'}`);
        });

        await createShopifyProduct(item, inventoryMap);
        console.log('✓ Successfully added to Shopify');
        successCount++;
        
        // Wait between operations to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error adding ${item.itemData.name}:`, error.response?.data || error.message);
        errorCount++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('\n=== Summary ===');
    console.log(`Successfully added: ${successCount} products`);
    console.log(`Errors encountered: ${errorCount}`);

  } catch (error) {
    console.error('\nError:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

syncInventory();
