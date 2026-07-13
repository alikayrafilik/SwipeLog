const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const analyticsPath = path.join(root, 'src', 'services', 'analytics.ts');
const analyticsSource = fs.readFileSync(analyticsPath, 'utf8');

const eventMapMatch = analyticsSource.match(/export interface AnalyticsEventMap \{([\s\S]*?)\n\}/u);
if (!eventMapMatch) throw new Error('AnalyticsEventMap could not be found.');

const eventNames = new Set(
  [...eventMapMatch[1].matchAll(/^  ([a-z][a-z0-9_]+):/gmu)].map((match) => match[1])
);

const requiredEvents = [
  'screen_view',
  'onboarding_completed',
  'search',
  'recommendation_impression',
  'browse_section_item_opened',
  'discover_session_started',
  'discover_card_viewed',
  'discover_card_action',
  'movie_opened',
  'watchlist_added',
  'movie_logged',
  'library_tab_viewed',
  'tier_list_opened',
  'tier_list_created',
  'tier_list_edited',
  'tier_list_completed',
  'tier_list_shared',
  'profile_stats_viewed',
  'profile_edit_saved',
  'friend_request_sent',
  'shared_watchlist_opened',
  'notification_preference_changed',
  'letterboxd_import_completed',
  'data_export_completed',
  'account_deletion_completed',
];

const forbiddenParams = [
  'bio', 'display_name', 'email', 'friend_id', 'list_name', 'name', 'note', 'query',
  'review', 'title', 'url', 'user_id', 'username',
];

const failures = [];
for (const event of requiredEvents) {
  if (!eventNames.has(event)) failures.push(`Missing required event: ${event}`);
}
for (const event of eventNames) {
  if (event.length > 40) failures.push(`Event exceeds Firebase's 40-character limit: ${event}`);
}
for (const param of forbiddenParams) {
  if (new RegExp(`\\b${param}\\??\\s*:`, 'u').test(eventMapMatch[1])) {
    failures.push(`PII/high-cardinality parameter is present in AnalyticsEventMap: ${param}`);
  }
}

const sourceFiles = [];
const walk = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (/\.(ts|tsx)$/u.test(entry.name)) sourceFiles.push(fullPath);
  }
};
walk(path.join(root, 'src'));

const usedEvents = new Set();
for (const file of sourceFiles) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/trackEvent\(\s*['"]([a-z0-9_]+)['"]/gu)) usedEvents.add(match[1]);
  for (const match of source.matchAll(/event=['"]([a-z0-9_]+)['"]/gu)) usedEvents.add(match[1]);
  if (/trackEvent\(\s*['"](?:app_opened|movie_added_to_watchlist|discover_card_swiped)['"]/u.test(source)) {
    failures.push(`Legacy event name remains in ${path.relative(root, file)}`);
  }
}
for (const event of usedEvents) {
  if (!eventNames.has(event)) failures.push(`Used event is not declared in AnalyticsEventMap: ${event}`);
}
for (const event of requiredEvents) {
  if (!usedEvents.has(event)) failures.push(`Required event has no instrumentation call: ${event}`);
}

if (!/schema_version:\s*SCHEMA_VERSION/u.test(analyticsSource)) {
  failures.push('schema_version is not attached to every analytics event.');
}
if (!/sanitizeAnalyticsParams/u.test(analyticsSource)) {
  failures.push('Analytics privacy sanitizer is missing.');
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log(`Analytics contract OK: ${eventNames.size} declared events, ${usedEvents.size} instrumented events.`);
