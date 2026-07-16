const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const errors = [];
const warnings = [];

const readJson = (name) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const exists = (name) => fs.existsSync(path.join(root, name));

const pngInfo = (name) => {
  const buffer = fs.readFileSync(path.join(root, name));
  const signature = buffer.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') throw new Error(`${name} is not a PNG file`);
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    colorType: buffer.readUInt8(25),
  };
};

const app = readJson('app.json').expo;
const eas = readJson('eas.json');

if (app.android?.package !== 'com.waage.SwipeLog') {
  errors.push('Android package does not match com.waage.SwipeLog.');
}
if (app.version !== '1.0.0') warnings.push(`Unexpected release version: ${app.version}`);
if (!eas.build?.production?.autoIncrement) errors.push('Production autoIncrement is not enabled.');
if (eas.cli?.appVersionSource !== 'remote') errors.push('EAS appVersionSource must be remote.');

const requiredFiles = [
  'app.config.js',
  'assets/images/play-store-icon.png',
  'assets/images/play-store-feature-graphic.png',
  'hosting/privacy.html',
  'hosting/terms.html',
  'hosting/delete-account.html',
  'hosting/index.html',
  'docs/play-store-listing.md',
  'docs/play-store-data-safety.md',
];
for (const file of requiredFiles) {
  if (!exists(file)) errors.push(`Required release file is missing: ${file}`);
}

if (exists('assets/images/play-store-icon.png')) {
  const icon = pngInfo('assets/images/play-store-icon.png');
  if (icon.width !== 512 || icon.height !== 512) errors.push('Play Store icon must be 512 × 512.');
  if (icon.colorType === 4 || icon.colorType === 6) errors.push('Play Store icon must not contain an alpha channel.');
}

if (exists('assets/images/play-store-feature-graphic.png')) {
  const feature = pngInfo('assets/images/play-store-feature-graphic.png');
  if (feature.width !== 1024 || feature.height !== 500) errors.push('Feature graphic must be 1024 × 500.');
}

for (const file of ['hosting/index.html', 'hosting/privacy.html', 'hosting/terms.html', 'hosting/delete-account.html']) {
  if (!exists(file)) continue;
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  if (content.includes('SUPPORT_EMAIL_PLACEHOLDER')) errors.push(`${file} still contains the support-email placeholder.`);
}

const firebaseFile = process.env.GOOGLE_SERVICES_JSON || path.join(root, 'google-services.json');
if (!fs.existsSync(firebaseFile)) {
  errors.push('Android Firebase config is missing. Set GOOGLE_SERVICES_JSON or add ignored google-services.json locally.');
}

const attributionTargets = [
  'src/app/(tabs)/profile.tsx',
  'src/app/movie/[id].tsx',
  'hosting/privacy.html',
  'hosting/terms.html',
];
const attributionText = attributionTargets
  .filter(exists)
  .map((file) => fs.readFileSync(path.join(root, file), 'utf8'))
  .join('\n');
if (!attributionText.includes('not endorsed or certified by TMDB')) errors.push('Required TMDB notice is missing.');
if (!attributionText.includes('JustWatch')) errors.push('JustWatch attribution is missing.');

const publicTargets = ['hosting', 'docs/play-store-listing.md', 'src/app'];
const forbidden = /\b(Codex|ChatGPT|OpenAI)\b/i;
const scan = (target) => {
  const absolute = path.join(root, target);
  if (!fs.existsSync(absolute)) return;
  const stat = fs.statSync(absolute);
  if (stat.isDirectory()) {
    for (const child of fs.readdirSync(absolute)) scan(path.join(target, child));
    return;
  }
  if (!/\.(html|md|ts|tsx|js|json)$/i.test(target)) return;
  if (forbidden.test(fs.readFileSync(absolute, 'utf8'))) errors.push(`Forbidden AI attribution found in ${target}.`);
};
publicTargets.forEach(scan);

warnings.forEach((warning) => console.warn(`Warning: ${warning}`));
if (errors.length) {
  console.error(`Release readiness failed (${errors.length}):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

console.log('Release readiness OK: configuration, legal pages, attribution, Firebase file, and store assets passed.');
