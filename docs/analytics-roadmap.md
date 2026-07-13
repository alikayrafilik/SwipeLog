# SwipeLog analytics implementation

## Rules

- Every custom event carries `schema_version=1`.
- Event parameters never contain email, username, display name, biography, notes, reviews, search text, movie/list titles, URLs, or friend/user identifiers.
- Counts, rating, position, account age, and elapsed time use buckets where practical.
- Recommendation impressions fire only after at least 50% of the tracked view is visible for 500 ms.
- Firebase's automatic `first_open`, `session_start`, and engagement events remain the source for app-open/session reporting; SwipeLog does not send a duplicate `app_opened` event.

## Primary funnels

Create these explorations in Firebase/GA4 after the release has collected data:

1. Recommendation conversion: `recommendation_impression` → `browse_section_item_opened` or `discover_movie_opened` → `watchlist_added` → `movie_logged`.
2. Discover adoption: `discover_session_started` → `discover_card_viewed` → `discover_card_action` → `discover_session_completed`.
3. Search conversion: `search` (result=success) → `search_result_opened` → `watchlist_added` or `movie_logged`.
4. Tier List adoption: `tier_list_opened` → `tier_list_created` → `tier_list_edited` → `tier_list_completed` → `tier_list_shared`.
5. Profile engagement: `screen_view` (Profile) → `profile_stats_viewed` or `profile_stat_opened` → `profile_edit_started` → `profile_edit_saved`.
6. Social loop: `friend_search_started` → `friend_profile_opened` → `friend_request_sent` → `friend_request_accepted` → `shared_watchlist_created`.
7. Retention helpers: `watchlist_added` → `release_notification_opened` → `movie_logged`.

Recommended key events are `onboarding_completed`, `watchlist_added`, `movie_logged`, `tier_list_completed`, `tier_list_shared`, `friend_request_accepted`, and `shared_watchlist_created`.

## Validation

- Run `npm run check:analytics` for schema, event-name, legacy-name, instrumentation, and privacy checks.
- Use Firebase DebugView on a development build to verify parameter values and funnel order before enabling production dashboards.
- Compare events by `schema_version`, app version, platform, locale, and the low-cardinality `source`/`surface` fields.
