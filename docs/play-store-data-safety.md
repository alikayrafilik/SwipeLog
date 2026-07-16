# SwipeLog Google Play Data safety draft

This document is a code-based preparation aid. The account owner must confirm the final answers in Play Console against the production Firebase, analytics, crash-reporting, hosting, and retention configuration.

## Security and deletion

- Data is encrypted in transit using HTTPS/TLS through Firebase, TMDB, and other configured service providers.
- Users can request deletion inside the app from Profile settings.
- A public web deletion-request path is required before closed or production testing.
- Users can export a JSON copy of their profile and activity data from the app.

## Data collected

| Play data category | Examples in SwipeLog | Purpose | Required |
| --- | --- | --- | --- |
| Personal info — email address | Firebase Auth email | Account management, authentication, security | Yes |
| Personal info — name and user ID | Display name, username, Firebase UID | Profile, friends, shared watchlists | Profile fields optional |
| Photos | Optional profile image selected by the user | Profile customization and social features | No |
| App activity — app interactions | Screen and feature events, coarse action/result fields | Analytics, product improvement | Analytics should be disclosed as collected |
| App activity — other user-generated content | Ratings, notes, diary entries, lists, votes | Core movie diary and social functionality | Optional |
| Device or other identifiers | Firebase Analytics app/device identifiers | Analytics and fraud/abuse protection where provided by Firebase | Analytics-dependent |
| Files and documents | Letterboxd ZIP/CSV selected by the user | One-time import | No; processed on device unless implementation changes |

## User-directed sharing

The following may be visible to other users when the user chooses social features:

- Public profile name, username, bio, avatar, favorite films, and profile statistics
- Shared-watchlist membership, suggestions, votes, and watched state
- Activity intentionally published through profile and friendship features

These disclosures are user-directed product functionality and must still be described clearly in the privacy policy.

## Third-party processing

- Google Firebase: authentication, Firestore cloud sync, Analytics, and related infrastructure
- TMDB: movie search, metadata, images, recommendations, ratings, and watch-provider lookup
- JustWatch: source of streaming availability data delivered through TMDB
- Expo/EAS: application build and delivery infrastructure; production runtime processing depends on enabled Expo services
- Sentry: package is present but production collection must be declared only if a DSN is enabled

## Data not permitted in analytics

The analytics wrapper blocks sensitive raw fields including email, username, bio, name, notes, search queries, profile URLs, list names, and friend identifiers. Release QA must verify that new analytics events continue to follow this rule.

## Play Console declarations still requiring owner confirmation

- Whether analytics collection is optional or always enabled in the production build
- Final privacy-policy and deletion-request URLs
- Data-retention period after an account deletion request
- Whether any advertising SDK or ad-supported business model will be introduced
- Whether Sentry is enabled in production
- Intended target age group
- Whether the developer account is personal or organization-owned

