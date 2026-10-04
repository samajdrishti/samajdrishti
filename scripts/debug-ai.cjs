const puppeteer = require('puppeteer-core');

async function test() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new'
  });
  const page = await browser.newPage();
  page.on('response', async res => {
    if (res.url().includes('/api/admin/ai')) {
      console.log('API_RESP:', res.status(), res.url());
      try {
        const json = await res.json();
        console.log('BODY:', JSON.stringify(json).slice(0, 150));
      } catch(e) {
        console.log('BODY_ERR:', e.message);
      }
    }
  });

  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' });
  await page.type('input[type="email"]', 'admin@samajdrishti.gov.in');
  await page.type('input[type="password"]', 'Admin@123');
  await page.click('button[type="submit"]');
  await new Promise(r => setTimeout(r, 2000));

  console.log('Navigating to /ai-insights...');
  await page.goto('http://localhost:5173/ai-insights', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 4000));
  await browser.close();
}
test();
