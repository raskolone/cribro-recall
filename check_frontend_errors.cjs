const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.text().includes('NaN')) {
      console.log('PAGE LOG:', msg.text());
    }
  });
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  
  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    
    // Fill login form
    await page.type('input[type="text"]', 'maciej.wyrozumski@gmail.com');
    await page.type('input[type="password"]', 'zaq1@WSX');
    
    // Click submit button
    const buttons = await page.$$('button');
    for (let btn of buttons) {
        const text = await page.evaluate(el => el.innerText, btn);
        if (text && (text.includes('Sign in') || text.includes('Zaloguj'))) {
            await btn.click();
            break;
        }
    }
    
    // Wait for network idle after login
    await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {});
    await new Promise(r => setTimeout(r, 6000));
    
  } catch (e) {
    console.error(e);
  }
  
  await browser.close();
})();
