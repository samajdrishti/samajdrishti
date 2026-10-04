const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\prema\\.gemini\\antigravity-ide\\brain\\b519b9f9-ddf5-4b5e-b064-096bcd576ed3';

async function test() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--window-size=1440,960'],
    defaultViewport: { width: 1440, height: 960 }
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' });
  await page.type('input[type="email"]', 'admin@samajdrishti.gov.in');
  await page.type('input[type="password"]', 'Admin@123');
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => !!localStorage.getItem('samaj_drishti_token'), { timeout: 10000 });
  await new Promise(r => setTimeout(r, 1500));

  await page.goto('http://localhost:5173/procedure', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, '06_field_procedure.png') });
  await browser.close();
  console.log('Saved 06_field_procedure.png');
}
test();
