"use strict";

/*
json-array.json
json-array.json.br
json-array.json.gz
json-array.json.il
json-object.json
json-object.json.br
json-object.json.gz
json-object.json.il
text.txt
text.txt.br
text.txt.gz
text.txt.il
 */

const fs = require('fs-extra');
const axios = require('axios');
const path = require('path');

const variants = {
    'text': 'txt',
    'json-array': 'json',
    'json-object': 'json'
};

const encodings = [
    '',
    '.gz',
    '.br',
    '.il'
];

main().catch(err => console.error(err));

async function main() {
    const promises = [];
    for (const [variant, extension] of Object.entries(variants)) {
        for (const encoding of encodings) {
            promises.push(doRequest(variant, extension, encoding))
        }
    }

    const results = await Promise.all(promises);
    const string = results.join('\n');

    const resultsPath = path.join(__dirname, 'redirect-results.csv');

    if (!await fs.pathExists(resultsPath)) {
        await fs.appendFile(resultsPath, 'type,total,request,parse');
    }
    await fs.appendFile(resultsPath, '\n' + string);
}

async function doRequest(variant, extension, encoding) {
    const url = `https://beta.cdn.byu.edu/redirects/${variant}.${extension}${encoding}`;
    console.log('calling', url);
    try {
        const resp = await axios.get(url);
        const timing = resp.data.timing;

        const enc = encoding ? encoding : 'raw';

        console.log(variant, enc, 'took', timing.total, 'ms (req:', timing.request, 'parse:', timing.parse, ')');
        return `${variant} (${enc}),${timing.total},${timing.request},${timing.parse}`;
    } catch (err) {
        console.error('error calling', url, err.message || err);
        throw 'Kill';
    }
}
