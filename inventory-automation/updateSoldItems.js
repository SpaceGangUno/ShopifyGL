require('dotenv').config();
const axios = require('axios');

// Initialize Shopify client
const shopify = axios.create({
  baseURL: `https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/2023-10`,
  headers: {
    'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
    'Content-Type': 'application/json'
  }
});

// Parse the sold items data
const soldItems = `Ethik ''Howler Sherpa''  Work Jacket - Black	S	658141D	1
M8173D - Baggy Fit Jet Black Jeans	L-34	G075264	1
M8208D - Bleach Wash - Baggy Fit Jeans	XXS-28	3843380	1
RRRB889 - Rhinestone Skulls Belt - Silver/Black	M-32	898249V	1
Silver 2 Rhinestone Belt	L	1471849	1
Mohair Flannel Shacket's - Green (342-783)	M	Y135421	1
Burning Skull Crew Neck Sweater - Black (142-381)	XL	1754778	1
Burning Skull Crew Neck Sweater - Cream (142-382)	S	X967863	1
"Beast" 3/4 Sleeve F-Terry Cropped Tee - Black (T1211)	L	508106C	1
"Beast" 3/4 Sleeve F-Terry Cropped Tee - Black (T1211)	M	4262570	1
"Dismissed" 3/4 Sleeve F-Terry Cropped Tee - White (T1211)	S	1783859	1
"Member's Dept" Tee - Black	L	V577426	1
"The Madness" Oversized Tee (LP122) - Off White	M	5181920	1
(FRT2162TQ) Green Freedom is Not Free Flame Washed Tee Green	XL	3100666	1
Everything You Want - Black	M	Y455738	1
Fire Starter Tee (511)- Black	XS	630702V	1
Intellectual Property Washed Tee - Dark Grey (FRT2150)	XL	X293009	1
Juice God Money Tee - Black	L	591870Q	1
(431085-BK)  - Brown Hoodie	M	8705892	1
(431088-BK) Champions - Black Hoodie	M	7950981	1
(431088-GY) Champions - Grey Hoodie	M	483000R	1
132-352 - Punk Lego - Royal Hoodie	M	D844921	1
132-352 - Punk Lego - Royal Hoodie	XL	J900435	1
All Over Hoodie (FW25-211 Black)	M	3459912	1
Angels Hoodie - Green (GG147)	XXL	901783E	1
DM Tears Hoodie Grey	S	805850T	1
DM Tears Hoodie Grey	XXL	625216E	2
Darkest Era Washed Flc Hoodie - Charcoal (142-365)	L	S256597	1
Dm Tears Hoodie Red	S	B577150	1
Infinite Amour Fullzip Hoodie - Khaki (142-353)	L	Q760772	1
KNC001 - Charcoal Hoodie Tribal	M	1305784	1
KNC001 - Orange Hoodie Tribal	L	9477480	1
Kaws Underground - Black Hoodie (BP49)	S	H153904	1
Kiss My Fleece Hoodie - Black (142-322)	L	722926K	1
Mickey Smile - Black (ESC83)	S	270706H	1
Odb Funky Hoodie (ODB-29) - Purple	XXL	J969807	1
Pablo E. - Beige Hoodie (ESC82)	XL	977838N	1
Pablo E. - White Hoodie (ESC82)	M	B136873	1
Polizei Hoodie - White (PZ2)	XL	9950329	1
Popeye Full Zip Hoodie (POP-28)	XXXL	T601012	1
Real Eyes Hoodie Baby Blue - CT35	M	M722185	1
Real Eyes Hoodie Grey - CT35	M	2650093	1
Scarface Truth Hoodie - White	XL	W738649	1
Tormenta Grey Hoodie	M	Y865794	2
Way Of Life Hoodie Orange- GG80	XL	413579X	1
Win Again Part 2 Hoodie - Black	L	842336T	1
All Eyes on me-Jacket PL2711- Black	M	891203A	1
Angels Melton Jacket (142-532 Black)	M	2741059	1
FRJ2062 Over Logo Multi Patches Shacket	L	350615L	1
Fearless Soul Melton Jacket (142-515 Hunter Green)	S	250096E	1
Jurassic Park Varsity Jacket (JP-22)	M	6484002	1
Melton/Pu Varsity Jackets W/ Tapestry Patches - Black  (642-551)	L	699150H	1
RTS1058 BLUE (RTS1058 Jacket)	S	H257419	1
Wild Pack Varsity Jacket (OWG-22)	XXL	6192723	1
8M8253T Leb Kids Pants	16	646726D	1
AJK3047 Wayne LT Wash Jeans	2	286706C	1
Boy's Stretch Stack Denim Frayed Pacth - Light Blue (K3016)	16	W811108	2
Boy's Stretch Stack Denim Frayed Patch - Pink (K3016T)	16	N242077	1
K3020 Boy's Strecth Stack Denim - Jet Black (K3020)	16	8385262	1
Kids Tee Eagle Bling - White	2-3	F801834	1
Santo Stacked Jeans (AJK3030 LT Wash)	2	M125752	1
Skinny Fit (KND4769)	M-32	351029D	1
AJD3041 Comando White Tree Jeans	XL-36	768262H	1
AOM8148D - Brown Wash Stacked Fitted Jeans Waimea	XXS-28	N822307	1
Ajd3043 Shine (Jet Black) - Stacked Jeans	S-30	780480Z	1
Ajd3044 Shatter Lt Wash - Lt Wash Stacked Jeans	M-32	L340439	1
B2107, "Flare Fit" Twill Camo Pants (B2107) - City Camo	XS-29	3774767	1
Camo Stacked Jeans (AJS699-1)	L-34	8550145	1
Diamond & R.Stone Studded Stacked Flare Jeans - Med Indigo (642-630)	L-34	C001134	1
FW-330045A FWRD Washed Black Super Stacked Jeans	XS-29	204395T	1
KDNK4778 - Tribal Cargo Flare Skinny Jeans - Grey	M-32	6792502	1
KNC001 - Charcoal Stacked Sweat Pants Tribal	M	9415397	1
KNC001 - Orange Stacked Sweat Pants Tribal	L	3104100	1
KND4712 - Spider Web Slim Jeans - Lt.Blue	L-34	X890088	1
KND4712 - Spider Web Slim Jeans - Lt.Blue	M-32	412190S	1
KND4743 - Spider Web Jeans - Black	L-34	468609W	1
KND4743 - Spider Web Jeans - Blue	L-34	2580498	1
Knb3330 - Lather stacked fitted pants - Tan	M-32	972988M	1
M8199D - Jet Black Stacked Jeans	XXXL-40	S372344	1
M8259D - Indigo Wash Flare Fit Jeans	M-32	N749400	1
Santo Stacked Jeans (AJD3030 LT Wash)	L-34	R069121	1
Santo Stacked Jeans (AJD3030 LT Wash)	S-30	6885978	1
Santo Stacked Jeans (AJD3030 LT Wash)	XL-36	246412S	1
Slim Fit (KND4768) - Blue	M-32	L312924	1
Stacked Flare Fit Jeans - Desert (642-637)	36	S315735	1
Stacked Flare Fit Jeans - Med Indigo  (642-637)	38	6409806	1
Stylo Stacked Fitted Jeans - Baby Blue Denim	S-30	388277V	1
T4033, "Flare Fit" Strecth Pants With Patch Pocket - Teal Blue	XS-29	9103126	1
Yellow (P-6089)- Concept Stacked Fitted Jeans	XXS-28	N832405	1
(431585-BK) Sweat Pants - Brown	M-32	7275675	1
Darkest Era Washed Fleece Stacked Pants - Charcoal	XL-36	1445422	1
Stacked Fleece Pants (100-475 Khaki)	M-32	5275146	1
Stacked Fleece Pants (100-475 Red)	XL-36	999990N	1
Knd4792 - Flower Print Skinny Flare Jeans - Blue	M-32	258226B	1
Tapestry Cargo Pants -- Khaki (642-651)	L-34	E487755	1`.split('\n')
  .map(line => {
    const [title, size, sku, quantity] = line.split('\t');
    return {
      title: title.trim(),
      size: size.trim(),
      sku: sku.trim(),
      quantity: parseInt(quantity.trim())
    };
  });

