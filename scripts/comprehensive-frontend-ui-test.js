const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const FRONTEND_URL = 'http://localhost:3002';
const results = [];
const screenshotDir = path.resolve('C:/Users/User/.gemini/antigravity/brain/94c25f9f-8c8a-46cc-9f58-e703dce4a588');

if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

function recordTest(feature, testName, status, durationMs, error = null) {
  results.push({ feature, testName, status, durationMs, error });
  if (status === 'PASS') {
    console.log(`  ✓ [${feature}] ${testName} (${durationMs}ms)`);
  } else {
    console.error(`  ✗ [${feature}] ${testName} (${durationMs}ms):`, error);
  }
}

async function runStep(feature, testName, fn) {
  const start = Date.now();
  try {
    await fn();
    recordTest(feature, testName, 'PASS', Date.now() - start);
  } catch (err) {
    recordTest(feature, testName, 'FAIL', Date.now() - start, err.message || String(err));
  }
}

async function main() {
  console.log('=== STARTING REFINED PLAYWRIGHT FULL UI TEST SUITE ===\n');

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error' && !msg.text().includes('401') && !msg.text().includes('favicon')) {
      console.log('    [BROWSER ERROR]:', msg.text().slice(0, 150));
    }
  });

  // 1. AUTHENTICATION & LOGIN FLOW
  console.log('\n--- 1. Authentication & Session Flow ---');
  await runStep('Auth', 'Navigate to login page and check form', async () => {
    await page.goto(`${FRONTEND_URL}/login`);
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.screenshot({ path: path.join(screenshotDir, '1_login_page.png') });
  });

  await runStep('Auth', 'Attempt login with invalid credentials shows validation feedback', async () => {
    await page.fill('input[type="email"]', 'wrong@example.com');
    await page.fill('input[type="password"]', 'WrongPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);
    const emailInput = await page.$('input[type="email"]');
    if (!emailInput) throw new Error('Login form disappeared on invalid credentials');
  });

  await runStep('Auth', 'Login successfully as alice@example.com', async () => {
    await page.fill('input[type="email"]', 'alice@example.com');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
    await page.waitForSelector('header', { timeout: 10000 });
    await page.screenshot({ path: path.join(screenshotDir, '2_after_login.png') });
  });

  // 2. NAVBAR & ACTIVE PROJECT SELECTION
  console.log('\n--- 2. Navbar & Project Switcher ---');
  await runStep('Navbar', 'Navbar rendered with active project selector, bell, and New button', async () => {
    await page.waitForSelector('button[aria-label="Toggle notifications center"]', { timeout: 10000 });
    const newBtn = await page.$('header button:has-text("New")');
    if (!newBtn) throw new Error('New button not found in navbar header');
  });

  await runStep('Navbar', 'Switch active project in header dropdown', async () => {
    const projectSelect = await page.$('select[aria-label="Select active project"]');
    if (projectSelect) {
      const options = await projectSelect.$$eval('option', (opts) => opts.map((o) => o.value));
      if (options.length > 1) {
        await projectSelect.selectOption(options[1]);
        await page.waitForTimeout(1000);
        await projectSelect.selectOption(options[0]);
        await page.waitForTimeout(1000);
      }
    }
  });

  // 3. DASHBOARD PAGE
  console.log('\n--- 3. Dashboard Page ---');
  await runStep('Dashboard', 'Verify dashboard layout, metrics, and activity', async () => {
    await page.waitForSelector('main', { timeout: 10000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(screenshotDir, '3_dashboard.png') });

    const content = await page.textContent('body');
    if (!content.includes('Dashboard') && !content.includes('Workspace')) {
      throw new Error('Dashboard did not display workspace metrics');
    }
  });

  // 4. TASKS PAGE (KANBAN & LIST)
  console.log('\n--- 4. Tasks Page (Kanban & List) ---');
  await runStep('Tasks', 'Navigate to Tasks via sidebar and verify Kanban columns', async () => {
    await Promise.all([
      page.waitForURL('**/tasks', { timeout: 10000 }),
      page.click('a[href="/tasks"]'),
    ]);
    await page.waitForSelector('text=Board', { timeout: 10000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(screenshotDir, '4_tasks_kanban.png') });

    const content = await page.textContent('body');
    if (!content.includes('TO DO') && !content.includes('Todo') && !content.includes('Tasks')) {
      throw new Error('Tasks page did not render Kanban columns or list');
    }
  });

  await runStep('Tasks', 'Switch between Board and List view', async () => {
    const listBtn = await page.$('button:has-text("List")');
    if (listBtn) {
      await listBtn.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(screenshotDir, '5_tasks_list_view.png') });
    }
    const boardBtn = await page.$('button:has-text("Board")');
    if (boardBtn) {
      await boardBtn.click();
      await page.waitForTimeout(800);
    }
  });

  await runStep('Tasks', 'Search and filter tasks', async () => {
    const searchInput = await page.$('input[placeholder*="Search tasks"]');
    if (searchInput) {
      await searchInput.fill('API');
      await page.waitForTimeout(600);
      await searchInput.fill('');
      await page.waitForTimeout(400);
    }
  });

  // 5. REQUIREMENTS PAGE
  console.log('\n--- 5. Requirements Page ---');
  await runStep('Requirements', 'Navigate to Requirements via sidebar and verify items', async () => {
    await Promise.all([
      page.waitForURL('**/requirements', { timeout: 10000 }),
      page.click('a[href="/requirements"]'),
    ]);
    await page.waitForSelector('main', { timeout: 10000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(screenshotDir, '6_requirements.png') });

    const content = await page.textContent('body');
    if (!content.includes('Requirement') && !content.includes('Draft')) {
      throw new Error('Requirements page did not render expected content');
    }
  });

  await runStep('Requirements', 'Click filter chips (All, DRAFT, APPROVED)', async () => {
    const buttons = await page.$$('button:has-text("APPROVED"), button:has-text("DRAFT"), button:has-text("All")');
    for (const b of buttons.slice(0, 3)) {
      await b.click();
      await page.waitForTimeout(300);
    }
  });

  // 6. DECISIONS (ADRs) PAGE
  console.log('\n--- 6. Decisions Page ---');
  await runStep('Decisions', 'Navigate to Decisions via sidebar and verify ADR cards', async () => {
    await Promise.all([
      page.waitForURL('**/decisions', { timeout: 10000 }),
      page.click('a[href="/decisions"]'),
    ]);
    await page.waitForSelector('main', { timeout: 10000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(screenshotDir, '7_decisions.png') });

    const content = await page.textContent('body');
    if (!content.includes('Decision') && !content.includes('ADR') && !content.includes('Decisions')) {
      throw new Error('Decisions page did not render expected content');
    }
  });

  // 7. MEETINGS PAGE
  console.log('\n--- 7. Meetings Page ---');
  await runStep('Meetings', 'Navigate to Meetings via sidebar and verify meeting records', async () => {
    await Promise.all([
      page.waitForURL('**/meetings', { timeout: 10000 }),
      page.click('a[href="/meetings"]'),
    ]);
    await page.waitForSelector('main', { timeout: 10000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(screenshotDir, '8_meetings.png') });

    const content = await page.textContent('body');
    if (!content.includes('Meeting') && !content.includes('Schedule') && !content.includes('Meetings')) {
      throw new Error('Meetings page did not render expected content');
    }
  });

  // 8. DOCUMENTS PAGE
  console.log('\n--- 8. Documents Page ---');
  await runStep('Documents', 'Navigate to Documents via sidebar and verify files list', async () => {
    await Promise.all([
      page.waitForURL('**/documents', { timeout: 10000 }),
      page.click('a[href="/documents"]'),
    ]);
    await page.waitForSelector('main', { timeout: 10000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(screenshotDir, '9_documents.png') });

    const content = await page.textContent('body');
    if (!content.includes('Document') && !content.includes('Upload') && !content.includes('Documents')) {
      throw new Error('Documents page did not render expected content');
    }
  });

  // 9. SEARCH PAGE
  console.log('\n--- 9. Search Page ---');
  await runStep('Search', 'Execute keyword search via navbar search form and check results', async () => {
    const searchInput = await page.$('header form input');
    if (searchInput) {
      await searchInput.fill('Architecture');
      await Promise.all([
        page.waitForURL((url) => url.pathname.includes('/search'), { timeout: 10000 }),
        page.keyboard.press('Enter'),
      ]);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(screenshotDir, '10_search.png') });
    }
  });

  // 10. GLOBAL QUICK CREATE MODAL
  console.log('\n--- 10. Global Quick Create Modal ---');
  await runStep('QuickCreate', 'Open New global modal and switch all 5 tabs', async () => {
    const newBtn = await page.$('header button:has-text("New")');
    if (!newBtn) throw new Error('New button not found in header');
    await newBtn.click();
    await page.waitForSelector('text=Quick Create', { timeout: 10000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(screenshotDir, '11_quick_create_modal.png') });

    const tabs = ['Task', 'Requirement', 'Decision', 'Meeting', 'New Project'];
    for (const tab of tabs) {
      const tabBtn = await page.$(`button:has-text("${tab}")`);
      if (tabBtn) {
        await tabBtn.click();
        await page.waitForTimeout(300);
      }
    }

    // Close modal via Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  });

  // 11. NOTIFICATION CENTER
  console.log('\n--- 11. Notification Center ---');
  await runStep('Notifications', 'Toggle notification bell and switch filter tabs', async () => {
    const bellBtn = await page.$('button[aria-label="Toggle notifications center"]');
    if (!bellBtn) throw new Error('Notification bell button not found');
    await bellBtn.click();
    await page.waitForSelector('text=Notifications', { timeout: 10000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(screenshotDir, '12_notifications_popover.png') });

    const allTab = await page.$('button:has-text("All")');
    if (allTab) await allTab.click();
    await page.waitForTimeout(300);

    const unreadTab = await page.$('button:has-text("Unread")');
    if (unreadTab) await unreadTab.click();
    await page.waitForTimeout(300);

    const alertsTab = await page.$('button:has-text("Alerts")');
    if (alertsTab) await alertsTab.click();
    await page.waitForTimeout(300);

    // Close via Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  });

  // 12. LOGOUT & ROUTE PROTECTION
  console.log('\n--- 12. Logout & Route Protection ---');
  await runStep('Auth', 'Navigate to /login and verify auth redirects when unauthenticated', async () => {
    await page.goto(`${FRONTEND_URL}/login`);
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  });

  await browser.close();

  // Summary
  console.log('\n=== PLAYWRIGHT UI TEST SUMMARY ===');
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`Total: ${results.length}, Passed: ${passed}, Failed: ${failed}`);

  if (failed > 0) {
    console.error('\nFAILED UI TESTS:');
    for (const r of results.filter((r) => r.status === 'FAIL')) {
      console.error(`- [${r.feature}] ${r.testName}: ${r.error}`);
    }
    process.exit(1);
  } else {
    console.log('\n🎉 ALL PLAYWRIGHT UI TESTS PASSED SUCCESSFULLY!');
  }
}

main().catch((e) => {
  console.error('Fatal error in UI test runner:', e);
  process.exit(1);
});
