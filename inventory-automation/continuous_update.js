const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');

// Store all SKUs and their quantities
const allSkus = `3378430	2
L709175	1
792126B	1
P070375	1
R654142	2
V562408	2
209792Q	1
1417429	1
2225808	2
Q056681	2
T985139	1
4921580	1
3801886	2
246352F	2
8327481	1
1977860	1
268560W	1
5388948	2
Q949129	1
120429Z	1
8848660	1
7275675	1
G378160	2
Q547175	1
504175X	1
N590715	1
7975976	2
Y519807	2
504756L	1
N079743	1
G637969	1
431003M	2
N646767	1
641947X	1
8473759	1
3232180	2
123791V	2
1799726	1
K473672	1
1717851	1
R814177	2
W241889	1
8663180	1
9314656	1
153638L	1
Z100800	3
5745764	3
X517321	2
J070261	2
X603073	1`;

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
