const fs = require('node:fs');
const path = require('node:path');

const hostingDir = path.join(__dirname, '..', 'hosting');
const htmlFiles = fs.readdirSync(hostingDir).filter((name) => name.endsWith('.html'));
const failures = [];

for (const name of htmlFiles) {
  const content = fs.readFileSync(path.join(hostingDir, name), 'utf8');
  if (content.includes('SUPPORT_EMAIL_PLACEHOLDER')) {
    failures.push(`${name}: support email is not configured`);
  }
  if (!content.includes('<meta name="viewport"')) {
    failures.push(`${name}: viewport metadata is missing`);
  }
}

if (failures.length) {
  console.error(`Hosting content is not release-ready:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`Hosting content OK: ${htmlFiles.length} pages checked.`);
