const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER ERROR:', msg.text());
    }
  });

  page.on('pageerror', err => {
    console.log('UNCAUGHT PAGE ERROR:', err.message, err.stack);
  });

  await page.goto('http://localhost:3002/login');
  await page.fill('input[type="email"]', 'admin@example.com');
  await page.fill('input[type="password"]', 'Password123!');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);

  await page.goto('http://localhost:3002/integrations?app=mcp');
  await page.waitForTimeout(2500);

  await browser.close();
}

main().catch(console.error);
