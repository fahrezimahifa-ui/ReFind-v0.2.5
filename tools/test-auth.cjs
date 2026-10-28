const qaRuntime = require('./qa-runtime.cjs');
qaRuntime.assertQa();
const {themedContext}=require('./qa-browser.cjs');
// Real Apache/PHP/MariaDB + browser tests. All mutations are isolated in _test.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {execFileSync, spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const testRoot = path.resolve(root, '..', 'ReFind_0.2.0_Test');
const base = 'http://localhost/ReFind_0.2.0_Test/';
const php = qaRuntime.php;
const {chromium} = qaRuntime.playwright();
const out = process.env.REFIND_EVIDENCE_DIR ? path.resolve(process.env.REFIND_EVIDENCE_DIR) : process.env.REFIND_EVIDENCE_BATCH ? path.join(root, 'docs', 'verification', process.env.REFIND_EVIDENCE_BATCH, 'auth') : path.join(root, 'docs', 'verification', 'b02');
assert.ok(fs.existsSync(testRoot) && fs.existsSync(path.join(testRoot, '.refind-b02-test.json')));
assert.equal(new URL(base).pathname, '/ReFind_0.2.0_Test/');
fs.mkdirSync(out, {recursive: true});
const accounts = JSON.parse(fs.readFileSync(path.join(testRoot, 'storage', 'setup', 'demo-accounts.json'), 'utf8')).accounts;
const A = accounts['student-a@refind.test'], B = accounts['student-b@refind.test'], BM = accounts['bm@refind.test'];
const run = 'B02-' + Date.now().toString(36);
const results = [], browserErrors = [], viewportChecks = [], files = [], fixtures = [];
let browser;
function driver(input) {return JSON.parse(execFileSync(php, [path.join(testRoot, 'tools', 'b02-fixture.php')], {input: JSON.stringify(input), encoding: 'utf8'}));}
function query(query, values = []) {return driver({action: 'query', query, values});}
function clearThrottle() {driver({action: 'clear_throttle'});}
function persist(extra = {}) {fs.writeFileSync(path.join(out, 'auth-results.json'), JSON.stringify({scope: 'B02 real auth + role/ownership foundation; business workflow mutations NOT implemented/tested', run, results, passed: results.length, browserErrors, viewportChecks, ...extra}, null, 2) + '\n');}
async function test(name, fn) {await fn(); results.push(name); persist(); console.log('PASS ' + results.length + ': ' + name);}

async function showAccountMenu(page) {
  if (await page.locator('#nav-toggle').isVisible() && await page.locator('#nav-toggle').getAttribute('aria-expanded') !== 'true') await page.click('#nav-toggle');
  if (await page.locator('#account-toggle').getAttribute('aria-expanded') !== 'true') await page.click('#account-toggle');
}

class Session {
  cookies = new Map(); csrf = ''; user = null;
  cookie() {return [...this.cookies].map(([k, v]) => k + '=' + v).join('; ');}
  id() {return this.cookies.get('refind_020_test');}
  async call(endpoint, values, options = {}) {
    const headers = {Cookie: this.cookie(), ...(options.headers || {})};
    const init = {redirect: 'manual', headers, method: options.method || (values === undefined ? 'GET' : 'POST')};
    if (values !== undefined) {
      const form = new FormData(); Object.entries(values).forEach(([k, v]) => form.append(k, v));
      init.body = form; headers['X-CSRF-Token'] = options.csrf === undefined ? this.csrf : options.csrf;
    }
    const response = await fetch(base + endpoint, init);
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(';'); const split = pair.indexOf('=');
      const name = pair.slice(0, split), value = pair.slice(split + 1);
      if (value) this.cookies.set(name, value); else this.cookies.delete(name);
    }
    const type = response.headers.get('content-type') || '';
    const bytes = Buffer.from(await response.arrayBuffer());
    const data = type.includes('application/json') ? JSON.parse(bytes.toString()) : bytes;
    return {status: response.status, headers: response.headers, data, text: bytes.toString()};
  }
  async init() {const r = await this.call('api/session.php'); assert.equal(r.status, 200); this.csrf = r.data.csrf; this.user = r.data.user; return this;}
  async login(account, returnTo = '') {await this.init(); const r = await this.call('api/auth.php', {action: 'login', email: account.email, password: account.password, return: returnTo}); assert.equal(r.status, 200, r.text); this.csrf = r.data.csrf; this.user = r.data.user; return r;}
}

