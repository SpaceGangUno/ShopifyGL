const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');

// Store all SKUs and their quantities
const allSkus = `9906	1
3149	1
5992125	1
G838396	1
830229E	1
285885M	2
L678506	2
7327378	1
R821986	1
385790J	1
Z405165	1
209911V	1
5054438	1
D397680	1
492	1
3299	1
3302	1
552	2
553	4
554	4
555	1
517	1
519	1
520	1
3318	2
3336	2
3338	1
3339	1
3367	2
3372	2
3373	1
859377X	1
V264679	1
B670602	1
498778Q	1
D996299	1
547851L	2
D042048	1
8550145	2
M128332	1
T795235	1
951562G	1
H849363	1
2464370	2
K491571	1
	1
	1
	1
	1
	1`;

// Split SKUs into batches of 50
const skus = allSkus.split('\n')
  .map(line => {
    const [sku, quantity] = line.trim().split('\t');
    if (!sku || sku === '') return null;  // Skip empty SKUs
    return {
      sku,
      quantity: parseInt(quantity) || 0
    };
  })
  .filter(item => item !== null);  // Remove null entries

const batchSize = 50;
const batches = [];

for (let i = 0; i < skus.length; i += batchSize) {
    batches.push(skus.slice(i, i + batchSize));
}

let currentBatch = 0;

function updateSkuDataFile(skuBatch) {
    const content = `module.exports = \`${skuBatch.map(item => `${item.sku}\t${item.quantity}`).join('\n')}\`;`;
    fs.writeFileSync(path.join(__dirname, 'sku_data.js'), content);
}

function runUpdateScript() {
    return new Promise((resolve, reject) => {
        const process = spawn('node', ['updateBulkInventory.js'], {
            cwd: __dirname
        });

        process.stdout.on('data', (data) => {
            console.log(data.toString());
        });

        process.stderr.on('data', (data) => {
            console.error(data.toString());
        });

        process.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Process exited with code ${code}`));
            }
        });
    });
}

async function processBatches() {
    console.log(`Starting continuous update process with ${batches.length} batches`);
    
    while (currentBatch < batches.length) {
        console.log(`\n=== Processing Batch ${currentBatch + 1}/${batches.length} ===\n`);
        
        // Update the sku_data.js file with current batch
        updateSkuDataFile(batches[currentBatch]);
        
        try {
            // Run the update script
            await runUpdateScript();
            console.log(`\n✓ Completed batch ${currentBatch + 1}`);
            
            // Move to next batch
            currentBatch++;
            
            if (currentBatch < batches.length) {
                // Take a longer break between batches
                console.log('\nTaking a break between batches (2 minutes)...\n');
                await new Promise(resolve => setTimeout(resolve, 120000));
            }
        } catch (error) {
            console.error('Error processing batch:', error);
            // On error, wait 5 minutes and retry the same batch
            console.log('\nError occurred, waiting 5 minutes before retrying...\n');
            await new Promise(resolve => setTimeout(resolve, 300000));
        }
    }
    
    console.log('\n=== All batches completed ===');
}

// Start the continuous process
processBatches().catch(console.error);
