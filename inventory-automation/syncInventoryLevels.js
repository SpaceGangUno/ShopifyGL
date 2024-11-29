require('dotenv').config();
const { Client, Environment } = require('square');
const axios = require('axios');

// Initialize Square client
const squareClient = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: Environment.Production,
  userAgentDetail: 'Inventory Sync'
});

// Initialize Shopify client
const shopify = axios.create({
  baseURL: `https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/2023-10`,
  headers: {
    'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
    'Content-Type': 'application/json'
  }
});

async function getSquareLocations() {
  console.log('Getting Square locations...');
  const locationResponse = await squareClient.locationsApi.listLocations();
  const locations = locationResponse.result.locations;
  
  console.log('Available locations:');
  locations.forEach(loc => {
    console.log(`- ${loc.name} (${loc.id})`);
    console.log(`  Address: ${loc.address?.address_line_1 || 'No address'}`);
  });
  
  // Find the Gear Locker LA location
  const gearLockerLA = locations.find(loc => 
    loc.name === 'Gear Locker LA'
  );
  
  if (!gearLockerLA) {
    throw new Error('Could not find Gear Locker LA location');
  }
  
  return gearLockerLA;
}

async function getSquareInventory(locationId) {
  try {
    // First get catalog items
    console.log('Fetching catalog items...');
    const catalogResponse = await squareClient.catalogApi.listCatalog();
    const items = catalogResponse.result.objects || [];
    console.log(`Found ${items.length} catalog items`);

    // Get variation IDs
    const variationIds = [];
    items.forEach(item => {
      if (item.type === 'ITEM' && item.itemData.variations) {
        item.itemData.variations.forEach(variation => {
          variationIds.push(variation.id);
        });
      }
    });

    // Split variation IDs into chunks to avoid request size limits
    const chunkSize = 100;
    const chunks = [];
    for (let i = 0; i < variationIds.length; i += chunkSize) {
      chunks.push(variationIds.slice(i, i + chunkSize));
    }

    // Get inventory counts for all variations
    console.log('\nFetching inventory counts...');
    const inventoryMap = new Map();
    
    for (const chunk of chunks) {
      const { result: { counts = [] } } = await squareClient.inventoryApi.batchRetrieveInventoryCounts({
        catalogObjectIds: chunk,
        locationIds: [locationId]
      });

      counts.forEach(count => {
        inventoryMap.set(count.catalogObjectId, count.quantity || '0');
      });

      // Add a small delay between chunks
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return { items, inventoryMap };
  } catch (error) {
    console.error('Square API Error:', error);
    if (error.result && error.result.errors) {
      console.error('Error details:', JSON.stringify(error.result.errors, null, 2));
    }
    throw error;
  }
}

async function findProductMatch(item, shopifyProducts) {
  // Try to find match by SKU first
  const squareSkus = item.itemData.variations
    .map(v => v.itemVariationData.sku)
    .filter(Boolean);

  if (squareSkus.length > 0) {
    const matchBySku = shopifyProducts.find(p => 
      p.variants.some(v => squareSkus.includes(v.sku))
    );
    if (matchBySku) {
      console.log('Found match by SKU');
      return matchBySku;
    }
  }

  // Try to find match by exact title
  const matchByTitle = shopifyProducts.find(p => 
    p.title.toLowerCase() === item.itemData.name.toLowerCase()
  );
  if (matchByTitle) {
    console.log('Found match by exact title');
    return matchByTitle;
  }

  // Try to find match by similar title
  const matchBySimilarTitle = shopifyProducts.find(p => {
    const pTitle = p.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    const iTitle = item.itemData.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return pTitle === iTitle || pTitle.includes(iTitle) || iTitle.includes(pTitle);
  });
  if (matchBySimilarTitle) {
    console.log('Found match by similar title');
    return matchBySimilarTitle;
  }

  console.log('No match found');
  return null;
}

async function updateShopifyInventory(variantId, quantity) {
  try {
    console.log(`Getting inventory details for variant ${variantId}...`);
    // First get the inventory item ID
    const variantResponse = await shopify.get(`/variants/${variantId}.json`);
    const inventoryItemId = variantResponse.data.variant.inventory_item_id;
    console.log(`Found inventory item ID: ${inventoryItemId}`);

    // Then set the inventory level
    console.log(`Setting inventory level to ${quantity}...`);
    const response = await shopify.post('/inventory_levels/set.json', {
      location_id: process.env.SHOPIFY_LOCATION_ID,
      inventory_item_id: inventoryItemId,
      available: quantity
    });

    console.log('Inventory update response:', response.data);
    return true;
  } catch (error) {
    console.error(`Error updating inventory for variant ${variantId}:`);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    } else {
      console.error(error.message);
    }
    return false;
  }
}

async function syncInventory() {
  try {
    console.log('=== Syncing Inventory Levels ===\n');
    
    // Get Square location
    const location = await getSquareLocations();
    console.log(`\nUsing location: ${location.name} (${location.id})`);
    
    // Get Square inventory
    const { items, inventoryMap } = await getSquareInventory(location.id);
    
    // Get Shopify products
    console.log('\nFetching Shopify products...');
    const response = await shopify.get('/products.json?limit=250&status=active');
    const shopifyProducts = response.data.products;
    console.log(`Found ${shopifyProducts.length} products in Shopify`);

    // Process each Square item
    console.log('\n=== Updating Inventory Levels ===\n');
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const item of items) {
      if (item.type !== 'ITEM') continue;

      const variations = item.itemData.variations || [];
      let hasStock = false;
      variations.forEach(variation => {
        const quantity = parseInt(inventoryMap.get(variation.id) || '0');
        if (quantity > 0) hasStock = true;
      });

      if (hasStock) {
        console.log(`\nProcessing: ${item.itemData.name}`);
        const shopifyProduct = await findProductMatch(item, shopifyProducts);
        
        if (shopifyProduct) {
          console.log('Variations:');
          for (const variation of variations) {
            const squareQty = parseInt(inventoryMap.get(variation.id) || '0');
            if (squareQty > 0) {
              console.log(`- ${variation.itemVariationData.name}:`);
              console.log(`  Square quantity: ${squareQty}`);
              console.log(`  SKU: ${variation.itemVariationData.sku || 'N/A'}`);
              
              const shopifyVariant = shopifyProduct.variants.find(v => {
                const skuMatch = v.sku === variation.itemVariationData.sku;
                const titleMatch = v.title === variation.itemVariationData.name;
                if (skuMatch) console.log('  Found matching SKU in Shopify');
                if (titleMatch) console.log('  Found matching title in Shopify');
                return skuMatch || titleMatch;
              });
              
              if (shopifyVariant) {
                const shopifyQty = shopifyVariant.inventory_quantity || 0;
                console.log(`  Current Shopify quantity: ${shopifyQty}`);
                
                if (squareQty !== shopifyQty) {
                  console.log(`  Updating inventory to: ${squareQty}`);
                  const success = await updateShopifyInventory(shopifyVariant.id, squareQty);
                  if (success) {
                    console.log('  ✓ Successfully updated');
                    updatedCount++;
                  } else {
                    console.log('  ✗ Update failed');
                    errorCount++;
                  }
                } else {
                  console.log('  → Inventory already matches');
                }
              } else {
                console.log('  ✗ No matching variant found in Shopify');
              }
            }
          }
        }
      }
    }

    console.log('\n=== Summary ===');
    console.log(`Successfully updated: ${updatedCount} variants`);
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