function seedFixtures() {
  function item(owner, type, title, status = 1) {
    const id = query('INSERT INTO items(reporter_user_id,category_id,location_id,status_id,item_type,title,description,event_date,verification_clue) VALUES (?,1,35,?,?,?,\'Public fixture description\',\'2026-10-10\',\'PRIVATE-CLUE\')', [Number(owner.user_id), status, type, run + ' ' + title]).id;
    fixtures.push(id); query("INSERT INTO item_status_history(item_id,status_id,changed_by_user_id,note) VALUES (?,?,?,'Fixture created')", [Number(id), status, Number(owner.user_id)]); return id;
  }
  const lost = item(A, 'LOST', 'own Lost');
  const found = item(B, 'FOUND', 'Found pending', 4);
  const pickup = item(BM, 'FOUND', 'approved pickup', 5);
  const claim = query("INSERT INTO claims(item_id,claimant_user_id,ownership_answer) VALUES (?,?,'PRIVATE-ANSWER')", [Number(found), Number(A.user_id)]).id;
  const approved = query("INSERT INTO claims(item_id,claimant_user_id,ownership_answer,claim_status) VALUES (?,?,'Verified fixture','APPROVED')", [Number(pickup), Number(A.user_id)]).id;
  const handover = query('INSERT INTO handovers(claim_id,pickup_location_id,notes) VALUES (?,37,\'PRIVATE-PICKUP\')', [Number(approved)]).id;
  const photoContent = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64');
  function photo(collection, table, relation, column, kind) {
    const relative = collection + '/' + require('node:crypto').randomBytes(16).toString('hex') + '.png';
    const physical = path.join(testRoot, 'storage', relative); fs.writeFileSync(physical, photoContent); files.push(physical);
    if (table === 'item_photos') return {id: query('INSERT INTO item_photos(item_id,photo_kind,file_path) VALUES (?,?,?)', [Number(relation), kind, relative]).id, path: relative};
    return {id: query('INSERT INTO claim_photos(claim_id,file_path) VALUES (?,?)', [Number(relation), relative]).id, path: relative};
  }
  const publicPhoto = photo('items', 'item_photos', lost, 'item_id', 'ITEM');
  const privatePhoto = photo('evidence', 'item_photos', lost, 'item_id', 'OWNERSHIP');
  const claimPhoto = photo('claims', 'claim_photos', claim, 'claim_id');
  const notification = query("INSERT INTO notifications(user_id,item_id,claim_id,notification_type,title,message) VALUES (?,?,?,'FIXTURE','B02 fixture','PRIVATE-NOTIFICATION')", [Number(A.user_id), Number(found), Number(claim)]).id;
  return {lost, found, pickup, claim, approved, handover, publicPhoto, privatePhoto, claimPhoto, notification};
}

