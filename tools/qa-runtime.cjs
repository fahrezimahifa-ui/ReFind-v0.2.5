// Shared discovery and fail-closed preflight. No main-app HTTP traffic.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const staging = process.env.REFIND_TEST_PROFILE === 'xampp-stage';
const docker = process.env.REFIND_TEST_PROFILE === 'ui-ux-dev';
const rc = process.env.REFIND_TEST_PROFILE === 'v1-rc';
const dev = docker || staging || rc;
if(path.basename(root)==='refind-dev'&&!(docker||staging))throw new Error('refind-dev requires its explicit development test profile; legacy QA discovery is refused');
if((path.basename(root)==='refind-v1-rc')!==rc)throw new Error('The v1-rc test profile runs only from, and is required by, the refind-v1-rc worktree');
const owner = process.env.REFIND_QA_OWNER_ROOT ? fs.realpathSync(process.env.REFIND_QA_OWNER_ROOT) : root;
if(owner!==root){
  assert.equal(dev,false,'Explicit QA owner is only for native QA');
  const common=folder=>fs.realpathSync(execFileSync('git',['-C',folder,'rev-parse','--path-format=absolute','--git-common-dir'],{encoding:'utf8'}).trim());
  assert.equal(common(owner),common(root),'QA sync source and owner must share the Git repository');
}
const target = staging ? path.resolve(root,'../refind-xampp-stage') : (docker||rc) ? root : path.resolve(owner, '../ReFind_0.2.0_Test');
const php = process.env.REFIND_PHP || (process.platform === 'win32' ? 'C:/xampp/php/php.exe' : 'php');
const origin=process.env.REFIND_QA_ORIGIN||'http://localhost';
assert.match(origin,/^http:\/\/(?:localhost|127\.0\.0\.1)(?::[0-9]{1,5})?$/,'QA origin must be loopback');
const base = staging ? 'http://localhost/refind-xampp-stage/' : docker ? 'http://localhost/refind-dev/' : rc ? 'http://localhost/refind-v1-rc/' : origin+'/ReFind_0.2.0_Test/';
const sessionName = staging ? 'refind_xampp_stage' : docker ? 'refind_ui_ux_dev' : rc ? 'refind_v1rc_test' : 'refind_020_test';
const basePath = new URL(base).pathname;
function assertQa() {
  if (dev) { execFileSync(php, [path.join(root, 'tools/qa-guard.php'), target], {stdio:['ignore','pipe','pipe']}); return; }
  const marker = JSON.parse(fs.readFileSync(path.join(target, '.refind-b02-test.json'), 'utf8'));
  assert.equal(fs.realpathSync(marker.source), fs.realpathSync(owner), 'QA ownership mismatch');
  execFileSync(php, [path.join(root, 'tools/qa-guard.php'), target], {stdio: ['ignore', 'pipe', 'pipe']});
}
function playwright() { return require(process.env.REFIND_PLAYWRIGHT_MODULE || 'playwright'); }
function chromePath() {
  if (process.env.REFIND_CHROME) return process.env.REFIND_CHROME;
  const local = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  return process.platform === 'win32' && fs.existsSync(local) ? local : playwright().chromium.executablePath();
}
module.exports = {root, target, php, base, basePath, sessionName, dev, assertQa, playwright, chromePath};
