"use strict";

const fs = require('fs-extra');

const parse = require('csv-parse/lib/sync');
const stats = require('stats-lite');
const {table} = require('table');
const {finished} = require('stream');
const path = require('path');

(async () => {
    // console.log('------------- prod -----------');
    const prod = await analyze('dev.cdn.byu.edu-results.csv');
    const beta = await analyze('beta.cdn.byu.edu-results.csv');

    const cells = [
        ['Name', 'Runs', 'Min (ms)', 'Max (ms)', 'Mean (ms)', 'Median (ms)', 'StdDev', 'p85 (ms)', 'p95 (ms)', 'p99 (ms)', 'Cache Efficiency', 'Reqs/load'],
        ['prod-like', prod.count, prod.min, prod.max, prod.mean, prod.median, prod.stdev, prod.p85, prod.p95, prod.p99, prod.efficiency, prod.reqs],
        ['beta', beta.count, beta.min, beta.max, beta.mean, beta.median, beta.stdev, beta.p85, beta.p95, beta.p99, beta.efficiency, beta.reqs],
    ];

    console.log(table(cells));

    // console.log('------------- beta -----------');

})().catch(err => console.error(err));

async function analyze(resultsFile) {
    const file = (await fs.readFile(path.join(__dirname, 'results-redirect-lambda', resultsFile), 'utf8')).split('\n').filter(it => it.length > 0).join('\n');

    const parsed = parse(file, {columns: true});

    const durations = parsed.map(it => Number(it.Duration) / 1000);
    const hits = parsed.reduce((total, it) => Number(it.Hits) + total, 0);
    const misses = parsed.reduce((total, it) => Number(it.Misses) + total, 0);

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
        efficiency: (hits / (hits + misses) * 100).toFixed(2),
        reqs: (hits + misses) / durations.length,
    }

}
