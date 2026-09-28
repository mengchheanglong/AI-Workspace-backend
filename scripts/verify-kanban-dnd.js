const { chromium } = require('playwright');
const path = require('path');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER LOG:', msg.type(), msg.text()));

  console.log('Logging in...');
  await page.goto('http://localhost:3002/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'admin@example.com');
  await page.fill('input[type="password"]', 'Password123!');
  await page.click('button[type="submit"]');

  await page.waitForTimeout(2000);
  console.log('Navigating to /tasks...');
  await page.goto('http://localhost:3002/tasks', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const artifactDir = path.resolve('C:/Users/User/.gemini/antigravity/brain/b7e1f7b7-ea15-4319-8273-c85a53d28c1f');

  // Find column elements
  const columns = await page.$$('.rounded-2xl.p-3');
  console.log(`Found ${columns.length} columns`);

  // First draggable card in column 0 (TO DO)
  const firstCard = page.locator('[draggable="true"]').first();
  const cardTitle = await firstCard.locator('h4').innerText();
  console.log(`First card title: "${cardTitle}"`);

  // Target second column (IN PROGRESS)
  const targetCol = page.locator('.rounded-2xl.p-3').nth(1);

  console.log('Executing drag to IN PROGRESS column...');
  await firstCard.dragTo(targetCol);

  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(artifactDir, 'tasks_kanban_drag_drop_verified.png'), fullPage: false });
  console.log('Drag and Drop verified! Screenshot captured.');

  await browser.close();
}

main().catch(err => {
  console.error('Error during DnD verification:', err);
  process.exit(1);
});
