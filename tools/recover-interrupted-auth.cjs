if(require('node:path').basename(require('node:path').resolve(__dirname,'..'))==='refind-dev')throw new Error('Historical auth recovery is refused from the development worktree');
// Scoped recovery of the interrupted B02-mv3k0md9 test run only; never main data.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),test=path.resolve(root,'..','ReFind_0.2.0_Test'),php='C:\\xampp\\php\\php.exe';
assert.ok(fs.existsSync(path.join(test,'.refind-b02-test.json')));
function q(query,values=[]){return JSON.parse(execFileSync(php,[path.join(test,'tools','b02-fixture.php')],{input:JSON.stringify({action:'query',query,values}),encoding:'utf8'}));}
const receipt=JSON.parse(fs.readFileSync(path.join(test,'storage','setup','demo-accounts.json'),'utf8'));assert.equal(receipt.database,'refind_db_0_2_0_test');
const account=receipt.accounts['student-a@refind.test'];const record=q('SELECT password_hash FROM users WHERE user_id=?',[Number(account.user_id)]).rows[0];
function verifies(password){return execFileSync(php,['-r','$d=json_decode(stream_get_contents(STDIN),true);echo password_verify($d["password"],$d["hash"])?"yes":"no";'],{input:JSON.stringify({password,hash:record.password_hash}),encoding:'utf8'})==='yes';}
if(!verifies(account.password)){assert.ok(verifies('p'.repeat(72)),'Not the known interrupted bcrypt probe; do not overwrite');const hash=execFileSync(php,['-r','echo password_hash(stream_get_contents(STDIN),PASSWORD_DEFAULT);'],{input:account.password,encoding:'utf8'});q('UPDATE users SET password_hash=? WHERE user_id=?',[hash,Number(account.user_id)]);console.log('Recovered known 72-byte test probe on isolated Student A only.');}
const records=q("SELECT item_id,title FROM items WHERE item_id IN (52,53,54)").rows;const expected=new Set(['B02-mv3k0md9 own Lost','B02-mv3k0md9 Found pending','B02-mv3k0md9 approved pickup']);assert.ok(records.every(r=>expected.has(r.title)),'Unexpected record identity; stopped');
const ids=records.map(r=>Number(r.item_id));if(ids.length){const m=ids.map(()=>'?').join(','),paths=q('SELECT file_path FROM item_photos WHERE item_id IN ('+m+') UNION ALL SELECT p.file_path FROM claim_photos p JOIN claims c ON c.claim_id=p.claim_id WHERE c.item_id IN ('+m+')',[...ids,...ids]).rows;q('DELETE FROM notifications WHERE item_id IN ('+m+')',ids);q('DELETE FROM items WHERE item_id IN ('+m+')',ids);for(const r of paths){assert.match(r.file_path,/^(items|evidence|claims)\/[a-f0-9]{32}\.(jpg|png|webp)$/);const p=path.join(test,'storage',r.file_path);if(fs.existsSync(p))fs.unlinkSync(p);}}
console.log('Recovered interrupted run fixtures:',ids.length,'records. Main app untouched.');
