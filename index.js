#!/usr/bin/env node
"use strict";

const path = require('path');
const fs = require('fs-extra');
const puppeteer = require('puppeteer');

const [, , cdnBase = 'cdn.byu.edu'] = process.argv;
const URL = require('url').URL;

(async () => {
    console.log(cdnBase);

    const content = getPageContent(cdnBase);

    const contentPath = path.join(__dirname, 'html', cdnBase + '-content.html');

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
        let url = req.url();

        if (url.startsWith('https://cdn.byu.edu')) {
            url = url.replace('https://cdn.byu.edu', 'https://' + cdnBase);
        }
        // const parsed = new URL(url);
        //
        // if (parsed.host === 'cdn.byu.edu' && parsed.host !== cdnBase) {
        //     parsed.host = cdnBase;
        // }

        req.continue({
            url: url
        });
    });

    let hits = 0;
    let misses = 0;

    page.on('response', resp => {
        const headers = resp.headers();
        const c = headers['x-cache'];
        if (!c) {
            return;
        } else if (c && c.startsWith('Hit')) {
            hits++;
        } else {
            misses++;
        }
    });

    await page.tracing.start({});

    // const loadPromise = new Promise((resolve, reject) => page.on('load', async () => {
    //     try {
    //         const traceData = await page.tracing.stop();
    //         resolve();
    //     } catch (err) {
    //         reject(err);
    //     }
    // }));

    // await page.setContent(content);
    await page.goto(contentUrl, {waitUntil: ['load', 'networkidle0']});

    console.log('goto finished');

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

    await results(start.ts, end.ts, hits, misses);
})().catch(err => {
    console.error(err);
    process.exit(1);
});

async function results(start, end, hits, misses) {
    const resultsDir = path.join(__dirname, 'results');
    await fs.ensureDir(resultsDir);
    const resultsFile = path.join(resultsDir, `${cdnBase}-results.csv`);
    if (!await fs.pathExists(resultsFile)) {
        await fs.appendFile(resultsFile, `Timestamp,Start,End,Duration,Hits,Misses`);
    }

    await fs.appendFile(resultsFile, `\n${new Date().toISOString()},${start},${end},${end - start},${hits},${misses}`);
}


function getPageContent(cdnBase) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <link rel="stylesheet" href="https://${cdnBase}/byu-theme-components/latest/byu-theme-components.min.css">
    <script async src="https://${cdnBase}/byu-theme-components/latest/byu-theme-components.min.js"></script>
</head>

<body>
<byu-header mobile-max-width="700px" home-url="http://web.byu.edu" max-width="900px">
    <span slot="site-title">Component Demos</span>

    <byu-search slot="search"></byu-search>

    <byu-user-info slot="user" id="user-info">
        <a slot="login" id="sign-in" href="#login">Sign In</a>
        <a slot="logout" id="sign-out" href="#logout">Sign Out</a>
    </byu-user-info>

    <byu-menu slot="nav" class="transparent">
        <a href="docs/index.html">Main Docs</a>
        <a href="#nav1" class="current">Nav Item 1</a>
        <a href="#nav2">Nav Item 2</a>
        <a href="#nav3">Nav Item 3</a>
        <a href="#nav4">Nav Item 4</a>
        <a href="#nav5">Nav Item 5</a>
        <a href="#nav5">Nav Item 5</a>
        <a href="#nav5">Nav Item 5</a>
        <a href="#nav5">Nav Item 5</a>
    </byu-menu>

</byu-header>
<byu-footer>
    <byu-footer-column>
        <byu-social-media-links>
            <a class="facebook" href="https://www.facebook.com">Facebook</a>
            <a class="instagram" href="https://www.instagram.com">Insta</a>
            <a class="twitter" href="https://www.twitter.com">Twitter</a>
            <a class="gplus" href="https://plus.google.com">GPlus</a>
            <a class="youtube" href="https://www.youtube.com">YouTube</a>
            <a class="rss" href="#">RSS</a>
        </byu-social-media-links>
    </byu-footer-column>
</byu-footer>
</body>
</html>
    `
}
