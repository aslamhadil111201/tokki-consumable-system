const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.toString()));
  
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' });
  
  await page.type('input[placeholder="Masukkan username"]', 'admin');
  await page.type('input[placeholder="Masukkan password"]', 'admin123');
  
  await Promise.all([
    page.click('.login-btn'),
    page.waitForTimeout(3000)
  ]);
  
  const content = await page.content();
  if (content.includes('Username atau password salah') || content.includes('Login gagal')) {
    console.log("LOGIN FAILED in UI");
  } else if (content.includes('Dashboard')) {
    console.log("LOGIN SUCCESS in UI");
  } else {
    console.log("UNKNOWN UI STATE");
  }
  
  await browser.close();
})();
