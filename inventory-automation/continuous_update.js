const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');

// Store all SKUs and their quantities
const allSkus = `B266773	0
5688002	0
N239148	0
9235984	0
Z636622	1
Z934377	0
5333504	0
7500158	0
9593150	0
7330	1
7331	0
7332	1
7333	0
7334	0
7335	0
7336	0
7337	0
7338	0
7339	1
431164X	0
F028269	0
R114711	1
C046672	0
W075587	0
T292273	0
180894A	1
2590567	2
1851094	1
D795683	0
3263682	0
W937990	0
M159918	0
4479743	0
126831E	0
1335046	0
911062N	0
3266893	0
J096224	0
725265R	0
7191172	0
575250A	0
T381122	0
Q594273	0
Z142948	0
Q911947	0
J036259	0
M187277	0
D312423	0
791800S	0
R390571	0
759521Y	0
4384928	0
7855302	0
L372887	0
798815W	0
484132E	0
210506Q	0
1610111	0
P429437	1
447715J	0
581114C	0
4298158	0
B142782	0
V886413	0
D363813	0
Y134981	0
Q452549	0
525459V	0
578760B	0
887988K	0
326588K	0
8886390	0
1088868	0
2002698	0
228740P	0
553612A	0
812405V	0
1540675	0
7158900	0
B356287	0
2768886	0
P504865	0
686111L	0
512508M	0
708657N	0
Q717488	0
Q461487	0
2836333	0
1206268	0
P237964	0
7508325	0
8254206	1
N857595	0
357001K	0
Y294705	-1
T490213	0
664912Q	0
R419950	0
635636G	0
659125S	1
628835Z	0
8571054	0
331540X	0
661094S	0
906506W	0
703915F	0
556961G	0`;

// Split SKUs into batches of 50
const skus = allSkus.split('\n');
const batchSize = 50;
const batches = [];

for (let i = 0; i < skus.length; i += batchSize) {
    batches.push(skus.slice(i, i + batchSize));
}

let currentBatch = 0;

function updateSkuDataFile(skuBatch) {
    const content = `module.exports = \`${skuBatch.join('\n')}\`;`;
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
