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

// Product data with SKU and quantity (batch 2 of 50)
const inventory = [
  { sku: '422715P', size: 'XL-36', quantity: 3, title: 'Nylon Shorts (AR1006)- Navy' },
  { sku: '400592S', size: 'M-32', quantity: 3, title: 'Nylon Shorts (AR1006)- Red' },
  { sku: '6808989', size: 'XL-36', quantity: 3, title: 'Nylon Shorts (AR1006)- Red' },
  { sku: 'E502726', size: 'M-32', quantity: 3, title: 'Nylon Shorts (AR1006)- Royal' },
  { sku: 'C566327', size: 'XL-36', quantity: 3, title: 'Nylon Shorts (AR1006)- Royal' },
  { sku: '3153632', size: 'L', quantity: 3, title: 'Orange And Gold Button Down' },
  { sku: '7477', size: 'L', quantity: 3, title: 'QS7 - No Bad Vibes - Aqua' },
  { sku: '0434', size: 'M', quantity: 3, title: 'ROOKIE BLACK JOGGERS' },
  { sku: '9423', size: 'Regular', quantity: 3, title: 'RTH-F-19 ANIME TRUCKER HAT NAVY' },
  { sku: '4462689', size: 'S', quantity: 3, title: 'RXNF22-WS001 Naruto Mesh Shorts' },
  { sku: '684590Y', size: 'L', quantity: 3, title: 'RXNF22-WT001 Naruto Sasuke Shirt' },
  { sku: '447372V', size: '32', quantity: 3, title: 'S2202 Grey Denim Shorts' },
  { sku: '767436X', size: '36', quantity: 3, title: 'S3016T- Gray Distressed Stacked Jeans' },
  { sku: '8215', size: 'XL', quantity: 3, title: 'SF1028 - Burgundy Never Stop' },
  { sku: 'T939519', size: 'L-34', quantity: 3, title: 'Skinny Fit Jeans Olive - KNB3119' },
  { sku: 'A000391', size: 'M-32', quantity: 3, title: 'Skinny Fit Ripped Jeans Black - KNB3119' },
  { sku: 'M902697', size: 'M-32', quantity: 3, title: 'Skinny Flare Fit (KND4773) - Blue' },
  { sku: 'E543853', size: 'L-34', quantity: 3, title: 'Skinny Jeans White - KD656' },
  { sku: 'V956439', size: 'S-30', quantity: 3, title: 'Slim Fit (KND4768) - Blue' },
  { sku: '5026769', size: 'S-30', quantity: 3, title: 'Slim Flare Fit (KND4772) - Blue' },
  { sku: 'T321562', size: '36', quantity: 3, title: 'Stacked Flare Fit Jeans - Med Indigo  (642-637)' },
  { sku: '941139G', size: 'XL-36', quantity: 3, title: 'Stitch Athletic Fit Jeans - Jet Black' },
  { sku: '2069841', size: 'M-32', quantity: 3, title: 'Stylo Stacked Fitted Jeans - Burgundy And Black' },
  { sku: '344918S', size: 'L-34', quantity: 3, title: 'Stylo Stacked Fitted Jeans - Burgundy And Black' },
  { sku: 'F662162', size: 'L', quantity: 3, title: 'T474 Roar Black T-shirt' },
  { sku: '338279A', size: 'S', quantity: 3, title: 'T474 Roar Teal T-shirt' },
  { sku: '9471233', size: 'Regular', quantity: 3, title: 'TN5331B - Rose Money Trucker Hat - Black' },
  { sku: 'E487755', size: 'L-34', quantity: 3, title: 'Tapestry Cargo Pants -- Khaki (642-651)' },
  { sku: '4913070', size: 'XL', quantity: 3, title: 'Tokyo Drift Mint Tee' },
  { sku: 'L480698', size: 'O/S', quantity: 3, title: 'Travis Astro Hat TN5313A CAMO' },
  { sku: '5991097', size: 'L', quantity: 3, title: 'True Feelings Fleece Hoodie (142-333) Beige' },
  { sku: '5519959', size: '32', quantity: 3, title: 'UB107 - Orange Denim Shorts' },
  { sku: 'X268628', size: 'L', quantity: 3, title: 'US3115- Royal Blue T Shirt' },
  { sku: '126931S', size: 'L', quantity: 3, title: 'Vessel of Grace Tee - Black' },
  { sku: '144712D', size: 'XL', quantity: 3, title: 'Vessel of Grace Tee - Black' },
  { sku: 'P392195', size: 'L-34', quantity: 3, title: 'Victorious Black Baggy Fit Shorts DS2099 (1)' },
  { sku: '103817F', size: 'M-32', quantity: 3, title: 'Victorious DL1501 Indigo Baggy Fit Carpenter Jeans' },
  { sku: '438842S', size: 'XXS-28', quantity: 3, title: 'Victorious DS2099 Lt. Indigo Baggy Fit Shorts' },
  { sku: 'S479720', size: 'M', quantity: 3, title: 'W Black and White Shorts' },
  { sku: '9263', size: 'L', quantity: 3, title: 'WOLF TRIBE - BLACK' },
  { sku: '9264', size: 'XL', quantity: 3, title: 'WOLF TRIBE - BLACK' },
  { sku: '9267', size: 'M', quantity: 3, title: 'WOLF TRIBE - BLUE' },
  { sku: 'N869206', size: 'L', quantity: 3, title: 'WV1-004 Gold Digging S/S Shirt' },
  { sku: '144921L', size: 'M-32', quantity: 3, title: 'Waimea Rust Stacked Jeans -M5826T' },
  { sku: 'Y768672', size: 'M', quantity: 3, title: 'Wake Up And Be Fierce Skull Spirit Washed Cropped Tee' },
  { sku: 'D715005', size: '30', quantity: 3, title: 'White Ripped Skinny Jeans (KNB3341)' },
  { sku: '9562091', size: 'M', quantity: 3, title: 'Win Again Hoodie - Blue' },
  { sku: 'M485345', size: 'S', quantity: 3, title: 'Wrathboy Wolf Head Gothic Tee (WB04-101 DK Grey)' },
  { sku: '878748R', size: 'S', quantity: 3, title: "Y'all Invtd Hoodie (KF-6920 Vintage Black)" },
  { sku: 'D314927', size: 'XL-36', quantity: 3, title: 'off the wok - sweat pants' },
  { sku: '3672978', size: 'XL', quantity: 3, title: 'off the wok tees - blue' },
  { sku: '916293B', size: 'L', quantity: 3, title: 'off the wok tees - red' }
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
    console.log('=== Updating Inventory Levels (Batch 2 of 50) ===\n');
    
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
