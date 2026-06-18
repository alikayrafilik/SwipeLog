# Archived Trailer Feed

The trailer feed prototype was archived on 2026-06-18 so it can be revisited in a later release without staying in the active Expo Router code path.

Archived files:

- `trailer-feed.tsx.archive`: former route entry from `src/app/trailer-feed.tsx`
- `trailer-feed-screen.tsx.archive`: former screen implementation from `src/components/trailer-feed-screen.tsx`

To restore this feature later:

1. Move `trailer-feed.tsx.archive` back to `src/app/trailer-feed.tsx`.
2. Move `trailer-feed-screen.tsx.archive` back to `src/components/trailer-feed-screen.tsx`.
3. Restore the `trailer-feed` Stack screen in `src/app/_layout.tsx`.
4. Restore a navigation entry point, such as the Discover header button.
5. Re-add `react-native-webview` if the archived player still uses YouTube embeds.
6. Re-add the trailer helper in `src/services/tmdb.ts` or replace it with a new trailer API approach.
