// Front-end check for the photo-search results panel with a mocked visual-search API (no provider calls).
// Runs against an owned development profile (REFIND_TEST_PROFILE=xampp-stage or ui-ux-dev); the browser
// intercepts session.php (to switch the feature on) and visual-search.php (canned responses).
const qaRuntime = require('./qa-runtime.cjs');
qaRuntime.assertQa();
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const {chromium} = qaRuntime.playwright();
if (!qaRuntime.dev) throw new Error('Use a development profile; this check mocks the visual-search API.');
const base = qaRuntime.base;
const out = path.resolve(process.env.REFIND_EVIDENCE_DIR || path.join(qaRuntime.root, 'output/playwright/visual-results-ui'));
fs.mkdirSync(out, {recursive: true});
const accounts = JSON.parse(fs.readFileSync(path.join(qaRuntime.target, 'storage/setup/demo-accounts.json'), 'utf8')).accounts;
const photo = {name: 'query.jpg', mimeType: 'image/jpeg', buffer: fs.readFileSync(path.join(qaRuntime.root, 'tools/demo-photos/headphones-overview.jpg'))};
const results = [];
async function check(name, fn) { await fn(); results.push(name); console.log('PASS ' + name); }

(async () => {
  const browser = await chromium.launch({executablePath: qaRuntime.chromePath(), headless: true});
  try {
    for (const [width, height, theme] of [[1366, 768, 'dark'], [375, 812, 'light']]) {
      const context = await browser.newContext({viewport: {width, height}, colorScheme: theme});
      const page = await context.newPage();
      const errors = []; page.on('pageerror', e => errors.push(String(e)));
      let mode = 'matches', items = [];
      await page.route('**/api/session.php', async route => {
        const response = await route.fetch(); const body = await response.json();
        await route.fulfill({response, json: {...body, visual_search_enabled: body.authenticated && body.user?.role === 'STUDENT'}});
      });
      await page.route('**/api/visual-search.php', async route => {
        await new Promise(r => setTimeout(r, 400));
        if (mode === 'matches') return route.fulfill({json: {ok: true, state: 'matches', items}});
        if (mode === 'no_match') return route.fulfill({json: {ok: true, state: 'no_match', items: []}});
        return route.fulfill({status: 429, headers: {'Retry-After': '60'}, json: {ok: false, code: 'visual_rate_limited', message: 'Photo search has reached a temporary limit. Try again later or search by keyword.'}});
      });
      await page.goto(base + 'login.html');
      await page.fill('#email', 'student-a@refind.test'); await page.fill('#password', accounts['student-a@refind.test'].password);
      await Promise.all([page.waitForURL('**/index.html'), page.click('#login-submit')]);
      items = (await page.evaluate(async () => (await (await fetch('api/items.php?active=1&limit=3')).json()).items))
        .map((item, index) => ({...item, match_label: index === 0 ? 'very_similar' : 'similar'}));
      assert.ok(items.length >= 2, 'stage needs reports with photos');
      await page.goto(base + 'browse.html'); await page.waitForSelector('body[data-ready="true"]');

      await check(`${width}px ${theme}: matches render as a pinned, labelled panel with the query photo`, async () => {
        await page.click('#visual-toggle'); await page.setInputFiles('#visual-photo', photo);
        await page.waitForFunction(() => !document.querySelector('#visual-submit').disabled);
        await page.click('#visual-submit');
        await page.waitForSelector('.visual-skeleton');
        await page.waitForSelector('#visual-heading:visible');
        assert.equal(await page.locator('#visual-heading').innerText(), 'Possible Visual Matches');
        assert.equal(await page.locator('#visual-count').innerText(), String(items.length));
        assert.equal(await page.locator('#visual-query-thumb').isVisible(), true);
        assert.equal(await page.locator('#visual-results .discovery-card').count(), items.length);
        assert.equal(await page.locator('#visual-results .match-label.very_similar').innerText(), 'Very similar');
        assert.equal(await page.locator('#visual-results .match-label.similar').count(), items.length - 1);
        assert.equal(await page.locator('#visual-results a.card-details').count(), items.length);
        assert.equal(await page.locator('#all-reports-heading').isVisible(), true);
        assert.equal(await page.evaluate(() => document.activeElement.id), 'visual-outcome');
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal page overflow');
        await page.locator('#visual-outcome').screenshot({path: path.join(out, `matches-${width}-${theme}.png`)});
      });
      await check(`${width}px ${theme}: no-match and limit states stay in the panel with a keyword fallback`, async () => {
        mode = 'no_match'; await page.click('#visual-submit');
        await page.waitForFunction(() => document.querySelector('#visual-status').textContent === 'No sufficiently similar matches.');
        assert.equal(await page.locator('#visual-fallback').isVisible(), true);
        assert.equal(await page.locator('#visual-results .discovery-card').count(), 0);
        mode = 'limit'; await page.click('#visual-submit');
        await page.waitForFunction(() => document.querySelector('#visual-status').textContent.includes('temporary limit'));
        assert.equal(await page.locator('#visual-status').innerText(), 'Photo search has reached a temporary limit. Try again later or search by keyword.');
        await page.locator('#visual-outcome').screenshot({path: path.join(out, `limit-${width}-${theme}.png`)});
        await page.click('#visual-keyword'); assert.equal(await page.evaluate(() => document.activeElement.id), 'filter-q');
      });
      await check(`${width}px ${theme}: Clear hides the panel and the All reports heading`, async () => {
        await page.click('#visual-panel-clear');
        assert.equal(await page.locator('#visual-outcome').isHidden(), true);
        assert.equal(await page.locator('#all-reports-heading').isHidden(), true);
        assert.equal(await page.locator('#visual-upload img').count(), 0);
      });
      assert.deepEqual(errors, []);
      await context.close();
    }
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(out, 'visual-results-ui.json'), JSON.stringify({scope: 'Mocked visual-search API on an owned development profile', results}, null, 2) + '\n');
})().catch(error => { console.error(error); process.exit(1); });
