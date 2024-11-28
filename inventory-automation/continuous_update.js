const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');

// Store all SKUs and their quantities
const allSkus = `1826	1
8943834	1
876797F	1
782979V	1
7609204	1
M057226	1
A027841	1
6082139	1
601529K	-1
706572A	1
1838221	3
A153484	2
F254850	1
4102197	1
344864G	1
7268898	1
931751T	1
954308H	2
999029P	1
9439886	1
3866856	1
N769050	1
5584056	1
5586409	1
1419630	1
X555003	1
721951T	1
582751G	1
6020296	1
7688769	1
1392213	1
X403089	1
1418811	1
193597J	1
M740370	1
F415230	1
K698259	1
4570866	1
5873329	1
470624D	1
7191295	1
346286Q	1
259612H	1
M204223	1
950351J	1
Z447044	1
438615X	1
283482E	1
J973714	1
1009733	1`;

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
