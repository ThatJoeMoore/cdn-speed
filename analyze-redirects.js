"use strict";

const fs = require('fs-extra');

const parse = require('csv-parse/lib/sync');
const stats = require('stats-lite');
const StatArray = require('statsjs');
const {table} = require('table');
const path = require('path');

(async () => {
    // console.log('------------- prod -----------');
    const results = await analyze('redirect-results.csv');

    showTable('By Mean', results, (one, two) => one.total.mean - two.total.mean);
    showTable('By p99', results, (one, two) => one.total.p99 - two.total.p99);

//    showTable('By Request p99', results, (one, two) => one.request.p99 - two.request.p99);
//    showTable('By Parse p99', results, (one, two) => one.parse.p99 - two.parse.p99);

    // .sort((one, two) => one.p99 - two.p99)

    // console.log('------------- beta -----------');

})().catch(err => console.error(err));

function showTable(label, results, sorter) {
    const cells = [
        [
            'Name',
            'Results',
            // 'Outliers',
            'Min (ms)',
            'Max (ms)',
            'Total Mean (ms)',
            'Total StdDev',
            'Total p99 (ms)',
            'Request Mean (ms)',
            'Request StdDev',
            'Request p99 (ms)',
            'Parse Mean (ms)',
            'Parse StdDev',
            'Parse p99 (ms)',
        ],
    ];

    for (const row of results.sort(sorter)) {
        cells.push([
            row.type,
            row.count,
            // row.outliers,
            row.total.min,
            row.total.max,
            row.total.mean,
            row.total.stdev,
            row.total.p99,
            row.request.mean,
            row.request.stdev,
            row.request.p99,
            row.parse.mean,
            row.parse.stdev,
            row.parse.p99,
        ])
    }

    console.log('=============', label, '=============');
    console.log(table(cells));
}

async function analyze(resultsFile) {
    const file = await fs.readFile(path.join(__dirname, resultsFile), 'utf8');

    const parsed = parse(file, {columns: true});

    const grouped = groupBy(parsed, it => it.type);

    return [...grouped.entries()].map(([type, entries]) => {
        // const statArray = StatArray(entries.map(it => Number(it.duration)));
        //
        // const durations = statArray.removeOutliers().toArray();
        const durations = entries.map(it => Number(it.total));

        const reqs = entries.map(it => Number(it.request));
        const parses = entries.map(it => Number(it.parse));

        return {
            type: type,
            count: durations.length,
            // outliers: entries.length - durations.length,
            total: statSummary(durations),
            request: statSummary(reqs),
            parse: statSummary(parses),
        };
    });
}

function statSummary(durations) {
    return {
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

function groupBy(list, keyGetter) {
    const map = new Map();
    list.forEach((item) => {
        const key = keyGetter(item);
        const collection = map.get(key);
        if (!collection) {
            map.set(key, [item]);
        } else {
            collection.push(item);
        }
    });
    return map;
}
