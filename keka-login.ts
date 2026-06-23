import { chromium } from 'playwright';

const { KEKA_URL } = process.env;
if (!KEKA_URL) {
  console.error('Set KEKA_URL in your .env first.');
  process.exit(1);
}

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(KEKA_URL);
  console.log('\n  Log in manually now — email, password, and the OTP from Outlook.');
  console.log('  Once you are sitting on the Keka dashboard, come back here');
  console.log('  and press Enter.\n');

  await new Promise<void>((resolve) => process.stdin.once('data', () => resolve()));

  await context.storageState({ path: 'keka-session.json' });
  console.log('Saved session to keka-session.json');
  console.log('\nTo upload to GitHub Actions, run:');
  console.log('  npm run upload-session');
  await browser.close();
})();
