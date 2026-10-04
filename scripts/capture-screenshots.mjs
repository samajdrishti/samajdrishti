import puppeteer from 'puppeteer-core';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\prema\\.gemini\\antigravity-ide\\brain\\34f73eb7-36eb-4208-b188-1a93bf63d5b6';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function run() {
  console.log('Launching Edge browser...');
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  // --- Part 1: Admin Dashboard ---
  console.log('Navigating to Admin Dashboard (http://localhost:5173)...');
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: path.join(ARTIFACT_DIR, '01_admin_login.png') });
  console.log('Saved 01_admin_login.png');

  // Submit login on Admin page
  const signInBtn = await page.$('button[type="submit"], button:has-text("Sign in"), .login-btn');
  if (signInBtn) {
    console.log('Clicking Sign in button...');
    await signInBtn.click();
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, '02_admin_dashboard.png') });
    console.log('Saved 02_admin_dashboard.png');
  }

  // Click GIS Map link/tab if available
  try {
    const gisLink = await page.$('a[href="/gis"], a[href*="gis"], text/GIS Map');
    if (gisLink) {
      await gisLink.click();
      await new Promise(r => setTimeout(r, 3000));
      await page.screenshot({ path: path.join(ARTIFACT_DIR, '03_admin_gis_map.png') });
      console.log('Saved 03_admin_gis_map.png');
    }
  } catch (e) {
    console.log('GIS Map navigation error:', e.message);
  }

  // Click Monitoring link/tab if available
  try {
    const monLink = await page.$('a[href="/monitoring"], a[href*="monitoring"], text/Live Monitoring');
    if (monLink) {
      await monLink.click();
      await new Promise(r => setTimeout(r, 3000));
      await page.screenshot({ path: path.join(ARTIFACT_DIR, '04_admin_monitoring.png') });
      console.log('Saved 04_admin_monitoring.png');
    }
  } catch (e) {
    console.log('Monitoring navigation error:', e.message);
  }

  // --- Part 2: Mobile Field App ---
  console.log('Navigating to Mobile Field App (http://localhost:5174)...');
  const mobilePage = await browser.newPage();
  mobilePage.on('console', msg => console.log('MOBILE LOG:', msg.text()));
  mobilePage.on('pageerror', err => console.log('MOBILE ERROR:', err.message));

  await mobilePage.setViewport({ width: 412, height: 860, isMobile: true, hasTouch: true });
  await mobilePage.goto('http://localhost:5174', { waitUntil: 'networkidle2', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));
  await mobilePage.screenshot({ path: path.join(ARTIFACT_DIR, '05_mobile_login.png') });
  console.log('Saved 05_mobile_login.png');

  // Check if quick login button or login button exists
  const quickOfficial = await mobilePage.$('button:has-text("Field official"), button:has-text("Official"), .quick-login button');
  if (quickOfficial) {
    console.log('Clicking Field official quick login...');
    await quickOfficial.click();
  } else {
    // Fill credentials if inputs exist
    const emailInput = await mobilePage.$('input[type="email"], input[name="email"]');
    const passInput = await mobilePage.$('input[type="password"], input[name="password"]');
    const submitBtn = await mobilePage.$('button[type="submit"], .btn-primary');
    if (emailInput && passInput && submitBtn) {
      await emailInput.type('official1@samajdrishti.gov.in');
      await passInput.type('Official@123');
      await submitBtn.click();
    }
  }

  await new Promise(r => setTimeout(r, 3000));
  await mobilePage.screenshot({ path: path.join(ARTIFACT_DIR, '06_mobile_dashboard.png') });
  console.log('Saved 06_mobile_dashboard.png');

  // Try clicking first inspection
  try {
    const firstInspection = await mobilePage.$('.inspection-card, .card, [data-inspection-id]');
    if (firstInspection) {
      await firstInspection.click();
      await new Promise(r => setTimeout(r, 2000));
      await mobilePage.screenshot({ path: path.join(ARTIFACT_DIR, '07_mobile_inspection_detail.png') });
      console.log('Saved 07_mobile_inspection_detail.png');
    }
  } catch (e) {
    console.log('Inspection detail error:', e.message);
  }

  await browser.close();
  console.log('All screenshots captured successfully!');
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
