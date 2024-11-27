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

// Final batch of products
const inventory = [
  { sku: '578781D', size: '33', quantity: 2, title: 'La Denim Shorts Baggy Fit- Light Blue' },
  { sku: '6886366', size: 'L', quantity: 2, title: 'Laws of Eden Fleece (142-323) Black' },
  { sku: '9587934', size: 'M', quantity: 2, title: 'Laws of Eden Fleece Hoodie (142-323) Black' },
  { sku: 'L391864', size: 'L', quantity: 2, title: 'Laws of Eden Fleece Hoodie (142-323) Red' },
  { sku: '4388890', size: 'M', quantity: 2, title: 'Laws of Eden Fleece Hoodie (142-323) Red' },
  { sku: '9143639', size: 'L', quantity: 2, title: 'Laws of Eden Fleece Hoodie (142-323) Red' },
  { sku: 'R280785', size: 'M', quantity: 2, title: 'Life Is Too Short - Black' },
  { sku: '1297453', size: 'M', quantity: 2, title: 'Life Is Too Short - Light Grey' },
  { sku: '5164290', size: 'M', quantity: 2, title: 'Life Is Too Short - Red' },
  { sku: 'P241393', size: 'XXL', quantity: 2, title: 'Lil Baby Tee - Black' },
  { sku: '1172514', size: 'XXL', quantity: 2, title: 'Lil Uzi vert Tee - Black' },
  { sku: '3777417', size: 'M', quantity: 2, title: 'Live Mechanic Overload - Black T-shirt' },
  { sku: '933561Q', size: 'L', quantity: 2, title: 'Live Mechanic Smile - Black T-shirt' },
  { sku: '272634Z', size: 'XL', quantity: 2, title: 'Live Mechanics Time is running out - Black t-shirt' },
  { sku: 'Q782551', size: 'S', quantity: 2, title: 'Los Primeros Black T-shirt' },
  { sku: '2307150', size: '10.5', quantity: 2, title: 'Lotus - 040 Yellow, Red' },
  { sku: 'Y226237', size: 'S-30', quantity: 2, title: 'Love Shorts P46' },
  { sku: '5697', size: 'Regular', quantity: 2, title: 'Loyalty is Royalty - Camo' },
  { sku: 'D967622', size: 'S', quantity: 2, title: 'Lucid Dreams T-Shirt (23-366) - Flamingo' },
  { sku: 'A410381', size: 'M', quantity: 2, title: 'Lucky Angel Bone Tee - White' },
  { sku: 'Y646549', size: 'L', quantity: 2, title: 'Lucky Angel Bone Tee - White' },
  { sku: 'J904225', size: 'M', quantity: 2, title: 'M5866A - Cabernet Stack Sweats' },
  { sku: '842035N', size: 'XXS-28', quantity: 2, title: 'M8026T olive cargos' },
  { sku: '503685K', size: 'M-32', quantity: 2, title: 'M8037T - Waimea Jet Black Baggy Fit Cargo Jeans' },
  { sku: 'Y292479', size: 'M-32', quantity: 2, title: 'M8190D - Baggy Fitted Jeans - Blue Wash' },
  { sku: '173631E', size: 'S-30', quantity: 2, title: 'M8199D - Jet Black Stacked Jeans' },
  { sku: 'R645061', size: 'XL', quantity: 2, title: 'M9b32 Skull Tee - Yellow' },
  { sku: '0440', size: 'XL', quantity: 2, title: 'MALCOM X RESPECT BLACK T-SHIRT' },
  { sku: '9407', size: 'XL', quantity: 2, title: 'MB-10K Money Bear Truly Blessed Blue Kids Tee' },
  { sku: '283853Z', size: 'M', quantity: 2, title: 'MT85 Black Dashiki Satin Shirt' },
  { sku: '411040Z', size: 'OS', quantity: 2, title: 'MUKA S5411 Black Cry Baby Trucker Hat' },
  { sku: '6572', size: 'Regular', quantity: 2, title: 'MUM2223-PEACH' },
  { sku: '6581', size: 'Regular', quantity: 2, title: 'MUM2230-BLACK' },
  { sku: 'Z655240', size: 'S', quantity: 2, title: 'MV-03 "SHELTON PLAID SHIRT"' },
  { sku: '7123871', size: 'M', quantity: 2, title: 'Machinist M1988 Beige Triangle Applique T-Shirt' },
  { sku: '403160D', size: 'M', quantity: 2, title: 'Machinist M1988 ECRU Triangle Applique T-Shirt' },
  { sku: 'K724340', size: 'M', quantity: 2, title: 'Machinist M1988 Oak Coffee Triangle Applique T-Shirt' },
  { sku: 'X029341', size: 'M', quantity: 2, title: 'Machinist M1988 Oil Green Triangle Applique T-Shirt' },
  { sku: '6345418', size: 'M', quantity: 2, title: 'Machinist M2057 Indigo 87 Sea Shells T-Shirt' },
  { sku: 'X037550', size: 'XL', quantity: 2, title: 'Match Point Tee P47-BLK' },
  { sku: '350859A', size: 'L', quantity: 2, title: 'Match Point Tee P47-RED' },
  { sku: 'G800674', size: '6.5', quantity: 2, title: 'Mazino Kids Augen-040 Multi Sneakers' },
  { sku: 'E414176', size: '6', quantity: 2, title: 'Mazino Kids Magma-015 Black Sneakers' },
  { sku: '4319541', size: '6.5', quantity: 2, title: 'Mazino Kids Magma-015 Black Sneakers' },
  { sku: '852129M', size: '9.5', quantity: 2, title: 'Mazino Titanium-075 Black Sneakers' },
  { sku: '6354158', size: '10', quantity: 2, title: 'Mazino Titanium-075 Black Sneakers' },
  { sku: 'E186930', size: 'M-32', quantity: 2, title: 'Medium Stone Tint Pants (Frd3116A)' },
  { sku: '9825426', size: 'XL', quantity: 2, title: 'Medusa Hoodie (FW25-115 White' },
  { sku: '1301362', size: 'XXL', quantity: 2, title: 'Medusa Hoodie (FW25-115 White' },
  { sku: '1462100', size: 'L', quantity: 2, title: 'Melton/Pu Varsity Jackets W/ Tapestry Patches -DK Royal (642-552)' },
  { sku: 'N863201', size: 'L-34', quantity: 2, title: 'Mens Relaxed Fit Jeans' },
  { sku: '2318106', size: 'L', quantity: 2, title: 'Mind Grind Washed Flc Hoodie - Black (142-366)' },
  { sku: '3928164', size: 'L-34', quantity: 2, title: 'Mind Grind Washed Fleece Stacked Pants - Black (142-466)' },
  { sku: 'W674316', size: 'L', quantity: 2, title: 'Mohair Flannel Shacket\'s - Green (342-783)' },
  { sku: '5076326', size: 'M', quantity: 2, title: 'Mohair Flannel Shacket\'s - Orange (342-784)' },
  { sku: '815956Q', size: 'L', quantity: 2, title: 'Mohair Flannel Shackets - Purple (342-783)' },
  { sku: '364131N', size: 'S', quantity: 2, title: 'Motive Shirt - Taro  - Mt308' },
  { sku: 'Y723044', size: 'M', quantity: 2, title: 'Motive Shirt - Taro  - Mt308' },
  { sku: '908229F', size: 'L', quantity: 2, title: 'Motive Shirt - Taro  - Mt308' },
  { sku: '9640971', size: 'XXL-38', quantity: 2, title: 'Motor Racing Y2k Denim Pants (Frd3117)' },
  { sku: 'R363447', size: 'S', quantity: 2, title: 'Muichiro Graphic Tee (Muichiro-Graphic-Tee)' },
  { sku: '1455055', size: 'M', quantity: 2, title: 'Muichiro Graphic Tee (Muichiro-Graphic-Tee)' },
  { sku: 'Z403657', size: 'L', quantity: 2, title: 'Muichiro Graphic Tee (Muichiro-Graphic-Tee)' },
  { sku: 'B482712', size: 'XL', quantity: 2, title: 'Muichiro Graphic Tee (Muichiro-Graphic-Tee)' },
  { sku: '6306808', size: 'XXL', quantity: 2, title: 'Muichiro Graphic Tee (Muichiro-Graphic-Tee)' },
  { sku: '6298332', size: 'L-34', quantity: 2, title: 'Multi Cargo Pocket (Qdl-2435)' }
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
    console.log('=== Updating Inventory Levels (Final Batch) ===\n');
    
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
