const fs = require('fs');
const path = require('path');
const dir = path.join(process.cwd(), 'lib');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));
let count = 0;
for (const file of files) {
  const p = path.join(dir, file);
  let content = fs.readFileSync(p, 'utf8');
  const replaced = content.replace(/console\.error\('❌ Could not get current user:', userError\);/g, "if (userError?.name !== 'AuthSessionMissingError' && userError?.message !== 'Auth session missing!') { console.error('❌ Could not get current user:', userError); }");
  if (content !== replaced) {
    fs.writeFileSync(p, replaced);
    count++;
  }
}
console.log('Fixed files:', count);