async function updateInventory() {
  console.log('=== Updating Shopify Inventory ===\n');
  
  // Get all Shopify products
  console.log('Fetching Shopify products...');
  const response = await shopify.get('/products.json?limit=250&status=active');
  const shopifyProducts = response.data.products;
  console.log(`Found ${shopifyProducts.length} products in Shopify\n`);

  // Create a map of SKU to variant ID and inventory item ID
  const skuMap = new Map();
  shopifyProducts.forEach(product => {
    product.variants.forEach(variant => {
      if (variant.sku) {
        skuMap.set(variant.sku, {
          variantId: variant.id,
          inventoryItemId: variant.inventory_item_id,
          productTitle: product.title,
          variantTitle: variant.title
        });
      }
    });
  });

  // Process each sold item
  console.log('Processing sold items...');
  let updatedCount = 0;
  let errorCount = 0;
  let notFoundCount = 0;

  for (const item of soldItems) {
    const variantInfo = skuMap.get(item.sku);
    
    if (variantInfo) {
      try {
        console.log(`\nUpdating: ${item.title} (${item.size})`);
        console.log(`SKU: ${item.sku}, Quantity: -${item.quantity}`);
        
        // Get current inventory level
        const levelResponse = await shopify.get(`/inventory_levels.json?inventory_item_ids=${variantInfo.inventoryItemId}`);
        const currentLevel = levelResponse.data.inventory_levels[0];
        
        if (currentLevel) {
          const newQuantity = Math.max(0, currentLevel.available - item.quantity);
          
          // Update inventory level
          await shopify.post('/inventory_levels/set.json', {
            location_id: process.env.SHOPIFY_LOCATION_ID,
            inventory_item_id: variantInfo.inventoryItemId,
            available: newQuantity
          });
          
          console.log(`✓ Updated inventory from ${currentLevel.available} to ${newQuantity}`);
          updatedCount++;
        } else {
          console.log(`✗ No inventory level found`);
          errorCount++;
        }
      } catch (error) {
        console.error(`Error updating ${item.title}:`, error.response?.data || error.message);
        errorCount++;
      }
      
      // Add delay between updates
      await new Promise(resolve => setTimeout(resolve, 500));
    } else {
      console.log(`\nSKU not found in Shopify: ${item.sku}`);
      console.log(`Product: ${item.title} (${item.size})`);
      notFoundCount++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Successfully updated: ${updatedCount} items`);
  console.log(`Errors encountered: ${errorCount}`);
  console.log(`SKUs not found: ${notFoundCount}`);
}

updateInventory().catch(error => {
  console.error('\nError:', error.message);
  if (error.response) {
    console.error('Response status:', error.response.status);
    console.error('Response data:', error.response.data);
  }
  process.exit(1);
});
