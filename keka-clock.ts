import { chromium } from 'playwright';
import { existsSync, writeFileSync } from 'fs';
import { gunzipSync } from 'zlib';

const action = process.argv[2] as 'in' | 'out';
if (action !== 'in' && action !== 'out') {
  console.error('Usage: npx ts-node keka-clock.ts <in|out>');
  process.exit(1);
}

const { KEKA_URL, KEKA_SESSION } = process.env;
if (!KEKA_URL) {
  console.error('Missing KEKA_URL.');
  process.exit(1);
}

const sessionPath = 'keka-session.json';

if (!existsSync(sessionPath)) {
  if (!KEKA_SESSION) {
    console.error(
      'No keka-session.json and no KEKA_SESSION env var.\n' +
      'Run "npm run login" locally, then "npm run upload-session" to push it to GitHub.'
    );
    process.exit(1);
  }
  const compressed = Buffer.from(KEKA_SESSION, 'base64');
  const json = gunzipSync(compressed).toString('utf-8');
  writeFileSync(sessionPath, json);
  console.log('Decoded and decompressed KEKA_SESSION env var into keka-session.json.');
}

const day = new Date().getDay();
if (day === 0 || day === 6) {
  console.log('Weekend — skipping.');
  process.exit(0);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: sessionPath,
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  try {
    await page.goto(KEKA_URL, { waitUntil: 'networkidle' });

    if (/login|signin/i.test(page.url())) {
      throw new Error(
        'Session expired — run "npm run login" locally, then "npm run upload-session" to refresh.'
      );
    }

    const label = action === 'in'
      ? /web clock-?in|clock-?in/i
      : /web clock-?out|clock-?out/i;

    let button = page.getByRole('button', { name: label }).first();
    const visible = await button.isVisible().catch(() => false);

    if (!visible) {
      // Dashboard "Welcome" view may not show the clock widget — navigate via sidebar + tab
      console.log('Clock button not on dashboard, navigating to Me > Attendance...');
      await page.getByRole('link', { name: /\bme\b/i }).first().click();
      await page.waitForLoadState('networkidle');
      const attTab = page.getByRole('link', { name: /attendance/i }).first();
      await attTab.waitFor({ state: 'visible', timeout: 10000 });
      await attTab.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `keka-attendance-${Date.now()}.png` });
      button = page.getByRole('button', { name: label }).first();
    }

    await button.waitFor({ state: 'visible', timeout: 15000 });
    await button.click();
    console.log(`Clicked ${action} button, waiting for confirmation...`);

    await page.waitForTimeout(2000);

    // Keka shows a confirmation dialog — click the confirm button
    const confirmBtn = page.getByRole('button', { name: /confirm|yes|ok|clock-?out|clock-?in/i }).first();
    try {
      await confirmBtn.waitFor({ state: 'visible', timeout: 5000 });
      await confirmBtn.click();
      console.log('Clicked confirmation button.');
    } catch {
      console.log('No confirmation dialog found — assuming direct action.');
    }

    await page.waitForTimeout(3000);
    await page.screenshot({ path: `keka-${action}-${Date.now()}.png` });
    console.log(`Clock-${action} done.`);
  } catch (err) {
    await page.screenshot({ path: `keka-error-${Date.now()}.png` }).catch(() => {});
    console.error(`Clock-${action} failed:`, err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
