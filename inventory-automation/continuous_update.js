const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');

// Store all SKUs and their quantities
const allSkus = `W997700	1
5818712	2
575038H	1
487222V	1
D084751	1
723557K	1
D668330	1
2779794	1
Y473239	1
L222079	1
406403W	1
302940W	-2
P285994	1
W307770	1
Q408238	2
536715P	2
768262H	1
Q671807	1
B214952	1
194237X	1
7528569	2
N615171	2
6612840	2
B022575	2
T492644	1
2112498	1
3999883	1
572758S	1
C296596	2
Z970403	2
D528571	2
398251D	2
6492263	1
V180240	1
B067345	1
8102408	1
P324745	2
203252C	2
3964058	2
3041581	2
466888Y	1
8669047	1
7745734	1
286706C	1
Z557175	2
8660424	2
V401584	2
676841P	2
M747255	1
8635869	1`;

// Split SKUs into batches of 50
const skus = allSkus.split('\n')
  .map(line => {
    const [sku, quantity] = line.trim().split('\t');
    return {
      sku,
      quantity: parseInt(quantity) || 0
    };
  });

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
