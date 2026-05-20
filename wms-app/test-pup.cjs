const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));

  page.on('dialog', async dialog => {
    console.log('BROWSER DIALOG:', dialog.message());
    await dialog.accept();
  });

  console.log('Navigating to http://localhost:5173/');
  await page.goto('http://localhost:5173/');
  await new Promise(r => setTimeout(r, 2000));
  
  const hasLoginBtn = await page.$('.login-btn') !== null;
  if (hasLoginBtn) {
    console.log('Logging in...');
    const inputs = await page.$$('input');
    await inputs[0].type('admin');
    await inputs[1].type('admin123');
    await page.click('.login-btn');
    await new Promise(r => setTimeout(r, 10000));
  } else {
    console.log('No login button found.');
    await new Promise(r => setTimeout(r, 3000));
  }
  
  console.log('Done.');
  await browser.close();
})();
