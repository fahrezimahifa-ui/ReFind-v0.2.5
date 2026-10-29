const fs = require('node:fs'), path = require('node:path');
const {spawnSync} = require('node:child_process');
let count = 0;
for (const folder of ['js', 'tools']) for (const file of fs.readdirSync(folder, {recursive: true})) {
  if (!/\.(?:js|cjs)$/.test(file) || file.split(path.sep).includes('node_modules')) continue;
  const result = spawnSync(process.execPath, ['--check', path.join(folder, file)], {stdio: 'inherit'});
  if (result.status !== 0) process.exit(result.status || 1);
  count++;
}
console.log('PASS JavaScript syntax: ' + count + ' files');
