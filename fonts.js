#!/usr/bin/env node
"use strict";

const path = require('path');
const fs = require('fs-extra');
const puppeteer = require('puppeteer');

const redirect = process.argv.includes('--redirect');
const mode = redirect ? 'redirect' : 'no-redirect';

(async () => {
    console.log(`Running font tests. mode=${mode}`);

    const content = getPageContent(redirect);

    const contentPath = path.join(__dirname, 'html', `${mode}-fonts-content.html`);

    await fs.ensureFile(contentPath);

    const contentUrl = 'file://' + contentPath;

    await fs.writeFile(contentPath, content);

    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    const client = await page.target().createCDPSession();

    await client.send('Network.enable');
    await client.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: 750 * 1024,
        uploadThroughput: 250 * 1024,
        latency: 100
    });

    await client.send('Emulation.setCPUThrottlingRate', {rate: 4});

    page.setRequestInterception(true);
    page.on('request', req => {
        req.continue({
            headers: Object.assign({}, req.headers, {'referer': 'https://font-metrics.cdn.byu.edu/'})
        });
    });

    page.on('response', resp => {
        const status = resp.status();
        if (status >= 400) {
            console.error(`Got error response from ${resp.url()}: ${status}`)
        }

    });

    await page.tracing.start({});

    await page.goto(contentUrl, {waitUntil: ['load', 'networkidle0']});

    const traceData = await page.tracing.stop();

    const trace = JSON.parse(traceData.toString());

    trace.traceEvents = trace.traceEvents.sort((one, two) => one.ts - two.ts);

    const events = trace.traceEvents.filter(it => it.cat.includes('devtools.timeline'));

    const start = events.find(it => {
        return it.name === 'ResourceSendRequest';
    });

    const names = ['ParseAuthorStyleSheet', 'EvaluateScript', 'PaintImage'];

    const end = events.reverse().find(it => {
        return names.includes(it.name);
    });

    await browser.close();

    console.log('dur', (end.ts - start.ts) / 1000);

    await results(start.ts, end.ts);
})().catch(err => {
    console.error(err);
    process.exit(1);
});

async function results(start, end) {
    const resultsDir = path.join(__dirname, 'font-results');
    await fs.ensureDir(resultsDir);
    const resultsFile = path.join(resultsDir, `${mode}-results.csv`);
    if (!await fs.pathExists(resultsFile)) {
        await fs.appendFile(resultsFile, `Timestamp,Start,End,Duration`);
    }

    await fs.appendFile(resultsFile, `\n${new Date().toISOString()},${start},${end},${end - start}`);
}


function getPageContent(redirect) {
    const link = redirect ? 'https://cloud.typography.com/75214/6517752/css/fonts.css' : 'https://cdn.byu.edu/theme-fonts/1.0.1/648398/FCD4E5085F13BFF9E.css';


    return `<!DOCTYPE html>
<html lang="en">
<head>
    <link rel="stylesheet" href="${link}" media="all">
</head>
<body>
</body>
</html>
`
}