(async () => {
  const originalA = query('SELECT full_name,password_hash,role,is_active FROM users WHERE user_id=?', [Number(A.user_id)]).rows[0];
  const originalB = query('SELECT full_name,password_hash,role,is_active FROM users WHERE user_id=?', [Number(B.user_id)]).rows[0];
  const student = new Session(), second = new Session(), staff = new Session();
  clearThrottle();
  try {
    await test('Fresh schema has 14 tables, 2 views, 25 FK and correct handover enum', async () => {
      const counts = query("SELECT TABLE_TYPE,COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() GROUP BY TABLE_TYPE").rows;
      assert.equal(Number(counts.find(r => r.TABLE_TYPE === 'BASE TABLE').n), 14); assert.equal(Number(counts.find(r => r.TABLE_TYPE === 'VIEW').n), 2);
      assert.equal(Number(query("SELECT COUNT(*) AS n FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND CONSTRAINT_TYPE='FOREIGN KEY'").rows[0].n), 25);
      assert.equal(query("SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='handovers' AND COLUMN_NAME='handover_status'").rows[0].COLUMN_TYPE, "enum('PENDING','SCHEDULED','COMPLETED')");
    });
    await test('Repeat setup preserves accounts/password hashes and reference data', async () => {
      const before = query('SELECT user_id,email,password_hash FROM users ORDER BY user_id').rows;
      execFileSync(php, [path.join(testRoot, 'tools', 'setup-db.php')]); execFileSync(php, [path.join(testRoot, 'tools', 'setup-demo.php')]);
      assert.deepEqual(query('SELECT user_id,email,password_hash FROM users ORDER BY user_id').rows, before);
      assert.equal(Number(query('SELECT COUNT(*) AS n FROM campus_locations').rows[0].n), 40);
    });
    await test('Guest bootstrap has no implicit user; cookies HttpOnly/SameSite/scoped', async () => {
      const r = await student.call('api/session.php'); student.csrf = r.data.csrf;
      assert.equal(r.data.authenticated, false); assert.equal(r.data.user, null); assert.match(r.data.csrf, /^[a-f0-9]{64}$/);
      const cookie = r.headers.getSetCookie().join(';'); assert.match(cookie, /HttpOnly/i); assert.match(cookie, /SameSite=Lax/i); assert.match(cookie, /path=\/ReFind_0\.2\.0_Test\//i);
      assert.equal((await student.call('api/session.php', {account: 'admin'})).status, 405);
    });
    await test('Credential login rotates ID/token and resolves three roles from DB', async () => {
      const id = student.id(), csrf = student.csrf;
      const r = await student.call('api/auth.php', {action: 'login', email: A.email, password: A.password});
      assert.equal(r.status, 200); student.csrf = r.data.csrf; student.user = r.data.user;
      assert.notEqual(student.id(), id); assert.notEqual(student.csrf, csrf); assert.equal(student.user.role, 'STUDENT');
      await second.login(B); const bm = await staff.login(BM); assert.equal(bm.data.user.role, 'BUILDING_MANAGEMENT');
      assert.match(bm.data.redirect, /admin\.html$/); assert.notEqual(student.user.id, second.user.id);
      const old = new Session(); old.cookies.set('refind_020_test', id); assert.equal((await old.call('api/items.php')).status, 401);
      assert.equal((await student.call('api/items.php', {action: 'create'}, {csrf})).status, 403);
    });
    await test('Reload/bootstrap retains identity, with no credential/fingerprint exposure', async () => {
      const r = await student.call('api/session.php'); assert.equal(r.data.user.id, A.user_id);
      assert.equal(r.headers.get('cache-control').includes('no-store'), true);
      assert.ok(!r.text.includes('password_hash') && !r.text.includes('fingerprint') && !r.text.includes('dummy_hash'));
      assert.equal((await student.call('api/account.php')).data.profile.email, A.email);
    });
    await test('Wrong/unknown/inactive credentials share generic failure response', async () => {
      const wrong = new Session(); await wrong.init();
      const r1 = await wrong.call('api/auth.php', {action: 'login', email: A.email, password: 'WrongPassword!'});
      const r2 = await wrong.call('api/auth.php', {action: 'login', email: 'unknown@refind.test', password: 'WrongPassword!'});
      query('UPDATE users SET is_active=0 WHERE user_id=?', [Number(B.user_id)]);
      const r3 = await wrong.call('api/auth.php', {action: 'login', email: B.email, password: B.password});
      query('UPDATE users SET is_active=1 WHERE user_id=?', [Number(B.user_id)]);
      assert.equal(r1.status, 401); assert.deepEqual(r1.data, r2.data); assert.deepEqual(r2.data, r3.data);
    });
    await test('Forged client role/account/user_id and old demo switching cannot grant BM', async () => {
      assert.equal((await student.call('api/auth.php', {action: 'login', email: BM.email, password: BM.password, role: 'BUILDING_MANAGEMENT'})).status, 400);
      assert.equal((await student.call('api/session.php?account=admin')).status, 400);
      assert.equal((await student.call('api/staff.php')).status, 403);
      assert.equal((await student.call('api/account.php?user_id=' + B.user_id)).status, 400);
    });
    await test('Protected pages enforce role before delivering HTML, including case/query bypasses', async () => {
      for (const route of ['admin.html', 'ADMIN.HTML', 'admin.html?route=index.html', 'admin.html?role=BUILDING_MANAGEMENT']) assert.equal((await student.call(route)).status, 403, route);
      for (const route of ['report.html', 'claim.html', 'my-reports.html']) assert.equal((await staff.call(route)).status, 403);
      assert.equal((await staff.call('admin.html')).status, 200); assert.equal((await staff.call('index.html')).status, 302);
      assert.equal((await student.call('report.html')).status, 200, 'Authorized Student report page is implemented in B04');
      const guest = new Session(); const r = await guest.call('report.html?type=lost'); assert.equal(r.status, 302); assert.match(r.headers.get('location'), /login\.html\?return=/);
      assert.equal((await guest.call('page.php?route=admin.html')).status, 404);
    });
    await test('Guest/wrong-role protected API requests reject without DB mutations', async () => {
      const before = query('SELECT COUNT(*) AS n FROM items').rows;
      const guest = new Session(); await guest.init();
      for (const endpoint of ['items.php', 'claims.php', 'account.php', 'staff.php', 'notifications.php', 'handovers.php']) assert.equal((await guest.call('api/' + endpoint)).status, 401, endpoint);
      for (const endpoint of ['staff.php', 'handovers.php']) assert.equal((await student.call('api/' + endpoint, {action: 'review', id: '1'})).status, 403);
      assert.equal((await staff.call('api/items.php', {action: 'create'})).status, 403);
      assert.deepEqual(query('SELECT COUNT(*) AS n FROM items').rows, before);
    });
    await test('CSRF missing/stale and cross-origin mutations are denied', async () => {
      assert.equal((await student.call('api/auth.php', {action: 'logout'}, {csrf: ''})).status, 403);
      assert.equal((await student.call('api/auth.php', {action: 'logout'}, {headers: {Origin: 'https://outside.example'}})).status, 403);
      assert.equal((await student.call('api/notifications.php', {id: '1'}, {csrf: 'x'.repeat(64)})).status, 403);
      assert.equal((await student.call('api/session.php')).data.authenticated, true);
    });
    const f = seedFixtures();
    await test('Ownership guards reject cross-user edits/claims/profile and isolate own reads', async () => {
      assert.equal((await second.call('api/items.php?id=' + f.lost + '&editable=1')).status, 403);
      assert.equal((await second.call('api/items.php', {action: 'update', id: f.lost, user_id: A.user_id})).status, 403);
      assert.equal((await second.call('api/items.php', {action: 'delete', id: f.lost})).status, 403);
      assert.equal((await second.call('api/claims.php', {lostItemId: f.lost, itemId: f.pickup})).status, 403);
      assert.equal((await second.call('api/claims.php?id=' + f.claim)).status, 404);
      assert.equal((await second.call('api/handovers.php?id=' + f.handover)).status, 404);
      const own = await student.call('api/items.php?id=' + f.lost + '&editable=1'); assert.equal(own.status, 200); assert.equal(own.data.item.private_clue, 'PRIVATE-CLUE');
      assert.equal((await student.call('api/handovers.php?id=' + f.handover)).data.handovers[0].notes, 'PRIVATE-PICKUP');
      assert.equal((await second.call('api/items.php', {action: 'delete', id: f.found})).status, 409, 'Claims lock own report too');
    });
    await test('Public projections omit evidence/clue/email/NIM and private photos require BM', async () => {
      const projection = await second.call('api/items.php?id=' + f.lost); assert.ok(!projection.text.includes('PRIVATE-CLUE') && !projection.text.includes('verification_clue') && !projection.text.includes('ownership_photo') && !projection.text.includes(A.email) && !projection.text.includes(A.student_id));
      const guest = new Session(); assert.equal((await guest.call('api/photos.php?kind=item&id=' + f.publicPhoto.id)).status, 401);
      assert.equal((await guest.call('api/photos.php?kind=item&id=' + f.privatePhoto.id)).status, 401);
      assert.equal((await student.call('api/photos.php?kind=item&id=' + f.privatePhoto.id)).status, 403);
      assert.equal((await second.call('api/photos.php?kind=claim&id=' + f.claimPhoto.id)).status, 403);
      assert.equal((await staff.call('api/photos.php?kind=item&id=' + f.privatePhoto.id)).status, 200);
      assert.equal((await staff.call('api/photos.php?kind=claim&id=' + f.claimPhoto.id)).status, 200);
    });
    await test('Own notification read state persists; another user cannot mark it', async () => {
      assert.equal((await second.call('api/notifications.php', {id: f.notification})).status, 404);
      assert.equal((await student.call('api/notifications.php', {id: f.notification})).status, 200);
      assert.equal(Number(query('SELECT is_read FROM notifications WHERE notification_id=?', [Number(f.notification)]).rows[0].is_read), 1);
      assert.equal((await second.call('api/notifications.php')).data.notifications.some(n => String(n.notification_id) === f.notification), false);
    });
    await test('Mismatched public photo metadata cannot expose evidence/claim storage', async () => {
      const malformed = query("INSERT INTO item_photos(item_id,photo_kind,file_path) VALUES (?,'ITEM',?)", [Number(f.lost), f.privatePhoto.path]).id;
      const guest = new Session(); assert.equal((await guest.call('api/photos.php?kind=item&id=' + malformed)).status, 401);
      assert.equal((await second.call('api/photos.php?kind=item&id=' + malformed)).status, 404);
      query('DELETE FROM item_photos WHERE photo_id=?', [Number(malformed)]);
    });
    await test('Direct internal/config/storage/tool paths and traversal attempts are blocked', async () => {
      for (const route of ['app/config.php', 'APP/config.php', 'app/pages/bm.html', 'database/schema.sql', 'storage/setup/demo-accounts.json', 'storage/' + f.privatePhoto.path, 'tools/b02-fixture.php', 'api/bootstrap.php', 'API/BOOTSTRAP.PHP', '.env', '.git/config']) assert.equal((await fetch(base + route, {redirect: 'manual'})).status, 403, route);
      assert.equal((await student.call('api/items.php?id=1%20OR%201=1')).status, 400);
      assert.equal((await staff.call('api/photos.php?kind=item&id=../secret')).status, 400);
      assert.equal((await student.call('api/auth.php', undefined, {method: 'GET'})).status, 405);
    });
    await test('Logout destroys authorization and old session/token cannot be replayed', async () => {
      const s = new Session(); await s.login(A); const cookie = s.id(), token = s.csrf;
      assert.equal((await s.call('api/auth.php', {action: 'logout'})).status, 200);
      const old = new Session(); old.cookies.set('refind_020_test', cookie); old.csrf = token;
      assert.equal((await old.call('api/items.php')).status, 401); assert.equal((await old.call('admin.html')).status, 302);
      assert.equal((await old.call('api/auth.php', {action: 'logout'})).status, 401);
    });
    await test('Idle and absolute expiry invalidate real server sessions', async () => {
      for (const type of ['idle', 'absolute']) {
        const s = new Session(); await s.login(A); const before = s.id(); driver({action: 'expire', id: before, type});
        assert.equal((await s.call('api/items.php')).status, 401); assert.notEqual(s.id(), before);
        assert.equal((await s.call('api/session.php')).data.authenticated, false);
      }
    });
    await test('Inactive account revokes an existing login immediately', async () => {
      const s = new Session(); await s.login(B); query('UPDATE users SET is_active=0 WHERE user_id=?', [Number(B.user_id)]);
      assert.equal((await s.call('api/account.php')).status, 401);
      query('UPDATE users SET is_active=1 WHERE user_id=?', [Number(B.user_id)]);
    });
    await test('Role guards read current DB role instead of trusting session/client role', async () => {
      const s = new Session(); await s.login(A);
      query("UPDATE users SET role='BUILDING_MANAGEMENT' WHERE user_id=?", [Number(A.user_id)]);
      assert.equal((await s.call('api/staff.php')).status, 200); assert.equal((await s.call('report.html')).status, 403);
      query("UPDATE users SET role='STUDENT' WHERE user_id=?", [Number(A.user_id)]);
      assert.equal((await s.call('api/staff.php')).status, 403);
    });
    await test('Credential fingerprint revokes other sessions after hash change', async () => {
      clearThrottle(); const s1 = new Session(), s2 = new Session(); await s1.login(A); await s2.login(A);
      const newPassword = 'ChangedB02!-' + run;
      const hash = execFileSync(php, ['-r', 'echo password_hash(stream_get_contents(STDIN), PASSWORD_DEFAULT);'], {input: newPassword, encoding: 'utf8'});
      query('UPDATE users SET password_hash=? WHERE user_id=?', [hash, Number(A.user_id)]);
      assert.equal((await s1.call('api/account.php')).status, 401); assert.equal((await s2.call('api/account.php')).status, 401);
      const oldLogin = new Session(); await oldLogin.init(); assert.equal((await oldLogin.call('api/auth.php', {action: 'login', email: A.email, password: A.password})).status, 401);
      const updated = new Session(); await updated.login({...A, password: newPassword});
      query('UPDATE users SET password_hash=? WHERE user_id=?', [originalA.password_hash, Number(A.user_id)]);
    });
    await test('Safe return rejects external/traversal/wrong-role routes and allows authorized local routes', async () => {
      clearThrottle();
      for (const candidate of ['https://outside.example', '//outside.example', '../app/config.php', 'admin.html', '%2f%2foutside.example']) {
        const s = new Session(); const r = await s.login(A, candidate); assert.equal(r.data.redirect, '/ReFind_0.2.0_Test/index.html');
      }
      const s = new Session(); assert.equal((await s.login(A, 'report.html?type=lost')).data.redirect, '/ReFind_0.2.0_Test/report.html?type=lost');
      const b = new Session(); assert.equal((await b.login(BM, 'report.html')).data.redirect, '/ReFind_0.2.0_Test/admin.html');
    });
    await test('Throttling survives fresh sessions and serializes concurrent failed logins', async () => {
      clearThrottle();
      const sessions = await Promise.all(Array.from({length: 6}, async () => {const s = new Session(); await s.init(); return s;}));
      const outcomes = await Promise.all(sessions.map(s => s.call('api/auth.php', {action: 'login', email: A.email, password: 'WrongPassword!'})));
      assert.equal(outcomes.filter(r => r.status === 401).length, 5); assert.equal(outcomes.filter(r => r.status === 429).length, 1);
      const next = new Session(); await next.init(); const blocked = await next.call('api/auth.php', {action: 'login', email: A.email, password: A.password}); assert.equal(blocked.status, 429); assert.ok(Number(blocked.headers.get('Retry-After')) > 0);
      assert.ok(!fs.readFileSync(path.join(testRoot, 'storage', 'auth', 'attempts.json'), 'utf8').includes(A.email)); clearThrottle();
    });
    await test('Aggregate IP throttling blocks failures across different account emails', async () => {
      clearThrottle(); const s = new Session(); await s.init();
      for (let i = 0; i < 30; i++) assert.equal((await s.call('api/auth.php', {action: 'login', email: 'unknown-' + i + '@refind.test', password: 'WrongPassword!'})).status, 401);
      const next = await s.call('api/auth.php', {action: 'login', email: 'another@refind.test', password: 'WrongPassword!'}); assert.equal(next.status, 429); clearThrottle();
    });
    await test('Login rejects bcrypt suffix truncation beyond 72 bytes', async () => {
      clearThrottle(); const password = 'p'.repeat(72); const hash = execFileSync(php, ['-r','echo password_hash(stream_get_contents(STDIN), PASSWORD_DEFAULT);'], {input:password,encoding:'utf8'});
      query('UPDATE users SET password_hash=? WHERE user_id=?',[hash,Number(A.user_id)]);
      const accepted = new Session(); await accepted.login({...A,password});
      const rejected = new Session(); await rejected.init(); assert.equal((await rejected.call('api/auth.php',{action:'login',email:A.email,password:password+'x'})).status,401);
      query('UPDATE users SET password_hash=? WHERE user_id=?',[originalA.password_hash,Number(A.user_id)]); clearThrottle();
    });
    await test('CLI fixture rejects main database; no public debug endpoint', async () => {
      const denied = spawnSync(php, [path.join(root, 'tools', 'b02-fixture.php')], {input: JSON.stringify({action: 'query', query: 'SELECT 1'}), encoding: 'utf8'});
      assert.notEqual(denied.status, 0); assert.match(denied.stderr, /isolated _test/);
    });
    browser = await chromium.launch({executablePath: qaRuntime.chromePath(), headless: true});
    await test('Real browser Student/BM login, wrong-password recovery, logout and server page guards', async () => {
      clearThrottle(); const context = await themedContext(browser,{viewport: {width: 390, height: 844}}); const page = await context.newPage(); page.on('pageerror', e => browserErrors.push(String(e)));
      await page.goto(base + 'login.html'); await page.waitForSelector('body[data-ready="true"]');
      await page.fill('#email', A.email); await page.fill('#password', 'WrongPassword!'); await page.click('#login-submit'); await page.waitForFunction(() => !document.querySelector('#login-feedback').hidden && !document.querySelector('#login-submit').disabled);
      assert.match(await page.locator('#login-feedback').innerText(), /could not be verified/);
      await page.fill('#password', A.password); await page.click('#login-submit'); await page.waitForURL('**/index.html'); await page.waitForSelector('body[data-ready="true"]');
      assert.equal(await page.locator('[data-user-name]').innerText(), A.full_name); await page.reload(); await page.waitForSelector('body[data-ready="true"]');
      const forbidden = await page.goto(base + 'admin.html'); assert.equal(forbidden.status(), 403); assert.ok(!(await page.content()).includes('Staff access foundation'));
      await page.goto(base + 'index.html'); await page.waitForSelector('body[data-ready="true"]'); await showAccountMenu(page); await page.click('#logout'); await page.waitForURL('**/login.html'); await page.waitForSelector('body[data-ready="true"]');
      await page.fill('#email', BM.email); await page.fill('#password', BM.password); await page.click('#login-submit'); await page.waitForURL('**/admin.html'); await page.waitForSelector('body[data-ready="true"]');
      await page.screenshot({path: path.join(out, 'bm-authenticated.png'), fullPage: true}); await showAccountMenu(page); await page.click('#logout'); await page.waitForURL('**/login.html'); await context.close();
    });
    await test('Authentication UI works at five required viewports with keyboard controls', async () => {
      for (const [width, height] of [[360,800],[390,844],[768,1024],[1280,800],[1440,900]]) {
        const context = await themedContext(browser,{viewport: {width, height}}); const page = await context.newPage(); page.on('pageerror', e => browserErrors.push(String(e)));
        await page.goto(base + 'login.html'); await page.waitForSelector('body[data-ready="true"]');
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'overflow ' + width);
        await page.locator('#email').focus(); await page.keyboard.type(A.email); await page.keyboard.press('Tab'); await page.keyboard.type(A.password); await page.keyboard.press('Enter'); await page.waitForURL('**/index.html'); await page.waitForSelector('body[data-ready="true"]');
        await showAccountMenu(page); assert.ok(await page.locator('#logout').isVisible()); await page.locator('#logout').focus(); await page.keyboard.press('Enter'); await page.waitForURL('**/login.html'); await page.waitForSelector('body[data-ready="true"]');
        await page.screenshot({path: path.join(out, 'login-' + width + '.png'), fullPage: true}); viewportChecks.push({width, height, horizontalOverflow: false, keyboardLoginLogout: true}); await context.close();
      }
    });
    await test('Displayed DB names are escaped and produce no browser exceptions', async () => {
      query('UPDATE users SET full_name=? WHERE user_id=?', ['<img src=x onerror=alert(1)>', Number(A.user_id)]);
      const s = new Session(); await s.login(A); const context = await themedContext(browser);
      await context.addCookies([{name:'refind_020_test',value:s.id(),domain:'localhost',path:'/ReFind_0.2.0_Test/'}]); const page = await context.newPage(); page.on('pageerror', e => browserErrors.push(String(e)));
      await page.goto(base + 'index.html'); await page.waitForSelector('body[data-ready="true"]'); assert.equal(await page.locator('[data-user-name]').innerText(), '<img src=x onerror=alert(1)>'); assert.equal(await page.locator('[data-user-name] img').count(), 0);
      query('UPDATE users SET full_name=? WHERE user_id=?', [originalA.full_name, Number(A.user_id)]); await context.close(); assert.deepEqual(browserErrors, []);
    });
    persist({complete: true, chrome: browser.version()}); console.log('B02: ALL ' + results.length + ' SCENARIO GROUPS PASSED');
  } catch (error) {persist({complete:false, failure: String(error)}); throw error;}
  finally {
    query('UPDATE users SET full_name=?,password_hash=?,role=?,is_active=? WHERE user_id=?', [originalA.full_name, originalA.password_hash, originalA.role, Number(originalA.is_active), Number(A.user_id)]);
    query('UPDATE users SET full_name=?,password_hash=?,role=?,is_active=? WHERE user_id=?', [originalB.full_name, originalB.password_hash, originalB.role, Number(originalB.is_active), Number(B.user_id)]);
    for (const id of fixtures) {query('DELETE FROM notifications WHERE item_id=?',[Number(id)]); query('DELETE FROM items WHERE item_id=?',[Number(id)]);}
    for (const file of files) if (fs.existsSync(file)) fs.unlinkSync(file);
    clearThrottle(); if (browser) await browser.close();
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
