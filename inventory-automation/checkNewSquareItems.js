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

async function findProductMatch(item, shopifyProducts, inventoryMap) {
  // Try to find match by SKU first
  const squareSkus = item.itemData.variations
    .map(v => v.itemVariationData.sku)
    .filter(Boolean);

  if (squareSkus.length > 0) {
    const matchBySku = shopifyProducts.find(p => 
      p.variants.some(v => squareSkus.includes(v.sku))
    );
    if (matchBySku) return matchBySku;
  }

  // Try to find match by exact title
  const matchByTitle = shopifyProducts.find(p => 
    p.title.toLowerCase() === item.itemData.name.toLowerCase()
  );
  if (matchByTitle) return matchByTitle;

  // Try to find match by similar title
  const matchBySimilarTitle = shopifyProducts.find(p => {
    const pTitle = p.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    const iTitle = item.itemData.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return pTitle === iTitle || pTitle.includes(iTitle) || iTitle.includes(pTitle);
  });
  if (matchBySimilarTitle) return matchBySimilarTitle;

  // Try to find match by variant values
  const squareVariantNames = item.itemData.variations
    .map(v => v.itemVariationData.name)
    .sort()
    .join(',');

  const matchByVariants = shopifyProducts.find(p => {
    const shopifyVariantNames = p.variants
      .map(v => v.title)
      .sort()
      .join(',');
    return shopifyVariantNames === squareVariantNames;
  });
  if (matchByVariants) return matchByVariants;

  return null;
}

async function compareInventory() {
  try {
    console.log('=== Comparing Square and Shopify Inventory ===\n');
    
    // Get Square items
    console.log('Fetching Square catalog...');
    const { result: { objects = [] } } = await squareClient.catalogApi.listCatalog(
      undefined,
      'ITEM'
    );
    console.log(`Found ${objects.length} total items in Square`);
    
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
    console.log('\nChecking Square inventory...');
    const inventoryResponse = await squareClient.inventoryApi.batchRetrieveInventoryCounts({
      catalogObjectIds: variationIds,
      locationIds: [GEAR_LOCKER_LA_ID]
    });
    
    const inventoryCounts = inventoryResponse.result.counts || [];
    const inventoryMap = new Map(
      inventoryCounts.map(count => [count.catalogObjectId, count.quantity || '0'])
    );

    // Get Shopify products
    console.log('\nFetching Shopify products...');
    const response = await shopify.get('/products.json?limit=250&status=active');
    const shopifyProducts = response.data.products;
    console.log(`Found ${shopifyProducts.length} products in Shopify`);

    // Process each Square item
    console.log('\n=== Inventory Status ===\n');
    let itemsWithStock = 0;
    let itemsNotInShopify = 0;
    let itemsWithMismatch = 0;
    
    for (const item of objects) {
      if (item.type !== 'ITEM') continue;

      const variations = item.itemData.variations || [];
      let hasStock = false;
      let totalStock = 0;

      variations.forEach(variation => {
        const quantity = parseInt(inventoryMap.get(variation.id) || '0');
        if (quantity > 0) {
          hasStock = true;
          totalStock += quantity;
        }
      });

      if (hasStock) {
        itemsWithStock++;
        const shopifyProduct = await findProductMatch(item, shopifyProducts, inventoryMap);

        if (!shopifyProduct) {
          itemsNotInShopify++;
          console.log(`Item: ${item.itemData.name}`);
          console.log('Status: Not in Shopify - needs to be added');
          console.log('Variations:');
          variations.forEach(variation => {
            const quantity = parseInt(inventoryMap.get(variation.id) || '0');
            if (quantity > 0) {
              let priceStr = 'N/A';
              try {
                if (variation.itemVariationData.priceMoney) {
                  const priceAmount = Number(variation.itemVariationData.priceMoney.amount);
                  priceStr = `$${(priceAmount / 100).toFixed(2)}`;
                }
              } catch (e) {
                priceStr = 'Error reading price';
              }
              console.log(`- ${variation.itemVariationData.name}: ${priceStr}, Stock: ${quantity}, SKU: ${variation.itemVariationData.sku || 'N/A'}`);
            }
          });
          console.log(''); // Add blank line between items
        } else {
          // Check for inventory mismatches
          let hasMismatch = false;
          variations.forEach(variation => {
            const squareQty = parseInt(inventoryMap.get(variation.id) || '0');
            if (squareQty > 0) {
              const shopifyVariant = shopifyProduct.variants.find(v => 
                v.sku === variation.itemVariationData.sku ||
                v.title === variation.itemVariationData.name
              );
              
              if (shopifyVariant) {
                const shopifyQty = shopifyVariant.inventory_quantity || 0;
                if (squareQty !== shopifyQty) {
                  if (!hasMismatch) {
                    itemsWithMismatch++;
                    console.log(`Item: ${item.itemData.name}`);
                    console.log('Status: Inventory mismatch - needs sync');
                    hasMismatch = true;
                  }
                  console.log(`- ${variation.itemVariationData.name}:`);
                  console.log(`  Square: ${squareQty}`);
                  console.log(`  Shopify: ${shopifyQty}`);
                }
              }
            }
          });
          if (hasMismatch) console.log(''); // Add blank line after mismatches
        }
      }
    }

    console.log('=== Summary ===');
    console.log(`Total items with stock in Square: ${itemsWithStock}`);
    console.log(`Items missing from Shopify: ${itemsNotInShopify}`);
    console.log(`Items with inventory mismatch: ${itemsWithMismatch}`);

  } catch (error) {
    console.error('\nError:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

compareInventory();
