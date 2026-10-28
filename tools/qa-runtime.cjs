// Shared discovery and fail-closed preflight. No main-app HTTP traffic.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const target = path.resolve(root, '../ReFind_0.2.0_Test');
const php = process.env.REFIND_PHP || (process.platform === 'win32' ? 'C:/xampp/php/php.exe' : 'php');
const base = 'http://localhost/ReFind_0.2.0_Test/';
function assertQa() {
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
module.exports = {root, target, php, base, assertQa, playwright, chromePath};
