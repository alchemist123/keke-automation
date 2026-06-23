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

    // Navigate directly to the home dashboard where the clock widget lives
    const baseUrl = KEKA_URL.replace(/\/$/, '');
    const dashUrl = `${baseUrl}/#/home/dashboard`;
    if (!page.url().includes('#/home/dashboard')) {
      console.log('Navigating to home dashboard...');
      await page.goto(dashUrl, { waitUntil: 'networkidle' });
    }

    // Wait for the "Time Today" widget to fully load
    const timeWidget = page.getByText(/time today/i).first();
    await timeWidget.waitFor({ state: 'visible', timeout: 20000 });
    console.log('Time Today widget loaded.');

    // Wait for the clock widget inside "Time Today" to fully render
    await page.waitForTimeout(3000);

    const label = action === 'in'
      ? /clock[- ]?in/i
      : /clock[- ]?out/i;

    // The clock button may not be a <button> element — try multiple selectors
    const candidates = [
      page.getByRole('button', { name: label }).first(),
      page.locator(`text=${action === 'in' ? 'Clock-in' : 'Clock-out'}`).first(),
      page.locator(`text=${action === 'in' ? 'Clock In' : 'Clock Out'}`).first(),
      page.locator(`text=${action === 'in' ? 'Web Clock In' : 'Web Clock Out'}`).first(),
    ];

    let clicked = false;
    for (const candidate of candidates) {
      try {
        await candidate.waitFor({ state: 'visible', timeout: 5000 });
        console.log(`Found clock element, clicking...`);
        await candidate.click();
        clicked = true;
        break;
      } catch {
        continue;
      }
    }

    if (!clicked) {
      // Dump page content near Time Today for debugging
      const html = await page.locator('body').innerHTML();
      const clockMatch = html.match(/clock.{0,100}/gi);
      console.log('Clock-related HTML fragments:', clockMatch?.slice(0, 5));
      throw new Error(`Could not find clock-${action} button with any selector.`);
    }
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
