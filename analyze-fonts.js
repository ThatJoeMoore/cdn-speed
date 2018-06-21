"use strict";

const fs = require('fs-extra');

const parse = require('csv-parse/lib/sync');
const stats = require('stats-lite');
const {table} = require('table');
const {finished} = require('stream');
const path = require('path');

(async () => {
    // console.log('------------- prod -----------');
    const prod = await analyze('redirect-results.csv');
    const beta = await analyze('no-redirect-results.csv');

    const cells = [
        ['Name', 'Runs', 'Min (ms)', 'Max (ms)', 'Mean (ms)', 'Median (ms)', 'StdDev', 'p85 (ms)', 'p95 (ms)', 'p99 (ms)'],
        ['redirect', prod.count, prod.min, prod.max, prod.mean, prod.median, prod.stdev, prod.p85, prod.p95, prod.p99],
        ['no-redirect', beta.count, beta.min, beta.max, beta.mean, beta.median, beta.stdev, beta.p85, beta.p95, beta.p99],
    ];

    console.log(table(cells));

    // console.log('------------- beta -----------');

})().catch(err => console.error(err));

async function analyze(resultsFile) {
    const file = await fs.readFile(path.join(__dirname, 'font-results', resultsFile), 'utf8');

    const parsed = parse(file, {columns: true});

    const durations = parsed.map(it => Number(it.Duration) / 1000);

    return {
        count: durations.length,
        min: Math.min(...durations).toFixed(2),
        max: Math.max(...durations).toFixed(2),
        mean: stats.mean(durations).toFixed(2),
        median: stats.median(durations).toFixed(2),
        stdev: stats.stdev(durations).toFixed(2),
        p85: stats.percentile(durations, 0.85).toFixed(2),
        p95: stats.percentile(durations, 0.95).toFixed(2),
        p99: stats.percentile(durations, 0.99).toFixed(2),
    }

}
