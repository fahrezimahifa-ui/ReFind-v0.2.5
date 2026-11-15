// Stable/default visual-search posture: the feature stays off for Students outside the exact QA pilot identity.
// Sends no provider request (the gate refuses before any image work) and leaves no records behind.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const qa = require('./qa-runtime.cjs');

qa.assertQa();
const pilotIdentity = execFileSync(qa.php, ['-r', 'require $argv[1]; require $argv[2]; echo json_encode(visual_enabled());',
  path.join(qa.target, 'app/config.php'), path.join(qa.target, 'app/visual-config.php')], {encoding: 'utf8'});
const out = process.env.REFIND_EVIDENCE_DIR || path.join(qa.root, 'output/playwright/visual-disabled', new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(out, {recursive: true});
const accounts = JSON.parse(fs.readFileSync(path.join(qa.target, 'storage/setup/demo-accounts.json'), 'utf8')).accounts;
const db = (query, values = []) => JSON.parse(execFileSync(qa.php, [path.join(qa.target, 'tools/b02-fixture.php')],
  {input: JSON.stringify({action: 'query', query, values}), encoding: 'utf8'})).rows;
const checks = [];
const pass = name => { checks.push(name); console.log('PASS ' + name); };
const photo = {name: 'fixture.jpg', mimeType: 'image/jpeg', buffer: fs.readFileSync(path.join(qa.root, 'tools/demo-photos/headphones-overview.jpg'))};

(async () => {
  const {request} = qa.playwright();
  const guest = await request.newContext(), student = await request.newContext();
  try {
    assert.equal(JSON.parse(pilotIdentity), false, 'Visual search must be disabled outside the QA pilot');
    pass('visual_enabled() is false for this installation identity');
    assert.equal((await guest.post(qa.base + 'api/visual-search.php', {multipart: {'photo[]': photo}})).status(), 401);
    pass('Guests are refused before any photo handling');
    const boot = await (await student.get(qa.base + 'api/session.php')).json();
    const login = await student.post(qa.base + 'api/auth.php', {form: {action: 'login', email: accounts['student-a@refind.test'].email,
      password: accounts['student-a@refind.test'].password}, headers: {'X-CSRF-Token': boot.csrf}});
    assert.equal(login.status(), 200, 'synthetic Student sign-in failed');
    const csrf = (await login.json()).csrf;
    const session = await (await student.get(qa.base + 'api/session.php')).json();
    assert.equal(session.visual_search_enabled, false);
    pass('Session bootstrap reports photo search unavailable to a signed-in Student');
    const embeddings = Number(db('SELECT COUNT(*) AS n FROM item_photo_embeddings')[0].n);
    const refused = await student.post(qa.base + 'api/visual-search.php', {headers: {'X-CSRF-Token': csrf}, multipart: {'photo[]': photo}});
    assert.equal(refused.status(), 403);
    assert.equal((await refused.json()).code, 'visual_disabled');
    pass('Photo search endpoint refuses a signed-in Student with visual_disabled');
    const items = Number(db('SELECT COUNT(*) AS n FROM items')[0].n);
    const optIn = await student.post(qa.base + 'api/items.php', {headers: {'X-CSRF-Token': csrf}, multipart: {
      action: 'create', type: 'FOUND', title: 'Synthetic visual opt-in probe', description: 'Must be refused', category_id: '1',
      location_id: '35', date: '2026-10-10', clue: 'Synthetic clue', visual_opt_in: '1', 'photos[]': photo}});
    assert.equal(optIn.status(), 422);
    assert.ok(Object.keys((await optIn.json()).fields || {}).includes('visual_opt_in'), 'Expected the visual_opt_in field error');
    assert.equal(Number(db('SELECT COUNT(*) AS n FROM items')[0].n), items, 'A refused opt-in must not create a report');
    assert.equal(Number(db('SELECT COUNT(*) AS n FROM item_photo_embeddings')[0].n), embeddings, 'No embedding work may be queued');
    pass('Report photo indexing opt-in is refused without creating a report or queueing embeddings');
    fs.writeFileSync(path.join(out, 'visual-disabled-results.json'), JSON.stringify({scope: 'Visual search disabled posture on owned QA; no provider calls', passed: true, checks}, null, 2) + '\n');
  } finally {
    await guest.dispose(); await student.dispose();
  }
})().catch(error => {
  fs.writeFileSync(path.join(out, 'visual-disabled-results.json'), JSON.stringify({passed: false, checks, failure: error.message}, null, 2) + '\n');
  console.error(error); process.exitCode = 1;
});
