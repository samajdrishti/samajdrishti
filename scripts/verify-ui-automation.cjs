const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\prema\\.gemini\\antigravity-ide\\brain\\b519b9f9-ddf5-4b5e-b064-096bcd576ed3';

async function run() {
  console.log('Autonomous UI Verification running...');
  console.log('Launching system Chrome at:', CHROME_PATH);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,960'],
    defaultViewport: { width: 1440, height: 960 }
  });

  const results = {};

  try {
    const page = await browser.newPage();

    // 1. Sign in as Admin
    console.log('[1/5] Signing into Command Center...');
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' });
    await page.type('input[type="email"]', 'admin@samajdrishti.gov.in');
    await page.type('input[type="password"]', 'Admin@123');
    await page.click('button[type="submit"]');

    // Wait until logged in
    await page.waitForFunction(() => !!localStorage.getItem('samaj_drishti_token'), { timeout: 10000 });
    await new Promise(r => setTimeout(r, 1500));
    console.log('  -> Authenticated. Current URL:', page.url());

    // 2. AI Insights & Analytics
    console.log('[2/5] Testing AI Insights & Analytics (/ai-insights)...');
    await page.goto('http://localhost:5173/ai-insights', { waitUntil: 'networkidle2' });
    // Wait for the table rows to appear
    await page.waitForSelector('tbody tr', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 1500));

    const aiRows = await page.$$eval('tbody tr', rows => rows.length);
    console.log(`  -> AI Anomalies rendered: ${aiRows} rows`);
    results.aiInsightsRows = aiRows;

    const aiScreenshot = path.join(ARTIFACTS_DIR, '01_ai_insights.png');
    await page.screenshot({ path: aiScreenshot, fullPage: false });
    console.log('  -> Saved screenshot:', aiScreenshot);

    // Test anomaly type filter (e.g. filter by geofence_breach)
    try {
      const typeSelect = await page.$('#type-filter-select');
      if (typeSelect) {
        await typeSelect.click();
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (e) {}

    // 3. Users & Roles
    console.log('[3/5] Testing Users & Roles (/users)...');
    await page.goto('http://localhost:5173/users', { waitUntil: 'networkidle2' });
    await page.waitForSelector('tbody tr', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 1500));

    const userRows = await page.$$eval('tbody tr', rows => rows.length);
    console.log(`  -> Users rendered: ${userRows} rows`);
    results.usersCount = userRows;

    const usersScreenshot = path.join(ARTIFACTS_DIR, '02_users_roles.png');
    await page.screenshot({ path: usersScreenshot, fullPage: false });
    console.log('  -> Saved screenshot:', usersScreenshot);

    // 4. Audit Logs & Forensic Dossier Modal
    console.log('[4/5] Testing Audit Logs & Forensic Modal (/audit-logs)...');
    await page.goto('http://localhost:5173/audit-logs', { waitUntil: 'networkidle2' });
    await page.waitForSelector('tbody tr', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 1500));

    const auditRows = await page.$$eval('tbody tr', rows => rows.length);
    console.log(`  -> Audit events rendered: ${auditRows} rows`);
    results.auditRows = auditRows;

    const auditScreenshot = path.join(ARTIFACTS_DIR, '03_audit_trail.png');
    await page.screenshot({ path: auditScreenshot, fullPage: false });
    console.log('  -> Saved screenshot:', auditScreenshot);

    // Open first Inspect modal
    console.log('  -> Opening Audit Proof Dossier modal...');
    const inspectBtn = await page.$('tbody tr:first-child button');
    if (inspectBtn) {
      await inspectBtn.click();
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
      await new Promise(r => setTimeout(r, 1000));

      const modalScreenshot = path.join(ARTIFACTS_DIR, '04_audit_proof_modal.png');
      await page.screenshot({ path: modalScreenshot, fullPage: false });
      console.log('  -> Saved modal screenshot:', modalScreenshot);
      results.modalOpened = true;

      // Close modal
      const closeBtn = await page.$('[role="dialog"] button');
      if (closeBtn) await closeBtn.click();
      await new Promise(r => setTimeout(r, 500));
    }

    // 5. Evidence Records & Integrity
    console.log('[5/5] Testing Evidence Vault (/evidence)...');
    await page.goto('http://localhost:5173/evidence', { waitUntil: 'networkidle2' });
    await page.waitForSelector('tbody tr', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 1500));

    const evidenceRows = await page.$$eval('tbody tr', rows => rows.length);
    console.log(`  -> Evidence items rendered: ${evidenceRows} rows`);
    results.evidenceRows = evidenceRows;

    const evidenceScreenshot = path.join(ARTIFACTS_DIR, '05_evidence_records.png');
    await page.screenshot({ path: evidenceScreenshot, fullPage: false });
    console.log('  -> Saved screenshot:', evidenceScreenshot);

    console.log('\n=============================================');
    console.log('AUTONOMOUS TEST SUMMARY:');
    console.log(JSON.stringify(results, null, 2));
    console.log('=============================================\n');

  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
