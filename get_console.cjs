const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER ERROR:', msg.text());
    }
  });

  page.on('pageerror', error => {
    console.log('PAGE ERROR:', error.message);
  });

  await page.goto('http://localhost:3000');
  await page.waitForTimeout(2000);
  
  // also dump the DOM if it's empty
  const content = await page.content();
  if (!content.includes('CRIBRO ENGLISH')) {
      console.log("DOM might be empty or wrong:", content.substring(0, 500));
  } else if (content.includes('Rate exceeded')) {
      console.log("DOM includes 'Rate exceeded'");
  } else {
      console.log("DOM seems fine, checking for 'root' element content...");
      const rootHtml = await page.evaluate(() => document.getElementById('root')?.innerHTML || '');
      if (!rootHtml) {
          console.log("Root element is empty!");
      } else {
          console.log("Root element has content. Length:", rootHtml.length);
      }
  }

  await browser.close();
})();
