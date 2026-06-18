# Cloud Sync Setup

SwipeLog stores movie data and profile data locally first. When auth and cloud sync are enabled, the app also backs that state up to Supabase so a user can sign out, reinstall the app, or sign in on another device without losing data.

## Required Environment

Set these values in `.env`:

```env
EXPO_PUBLIC_ENABLE_AUTH=true
EXPO_PUBLIC_ENABLE_CLOUD_SYNC=true
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Cloud sync is intentionally disabled unless `EXPO_PUBLIC_ENABLE_AUTH=true`. Do not grant `anon` table write access for app state; synced data belongs to authenticated users only.

Keep `.env` out of Git. Use `.env.example` for placeholders only.

## Required Supabase SQL

Run these migrations in Supabase Dashboard > SQL Editor, in this order:

1. `supabase/migrations/20260612000000_create_user_app_state.sql`
2. `supabase/migrations/20260618000000_delete_user_rpc.sql`

The first migration creates `public.user_app_state`, enables row-level security, and allows authenticated users to manage only their own app state.

The second migration creates the `delete_user()` RPC used by the app's account deletion flow.

## What Syncs

The `user_app_state` row is keyed by `auth.users.id`.

- `movie_store`: logs, diary entries, ratings, favorites, watchlist, lists, discovery history
- `profile`: display name, username, bio, profile image URI, banner URI, featured movie ids

## Expected Behavior

If cloud sync is configured:

- Sign out and sign back in on the same device: data returns
- Delete and reinstall the app, then sign in: data returns
- Sign in on another device: data returns

If cloud sync is not configured:

- Same-device local data can remain until the app is deleted
- Reinstalling the app removes local data
- Other devices will not receive the user's data

## Verification Checklist

1. Create a test account.
2. Log at least one watched movie.
3. Edit the profile name or bio.
4. Confirm a row appears in Supabase:

```sql
select user_id, movie_store is not null as has_movie_store, profile is not null as has_profile, updated_at
from public.user_app_state;
```

5. Sign out and sign back in.
6. Confirm movie data and profile data return.
7. Test on a second device or simulator with the same account.

## Troubleshooting

If the app logs `PGRST205` for `public.user_app_state`, the migration has not been applied to the connected Supabase project.

If auth works but data does not sync, check:

- `.env` points to the intended Supabase project
- `EXPO_PUBLIC_ENABLE_CLOUD_SYNC=true`
- the `user_app_state` table exists
- row-level security policies exist
- the user is authenticated when saving data
