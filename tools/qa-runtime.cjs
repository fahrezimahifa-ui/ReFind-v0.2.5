// Shared discovery and fail-closed preflight. No main-app HTTP traffic.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const staging = process.env.REFIND_TEST_PROFILE === 'xampp-stage';
const docker = process.env.REFIND_TEST_PROFILE === 'ui-ux-dev';
const dev = docker || staging;
if(path.basename(root)==='refind-dev'&&!dev)throw new Error('refind-dev requires its explicit development test profile; legacy QA discovery is refused');
const target = staging ? path.resolve(root,'../refind-xampp-stage') : docker ? root : path.resolve(root, '../ReFind_0.2.0_Test');
const php = process.env.REFIND_PHP || (process.platform === 'win32' ? 'C:/xampp/php/php.exe' : 'php');
const base = staging ? 'http://localhost/refind-xampp-stage/' : docker ? 'http://localhost/refind-dev/' : 'http://localhost/ReFind_0.2.0_Test/';
const sessionName = staging ? 'refind_xampp_stage' : docker ? 'refind_ui_ux_dev' : 'refind_020_test';
const basePath = new URL(base).pathname;
function assertQa() {
  if (dev) { execFileSync(php, [path.join(root, 'tools/qa-guard.php'), target], {stdio:['ignore','pipe','pipe']}); return; }
  const marker = JSON.parse(fs.readFileSync(path.join(target, '.refind-b02-test.json'), 'utf8'));
  assert.equal(fs.realpathSync(marker.source), fs.realpathSync(root), 'QA ownership mismatch');
  execFileSync(php, [path.join(root, 'tools/qa-guard.php'), target], {stdio: ['ignore', 'pipe', 'pipe']});
}
function playwright() { return require(process.env.REFIND_PLAYWRIGHT_MODULE || 'playwright'); }
function chromePath() {
  if (process.env.REFIND_CHROME) return process.env.REFIND_CHROME;
  const local = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  return process.platform === 'win32' && fs.existsSync(local) ? local : playwright().chromium.executablePath();
}
module.exports = {root, target, php, base, basePath, sessionName, dev, assertQa, playwright, chromePath};
