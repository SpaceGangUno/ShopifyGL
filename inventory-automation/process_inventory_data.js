const fs = require('fs');

// Process the inventory data
function processInventoryData(input) {
  const inventoryData = {};
  const lines = input.split('\n');
  
  lines.forEach(line => {
    if (!line.trim()) return;
    
    const [sku, quantityStr] = line.split('\t');
    if (sku && quantityStr !== undefined) {
      // Convert quantity to number, default to 0 if invalid
      const quantity = parseInt(quantityStr) || 0;
      inventoryData[sku.trim()] = quantity;
    }
  });
  
  return inventoryData;
}

// Write the processed data to a file
function writeInventoryData(data) {
  fs.writeFileSync(
    'inventory_data.json',
    JSON.stringify(data, null, 2)
  );
}

// Main execution
try {
  console.log('Processing inventory data...');
  
  // Read from standard input
  let data = '';
  process.stdin.setEncoding('utf8');
  
  process.stdin.on('data', chunk => {
    data += chunk;
  });
  
  process.stdin.on('end', () => {
    const inventoryData = processInventoryData(data);
    writeInventoryData(inventoryData);
    console.log('Inventory data processed and saved to inventory_data.json');
    console.log(`Processed ${Object.keys(inventoryData).length} SKUs`);
  });
  
} catch (error) {
  console.error('Error processing inventory data:', error);
  process.exit(1);
}
