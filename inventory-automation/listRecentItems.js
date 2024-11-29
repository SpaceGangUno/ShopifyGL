require('dotenv').config();
const { Client, Environment } = require('square');

// Initialize Square client
const squareClient = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: Environment.Production
});

const GEAR_LOCKER_LA_ID = 'E5PKC0ETHRCZQ';

async function listRecentItems() {
  try {
    console.log('=== Square Catalog Items ===\n');
    
    // Get all catalog items
    console.log('Fetching catalog items...');
    const { result: { objects = [] } } = await squareClient.catalogApi.listCatalog(
      undefined,
      'ITEM'
    );
    
    console.log(`Found ${objects.length} total items\n`);

    // Get variation IDs for inventory check
    const variationIds = [];
    objects.forEach(item => {
      if (item.type === 'ITEM' && item.itemData.variations) {
        item.itemData.variations.forEach(variation => {
          variationIds.push(variation.id);
        });
      }
    });

    // Get inventory counts
    const inventoryResponse = await squareClient.inventoryApi.batchRetrieveInventoryCounts({
      catalogObjectIds: variationIds,
      locationIds: [GEAR_LOCKER_LA_ID]
    });
    
    const inventoryCounts = inventoryResponse.result.counts || [];
    const inventoryMap = new Map(
      inventoryCounts.map(count => [count.catalogObjectId, count.quantity || '0'])
    );

    // Show all items with their metadata
    console.log('=== All Items ===\n');
    objects.forEach(item => {
      if (item.type === 'ITEM') {
        console.log(`Item: ${item.itemData.name}`);
        console.log(`ID: ${item.id}`);
        console.log(`Type: ${item.type}`);
        console.log(`Version: ${item.version}`);
        console.log(`Present at all locations: ${item.presentAtAllLocations}`);
        if (item.createdAt) console.log(`Created: ${item.createdAt}`);
        if (item.updatedAt) console.log(`Updated: ${item.updatedAt}`);
        if (item.absentAt) console.log(`Absent at: ${item.absentAt}`);
        if (item.presentAt) console.log(`Present at: ${item.presentAt}`);
        
        if (item.itemData.variations) {
          console.log('Variations:');
          item.itemData.variations.forEach(variation => {
            const quantity = inventoryMap.get(variation.id) || '0';
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
          });
        }
        console.log(''); // Add blank line between items
      }
    });

  } catch (error) {
    console.error('\nError:', error.message);
    if (error.result && error.result.errors) {
      console.error('\nSquare API Errors:', JSON.stringify(error.result.errors, null, 2));
    }
    process.exit(1);
  }
}

listRecentItems();
