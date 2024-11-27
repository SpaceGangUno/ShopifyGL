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

// Product data with SKU and quantity (batch 8)
const inventory = [
  { sku: '820262A', size: 'L', quantity: 3, title: 'Ailip - Grey And Black Checker Printed Shorts' },
  { sku: 'G454993', size: 'XL', quantity: 3, title: 'Ailip - Grey And Black Checker Printed Shorts' },
  { sku: 'L515696', size: 'XXL', quantity: 3, title: 'Ailip - Grey And Black Checker Printed Shorts' },
  { sku: '891203A', size: 'M', quantity: 3, title: 'All Eyes on me-Jacket PL2711- Black' },
  { sku: '3459912', size: 'M', quantity: 3, title: 'All Over Hoodie (FW25-211 Black)' },
  { sku: 'Z692742', size: 'M', quantity: 3, title: 'At First Sight Fleece Hoodie - Black (142-321)' },
  { sku: '708512A', size: 'Regular', quantity: 3, title: 'Blue , Grey , White Shiesty face mask (1)' },
  { sku: '6381277', size: 'L', quantity: 3, title: 'Boomer Belts JX-6594 Gold Belt' },
  { sku: 'G038316', size: 'M', quantity: 3, title: 'Build Ideas Fleece Hoodie (142-332) Olive' },
  { sku: 'F907216', size: 'M-32', quantity: 3, title: 'Color Block Stacked Jeans (AJ40SK-3) - Blue' },
  { sku: 'H222996', size: 'L-34', quantity: 3, title: 'Color Block Stacked Jeans (AJ40SK-3) - Blue' },
  { sku: '8573232', size: 'XL', quantity: 3, title: "D'OH! Bunny Tee - Natural Tone" },
  { sku: '3927', size: '38', quantity: 3, title: 'EV-22278 WILD TIGER BLACK DENIM SHORTS' },
  { sku: '3933', size: '32', quantity: 3, title: 'EV-22278 WILD TIGER DENIM MED TINT SHORTS' },
  { sku: '3940', size: 'S', quantity: 3, title: 'EV-22461E CARGO BLACK KNIT SHORTS' },
  { sku: 'K471397', size: 'L-34', quantity: 3, title: 'Elite Corduroy Shorts - Beige' },
  { sku: 'Q227379', size: 'Regular', quantity: 3, title: 'Exalte Face Ski Mask - Black/White (EFSM)' },
  { sku: '771101G', size: 'Regular', quantity: 3, title: 'F - it Trucker Hat - Olive' },
  { sku: '9203772', size: 'L', quantity: 3, title: 'FRJ2060 Coexist Multi Patches Shacket' },
  { sku: '393535F', size: 'XL', quantity: 3, title: 'FW-11212A- Multi T-shirts' }
];

async function getLocationId() {
  try {
    const response = await shopify.get('/locations.json');
    return response.data.locations[0].id;
  } catch (error) {
    console.error('Error fetching location:', error.response?.data || error.message);
    throw error;
  }
}

async function findVariantBySKU(sku) {
  try {
    const response = await shopify.get(`/variants.json?sku=${encodeURIComponent(sku)}`);
    return response.data.variants[0];
  } catch (error) {
    console.error(`Error finding variant with SKU ${sku}:`, error.response?.data || error.message);
    return null;
  }
}

async function enableInventoryTracking(variantId) {
  try {
    await shopify.put(`/variants/${variantId}.json`, {
      variant: {
        id: variantId,
        inventory_management: 'shopify'
      }
    });
    console.log('✓ Enabled inventory tracking');
    return true;
  } catch (error) {
    console.error('Error enabling tracking:', error.response?.data || error.message);
    return false;
  }
}

async function setInventoryLevel(inventoryItemId, locationId, quantity) {
  try {
    await shopify.post('/inventory_levels/set.json', {
      location_id: locationId,
      inventory_item_id: inventoryItemId,
      available: quantity
    });
    console.log(`✓ Set inventory level to ${quantity}`);
    return true;
  } catch (error) {
    console.error('Error setting inventory:', error.response?.data || error.message);
    return false;
  }
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function updateInventoryLevels() {
  try {
    console.log('=== Updating Inventory Levels (Batch 8) ===\n');
    
    // Get location ID
    const locationId = await getLocationId();
    console.log(`Using location ID: ${locationId}\n`);

    let successCount = 0;
    let errorCount = 0;

    // Process each product
    for (const item of inventory) {
      console.log(`Processing: ${item.title} (SKU: ${item.sku})`);
      console.log(`Size: ${item.size}, Quantity: ${item.quantity}`);

      try {
        // Find variant by SKU
        const variant = await findVariantBySKU(item.sku);
        
        if (!variant) {
          console.log('❌ Variant not found\n');
          errorCount++;
          continue;
        }

        // Enable inventory tracking
        console.log('Enabling inventory tracking...');
        const trackingEnabled = await enableInventoryTracking(variant.id);
        if (!trackingEnabled) {
          console.log('❌ Failed to enable inventory tracking\n');
          errorCount++;
          continue;
        }

        // Wait a bit after enabling tracking
        await delay(500);

        // Set inventory level
        console.log('Setting inventory level...');
        const success = await setInventoryLevel(variant.inventory_item_id, locationId, item.quantity);
        
        if (success) {
          console.log('✓ Update completed successfully\n');
          successCount++;
        } else {
          console.log('❌ Failed to update inventory\n');
          errorCount++;
        }

        // Wait between products
        await delay(1000);

      } catch (error) {
        console.error(`Error processing ${item.title}:`, error.message);
        errorCount++;
        await delay(1000);
      }
    }

    console.log('=== Inventory Update Summary ===');
    console.log(`Total products processed: ${inventory.length}`);
    console.log(`Successfully updated: ${successCount}`);
    console.log(`Errors encountered: ${errorCount}`);
    console.log('\nInventory update completed! ✨');

  } catch (error) {
    console.error('\n❌ Error in update process:', error.message);
    process.exit(1);
  }
}

// Start the update process
updateInventoryLevels();
