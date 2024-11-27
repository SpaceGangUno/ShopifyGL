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

async function getLocationId() {
  try {
    const response = await shopify.get('/locations.json');
    const activeLocation = response.data.locations.find(loc => loc.active);
    if (!activeLocation) {
      throw new Error('No active location found');
    }
    return activeLocation.id;
  } catch (error) {
    console.error('Error fetching location:', error.response?.data || error.message);
    throw error;
  }
}

async function findProductBySKU(sku) {
  try {
    console.log(`Looking up details for SKU: ${sku}`);
    
    let cursor = null;
    let found = false;
    
    do {
      // Build query parameters
      let queryParams = 'limit=250';  // Max limit per request
      if (cursor) {
        queryParams += `&page_info=${cursor}`;
      }
      
      // Get products page
      const response = await shopify.get(`/products.json?${queryParams}`);
      
      // Check each product and its variants
      for (const product of response.data.products) {
        const matchingVariant = product.variants.find(v => v.sku === sku);
        if (matchingVariant) {
          console.log('\nProduct Details:');
          console.log('----------------');
          console.log('Product Title:', product.title);
          console.log('Variant:', matchingVariant.title);
          console.log('SKU:', matchingVariant.sku);
          console.log('Current Inventory:', matchingVariant.inventory_quantity);
          console.log('Inventory Tracking:', matchingVariant.inventory_management || 'disabled');
          console.log('Price:', matchingVariant.price);
          console.log('Product ID:', product.id);
          console.log('Variant ID:', matchingVariant.id);
          console.log('----------------');
          found = true;
          return { product, variant: matchingVariant };
        }
      }
      
      // Get next page cursor from Link header
      const linkHeader = response.headers['link'];
      if (linkHeader) {
        const match = linkHeader.match(/<[^>]*page_info=([^&>]*)[^>]*>; rel="next"/);
        cursor = match ? match[1] : null;
      } else {
        cursor = null;
      }
      
    } while (cursor && !found);
    
    if (!found) {
      console.log('No product found with this SKU');
    }
    return null;
    
  } catch (error) {
    console.error('Error getting product details:', error.response?.data || error.message);
    return null;
  }
}

async function getInventoryLevel(inventoryItemId, locationId) {
  try {
    const response = await shopify.get(`/inventory_levels.json?inventory_item_ids=${inventoryItemId}&location_ids=${locationId}`);
    if (response.data.inventory_levels && response.data.inventory_levels.length > 0) {
      return response.data.inventory_levels[0].available;
    }
    return null;
  } catch (error) {
    console.error('Error getting inventory level:', error.response?.data || error.message);
    return null;
  }
}

async function setInventoryLevel(inventoryItemId, locationId, quantity) {
  try {
    console.log(`Setting inventory level to ${quantity}...`);
    const response = await shopify.post('/inventory_levels/set.json', {
      location_id: locationId,
      inventory_item_id: inventoryItemId,
      available: quantity
    });
    return response.data.inventory_level;
  } catch (error) {
    console.error('Error setting inventory:', error.response?.data || error.message);
    return null;
  }
}

async function verifyAndUpdateInventory(variant, locationId, targetQuantity, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // Get current inventory level
    const beforeLevel = await getInventoryLevel(variant.inventory_item_id, locationId);
    console.log(`Current inventory level: ${beforeLevel}`);

    // Update inventory
    await setInventoryLevel(variant.inventory_item_id, locationId, targetQuantity);
    
    // Verify the update
    const afterLevel = await getInventoryLevel(variant.inventory_item_id, locationId);
    console.log(`New inventory level: ${afterLevel}`);

    if (afterLevel === targetQuantity) {
      console.log(`✓ Successfully updated inventory to ${targetQuantity}`);
      return true;
    } else {
      console.log(`Attempt ${attempt}: Inventory level verification failed. Expected ${targetQuantity}, got ${afterLevel}`);
      if (attempt < maxRetries) {
        console.log('Retrying...');
        await new Promise(resolve => setTimeout(resolve, 1000));  // Wait 1 second before retry
      }
    }
  }
  return false;
}

async function updateInventory() {
  try {
    const sku = '186840Z';
    const targetQuantity = 1;
    
    // Find the product and variant
    const result = await findProductBySKU(sku);
    if (!result) {
      console.log('Could not find product to update');
      return;
    }
    
    // Get location ID
    const locationId = await getLocationId();
    console.log('\nUsing location ID:', locationId);
    
    // Update and verify inventory
    await verifyAndUpdateInventory(result.variant, locationId, targetQuantity);
    
  } catch (error) {
    console.error('Error in update process:', error.response?.data || error.message);
  }
}

// Start the update process
updateInventory();
