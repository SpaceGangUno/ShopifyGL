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

// Previous rawUpdates and inventoryUpdates parsing remain the same...

async function enableInventoryTracking(productId, variantId) {
  try {
    console.log(`Enabling inventory tracking for variant ${variantId}...`);
    
    // Step 1: Get current product data
    const productResponse = await shopify.get(`/products/${productId}.json`);
    const product = productResponse.data.product;
    
    // Step 2: Update all variants to enable tracking
    const updatedVariants = product.variants.map(v => ({
      id: v.id,
      inventory_management: 'shopify',
      inventory_policy: 'deny',
      inventory_quantity: v.inventory_quantity || 0,
      requires_shipping: true,
      fulfillment_service: 'manual'
    }));
    
    // Step 3: Update product with all variants
    await shopify.put(`/products/${productId}.json`, {
      product: {
        id: productId,
        variants: updatedVariants
      }
    });
    
    await sleep(2000);
    
    // Step 4: Get updated variant details
    const variantResponse = await shopify.get(`/variants/${variantId}.json`);
    const variant = variantResponse.data.variant;
    
    if (!variant.inventory_item_id) {
      console.log('No inventory item ID found');
      return null;
    }
    
    // Step 5: Ensure inventory item exists and is tracked
    try {
      await shopify.post('/inventory_levels/activate.json', {
        location_id: await getLocationId(),
        inventory_item_id: variant.inventory_item_id
      });
    } catch (error) {
      // Ignore if already activated
      if (!error.response?.data?.errors?.includes('already activated')) {
        throw error;
      }
    }
    
    await sleep(2000);
    
    // Step 6: Verify tracking is enabled
    const verifyResponse = await shopify.get(`/variants/${variantId}.json`);
    const updatedVariant = verifyResponse.data.variant;
    
    if (updatedVariant.inventory_management === 'shopify') {
      console.log('✓ Inventory tracking activated');
      return updatedVariant;
    } else {
      console.log('✗ Failed to activate inventory tracking');
      return null;
    }
    
  } catch (error) {
    if (error.response?.data) {
      console.error('Error activating inventory:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error activating inventory:', error.message);
    }
    return null;
  }
}

async function setInventoryLevel(inventoryItemId, locationId, quantity) {
  return retryWithBackoff(async () => {
    console.log(`Setting inventory level to ${quantity}...`);
    
    try {
      // Step 1: Connect inventory item to location
      await shopify.post('/inventory_levels/connect.json', {
        location_id: locationId,
        inventory_item_id: inventoryItemId
      });
    } catch (error) {
      // Ignore if already connected
      if (!error.response?.data?.errors?.includes('already exists')) {
        throw error;
      }
    }
    
    await sleep(2000);
    
    // Step 2: Set inventory level
    const response = await shopify.post('/inventory_levels/set.json', {
      location_id: locationId,
      inventory_item_id: inventoryItemId,
      available: quantity
    });
    
    return response.data.inventory_level;
  });
}

async function verifyAndUpdateInventory(variant, locationId, targetQuantity, maxRetries = 3) {
  // First, ensure inventory tracking is enabled
  if (variant.inventory_management !== 'shopify') {
    console.log('Inventory tracking is disabled, activating it first...');
    const updatedVariant = await enableInventoryTracking(variant.product_id, variant.id);
    if (!updatedVariant) {
      console.log('Failed to activate inventory tracking');
      return false;
    }
    variant = updatedVariant;
    await sleep(2000);
  }

  // Now try to set and verify the inventory level
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const beforeLevel = await getInventoryLevel(variant.inventory_item_id, locationId);
      console.log(`Current inventory level: ${beforeLevel}`);

      await setInventoryLevel(variant.inventory_item_id, locationId, targetQuantity);
      await sleep(2000);
      
      const afterLevel = await getInventoryLevel(variant.inventory_item_id, locationId);
      console.log(`New inventory level: ${afterLevel}`);

      if (afterLevel === targetQuantity) {
        console.log(`✓ Successfully updated inventory to ${targetQuantity}`);
        return true;
      }
      
      console.log(`Attempt ${attempt}: Inventory level verification failed. Expected ${targetQuantity}, got ${afterLevel}`);
      if (attempt < maxRetries) {
        console.log('Retrying...');
        await sleep(3000 * attempt);
      }
    } catch (error) {
      console.error(`Error on attempt ${attempt}:`, error.response?.data || error.message);
      if (attempt < maxRetries) {
        console.log('Retrying...');
        await sleep(3000 * attempt);
      }
    }
  }
  
  return false;
}

// Rest of the script (updateInventory) remains the same...
