const { chromium } = require('playwright');
const path = require('path');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  page.on('console', (msg) => console.log('BROWSER LOG:', msg.type(), msg.text()));

  console.log('Logging in...');
  await page.goto('http://localhost:3002/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'admin@example.com');
  await page.fill('input[type="password"]', 'Password123!');
  await page.click('button[type="submit"]');

  await page.waitForTimeout(2000);
  console.log('Navigating to /requirements...');
  await page.goto('http://localhost:3002/requirements', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const artifactDir = path.resolve(
    'C:/Users/User/.gemini/antigravity/brain/b7e1f7b7-ea15-4319-8273-c85a53d28c1f',
  );

  // Screenshot full requirements page
  await page.screenshot({
    path: path.join(artifactDir, 'requirements_page_new_verified.png'),
    fullPage: false,
  });
  console.log('Requirements page screenshot captured.');

  // Test clicking "In Review 3" summary pill
  console.log('Clicking In Review pill filter...');
  const inReviewPill = page.locator('button:has-text("In Review")');
  await inReviewPill.click();
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(artifactDir, 'requirements_page_in_review_filtered.png'),
    fullPage: false,
  });

  // Reset filter by clicking Draft pill or all
  const allStatusSelect = page.locator('select').nth(1);
  await allStatusSelect.selectOption('ALL');
  await page.waitForTimeout(1000);

  // Click on the first requirement to open the detail modal
  console.log('Opening requirement detail modal...');
  const firstRow = page.locator('tbody tr').first();
  await firstRow.click();
  await page.waitForTimeout(1500);

  await page.screenshot({
    path: path.join(artifactDir, 'requirements_detail_modal_verified.png'),
    fullPage: false,
  });
  console.log('Requirement detail modal screenshot captured.');

  await browser.close();
  console.log('Verification completed successfully!');
}

main().catch((err) => {
  console.error('Error during requirements verification:', err);
  process.exit(1);
});
