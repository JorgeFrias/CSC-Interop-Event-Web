const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
    });
    const page = await browser.newPage();
    
    // Set viewport to see more
    await page.setViewport({ width: 1280, height: 2000 });

    const responsesDir = 'responses';
    if (!fs.existsSync(responsesDir)) fs.mkdirSync(responsesDir);
    
    let responseCount = 0;

    // Listen for all responses
    page.on('response', async (response) => {
        const url = response.url();
        const contentType = response.headers()['content-type'] || '';
        
        if (url.includes('jotform.com') || contentType.includes('json')) {
            try {
                if (response.status() === 200) {
                    const text = await response.text();
                    const filename = `res_${responseCount++}_${path.basename(url.split('?')[0]) || 'index'}.txt`.replace(/[^a-z0-9._-]/gi, '_');
                    fs.writeFileSync(path.join(responsesDir, filename), `URL: ${url}\n\n${text}`);
                }
            } catch (e) {
                // console.error('Error reading response:', e);
            }
        }
    });

    console.log("Going to URL...");
    try {
        await page.goto('https://eu.jotform.com/tables/260613670172351', { waitUntil: 'networkidle2', timeout: 60000 });
        
        // Wait for potential table rendering
        await new Promise(r => setTimeout(r, 10000));
        
        console.log("Taking screenshot...");
        await page.screenshot({ path: 'screenshot.png', fullPage: true });

        // Evaluate window data
        const __data = await page.evaluate(() => {
            return {
                url: window.location.href,
                title: document.title,
                keys: Object.keys(window).filter(k => k.startsWith('__')),
                hasStore: !!window.store,
                hasRedux: !!window.__REDUX_STATE__
            };
        });
        fs.writeFileSync('window_data_detailed.json', JSON.stringify(__data, null, 2));

    } catch (err) {
        console.error("Error during navigation:", err);
    }

    await browser.close();
    console.log("Done.");
})();
